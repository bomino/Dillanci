"""
Celery tasks for contract management including renewal alerts.
"""

import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def check_expiring_contracts():
    """
    Check all organizations for expiring contracts and send renewal alerts.

    This task should be scheduled to run daily (configured in Celery Beat).
    It checks all active contracts that are within their renewal notice period
    and creates notifications for contract owners.

    Logic:
    - Find contracts where: days_until_expiry <= renewal_notice_days
    - Avoid duplicate alerts using last_renewal_alert_sent field
    - Send weekly alerts until 7 days out, then daily alerts
    """
    from apps.contracts.models import Contract
    from apps.core.models import Notification
    from apps.core.tasks import send_notification_email
    from apps.organizations.models import Organization

    now = timezone.now()
    alerts_sent = 0
    contracts_checked = 0

    # Get all active organizations
    for org in Organization.objects.filter(is_active=True):
        # Get active contracts for this organization that might need alerts
        contracts = Contract.objects.filter(
            organization=org,
            status='ACTIVE',
            end_date__isnull=False,
        )

        for contract in contracts:
            contracts_checked += 1

            # Skip if not within renewal notice period
            if not contract.needs_renewal_notice:
                continue

            # Check if we should send an alert (avoid spamming)
            if not _should_send_renewal_alert(contract):
                continue

            # Create notification for contract owner/creator
            notification = Notification.objects.create(
                user=contract.created_by,
                type='CONTRACT_EXPIRING',
                title=f'Contract {contract.number} Expiring Soon',
                message=(
                    f'{contract.title} with {contract.supplier.name} '
                    f'expires in {contract.days_until_expiry} days on {contract.end_date}.'
                ),
                priority='URGENT' if contract.days_until_expiry <= 7 else 'HIGH',
                related_object_type='contract',
                related_object_id=contract.id,
                link=f'/contracts/{contract.id}',
                metadata={
                    'contract_number': contract.number,
                    'contract_title': contract.title,
                    'supplier_name': contract.supplier.name,
                    'end_date': str(contract.end_date),
                    'days_until_expiry': contract.days_until_expiry,
                    'total_value': str(contract.total_value),
                    'currency': contract.currency,
                    'auto_renew': contract.auto_renew,
                    'utilization_percent': float(contract.utilization_percent),
                },
            )

            # Queue email notification
            send_notification_email.delay(str(notification.id))

            # Update contract to track alert sent
            contract.last_renewal_alert_sent = now
            contract.save(update_fields=['last_renewal_alert_sent', 'updated_at'])

            alerts_sent += 1
            logger.info(
                f"Contract renewal alert sent for {contract.number} "
                f"(expires in {contract.days_until_expiry} days)"
            )

    logger.info(
        f"Contract renewal check completed: "
        f"{contracts_checked} contracts checked, {alerts_sent} alerts sent"
    )

    return {
        'contracts_checked': contracts_checked,
        'alerts_sent': alerts_sent,
    }


def _should_send_renewal_alert(contract) -> bool:
    """
    Determine if a renewal alert should be sent for this contract.

    Alert frequency:
    - When 7+ days out: Send weekly (every 7 days)
    - When <7 days out: Send daily

    Args:
        contract: Contract instance

    Returns:
        True if an alert should be sent, False otherwise
    """
    if not contract.last_renewal_alert_sent:
        # Never sent an alert, send one now
        return True

    days_since_last_alert = (timezone.now() - contract.last_renewal_alert_sent).days

    if contract.days_until_expiry <= 7:
        # Critical period: send daily alerts
        return days_since_last_alert >= 1
    else:
        # Normal period: send weekly alerts
        return days_since_last_alert >= 7


@shared_task
def auto_expire_contracts():
    """
    Automatically mark contracts as expired when they pass their end date.

    This is a cleanup task that ensures contracts with past end dates
    are properly marked as EXPIRED.
    """
    from apps.contracts.models import Contract

    today = timezone.now().date()

    # Find active contracts that have passed their end date
    expired_contracts = Contract.objects.filter(
        status='ACTIVE',
        end_date__lt=today,
    )

    count = 0
    for contract in expired_contracts:
        try:
            contract.expire()
            count += 1
            logger.info(f"Contract {contract.number} automatically expired")
        except Exception as e:
            logger.error(f"Failed to expire contract {contract.number}: {e}")

    logger.info(f"Auto-expire task completed: {count} contracts expired")
    return {'contracts_expired': count}


@shared_task
def update_contract_utilization_alerts():
    """
    Check contract utilization and send alerts when thresholds are exceeded.

    Alerts are sent when:
    - Contract utilization exceeds 80% (warning)
    - Contract utilization exceeds 95% (critical)
    """
    from apps.contracts.models import Contract
    from apps.core.models import Notification
    from apps.core.tasks import send_notification_email

    alerts_sent = 0

    # Get active contracts
    contracts = Contract.objects.filter(
        status='ACTIVE',
        total_value__gt=0,
    )

    for contract in contracts:
        utilization = float(contract.utilization_percent)

        # Determine alert level
        if utilization >= 95:
            priority = 'URGENT'
            title = f'Contract {contract.number} Nearly Exhausted'
            message = (
                f'{contract.title} has reached {utilization:.1f}% utilization. '
                f'Only {contract.remaining_value} {contract.currency} remaining.'
            )
        elif utilization >= 80:
            priority = 'HIGH'
            title = f'Contract {contract.number} High Utilization'
            message = (
                f'{contract.title} has reached {utilization:.1f}% utilization. '
                f'{contract.remaining_value} {contract.currency} remaining.'
            )
        else:
            continue  # No alert needed

        # Check if we've already sent this level of alert recently (within 7 days)
        recent_alert = Notification.objects.filter(
            user=contract.created_by,
            type='BUDGET_ALERT',
            related_object_id=contract.id,
            created_at__gte=timezone.now() - timezone.timedelta(days=7),
        ).exists()

        if recent_alert:
            continue

        # Create notification
        notification = Notification.objects.create(
            user=contract.created_by,
            type='BUDGET_ALERT',
            title=title,
            message=message,
            priority=priority,
            related_object_type='contract',
            related_object_id=contract.id,
            link=f'/contracts/{contract.id}',
            metadata={
                'contract_number': contract.number,
                'utilization_percent': utilization,
                'remaining_value': str(contract.remaining_value),
                'total_value': str(contract.total_value),
                'currency': contract.currency,
            },
        )

        # Queue email
        send_notification_email.delay(str(notification.id))
        alerts_sent += 1

        logger.info(f"Utilization alert sent for contract {contract.number} ({utilization:.1f}%)")

    logger.info(f"Contract utilization check completed: {alerts_sent} alerts sent")
    return {'alerts_sent': alerts_sent}
