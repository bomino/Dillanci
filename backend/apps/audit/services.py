"""
Audit Service for creating audit log entries.
"""

from typing import Any, Dict, Optional

from django.contrib.contenttypes.models import ContentType
from django.db.models import Model
from django.utils import timezone

from apps.audit.models import AuditConfiguration, AuditLog


class AuditService:
    """
    Service for creating and managing audit log entries.

    Provides methods for:
    - Logging CRUD operations
    - Logging state transitions
    - Tracking field-level changes
    - Retrieving audit history for objects
    """

    @staticmethod
    def get_changes(old_instance: Optional[Model], new_instance: Model, config: AuditConfiguration) -> Dict[str, Dict[str, Any]]:
        """
        Calculate field-level changes between old and new instance.

        Args:
            old_instance: Previous state of the model (None for creates)
            new_instance: Current state of the model
            config: Audit configuration for excluded fields

        Returns:
            Dict of changed fields: {"field_name": {"old": value, "new": value}}
        """
        if not config.track_field_changes:
            return {}

        changes = {}
        model = type(new_instance)

        for field in model._meta.fields:
            field_name = field.name

            # Skip excluded fields
            if config.should_exclude_field(field_name):
                continue

            new_value = getattr(new_instance, field_name, None)

            if old_instance is None:
                # For creates, only log non-null/non-default values
                if new_value is not None and new_value != '':
                    changes[field_name] = {
                        'old': None,
                        'new': AuditService._serialize_value(new_value),
                    }
            else:
                old_value = getattr(old_instance, field_name, None)
                if old_value != new_value:
                    changes[field_name] = {
                        'old': AuditService._serialize_value(old_value),
                        'new': AuditService._serialize_value(new_value),
                    }

        return changes

    @staticmethod
    def _serialize_value(value: Any) -> Any:
        """
        Serialize a value for JSON storage.

        Handles common Django types that aren't JSON-serializable.
        """
        if value is None:
            return None

        # Handle UUID
        if hasattr(value, 'hex'):
            return str(value)

        # Handle datetime
        if hasattr(value, 'isoformat'):
            return value.isoformat()

        # Handle Decimal
        if hasattr(value, 'quantize'):
            return str(value)

        # Handle model instances (FK relationships)
        if hasattr(value, 'pk'):
            return str(value.pk)

        return value

    @staticmethod
    def log_create(
        instance: Model,
        user=None,
        organization=None,
        ip_address: Optional[str] = None,
        user_agent: str = '',
        extra_data: Optional[Dict] = None,
    ) -> Optional[AuditLog]:
        """
        Log a CREATE action for a new model instance.

        Args:
            instance: The newly created model instance
            user: The user who created it (optional)
            organization: The organization context
            ip_address: Request IP address
            user_agent: Request user agent
            extra_data: Additional context data

        Returns:
            AuditLog entry or None if auditing disabled
        """
        if organization is None:
            organization = getattr(instance, 'organization', None)

        if organization is None:
            return None

        config = AuditConfiguration.get_for_organization(organization)
        if not config.enabled:
            return None

        changes = AuditService.get_changes(None, instance, config)

        return AuditLog.objects.create(
            user=user,
            user_email=getattr(user, 'email', '') if user else '',
            ip_address=ip_address,
            user_agent=user_agent,
            organization=organization,
            content_type=ContentType.objects.get_for_model(instance),
            object_id=instance.pk,
            object_repr=str(instance)[:512],
            action=AuditLog.Action.CREATE,
            changes=changes,
            extra_data=extra_data or {},
        )

    @staticmethod
    def log_update(
        old_instance: Model,
        new_instance: Model,
        user=None,
        organization=None,
        ip_address: Optional[str] = None,
        user_agent: str = '',
        extra_data: Optional[Dict] = None,
    ) -> Optional[AuditLog]:
        """
        Log an UPDATE action for a model instance.

        Args:
            old_instance: The model state before update
            new_instance: The model state after update
            user: The user who made the update
            organization: The organization context
            ip_address: Request IP address
            user_agent: Request user agent
            extra_data: Additional context data

        Returns:
            AuditLog entry or None if auditing disabled or no changes
        """
        if organization is None:
            organization = getattr(new_instance, 'organization', None)

        if organization is None:
            return None

        config = AuditConfiguration.get_for_organization(organization)
        if not config.enabled:
            return None

        changes = AuditService.get_changes(old_instance, new_instance, config)

        # Don't log if no actual changes
        if not changes:
            return None

        return AuditLog.objects.create(
            user=user,
            user_email=getattr(user, 'email', '') if user else '',
            ip_address=ip_address,
            user_agent=user_agent,
            organization=organization,
            content_type=ContentType.objects.get_for_model(new_instance),
            object_id=new_instance.pk,
            object_repr=str(new_instance)[:512],
            action=AuditLog.Action.UPDATE,
            changes=changes,
            extra_data=extra_data or {},
        )

    @staticmethod
    def log_delete(
        instance: Model,
        user=None,
        organization=None,
        ip_address: Optional[str] = None,
        user_agent: str = '',
        extra_data: Optional[Dict] = None,
    ) -> Optional[AuditLog]:
        """
        Log a DELETE (hard delete) action for a model instance.

        Args:
            instance: The model instance being deleted
            user: The user who deleted it
            organization: The organization context
            ip_address: Request IP address
            user_agent: Request user agent
            extra_data: Additional context data

        Returns:
            AuditLog entry or None if auditing disabled
        """
        if organization is None:
            organization = getattr(instance, 'organization', None)

        if organization is None:
            return None

        config = AuditConfiguration.get_for_organization(organization)
        if not config.enabled:
            return None

        return AuditLog.objects.create(
            user=user,
            user_email=getattr(user, 'email', '') if user else '',
            ip_address=ip_address,
            user_agent=user_agent,
            organization=organization,
            content_type=ContentType.objects.get_for_model(instance),
            object_id=instance.pk,
            object_repr=str(instance)[:512],
            action=AuditLog.Action.DELETE,
            extra_data=extra_data or {},
        )

    @staticmethod
    def log_soft_delete(
        instance: Model,
        user=None,
        organization=None,
        ip_address: Optional[str] = None,
        user_agent: str = '',
        extra_data: Optional[Dict] = None,
    ) -> Optional[AuditLog]:
        """
        Log a SOFT_DELETE action for a model instance.

        Args:
            instance: The model instance being soft deleted
            user: The user who soft deleted it
            organization: The organization context
            ip_address: Request IP address
            user_agent: Request user agent
            extra_data: Additional context data

        Returns:
            AuditLog entry or None if auditing disabled
        """
        if organization is None:
            organization = getattr(instance, 'organization', None)

        if organization is None:
            return None

        config = AuditConfiguration.get_for_organization(organization)
        if not config.enabled:
            return None

        return AuditLog.objects.create(
            user=user,
            user_email=getattr(user, 'email', '') if user else '',
            ip_address=ip_address,
            user_agent=user_agent,
            organization=organization,
            content_type=ContentType.objects.get_for_model(instance),
            object_id=instance.pk,
            object_repr=str(instance)[:512],
            action=AuditLog.Action.SOFT_DELETE,
            changes={'is_deleted': {'old': False, 'new': True}},
            extra_data=extra_data or {},
        )

    @staticmethod
    def log_restore(
        instance: Model,
        user=None,
        organization=None,
        ip_address: Optional[str] = None,
        user_agent: str = '',
        extra_data: Optional[Dict] = None,
    ) -> Optional[AuditLog]:
        """
        Log a RESTORE action for a soft-deleted model instance.

        Args:
            instance: The model instance being restored
            user: The user who restored it
            organization: The organization context
            ip_address: Request IP address
            user_agent: Request user agent
            extra_data: Additional context data

        Returns:
            AuditLog entry or None if auditing disabled
        """
        if organization is None:
            organization = getattr(instance, 'organization', None)

        if organization is None:
            return None

        config = AuditConfiguration.get_for_organization(organization)
        if not config.enabled:
            return None

        return AuditLog.objects.create(
            user=user,
            user_email=getattr(user, 'email', '') if user else '',
            ip_address=ip_address,
            user_agent=user_agent,
            organization=organization,
            content_type=ContentType.objects.get_for_model(instance),
            object_id=instance.pk,
            object_repr=str(instance)[:512],
            action=AuditLog.Action.RESTORE,
            changes={'is_deleted': {'old': True, 'new': False}},
            extra_data=extra_data or {},
        )

    @staticmethod
    def log_state_transition(
        instance: Model,
        from_state: str,
        to_state: str,
        user=None,
        organization=None,
        ip_address: Optional[str] = None,
        user_agent: str = '',
        extra_data: Optional[Dict] = None,
    ) -> Optional[AuditLog]:
        """
        Log a STATE_TRANSITION action for a workflow model.

        Args:
            instance: The model instance with state change
            from_state: Previous state value
            to_state: New state value
            user: The user who triggered the transition
            organization: The organization context
            ip_address: Request IP address
            user_agent: Request user agent
            extra_data: Additional context data

        Returns:
            AuditLog entry or None if auditing disabled
        """
        if organization is None:
            organization = getattr(instance, 'organization', None)

        if organization is None:
            return None

        config = AuditConfiguration.get_for_organization(organization)
        if not config.enabled:
            return None

        return AuditLog.objects.create(
            user=user,
            user_email=getattr(user, 'email', '') if user else '',
            ip_address=ip_address,
            user_agent=user_agent,
            organization=organization,
            content_type=ContentType.objects.get_for_model(instance),
            object_id=instance.pk,
            object_repr=str(instance)[:512],
            action=AuditLog.Action.STATE_TRANSITION,
            from_state=from_state,
            to_state=to_state,
            changes={'status': {'old': from_state, 'new': to_state}},
            extra_data=extra_data or {},
        )

    @staticmethod
    def get_history_for_object(instance: Model, limit: Optional[int] = None):
        """
        Get audit history for a specific object.

        Args:
            instance: The model instance to get history for
            limit: Maximum number of entries to return

        Returns:
            QuerySet of AuditLog entries ordered by timestamp (newest first)
        """
        content_type = ContentType.objects.get_for_model(instance)
        qs = AuditLog.objects.filter(
            content_type=content_type,
            object_id=instance.pk,
        ).order_by('-timestamp')

        if limit:
            qs = qs[:limit]

        return qs

    @staticmethod
    def get_user_activity(user, organization=None, limit: Optional[int] = None):
        """
        Get all audit entries for a specific user.

        Args:
            user: The user to get activity for
            organization: Optional organization filter
            limit: Maximum number of entries to return

        Returns:
            QuerySet of AuditLog entries ordered by timestamp (newest first)
        """
        qs = AuditLog.objects.filter(user=user)

        if organization:
            qs = qs.filter(organization=organization)

        qs = qs.order_by('-timestamp')

        if limit:
            qs = qs[:limit]

        return qs

    @staticmethod
    def cleanup_old_logs(organization, before_date=None):
        """
        Delete audit logs older than retention period.

        Args:
            organization: The organization to clean up logs for
            before_date: Optional specific date (otherwise uses retention config)

        Returns:
            Number of deleted logs
        """
        config = AuditConfiguration.get_for_organization(organization)

        if config.retention_days == 0:
            # 0 means keep forever
            return 0

        if before_date is None:
            before_date = timezone.now() - timezone.timedelta(days=config.retention_days)

        deleted_count, _ = AuditLog.objects.filter(
            organization=organization,
            timestamp__lt=before_date,
        ).delete()

        return deleted_count
