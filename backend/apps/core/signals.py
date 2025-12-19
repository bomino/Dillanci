"""
Signal handlers for creating notifications on procurement events.

These signals listen to model changes and create appropriate notifications
for users who need to take action or be informed of changes.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.core.models import Notification

logger = logging.getLogger(__name__)


# =============================================================================
# Notification Email Signal Handler
# =============================================================================

@receiver(post_save, sender=Notification)
def queue_notification_email(sender, instance, created, **kwargs):
    """
    Queue an email task when a new notification is created.

    This signal handler fires after any Notification is saved.
    If the notification is newly created, it queues a Celery task
    to send an email (respecting user preferences).
    """
    if not created:
        # Only queue emails for new notifications
        return

    # Import here to avoid circular imports
    from apps.core.tasks import send_notification_email

    try:
        # Queue the email task asynchronously
        send_notification_email.delay(str(instance.id))
        logger.debug(f"Email task queued for notification {instance.id}")
    except Exception as e:
        # Log but don't fail - the notification is still created
        logger.error(f"Failed to queue email task for notification {instance.id}: {e}")


def notify_approvers_for_requisition(requisition):
    """
    Notify users who can approve a requisition when it's submitted.
    """
    from apps.users.models import User, Permissions

    # Find users with requisition approval permission in the same organization
    approvers = User.objects.filter(
        organization=requisition.organization,
        status='ACTIVE',
        is_active=True
    ).exclude(id=requisition.requester_id)

    # Filter to those with approval permission
    approving_users = [
        user for user in approvers
        if user.has_permission(Permissions.REQUISITION_APPROVE)
    ]

    Notification.notify_users(
        users=approving_users,
        notification_type='APPROVAL_REQUIRED',
        title='Requisition Awaiting Approval',
        message=f'{requisition.number} "{requisition.title}" (${requisition.total_amount:,.2f}) requires your approval.',
        priority='HIGH',
        related_object_type='requisition',
        related_object_id=requisition.id,
        link=f'/requisitions/{requisition.id}',
        metadata={
            'requisition_number': requisition.number,
            'amount': str(requisition.total_amount),
            'requester': requisition.requester.full_name if requisition.requester else None,
        }
    )


def notify_requester_of_approval(requisition, approved=True):
    """
    Notify the requester when their requisition is approved or rejected.
    """
    if not requisition.requester:
        return

    if approved:
        Notification.create_notification(
            user=requisition.requester,
            notification_type='APPROVAL_COMPLETED',
            title='Requisition Approved',
            message=f'Your requisition {requisition.number} "{requisition.title}" has been approved.',
            priority='NORMAL',
            related_object_type='requisition',
            related_object_id=requisition.id,
            link=f'/requisitions/{requisition.id}',
        )
    else:
        Notification.create_notification(
            user=requisition.requester,
            notification_type='APPROVAL_REJECTED',
            title='Requisition Rejected',
            message=f'Your requisition {requisition.number} "{requisition.title}" has been rejected.',
            priority='HIGH',
            related_object_type='requisition',
            related_object_id=requisition.id,
            link=f'/requisitions/{requisition.id}',
        )


def notify_approvers_for_po(purchase_order):
    """
    Notify users who can approve a PO when it's submitted.
    """
    from apps.users.models import User, Permissions

    approvers = User.objects.filter(
        organization=purchase_order.organization,
        status='ACTIVE',
        is_active=True
    ).exclude(id=purchase_order.created_by_id)

    approving_users = [
        user for user in approvers
        if user.has_permission(Permissions.PO_APPROVE)
    ]

    Notification.notify_users(
        users=approving_users,
        notification_type='APPROVAL_REQUIRED',
        title='Purchase Order Awaiting Approval',
        message=f'{purchase_order.number} for {purchase_order.supplier.name} (${purchase_order.total_amount:,.2f}) requires your approval.',
        priority='HIGH',
        related_object_type='purchase_order',
        related_object_id=purchase_order.id,
        link=f'/purchase-orders/{purchase_order.id}',
        metadata={
            'po_number': purchase_order.number,
            'amount': str(purchase_order.total_amount),
            'supplier': purchase_order.supplier.name,
        }
    )


def notify_creator_of_po_approval(purchase_order, approved=True):
    """
    Notify the PO creator when it's approved or rejected.
    """
    if not purchase_order.created_by:
        return

    if approved:
        Notification.create_notification(
            user=purchase_order.created_by,
            notification_type='APPROVAL_COMPLETED',
            title='Purchase Order Approved',
            message=f'Your purchase order {purchase_order.number} has been approved.',
            priority='NORMAL',
            related_object_type='purchase_order',
            related_object_id=purchase_order.id,
            link=f'/purchase-orders/{purchase_order.id}',
        )
    else:
        Notification.create_notification(
            user=purchase_order.created_by,
            notification_type='APPROVAL_REJECTED',
            title='Purchase Order Rejected',
            message=f'Your purchase order {purchase_order.number} has been rejected.',
            priority='HIGH',
            related_object_type='purchase_order',
            related_object_id=purchase_order.id,
            link=f'/purchase-orders/{purchase_order.id}',
        )


def notify_bid_received(rfq, bid):
    """
    Notify the RFQ owner when a new bid is received.
    """
    if not rfq.created_by:
        return

    Notification.create_notification(
        user=rfq.created_by,
        notification_type='BID_RECEIVED',
        title='New Bid Submitted',
        message=f'{bid.supplier.name} submitted a bid of ${bid.total_amount:,.2f} for {rfq.number}.',
        priority='NORMAL',
        related_object_type='rfq',
        related_object_id=rfq.id,
        link=f'/rfqs/{rfq.id}',
        metadata={
            'rfq_number': rfq.number,
            'supplier': bid.supplier.name,
            'amount': str(bid.total_amount),
        }
    )


def notify_goods_received(goods_receipt):
    """
    Notify relevant users when goods are received.
    """
    from apps.users.models import User, Permissions

    # Notify AP team and PO creator
    if goods_receipt.purchase_order and goods_receipt.purchase_order.created_by:
        Notification.create_notification(
            user=goods_receipt.purchase_order.created_by,
            notification_type='GOODS_RECEIVED',
            title='Goods Receipt Posted',
            message=f'{goods_receipt.number} posted for PO {goods_receipt.purchase_order.number}. Ready for invoice matching.',
            priority='LOW',
            related_object_type='goods_receipt',
            related_object_id=goods_receipt.id,
            link=f'/receiving/{goods_receipt.id}',
        )


def notify_invoice_matched(invoice):
    """
    Notify AP team when an invoice passes 3-way matching.
    """
    from apps.users.models import User, Permissions

    if not invoice.created_by:
        return

    Notification.create_notification(
        user=invoice.created_by,
        notification_type='INVOICE_MATCHED',
        title='Invoice Matched Successfully',
        message=f'Invoice {invoice.number} passed 3-way matching and is ready for approval.',
        priority='NORMAL',
        related_object_type='invoice',
        related_object_id=invoice.id,
        link=f'/invoices/{invoice.id}',
    )


def notify_contract_expiring(contract, days_until_expiry):
    """
    Notify contract managers when a contract is expiring soon.
    """
    from apps.users.models import User, Permissions

    if not contract.created_by:
        return

    priority = 'URGENT' if days_until_expiry <= 7 else 'HIGH' if days_until_expiry <= 30 else 'NORMAL'

    Notification.create_notification(
        user=contract.created_by,
        notification_type='CONTRACT_EXPIRING',
        title='Contract Expiring Soon',
        message=f'Contract {contract.number} with {contract.supplier.name} expires in {days_until_expiry} days. Consider renewal.',
        priority=priority,
        related_object_type='contract',
        related_object_id=contract.id,
        link=f'/contracts/{contract.id}',
        metadata={
            'contract_number': contract.number,
            'supplier': contract.supplier.name,
            'days_until_expiry': days_until_expiry,
        }
    )


# =============================================================================
# Helper function to create sample notifications for testing
# =============================================================================

def create_sample_notifications(user):
    """
    Create sample notifications for a user (useful for testing/demo).
    """
    from datetime import timedelta
    from django.utils import timezone

    samples = [
        {
            'type': 'APPROVAL_REQUIRED',
            'title': 'Requisition Awaiting Approval',
            'message': 'REQ-2025-001 for Office Supplies ($2,500) requires your approval.',
            'priority': 'HIGH',
            'related_object_type': 'requisition',
            'link': '/requisitions',
        },
        {
            'type': 'BID_RECEIVED',
            'title': 'New Bid Submitted',
            'message': 'Acme Corp submitted a bid of $45,000 for RFQ-2025-042.',
            'priority': 'NORMAL',
            'related_object_type': 'rfq',
            'link': '/rfqs',
        },
        {
            'type': 'APPROVAL_COMPLETED',
            'title': 'Purchase Order Approved',
            'message': 'PO-2025-089 for IT Equipment has been approved by Finance Manager.',
            'priority': 'NORMAL',
            'related_object_type': 'purchase_order',
            'link': '/purchase-orders',
        },
        {
            'type': 'CONTRACT_EXPIRING',
            'title': 'Contract Expiring Soon',
            'message': 'Contract with TechSupply Inc expires in 30 days. Consider renewal.',
            'priority': 'HIGH',
            'related_object_type': 'contract',
            'link': '/contracts',
        },
        {
            'type': 'GOODS_RECEIVED',
            'title': 'Goods Receipt Posted',
            'message': 'GR-2025-156 posted for PO-2025-078. Ready for invoice matching.',
            'priority': 'LOW',
            'related_object_type': 'goods_receipt',
            'link': '/receiving',
        },
    ]

    notifications = []
    for i, sample in enumerate(samples):
        # Stagger creation times
        created_at = timezone.now() - timedelta(hours=i * 3)
        notification = Notification.objects.create(
            user=user,
            type=sample['type'],
            title=sample['title'],
            message=sample['message'],
            priority=sample['priority'],
            related_object_type=sample.get('related_object_type'),
            link=sample.get('link'),
            status='UNREAD' if i < 3 else 'READ',
            read_at=timezone.now() - timedelta(hours=1) if i >= 3 else None,
        )
        # Update created_at after creation
        Notification.objects.filter(id=notification.id).update(created_at=created_at)
        notifications.append(notification)

    return notifications
