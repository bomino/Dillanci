"""
Tests for contract Celery tasks.
"""

import pytest
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.utils import timezone

from apps.contracts.tasks import (
    check_expiring_contracts,
    auto_expire_contracts,
    update_contract_utilization_alerts,
    _should_send_renewal_alert,
)

from tests.factories import (
    ActiveContractFactory,
    ContractFactory,
    ContractSpendFactory,
    ExpiringContractFactory,
    OrganizationFactory,
    NotificationFactory,
    SentPOFactory,
)


@pytest.mark.django_db
class TestCheckExpiringContracts:
    """Tests for check_expiring_contracts task."""

    @patch('apps.core.tasks.send_notification_email')
    def test_check_expiring_contracts_no_expiring(self, mock_send_email):
        """Should not send alerts when no contracts are expiring."""
        # Create a contract that expires far in the future
        contract = ActiveContractFactory(
            end_date=timezone.now().date() + timedelta(days=365),
            renewal_notice_days=30,
        )

        result = check_expiring_contracts()

        assert result['alerts_sent'] == 0
        mock_send_email.delay.assert_not_called()

    @patch('apps.core.tasks.send_notification_email')
    def test_check_expiring_contracts_with_expiring(self, mock_send_email):
        """Should send alerts for expiring contracts."""
        # Create an expiring contract
        contract = ExpiringContractFactory(
            end_date=timezone.now().date() + timedelta(days=15),
            renewal_notice_days=30,
            last_renewal_alert_sent=None,
        )

        result = check_expiring_contracts()

        assert result['alerts_sent'] == 1
        # Email is called at least once (may be called multiple times due to signal + task)
        assert mock_send_email.delay.call_count >= 1

        # Check notification was created
        from apps.core.models import Notification
        notification = Notification.objects.filter(
            type='CONTRACT_EXPIRING',
            related_object_id=contract.id,
        ).first()
        assert notification is not None
        assert contract.number in notification.title

    @patch('apps.core.tasks.send_notification_email')
    def test_check_expiring_contracts_skips_already_alerted(self, mock_send_email):
        """Should skip contracts that were recently alerted."""
        contract = ExpiringContractFactory(
            end_date=timezone.now().date() + timedelta(days=15),
            renewal_notice_days=30,
            last_renewal_alert_sent=timezone.now() - timedelta(days=3),  # Alerted 3 days ago
        )

        result = check_expiring_contracts()

        assert result['alerts_sent'] == 0
        mock_send_email.delay.assert_not_called()

    @patch('apps.core.tasks.send_notification_email')
    def test_check_expiring_contracts_urgent_priority(self, mock_send_email):
        """Should set URGENT priority for contracts expiring within 7 days."""
        contract = ExpiringContractFactory(
            end_date=timezone.now().date() + timedelta(days=5),
            renewal_notice_days=30,
            last_renewal_alert_sent=None,
        )

        check_expiring_contracts()

        from apps.core.models import Notification
        notification = Notification.objects.filter(
            type='CONTRACT_EXPIRING',
            related_object_id=contract.id,
        ).first()
        assert notification.priority == 'URGENT'


@pytest.mark.django_db
class TestAutoExpireContracts:
    """Tests for auto_expire_contracts task."""

    def test_auto_expire_contracts_past_end_date(self):
        """Should expire contracts past their end date."""
        contract = ActiveContractFactory(
            end_date=timezone.now().date() - timedelta(days=1),  # Ended yesterday
        )

        result = auto_expire_contracts()

        assert result['contracts_expired'] == 1
        contract.refresh_from_db()
        assert contract.status == 'EXPIRED'

    def test_auto_expire_contracts_future_end_date(self):
        """Should not expire contracts with future end date."""
        contract = ActiveContractFactory(
            end_date=timezone.now().date() + timedelta(days=30),
        )

        result = auto_expire_contracts()

        assert result['contracts_expired'] == 0
        contract.refresh_from_db()
        assert contract.status == 'ACTIVE'

    def test_auto_expire_contracts_already_expired(self):
        """Should not affect already expired contracts."""
        from apps.contracts.models import Contract

        contract = ActiveContractFactory(
            end_date=timezone.now().date() - timedelta(days=1),
        )
        contract.status = 'EXPIRED'
        contract.save()

        result = auto_expire_contracts()

        # Contract should not be counted since it's already expired
        assert result['contracts_expired'] == 0


@pytest.mark.django_db
class TestUpdateContractUtilizationAlerts:
    """Tests for update_contract_utilization_alerts task."""

    @patch('apps.core.tasks.send_notification_email')
    def test_update_utilization_alerts_critical(self, mock_send_email):
        """Should send URGENT alert when utilization >= 95%."""
        contract = ActiveContractFactory(
            total_value=Decimal('10000.00'),
        )
        # Create spend to reach 96% utilization
        po = SentPOFactory(
            organization=contract.organization,
            supplier=contract.supplier,
        )
        ContractSpendFactory(
            contract=contract,
            purchase_order=po,
            amount=Decimal('9600.00'),
        )

        result = update_contract_utilization_alerts()

        assert result['alerts_sent'] == 1
        from apps.core.models import Notification
        notification = Notification.objects.filter(
            type='BUDGET_ALERT',
            related_object_id=contract.id,
        ).first()
        assert notification is not None
        assert notification.priority == 'URGENT'
        assert 'Nearly Exhausted' in notification.title

    @patch('apps.core.tasks.send_notification_email')
    def test_update_utilization_alerts_warning(self, mock_send_email):
        """Should send HIGH alert when utilization >= 80%."""
        contract = ActiveContractFactory(
            total_value=Decimal('10000.00'),
        )
        # Create spend to reach 85% utilization
        po = SentPOFactory(
            organization=contract.organization,
            supplier=contract.supplier,
        )
        ContractSpendFactory(
            contract=contract,
            purchase_order=po,
            amount=Decimal('8500.00'),
        )

        result = update_contract_utilization_alerts()

        assert result['alerts_sent'] == 1
        from apps.core.models import Notification
        notification = Notification.objects.filter(
            type='BUDGET_ALERT',
            related_object_id=contract.id,
        ).first()
        assert notification is not None
        assert notification.priority == 'HIGH'
        assert 'High Utilization' in notification.title

    @patch('apps.core.tasks.send_notification_email')
    def test_update_utilization_alerts_below_threshold(self, mock_send_email):
        """Should not send alerts when utilization < 80%."""
        contract = ActiveContractFactory(
            total_value=Decimal('10000.00'),
        )
        # Create spend to reach 50% utilization
        po = SentPOFactory(
            organization=contract.organization,
            supplier=contract.supplier,
        )
        ContractSpendFactory(
            contract=contract,
            purchase_order=po,
            amount=Decimal('5000.00'),
        )

        result = update_contract_utilization_alerts()

        assert result['alerts_sent'] == 0
        mock_send_email.delay.assert_not_called()

    @patch('apps.core.tasks.send_notification_email')
    def test_update_utilization_alerts_skips_recent_alert(self, mock_send_email):
        """Should skip sending if alert was sent within 7 days."""
        contract = ActiveContractFactory(
            total_value=Decimal('10000.00'),
        )
        # Create spend to reach 95% utilization
        po = SentPOFactory(
            organization=contract.organization,
            supplier=contract.supplier,
        )
        ContractSpendFactory(
            contract=contract,
            purchase_order=po,
            amount=Decimal('9500.00'),
        )

        # Create a recent notification
        NotificationFactory(
            user=contract.created_by,
            type='BUDGET_ALERT',
            related_object_type='contract',
            related_object_id=contract.id,
            created_at=timezone.now() - timedelta(days=3),  # 3 days ago
        )

        result = update_contract_utilization_alerts()

        assert result['alerts_sent'] == 0


class TestShouldSendRenewalAlert:
    """Tests for _should_send_renewal_alert helper function."""

    def test_should_send_alert_never_sent(self):
        """Should return True if no alert was ever sent."""
        contract = MagicMock()
        contract.last_renewal_alert_sent = None
        contract.days_until_expiry = 15

        assert _should_send_renewal_alert(contract) is True

    def test_should_send_alert_critical_period_daily(self):
        """Should return True if in critical period and 1+ days since last alert."""
        contract = MagicMock()
        contract.last_renewal_alert_sent = timezone.now() - timedelta(days=1)
        contract.days_until_expiry = 5  # Critical period

        assert _should_send_renewal_alert(contract) is True

    def test_should_not_send_alert_critical_period_same_day(self):
        """Should return False if in critical period but alert sent today."""
        contract = MagicMock()
        contract.last_renewal_alert_sent = timezone.now() - timedelta(hours=12)
        contract.days_until_expiry = 5  # Critical period

        assert _should_send_renewal_alert(contract) is False

    def test_should_send_alert_normal_period_weekly(self):
        """Should return True if in normal period and 7+ days since last alert."""
        contract = MagicMock()
        contract.last_renewal_alert_sent = timezone.now() - timedelta(days=8)
        contract.days_until_expiry = 20  # Normal period

        assert _should_send_renewal_alert(contract) is True

    def test_should_not_send_alert_normal_period_recent(self):
        """Should return False if in normal period but alert sent within 7 days."""
        contract = MagicMock()
        contract.last_renewal_alert_sent = timezone.now() - timedelta(days=3)
        contract.days_until_expiry = 20  # Normal period

        assert _should_send_renewal_alert(contract) is False
