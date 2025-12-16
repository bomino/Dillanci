"""
Django signals for automatic audit logging.

Connects to post_save and post_delete signals to automatically
create audit log entries for model changes.
"""

import threading

from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from apps.audit.services import AuditService

# Thread-local storage for pre-save instance state
_pre_save_instances = threading.local()


def get_pre_save_instance(instance):
    """Get the pre-save state of an instance from thread-local storage."""
    if not hasattr(_pre_save_instances, 'instances'):
        return None
    key = f"{type(instance).__name__}_{instance.pk}"
    return _pre_save_instances.instances.get(key)


def set_pre_save_instance(instance, old_instance):
    """Store the pre-save state of an instance in thread-local storage."""
    if not hasattr(_pre_save_instances, 'instances'):
        _pre_save_instances.instances = {}
    key = f"{type(instance).__name__}_{instance.pk}"
    _pre_save_instances.instances[key] = old_instance


def clear_pre_save_instance(instance):
    """Clear the pre-save state of an instance from thread-local storage."""
    if not hasattr(_pre_save_instances, 'instances'):
        return
    key = f"{type(instance).__name__}_{instance.pk}"
    _pre_save_instances.instances.pop(key, None)


# List of models to audit automatically
# Models can opt-in by setting _audit_enabled = True on the model class
# Or they can be in this explicit list
AUDITED_MODELS = [
    'suppliers.Supplier',
    'requisitions.Requisition',
    'requisitions.RequisitionLine',
    'rfqs.RFQ',
    'rfqs.RFQLine',
    'rfqs.Bid',
    'rfqs.BidLine',
    'rfqs.SupplierInvitation',
    'purchase_orders.PurchaseOrder',
    'purchase_orders.POLine',
    'receiving.GoodsReceipt',
    'receiving.GoodsReceiptLine',
    'invoices.Invoice',
    'invoices.InvoiceLine',
]


def should_audit_model(instance):
    """Check if a model instance should be audited."""
    # Check for explicit opt-in attribute
    if getattr(instance, '_audit_enabled', False):
        return True

    # Check if model is in the explicit list
    model_label = f"{instance._meta.app_label}.{instance._meta.model_name.title()}"
    # Also check with actual class name
    model_label_class = f"{instance._meta.app_label}.{instance.__class__.__name__}"

    return model_label in AUDITED_MODELS or model_label_class in AUDITED_MODELS


def get_organization_from_instance(instance):
    """Extract organization from an instance for auditing."""
    # Direct organization FK
    if hasattr(instance, 'organization'):
        return instance.organization

    # Nested through parent (e.g., RequisitionLine -> Requisition -> Organization)
    for parent_field in ['requisition', 'rfq', 'bid', 'purchase_order', 'goods_receipt', 'invoice']:
        parent = getattr(instance, parent_field, None)
        if parent and hasattr(parent, 'organization'):
            return parent.organization

    return None


@receiver(pre_save)
def capture_pre_save_state(sender, instance, **kwargs):
    """
    Capture the state of an instance before it's saved.

    This allows us to compare old vs new values in post_save.
    """
    if not should_audit_model(instance):
        return

    if instance.pk:
        try:
            old_instance = sender.objects.get(pk=instance.pk)
            set_pre_save_instance(instance, old_instance)
        except sender.DoesNotExist:
            pass


@receiver(post_save)
def audit_save(sender, instance, created, **kwargs):
    """
    Create audit log entry after a model is saved.

    Creates CREATE entry for new instances, UPDATE for existing.
    """
    if not should_audit_model(instance):
        return

    organization = get_organization_from_instance(instance)
    if not organization:
        return

    # Get audit context from instance (set by views/services)
    audit_user = getattr(instance, '_audit_user', None)
    audit_ip = getattr(instance, '_audit_ip_address', None)
    audit_ua = getattr(instance, '_audit_user_agent', '')

    if created:
        AuditService.log_create(
            instance=instance,
            user=audit_user,
            organization=organization,
            ip_address=audit_ip,
            user_agent=audit_ua,
        )
    else:
        old_instance = get_pre_save_instance(instance)
        if old_instance:
            # Check for soft delete
            was_deleted = getattr(old_instance, 'is_deleted', False)
            is_deleted = getattr(instance, 'is_deleted', False)

            if not was_deleted and is_deleted:
                # Soft delete
                AuditService.log_soft_delete(
                    instance=instance,
                    user=audit_user,
                    organization=organization,
                    ip_address=audit_ip,
                    user_agent=audit_ua,
                )
            elif was_deleted and not is_deleted:
                # Restore
                AuditService.log_restore(
                    instance=instance,
                    user=audit_user,
                    organization=organization,
                    ip_address=audit_ip,
                    user_agent=audit_ua,
                )
            else:
                # Regular update
                AuditService.log_update(
                    old_instance=old_instance,
                    new_instance=instance,
                    user=audit_user,
                    organization=organization,
                    ip_address=audit_ip,
                    user_agent=audit_ua,
                )

        clear_pre_save_instance(instance)


@receiver(post_delete)
def audit_delete(sender, instance, **kwargs):
    """
    Create audit log entry after a model is hard deleted.
    """
    if not should_audit_model(instance):
        return

    organization = get_organization_from_instance(instance)
    if not organization:
        return

    # Get audit context from instance
    audit_user = getattr(instance, '_audit_user', None)
    audit_ip = getattr(instance, '_audit_ip_address', None)
    audit_ua = getattr(instance, '_audit_user_agent', '')

    AuditService.log_delete(
        instance=instance,
        user=audit_user,
        organization=organization,
        ip_address=audit_ip,
        user_agent=audit_ua,
    )


def set_audit_context(instance, user=None, ip_address=None, user_agent=''):
    """
    Set audit context on an instance before saving.

    This is used by views to pass request context to the signal handlers.

    Usage:
        set_audit_context(instance, request.user, get_client_ip(request))
        instance.save()
    """
    instance._audit_user = user
    instance._audit_ip_address = ip_address
    instance._audit_user_agent = user_agent
    return instance


def get_client_ip(request):
    """
    Extract client IP address from request.

    Handles X-Forwarded-For header for proxied requests.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip
