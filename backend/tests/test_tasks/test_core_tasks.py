"""
Tests for core Celery tasks.
"""

import pytest
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.utils import timezone

from apps.core.tasks import (
    send_notification_email,
    send_portal_invitation_email,
    send_daily_digest,
    send_weekly_digest,
    _build_email_context,
    _get_template_for_notification_type,
)

from tests.factories import (
    NotificationFactory,
    PortalInvitationFactory,
    UserFactory,
)


@pytest.mark.django_db
class TestSendNotificationEmail:
    """Tests for send_notification_email task."""

    def test_send_email_notification_not_found(self):
        """Should return skipped status when notification not found."""
        result = send_notification_email('00000000-0000-0000-0000-000000000000')

        assert result['status'] == 'skipped'
        assert result['reason'] == 'notification_not_found'

    @patch('apps.core.tasks.send_mail')
    @patch('apps.core.tasks.render_to_string')
    def test_send_email_success(self, mock_render, mock_send):
        """Should send email successfully."""
        notification = NotificationFactory(type='APPROVAL_REQUIRED')
        mock_render.return_value = '<html>Test email</html>'

        result = send_notification_email(str(notification.id))

        assert result['status'] == 'sent'
        assert result['recipient'] == notification.user.email
        mock_send.assert_called_once()
        notification.refresh_from_db()
        assert notification.email_sent is True
        assert notification.email_sent_at is not None

    @patch('apps.core.tasks.send_mail')
    @patch('apps.core.tasks.render_to_string')
    def test_send_email_updates_notification(self, mock_render, mock_send):
        """Should update notification record after sending."""
        notification = NotificationFactory(type='BID_RECEIVED')
        mock_render.return_value = '<html>Test</html>'

        send_notification_email(str(notification.id))

        notification.refresh_from_db()
        assert notification.email_sent is True
        assert notification.email_sent_at is not None
        assert notification.email_error == ''

    @patch('apps.core.tasks.send_mail')
    @patch('apps.core.tasks.render_to_string')
    def test_send_email_no_template(self, mock_render, mock_send):
        """Should skip when no template for notification type."""
        notification = NotificationFactory(type='UNKNOWN_TYPE')

        result = send_notification_email(str(notification.id))

        assert result['status'] == 'skipped'
        assert result['reason'] == 'no_template'
        mock_send.assert_not_called()

    @patch('apps.core.tasks.send_mail')
    @patch('apps.core.tasks.render_to_string')
    def test_send_email_with_user_preferences_disabled(self, mock_render, mock_send):
        """Should skip when user has disabled email preference."""
        from apps.users.models import UserEmailPreference

        user = UserFactory()
        notification = NotificationFactory(
            user=user,
            type='APPROVAL_REQUIRED',
        )

        # Create preference that disables this type
        pref = UserEmailPreference.objects.create(
            user=user,
            digest_frequency='NONE',
        )

        result = send_notification_email(str(notification.id))

        assert result['status'] == 'skipped'
        mock_send.assert_not_called()


@pytest.mark.django_db
class TestSendPortalInvitationEmail:
    """Tests for send_portal_invitation_email task."""

    def test_invitation_not_found(self):
        """Should return skipped status when invitation not found."""
        result = send_portal_invitation_email('00000000-0000-0000-0000-000000000000')

        assert result['status'] == 'skipped'
        assert result['reason'] == 'invitation_not_found'

    @patch('apps.core.tasks.send_mail')
    @patch('apps.core.tasks.render_to_string')
    def test_send_invitation_email_success(self, mock_render, mock_send):
        """Should send invitation email successfully."""
        invitation = PortalInvitationFactory()
        mock_render.return_value = '<html>Invitation</html>'

        result = send_portal_invitation_email(str(invitation.id))

        assert result['status'] == 'sent'
        assert result['recipient'] == invitation.email
        mock_send.assert_called_once()

    @patch('apps.core.tasks.send_mail')
    @patch('apps.core.tasks.render_to_string')
    def test_send_invitation_email_failure(self, mock_render, mock_send):
        """Should return failed status on email error."""
        invitation = PortalInvitationFactory()
        mock_render.return_value = '<html>Invitation</html>'
        mock_send.side_effect = Exception('SMTP error')

        result = send_portal_invitation_email(str(invitation.id))

        assert result['status'] == 'failed'
        assert 'error' in result


@pytest.mark.django_db
class TestSendDailyDigest:
    """Tests for send_daily_digest task."""

    @patch('apps.core.tasks._send_digest_email')
    def test_send_daily_digest_no_users(self, mock_send_digest):
        """Should complete without sending when no users have daily preference."""
        send_daily_digest()

        mock_send_digest.assert_not_called()

    @patch('apps.core.tasks._send_digest_email')
    def test_send_daily_digest_with_users(self, mock_send_digest):
        """Should send digest to users with daily preference."""
        from apps.users.models import UserEmailPreference

        user = UserFactory()
        UserEmailPreference.objects.create(
            user=user,
            digest_frequency='DAILY',
        )

        # Create a notification from yesterday that hasn't been emailed
        yesterday = timezone.now() - timedelta(hours=12)
        NotificationFactory(
            user=user,
            created_at=yesterday,
            email_sent=False,
            status='UNREAD',
        )

        send_daily_digest()

        mock_send_digest.assert_called_once()


@pytest.mark.django_db
class TestSendWeeklyDigest:
    """Tests for send_weekly_digest task."""

    @patch('apps.core.tasks._send_digest_email')
    def test_send_weekly_digest_no_users(self, mock_send_digest):
        """Should complete without sending when no users have weekly preference."""
        send_weekly_digest()

        mock_send_digest.assert_not_called()

    @patch('apps.core.tasks._send_digest_email')
    def test_send_weekly_digest_with_users(self, mock_send_digest):
        """Should send digest to users with weekly preference."""
        from apps.users.models import UserEmailPreference

        user = UserFactory()
        UserEmailPreference.objects.create(
            user=user,
            digest_frequency='WEEKLY',
        )

        # Create notifications from this week
        NotificationFactory(
            user=user,
            created_at=timezone.now() - timedelta(days=3),
            email_sent=False,
            status='UNREAD',
        )

        send_weekly_digest()

        mock_send_digest.assert_called_once()


class TestBuildEmailContext:
    """Tests for _build_email_context helper function."""

    def test_build_email_context_basic(self):
        """Should build basic email context."""
        user = MagicMock()
        user.full_name = 'John Doe'
        user.email = 'john@example.com'

        notification = MagicMock()
        notification.user = user
        notification.type = 'APPROVAL_REQUIRED'
        notification.title = 'Test Title'
        notification.message = 'Test Message'
        notification.priority = 'HIGH'
        notification.link = '/test/link'
        notification.metadata = None

        context = _build_email_context(notification)

        assert context['recipient_name'] == 'John Doe'
        assert context['notification_type'] == 'APPROVAL_REQUIRED'
        assert context['title'] == 'Test Title'
        assert context['message'] == 'Test Message'

    def test_build_email_context_with_metadata(self):
        """Should include metadata in context."""
        user = MagicMock()
        user.full_name = 'Jane Doe'
        user.email = 'jane@example.com'

        notification = MagicMock()
        notification.user = user
        notification.type = 'CONTRACT_EXPIRING'
        notification.title = 'Contract Alert'
        notification.message = 'Contract expires soon'
        notification.priority = 'URGENT'
        notification.link = '/contracts/123'
        notification.metadata = {
            'contract_number': 'CTR-001',
            'days_until_expiry': 7,
        }

        context = _build_email_context(notification)

        assert context['contract_number'] == 'CTR-001'
        assert context['days_until_expiry'] == 7


class TestGetTemplateForNotificationType:
    """Tests for _get_template_for_notification_type helper function."""

    def test_get_template_approval_required(self):
        """Should return approval_required template."""
        template = _get_template_for_notification_type('APPROVAL_REQUIRED')
        assert template == 'approval_required'

    def test_get_template_contract_expiring(self):
        """Should return contract_expiring template."""
        template = _get_template_for_notification_type('CONTRACT_EXPIRING')
        assert template == 'contract_expiring'

    def test_get_template_bid_received(self):
        """Should return bid_received template."""
        template = _get_template_for_notification_type('BID_RECEIVED')
        assert template == 'bid_received'

    def test_get_template_unknown_type(self):
        """Should return None for unknown type."""
        template = _get_template_for_notification_type('UNKNOWN_TYPE')
        assert template is None
