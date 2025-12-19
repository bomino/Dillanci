"""
Celery tasks for core functionality including email notifications.
"""

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


# =============================================================================
# Email Notification Tasks
# =============================================================================

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_notification_email(self, notification_id: str):
    """
    Send an email notification for a given notification record.

    Args:
        notification_id: UUID of the Notification record

    This task:
    1. Fetches the notification and user
    2. Checks user email preferences
    3. Renders the appropriate email template
    4. Sends the email via configured backend
    5. Updates the notification with send status
    """
    from apps.core.models import Notification
    from apps.users.models import UserEmailPreference

    try:
        notification = Notification.objects.select_related('user').get(id=notification_id)
    except Notification.DoesNotExist:
        logger.warning(f"Notification {notification_id} not found, skipping email")
        return {'status': 'skipped', 'reason': 'notification_not_found'}

    user = notification.user

    # Check if user has email preferences and wants this type of email
    try:
        email_prefs = user.email_preferences
        if not email_prefs.should_send_email(notification.type):
            logger.info(f"User {user.email} has disabled {notification.type} emails")
            return {'status': 'skipped', 'reason': 'user_preference_disabled'}
    except UserEmailPreference.DoesNotExist:
        # No preferences set, use defaults (send emails)
        pass

    # Check digest frequency
    try:
        if user.email_preferences.digest_frequency == 'NONE':
            logger.info(f"User {user.email} has disabled all emails")
            return {'status': 'skipped', 'reason': 'digest_frequency_none'}
        # For DAILY/WEEKLY digest, we'd queue these for batch sending
        # For now, we only handle IMMEDIATE
        if user.email_preferences.digest_frequency not in ('IMMEDIATE', 'DAILY', 'WEEKLY'):
            return {'status': 'skipped', 'reason': 'non_immediate_digest'}
    except UserEmailPreference.DoesNotExist:
        pass

    # Build email context
    context = _build_email_context(notification)

    # Determine template based on notification type
    template_name = _get_template_for_notification_type(notification.type)
    if not template_name:
        logger.warning(f"No email template for notification type: {notification.type}")
        return {'status': 'skipped', 'reason': 'no_template'}

    try:
        # Render email
        html_content = render_to_string(f'emails/{template_name}.html', context)
        text_content = strip_tags(html_content)

        # Send email
        send_mail(
            subject=notification.title,
            message=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_content,
            fail_silently=False,
        )

        # Update notification record
        notification.email_sent = True
        notification.email_sent_at = timezone.now()
        notification.email_error = ''
        notification.save(update_fields=['email_sent', 'email_sent_at', 'email_error', 'updated_at'])

        logger.info(f"Email sent successfully for notification {notification_id} to {user.email}")
        return {'status': 'sent', 'recipient': user.email}

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to send email for notification {notification_id}: {error_msg}")

        # Update notification with error
        notification.email_error = error_msg[:500]  # Truncate if too long
        notification.save(update_fields=['email_error', 'updated_at'])

        # Retry the task
        try:
            raise self.retry(exc=e)
        except self.MaxRetriesExceededError:
            logger.error(f"Max retries exceeded for notification {notification_id}")
            return {'status': 'failed', 'error': error_msg}


def _build_email_context(notification) -> dict:
    """Build the context dictionary for email template rendering."""
    context = {
        'recipient_name': notification.user.get_full_name() or notification.user.email,
        'notification_type': notification.type,
        'title': notification.title,
        'message': notification.message,
        'priority': notification.priority,
        'base_url': settings.PORTAL_BASE_URL.replace('/portal', ''),
        'action_url': notification.link or settings.PORTAL_BASE_URL.replace('/portal', ''),
    }

    # Add metadata to context
    if notification.metadata:
        context.update(notification.metadata)

    return context


def _get_template_for_notification_type(notification_type: str) -> str:
    """Map notification type to email template name."""
    template_map = {
        'APPROVAL_REQUIRED': 'approval_required',
        'APPROVAL_COMPLETED': 'approval_completed',
        'APPROVAL_REJECTED': 'approval_rejected',
        'CONTRACT_EXPIRING': 'contract_expiring',
        'BID_RECEIVED': 'bid_received',
        'GOODS_RECEIVED': 'goods_received',
        'INVOICE_MATCHED': 'invoice_matched',
        'DOCUMENT_SUBMITTED': 'approval_required',  # Reuse approval_required template
        'BUDGET_ALERT': 'contract_expiring',  # Reuse contract_expiring template with different content
        'SYSTEM_ALERT': 'approval_required',  # Generic system alert
    }
    return template_map.get(notification_type)


@shared_task
def send_portal_invitation_email(invitation_id: str):
    """
    Send a portal invitation email to a supplier contact.

    Args:
        invitation_id: UUID of the PortalInvitation record
    """
    from apps.suppliers.models import PortalInvitation

    try:
        invitation = PortalInvitation.objects.select_related(
            'supplier', 'supplier__organization', 'created_by'
        ).get(id=invitation_id)
    except PortalInvitation.DoesNotExist:
        logger.warning(f"PortalInvitation {invitation_id} not found")
        return {'status': 'skipped', 'reason': 'invitation_not_found'}

    context = {
        'supplier_name': invitation.supplier.name,
        'organization_name': invitation.supplier.organization.name,
        'invited_by': invitation.created_by.get_full_name() if invitation.created_by else 'Dillanci',
        'expires_at': invitation.expires_at.strftime('%B %d, %Y'),
        'expiry_days': settings.PORTAL_INVITATION_EXPIRY_DAYS,
        'action_url': f"{settings.PORTAL_BASE_URL}/register?token={invitation.token}",
        'base_url': settings.PORTAL_BASE_URL.replace('/portal', ''),
    }

    try:
        html_content = render_to_string('emails/portal_invitation.html', context)
        text_content = strip_tags(html_content)

        send_mail(
            subject=f"You're Invited to {invitation.supplier.organization.name}'s Supplier Portal",
            message=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invitation.email],
            html_message=html_content,
            fail_silently=False,
        )

        logger.info(f"Portal invitation email sent to {invitation.email}")
        return {'status': 'sent', 'recipient': invitation.email}

    except Exception as e:
        logger.error(f"Failed to send portal invitation email: {e}")
        return {'status': 'failed', 'error': str(e)}


# =============================================================================
# Batch Email Tasks (for digests)
# =============================================================================

@shared_task
def send_daily_digest():
    """
    Send daily digest emails to users who have digest_frequency='DAILY'.

    This task should be scheduled to run once daily (e.g., 8 AM).
    """
    from apps.core.models import Notification
    from apps.users.models import User

    yesterday = timezone.now() - timezone.timedelta(days=1)

    # Get users with daily digest preference
    users_with_daily_digest = User.objects.filter(
        email_preferences__digest_frequency='DAILY',
        is_active=True,
    )

    for user in users_with_daily_digest:
        # Get unread notifications from last 24 hours that haven't been emailed
        notifications = Notification.objects.filter(
            user=user,
            created_at__gte=yesterday,
            email_sent=False,
            status='UNREAD',
        ).order_by('-created_at')

        if notifications.exists():
            _send_digest_email(user, notifications, 'daily')

    logger.info(f"Daily digest processed for {users_with_daily_digest.count()} users")


@shared_task
def send_weekly_digest():
    """
    Send weekly digest emails to users who have digest_frequency='WEEKLY'.

    This task should be scheduled to run once weekly (e.g., Monday 8 AM).
    """
    from apps.core.models import Notification
    from apps.users.models import User

    last_week = timezone.now() - timezone.timedelta(days=7)

    # Get users with weekly digest preference
    users_with_weekly_digest = User.objects.filter(
        email_preferences__digest_frequency='WEEKLY',
        is_active=True,
    )

    for user in users_with_weekly_digest:
        # Get unread notifications from last 7 days that haven't been emailed
        notifications = Notification.objects.filter(
            user=user,
            created_at__gte=last_week,
            email_sent=False,
            status='UNREAD',
        ).order_by('-created_at')

        if notifications.exists():
            _send_digest_email(user, notifications, 'weekly')

    logger.info(f"Weekly digest processed for {users_with_weekly_digest.count()} users")


def _send_digest_email(user, notifications, digest_type: str):
    """
    Send a digest email with multiple notifications.

    Args:
        user: User instance
        notifications: QuerySet of Notification instances
        digest_type: 'daily' or 'weekly'
    """
    context = {
        'recipient_name': user.get_full_name() or user.email,
        'digest_type': digest_type,
        'notifications': list(notifications),
        'notification_count': notifications.count(),
        'base_url': settings.PORTAL_BASE_URL.replace('/portal', ''),
    }

    try:
        # Note: You'd create a digest.html template for this
        html_content = render_to_string('emails/digest.html', context)
        text_content = strip_tags(html_content)

        send_mail(
            subject=f"Your {digest_type.title()} Dillanci Summary ({notifications.count()} notifications)",
            message=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_content,
            fail_silently=False,
        )

        # Mark all notifications as emailed
        notifications.update(
            email_sent=True,
            email_sent_at=timezone.now(),
        )

        logger.info(f"Sent {digest_type} digest to {user.email} with {notifications.count()} notifications")

    except Exception as e:
        logger.error(f"Failed to send {digest_type} digest to {user.email}: {e}")
