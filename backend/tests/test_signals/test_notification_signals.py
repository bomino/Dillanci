"""
Tests for notification signals.
"""

import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.utils import timezone

from apps.core.signals import (
    queue_notification_email,
    notify_approvers_for_requisition,
    notify_requester_of_approval,
    notify_approvers_for_po,
    notify_creator_of_po_approval,
    notify_bid_received,
    notify_goods_received,
    notify_invoice_matched,
    notify_contract_expiring,
    create_sample_notifications,
)
from apps.core.models import Notification

from tests.factories import (
    ActiveContractFactory,
    ApprovedPOFactory,
    DraftRequisitionFactory,
    GoodsReceiptFactory,
    InvoiceFactory,
    NotificationFactory,
    PurchaseOrderFactory,
    RequisitionFactory,
    SubmittedRequisitionFactory,
    SupplierFactory,
    UserFactory,
)


@pytest.mark.django_db
class TestQueueNotificationEmail:
    """Tests for queue_notification_email signal handler."""

    @patch('apps.core.tasks.send_notification_email')
    def test_queues_email_on_create(self, mock_send_email):
        """Should queue email task when notification is created."""
        # Create a notification - this triggers the signal
        notification = NotificationFactory()

        mock_send_email.delay.assert_called_once_with(str(notification.id))

    @patch('apps.core.tasks.send_notification_email')
    def test_does_not_queue_on_update(self, mock_send_email):
        """Should not queue email task when notification is updated."""
        notification = NotificationFactory()
        mock_send_email.delay.reset_mock()

        # Update the notification
        notification.status = 'READ'
        notification.save()

        mock_send_email.delay.assert_not_called()


@pytest.mark.django_db
class TestNotifyApproversForRequisition:
    """Tests for notify_approvers_for_requisition function."""

    @patch('apps.core.tasks.send_notification_email')
    def test_notifies_approvers(self, mock_send_email):
        """Should create notifications for approvers."""
        from apps.users.models import Role, RolePresets, UserRole, Permissions

        requisition = SubmittedRequisitionFactory()

        # Create a user with approval permission
        approver = UserFactory(organization=requisition.organization)

        # Create a role with requisition approval permission
        role = Role.objects.create(
            organization=requisition.organization,
            name='Approver',
            code='APPROVER',
        )
        role.permissions = RolePresets.PROCUREMENT_MANAGER['permissions']
        role.save()

        # Assign role to user
        UserRole.objects.create(
            user=approver,
            role=role,
        )

        notify_approvers_for_requisition(requisition)

        # Check notification was created
        notification = Notification.objects.filter(
            user=approver,
            type='APPROVAL_REQUIRED',
            related_object_type='requisition',
            related_object_id=requisition.id,
        ).first()
        assert notification is not None
        assert requisition.number in notification.message

    @patch('apps.core.tasks.send_notification_email')
    def test_excludes_requester(self, mock_send_email):
        """Should not notify the requester themselves."""
        from apps.users.models import Role, RolePresets, UserRole

        requisition = SubmittedRequisitionFactory()

        # Give the requester approval permission
        role = Role.objects.create(
            organization=requisition.organization,
            name='Approver',
            code='APPROVER',
        )
        role.permissions = RolePresets.PROCUREMENT_MANAGER['permissions']
        role.save()

        UserRole.objects.create(
            user=requisition.requester,
            role=role,
        )

        notify_approvers_for_requisition(requisition)

        # Requester should not receive notification
        notification = Notification.objects.filter(
            user=requisition.requester,
            type='APPROVAL_REQUIRED',
            related_object_id=requisition.id,
        ).first()
        assert notification is None


@pytest.mark.django_db
class TestNotifyRequesterOfApproval:
    """Tests for notify_requester_of_approval function."""

    @patch('apps.core.tasks.send_notification_email')
    def test_notifies_on_approval(self, mock_send_email):
        """Should notify requester when requisition is approved."""
        requisition = SubmittedRequisitionFactory()

        notify_requester_of_approval(requisition, approved=True)

        notification = Notification.objects.filter(
            user=requisition.requester,
            type='APPROVAL_COMPLETED',
            related_object_id=requisition.id,
        ).first()
        assert notification is not None
        assert 'Approved' in notification.title

    @patch('apps.core.tasks.send_notification_email')
    def test_notifies_on_rejection(self, mock_send_email):
        """Should notify requester when requisition is rejected."""
        requisition = SubmittedRequisitionFactory()

        notify_requester_of_approval(requisition, approved=False)

        notification = Notification.objects.filter(
            user=requisition.requester,
            type='APPROVAL_REJECTED',
            related_object_id=requisition.id,
        ).first()
        assert notification is not None
        assert 'Rejected' in notification.title
        assert notification.priority == 'HIGH'

    @patch('apps.core.tasks.send_notification_email')
    def test_handles_no_requester(self, mock_send_email):
        """Should handle requisition with no requester gracefully."""
        # Create a mock requisition with no requester to test the guard clause
        mock_requisition = MagicMock()
        mock_requisition.requester = None

        # Should not raise an exception
        notify_requester_of_approval(mock_requisition, approved=True)


@pytest.mark.django_db
class TestNotifyApproversForPO:
    """Tests for notify_approvers_for_po function."""

    @patch('apps.core.tasks.send_notification_email')
    def test_notifies_approvers(self, mock_send_email):
        """Should create notifications for PO approvers."""
        from apps.users.models import Role, RolePresets, UserRole

        po = PurchaseOrderFactory(status='SUBMITTED')

        # Create a user with PO approval permission
        approver = UserFactory(organization=po.organization)

        role = Role.objects.create(
            organization=po.organization,
            name='Approver',
            code='APPROVER',
        )
        role.permissions = RolePresets.PROCUREMENT_MANAGER['permissions']
        role.save()

        UserRole.objects.create(
            user=approver,
            role=role,
        )

        notify_approvers_for_po(po)

        notification = Notification.objects.filter(
            user=approver,
            type='APPROVAL_REQUIRED',
            related_object_type='purchase_order',
            related_object_id=po.id,
        ).first()
        assert notification is not None
        assert po.number in notification.message


@pytest.mark.django_db
class TestNotifyCreatorOfPOApproval:
    """Tests for notify_creator_of_po_approval function."""

    @patch('apps.core.tasks.send_notification_email')
    def test_notifies_on_approval(self, mock_send_email):
        """Should notify creator when PO is approved."""
        po = PurchaseOrderFactory(status='SUBMITTED')

        notify_creator_of_po_approval(po, approved=True)

        notification = Notification.objects.filter(
            user=po.created_by,
            type='APPROVAL_COMPLETED',
            related_object_id=po.id,
        ).first()
        assert notification is not None
        assert 'Approved' in notification.title

    @patch('apps.core.tasks.send_notification_email')
    def test_notifies_on_rejection(self, mock_send_email):
        """Should notify creator when PO is rejected."""
        po = PurchaseOrderFactory(status='SUBMITTED')

        notify_creator_of_po_approval(po, approved=False)

        notification = Notification.objects.filter(
            user=po.created_by,
            type='APPROVAL_REJECTED',
            related_object_id=po.id,
        ).first()
        assert notification is not None
        assert 'Rejected' in notification.title


@pytest.mark.django_db
class TestNotifyBidReceived:
    """Tests for notify_bid_received function."""

    @patch('apps.core.tasks.send_notification_email')
    def test_notifies_rfq_owner(self, mock_send_email):
        """Should notify RFQ owner when bid is received."""
        from apps.rfqs.models import RFQ, Bid

        user = UserFactory()
        supplier = SupplierFactory(organization=user.organization)

        # Create RFQ
        rfq = RFQ.objects.create(
            organization=user.organization,
            created_by=user,
            title='Test RFQ',
            status='PUBLISHED',
        )

        # Create mock bid
        bid = MagicMock()
        bid.supplier = supplier
        bid.total_amount = Decimal('5000.00')

        notify_bid_received(rfq, bid)

        notification = Notification.objects.filter(
            user=user,
            type='BID_RECEIVED',
            related_object_type='rfq',
            related_object_id=rfq.id,
        ).first()
        assert notification is not None
        assert supplier.name in notification.message


@pytest.mark.django_db
class TestNotifyGoodsReceived:
    """Tests for notify_goods_received function."""

    @patch('apps.core.tasks.send_notification_email')
    def test_notifies_po_creator(self, mock_send_email):
        """Should notify PO creator when goods are received."""
        po = PurchaseOrderFactory(status='SENT')
        gr = GoodsReceiptFactory(purchase_order=po)

        notify_goods_received(gr)

        notification = Notification.objects.filter(
            user=po.created_by,
            type='GOODS_RECEIVED',
            related_object_type='goods_receipt',
            related_object_id=gr.id,
        ).first()
        assert notification is not None
        assert po.number in notification.message


@pytest.mark.django_db
class TestNotifyInvoiceMatched:
    """Tests for notify_invoice_matched function."""

    @patch('apps.core.tasks.send_notification_email')
    def test_notifies_invoice_creator(self, mock_send_email):
        """Should notify creator when invoice is matched."""
        invoice = InvoiceFactory(status='MATCHED')

        notify_invoice_matched(invoice)

        notification = Notification.objects.filter(
            user=invoice.created_by,
            type='INVOICE_MATCHED',
            related_object_type='invoice',
            related_object_id=invoice.id,
        ).first()
        assert notification is not None
        assert 'Matched Successfully' in notification.title


@pytest.mark.django_db
class TestNotifyContractExpiring:
    """Tests for notify_contract_expiring function."""

    @patch('apps.core.tasks.send_notification_email')
    def test_notifies_contract_creator(self, mock_send_email):
        """Should notify creator when contract is expiring."""
        contract = ActiveContractFactory()

        notify_contract_expiring(contract, days_until_expiry=30)

        notification = Notification.objects.filter(
            user=contract.created_by,
            type='CONTRACT_EXPIRING',
            related_object_type='contract',
            related_object_id=contract.id,
        ).first()
        assert notification is not None
        assert '30 days' in notification.message

    @patch('apps.core.tasks.send_notification_email')
    def test_sets_urgent_priority_for_week(self, mock_send_email):
        """Should set URGENT priority for contracts expiring within 7 days."""
        contract = ActiveContractFactory()

        notify_contract_expiring(contract, days_until_expiry=5)

        notification = Notification.objects.filter(
            user=contract.created_by,
            type='CONTRACT_EXPIRING',
            related_object_id=contract.id,
        ).first()
        assert notification.priority == 'URGENT'

    @patch('apps.core.tasks.send_notification_email')
    def test_sets_high_priority_for_month(self, mock_send_email):
        """Should set HIGH priority for contracts expiring within 30 days."""
        contract = ActiveContractFactory()

        notify_contract_expiring(contract, days_until_expiry=20)

        notification = Notification.objects.filter(
            user=contract.created_by,
            type='CONTRACT_EXPIRING',
            related_object_id=contract.id,
        ).first()
        assert notification.priority == 'HIGH'


@pytest.mark.django_db
class TestCreateSampleNotifications:
    """Tests for create_sample_notifications function."""

    @patch('apps.core.tasks.send_notification_email')
    def test_creates_sample_notifications(self, mock_send_email):
        """Should create sample notifications for testing."""
        user = UserFactory()

        notifications = create_sample_notifications(user)

        assert len(notifications) == 5
        assert all(n.user == user for n in notifications)

        # Check that different types were created
        types = {n.type for n in notifications}
        assert 'APPROVAL_REQUIRED' in types
        assert 'BID_RECEIVED' in types
        assert 'CONTRACT_EXPIRING' in types

    @patch('apps.core.tasks.send_notification_email')
    def test_staggers_creation_times(self, mock_send_email):
        """Should stagger creation times for sample notifications."""
        user = UserFactory()

        notifications = create_sample_notifications(user)

        # Refresh from DB to get actual created_at values
        notification_ids = [n.id for n in notifications]
        db_notifications = list(
            Notification.objects.filter(id__in=notification_ids).order_by('created_at')
        )

        # Check that creation times are different
        times = [n.created_at for n in db_notifications]
        assert len(set(times)) > 1  # Not all the same time

    @patch('apps.core.tasks.send_notification_email')
    def test_marks_some_as_read(self, mock_send_email):
        """Should mark some sample notifications as read."""
        user = UserFactory()

        notifications = create_sample_notifications(user)

        # Refresh from DB
        notification_ids = [n.id for n in notifications]
        db_notifications = list(Notification.objects.filter(id__in=notification_ids))

        read_count = sum(1 for n in db_notifications if n.status == 'READ')
        unread_count = sum(1 for n in db_notifications if n.status == 'UNREAD')

        assert read_count > 0
        assert unread_count > 0
