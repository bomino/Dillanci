"""
User models - Custom user model and RBAC system for the platform.
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel


# =============================================================================
# Permission Constants - Define all available permissions in the system
# =============================================================================

class Permissions:
    """
    Central registry of all permissions in the system.
    Organized by module for easy management.
    """

    # User Management
    USER_VIEW = 'user.view'
    USER_CREATE = 'user.create'
    USER_EDIT = 'user.edit'
    USER_DELETE = 'user.delete'
    USER_ACTIVATE = 'user.activate'
    USER_DEACTIVATE = 'user.deactivate'
    USER_ASSIGN_ROLES = 'user.assign_roles'

    # Organization Management
    ORG_VIEW = 'organization.view'
    ORG_EDIT = 'organization.edit'
    ORG_MANAGE_SETTINGS = 'organization.manage_settings'

    # Supplier Management
    SUPPLIER_VIEW = 'supplier.view'
    SUPPLIER_CREATE = 'supplier.create'
    SUPPLIER_EDIT = 'supplier.edit'
    SUPPLIER_DELETE = 'supplier.delete'
    SUPPLIER_APPROVE = 'supplier.approve'
    SUPPLIER_SUSPEND = 'supplier.suspend'

    # Requisition Management
    REQUISITION_VIEW = 'requisition.view'
    REQUISITION_VIEW_ALL = 'requisition.view_all'  # View all org requisitions
    REQUISITION_CREATE = 'requisition.create'
    REQUISITION_EDIT = 'requisition.edit'
    REQUISITION_DELETE = 'requisition.delete'
    REQUISITION_SUBMIT = 'requisition.submit'
    REQUISITION_APPROVE = 'requisition.approve'
    REQUISITION_REJECT = 'requisition.reject'

    # RFQ Management
    RFQ_VIEW = 'rfq.view'
    RFQ_CREATE = 'rfq.create'
    RFQ_EDIT = 'rfq.edit'
    RFQ_DELETE = 'rfq.delete'
    RFQ_PUBLISH = 'rfq.publish'
    RFQ_AWARD = 'rfq.award'
    RFQ_CANCEL = 'rfq.cancel'

    # RFP Management
    RFP_VIEW = 'rfp.view'
    RFP_CREATE = 'rfp.create'
    RFP_EDIT = 'rfp.edit'
    RFP_DELETE = 'rfp.delete'
    RFP_PUBLISH = 'rfp.publish'
    RFP_EVALUATE = 'rfp.evaluate'
    RFP_AWARD = 'rfp.award'

    # Purchase Order Management
    PO_VIEW = 'purchase_order.view'
    PO_VIEW_ALL = 'purchase_order.view_all'
    PO_CREATE = 'purchase_order.create'
    PO_EDIT = 'purchase_order.edit'
    PO_DELETE = 'purchase_order.delete'
    PO_SUBMIT = 'purchase_order.submit'
    PO_APPROVE = 'purchase_order.approve'
    PO_REJECT = 'purchase_order.reject'
    PO_CANCEL = 'purchase_order.cancel'
    PO_CLOSE = 'purchase_order.close'

    # Receiving/Goods Receipt
    RECEIVING_VIEW = 'receiving.view'
    RECEIVING_CREATE = 'receiving.create'
    RECEIVING_EDIT = 'receiving.edit'
    RECEIVING_COMPLETE = 'receiving.complete'

    # Invoice Management
    INVOICE_VIEW = 'invoice.view'
    INVOICE_CREATE = 'invoice.create'
    INVOICE_EDIT = 'invoice.edit'
    INVOICE_DELETE = 'invoice.delete'
    INVOICE_MATCH = 'invoice.match'
    INVOICE_APPROVE = 'invoice.approve'
    INVOICE_REJECT = 'invoice.reject'
    INVOICE_PAY = 'invoice.pay'

    # Contract Management
    CONTRACT_VIEW = 'contract.view'
    CONTRACT_CREATE = 'contract.create'
    CONTRACT_EDIT = 'contract.edit'
    CONTRACT_DELETE = 'contract.delete'
    CONTRACT_APPROVE = 'contract.approve'
    CONTRACT_TERMINATE = 'contract.terminate'
    CONTRACT_RENEW = 'contract.renew'

    # Budget Management
    BUDGET_VIEW = 'budget.view'
    BUDGET_CREATE = 'budget.create'
    BUDGET_EDIT = 'budget.edit'
    BUDGET_APPROVE = 'budget.approve'
    BUDGET_TRANSFER = 'budget.transfer'

    # Reports
    REPORT_VIEW = 'report.view'
    REPORT_EXPORT = 'report.export'
    REPORT_ADVANCED = 'report.advanced'

    # Audit
    AUDIT_VIEW = 'audit.view'
    AUDIT_EXPORT = 'audit.export'

    # System Administration
    ADMIN_FULL_ACCESS = 'admin.full_access'
    ADMIN_MANAGE_ROLES = 'admin.manage_roles'
    ADMIN_VIEW_ALL_ORGS = 'admin.view_all_orgs'

    @classmethod
    def all_permissions(cls):
        """Return all permission codes as a list of tuples (code, label)."""
        return [
            (getattr(cls, attr), attr.replace('_', ' ').title())
            for attr in dir(cls)
            if not attr.startswith('_') and isinstance(getattr(cls, attr), str)
            and '.' in getattr(cls, attr)
        ]

    @classmethod
    def get_choices(cls):
        """Return permission choices for model fields."""
        return cls.all_permissions()


# =============================================================================
# Role Presets - Pre-defined role configurations
# =============================================================================

class RolePresets:
    """Pre-defined role configurations for quick setup."""

    REQUESTER = {
        'name': 'Requester',
        'description': 'Can create and submit requisitions',
        'permissions': [
            Permissions.REQUISITION_VIEW,
            Permissions.REQUISITION_CREATE,
            Permissions.REQUISITION_EDIT,
            Permissions.REQUISITION_SUBMIT,
            Permissions.SUPPLIER_VIEW,
            Permissions.BUDGET_VIEW,
        ]
    }

    BUDGET_HOLDER = {
        'name': 'Budget Holder',
        'description': 'Can approve requisitions within budget authority',
        'permissions': [
            Permissions.REQUISITION_VIEW,
            Permissions.REQUISITION_VIEW_ALL,
            Permissions.REQUISITION_APPROVE,
            Permissions.REQUISITION_REJECT,
            Permissions.BUDGET_VIEW,
            Permissions.SUPPLIER_VIEW,
            Permissions.REPORT_VIEW,
        ]
    }

    PROCUREMENT_OFFICER = {
        'name': 'Procurement Officer',
        'description': 'Manages procurement operations and supplier relationships',
        'permissions': [
            Permissions.REQUISITION_VIEW,
            Permissions.REQUISITION_VIEW_ALL,
            Permissions.RFQ_VIEW,
            Permissions.RFQ_CREATE,
            Permissions.RFQ_EDIT,
            Permissions.RFQ_PUBLISH,
            Permissions.RFP_VIEW,
            Permissions.RFP_CREATE,
            Permissions.RFP_EDIT,
            Permissions.RFP_PUBLISH,
            Permissions.PO_VIEW,
            Permissions.PO_VIEW_ALL,
            Permissions.PO_CREATE,
            Permissions.PO_EDIT,
            Permissions.PO_SUBMIT,
            Permissions.SUPPLIER_VIEW,
            Permissions.SUPPLIER_CREATE,
            Permissions.SUPPLIER_EDIT,
            Permissions.CONTRACT_VIEW,
            Permissions.CONTRACT_CREATE,
            Permissions.CONTRACT_EDIT,
            Permissions.REPORT_VIEW,
        ]
    }

    PROCUREMENT_MANAGER = {
        'name': 'Procurement Manager',
        'description': 'Full procurement authority including approvals',
        'permissions': [
            Permissions.REQUISITION_VIEW,
            Permissions.REQUISITION_VIEW_ALL,
            Permissions.REQUISITION_APPROVE,
            Permissions.REQUISITION_REJECT,
            Permissions.RFQ_VIEW,
            Permissions.RFQ_CREATE,
            Permissions.RFQ_EDIT,
            Permissions.RFQ_PUBLISH,
            Permissions.RFQ_AWARD,
            Permissions.RFQ_CANCEL,
            Permissions.RFP_VIEW,
            Permissions.RFP_CREATE,
            Permissions.RFP_EDIT,
            Permissions.RFP_PUBLISH,
            Permissions.RFP_EVALUATE,
            Permissions.RFP_AWARD,
            Permissions.PO_VIEW,
            Permissions.PO_VIEW_ALL,
            Permissions.PO_CREATE,
            Permissions.PO_EDIT,
            Permissions.PO_SUBMIT,
            Permissions.PO_APPROVE,
            Permissions.PO_REJECT,
            Permissions.PO_CANCEL,
            Permissions.PO_CLOSE,
            Permissions.SUPPLIER_VIEW,
            Permissions.SUPPLIER_CREATE,
            Permissions.SUPPLIER_EDIT,
            Permissions.SUPPLIER_APPROVE,
            Permissions.SUPPLIER_SUSPEND,
            Permissions.CONTRACT_VIEW,
            Permissions.CONTRACT_CREATE,
            Permissions.CONTRACT_EDIT,
            Permissions.CONTRACT_APPROVE,
            Permissions.CONTRACT_TERMINATE,
            Permissions.CONTRACT_RENEW,
            Permissions.REPORT_VIEW,
            Permissions.REPORT_EXPORT,
        ]
    }

    ACCOUNTS_PAYABLE = {
        'name': 'Accounts Payable',
        'description': 'Manages invoices and payments',
        'permissions': [
            Permissions.PO_VIEW,
            Permissions.RECEIVING_VIEW,
            Permissions.INVOICE_VIEW,
            Permissions.INVOICE_CREATE,
            Permissions.INVOICE_EDIT,
            Permissions.INVOICE_MATCH,
            Permissions.INVOICE_APPROVE,
            Permissions.INVOICE_REJECT,
            Permissions.INVOICE_PAY,
            Permissions.SUPPLIER_VIEW,
            Permissions.REPORT_VIEW,
        ]
    }

    WAREHOUSE_STAFF = {
        'name': 'Warehouse Staff',
        'description': 'Manages goods receipt and inventory',
        'permissions': [
            Permissions.PO_VIEW,
            Permissions.RECEIVING_VIEW,
            Permissions.RECEIVING_CREATE,
            Permissions.RECEIVING_EDIT,
            Permissions.RECEIVING_COMPLETE,
            Permissions.SUPPLIER_VIEW,
        ]
    }

    FINANCE_MANAGER = {
        'name': 'Finance Manager',
        'description': 'Financial oversight and budget management',
        'permissions': [
            Permissions.BUDGET_VIEW,
            Permissions.BUDGET_CREATE,
            Permissions.BUDGET_EDIT,
            Permissions.BUDGET_APPROVE,
            Permissions.BUDGET_TRANSFER,
            Permissions.INVOICE_VIEW,
            Permissions.INVOICE_APPROVE,
            Permissions.CONTRACT_VIEW,
            Permissions.REPORT_VIEW,
            Permissions.REPORT_EXPORT,
            Permissions.REPORT_ADVANCED,
            Permissions.AUDIT_VIEW,
        ]
    }

    AUDITOR = {
        'name': 'Auditor',
        'description': 'Read-only access for audit purposes',
        'permissions': [
            Permissions.REQUISITION_VIEW,
            Permissions.REQUISITION_VIEW_ALL,
            Permissions.RFQ_VIEW,
            Permissions.RFP_VIEW,
            Permissions.PO_VIEW,
            Permissions.PO_VIEW_ALL,
            Permissions.RECEIVING_VIEW,
            Permissions.INVOICE_VIEW,
            Permissions.CONTRACT_VIEW,
            Permissions.BUDGET_VIEW,
            Permissions.SUPPLIER_VIEW,
            Permissions.REPORT_VIEW,
            Permissions.REPORT_EXPORT,
            Permissions.REPORT_ADVANCED,
            Permissions.AUDIT_VIEW,
            Permissions.AUDIT_EXPORT,
        ]
    }

    ORG_ADMIN = {
        'name': 'Organization Admin',
        'description': 'Full administrative access for the organization',
        'permissions': [
            Permissions.USER_VIEW,
            Permissions.USER_CREATE,
            Permissions.USER_EDIT,
            Permissions.USER_DELETE,
            Permissions.USER_ACTIVATE,
            Permissions.USER_DEACTIVATE,
            Permissions.USER_ASSIGN_ROLES,
            Permissions.ORG_VIEW,
            Permissions.ORG_EDIT,
            Permissions.ORG_MANAGE_SETTINGS,
            Permissions.ADMIN_MANAGE_ROLES,
        ]
    }

    @classmethod
    def all_presets(cls):
        """Return all role presets."""
        return [
            cls.REQUESTER,
            cls.BUDGET_HOLDER,
            cls.PROCUREMENT_OFFICER,
            cls.PROCUREMENT_MANAGER,
            cls.ACCOUNTS_PAYABLE,
            cls.WAREHOUSE_STAFF,
            cls.FINANCE_MANAGER,
            cls.AUDITOR,
            cls.ORG_ADMIN,
        ]


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    """
    Custom User model using email as the username field.
    """

    STATUSES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('SUSPENDED', 'Suspended'),
    ]

    USER_TYPES = [
        ('INTERNAL', 'Internal User'),
        ('PORTAL', 'Portal User'),
    ]

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    employee_id = models.CharField(max_length=50, blank=True, null=True)

    # Organization link (will be added after organizations app)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.PROTECT,
        related_name='users',
        null=True,  # Temporarily nullable for initial migration
        blank=True,
    )

    status = models.CharField(max_length=20, choices=STATUSES, default='ACTIVE')
    user_type = models.CharField(max_length=20, choices=USER_TYPES, default='INTERNAL')
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        db_table = 'user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    def get_roles(self):
        """Get all active roles for this user."""
        return self.user_roles.filter(
            is_active=True
        ).select_related('role')

    def get_permissions(self):
        """Get all permissions for this user across all roles."""
        if self.is_superuser:
            return set(p[0] for p in Permissions.all_permissions())

        permissions = set()
        for user_role in self.get_roles():
            permissions.update(user_role.role.get_permissions_list())
        return permissions

    def has_permission(self, permission_code):
        """Check if user has a specific permission."""
        if self.is_superuser:
            return True
        return permission_code in self.get_permissions()

    def has_any_permission(self, permission_codes):
        """Check if user has any of the specified permissions."""
        if self.is_superuser:
            return True
        user_permissions = self.get_permissions()
        return any(p in user_permissions for p in permission_codes)

    def has_all_permissions(self, permission_codes):
        """Check if user has all specified permissions."""
        if self.is_superuser:
            return True
        user_permissions = self.get_permissions()
        return all(p in user_permissions for p in permission_codes)

    def has_role(self, role_name):
        """Check if user has a specific role."""
        return self.user_roles.filter(
            role__name__iexact=role_name,
            is_active=True
        ).exists()


# =============================================================================
# Role Model - Define roles with permissions
# =============================================================================

class Role(BaseModel):
    """
    Role model for RBAC.

    Roles can be:
    - System-wide (organization=None, is_system_role=True)
    - Organization-specific (organization set)
    """

    ROLE_TYPES = [
        ('SYSTEM', 'System Role'),
        ('ORGANIZATION', 'Organization Role'),
        ('CUSTOM', 'Custom Role'),
    ]

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True, help_text='Unique code for the role')
    description = models.TextField(blank=True)
    role_type = models.CharField(max_length=20, choices=ROLE_TYPES, default='ORGANIZATION')

    # Organization scope (null for system-wide roles)
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='roles',
        null=True,
        blank=True,
        help_text='Leave empty for system-wide roles'
    )

    # Permissions stored as JSON array
    permissions = models.JSONField(
        default=list,
        help_text='List of permission codes'
    )

    # Role hierarchy
    parent_role = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='child_roles',
        help_text='Inherit permissions from parent role'
    )

    # Approval limits
    approval_limit = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Maximum amount this role can approve'
    )
    currency = models.CharField(max_length=3, default='USD')

    # Status
    is_active = models.BooleanField(default=True)
    is_system_role = models.BooleanField(
        default=False,
        help_text='System roles cannot be modified or deleted'
    )

    class Meta:
        db_table = 'role'
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'
        ordering = ['name']
        unique_together = [['name', 'organization']]

    def __str__(self):
        if self.organization:
            return f'{self.name} ({self.organization.code})'
        return f'{self.name} (System)'

    def get_permissions_list(self):
        """Get all permissions including inherited from parent."""
        permissions = set(self.permissions or [])
        if self.parent_role:
            permissions.update(self.parent_role.get_permissions_list())
        return permissions

    def add_permission(self, permission_code):
        """Add a permission to this role."""
        if permission_code not in self.permissions:
            self.permissions.append(permission_code)
            self.save(update_fields=['permissions', 'updated_at'])

    def remove_permission(self, permission_code):
        """Remove a permission from this role."""
        if permission_code in self.permissions:
            self.permissions.remove(permission_code)
            self.save(update_fields=['permissions', 'updated_at'])

    def has_permission(self, permission_code):
        """Check if role has a specific permission."""
        return permission_code in self.get_permissions_list()

    @classmethod
    def create_from_preset(cls, preset, organization=None):
        """Create a role from a preset configuration."""
        code = preset['name'].lower().replace(' ', '_')
        if organization:
            code = f"{organization.code.lower()}_{code}"

        role, created = cls.objects.get_or_create(
            code=code,
            defaults={
                'name': preset['name'],
                'description': preset['description'],
                'permissions': preset['permissions'],
                'organization': organization,
                'role_type': 'ORGANIZATION' if organization else 'SYSTEM',
            }
        )
        return role, created


# =============================================================================
# User Role Assignment - Link users to roles
# =============================================================================

class UserRole(BaseModel):
    """
    Assigns a role to a user.

    Features:
    - Can be time-limited (valid_from, valid_to)
    - Can have delegated authority from another user
    - Tracks assignment history
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='user_roles'
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name='user_assignments'
    )

    # Validity period
    valid_from = models.DateTimeField(default=timezone.now)
    valid_to = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Leave empty for permanent assignment'
    )

    # Delegation
    delegated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='delegated_roles',
        help_text='User who delegated this role'
    )
    delegation_reason = models.TextField(blank=True)

    # Override approval limit for this specific assignment
    custom_approval_limit = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Override role approval limit for this user'
    )

    # Assignment tracking
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='role_assignments_made'
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'user_role'
        verbose_name = 'User Role'
        verbose_name_plural = 'User Roles'
        ordering = ['-created_at']
        unique_together = [['user', 'role']]

    def __str__(self):
        return f'{self.user.email} - {self.role.name}'

    @property
    def is_valid(self):
        """Check if the role assignment is currently valid."""
        now = timezone.now()
        if not self.is_active:
            return False
        if self.valid_from and self.valid_from > now:
            return False
        if self.valid_to and self.valid_to < now:
            return False
        return True

    @property
    def is_delegated(self):
        """Check if this is a delegated role."""
        return self.delegated_by is not None

    @property
    def approval_limit(self):
        """Get the effective approval limit."""
        if self.custom_approval_limit is not None:
            return self.custom_approval_limit
        return self.role.approval_limit

    def save(self, *args, **kwargs):
        # Auto-deactivate if validity period has passed
        if self.valid_to and self.valid_to < timezone.now():
            self.is_active = False
        super().save(*args, **kwargs)


# =============================================================================
# Role Change Audit - Track role assignment changes
# =============================================================================

class RoleChangeLog(BaseModel):
    """
    Audit log for role assignment changes.
    """

    ACTION_TYPES = [
        ('ASSIGNED', 'Role Assigned'),
        ('REMOVED', 'Role Removed'),
        ('MODIFIED', 'Role Modified'),
        ('DELEGATED', 'Role Delegated'),
        ('DELEGATION_REVOKED', 'Delegation Revoked'),
        ('EXPIRED', 'Role Expired'),
        ('ACTIVATED', 'Role Activated'),
        ('DEACTIVATED', 'Role Deactivated'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='role_change_logs'
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        related_name='change_logs'
    )
    role_name = models.CharField(max_length=100)  # Store name in case role is deleted

    action = models.CharField(max_length=20, choices=ACTION_TYPES)
    performed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='role_changes_performed'
    )

    old_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    reason = models.TextField(blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        db_table = 'role_change_log'
        verbose_name = 'Role Change Log'
        verbose_name_plural = 'Role Change Logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.email} - {self.action} - {self.role_name}'


# =============================================================================
# User Email Preferences - Control email notification delivery
# =============================================================================

class UserEmailPreference(BaseModel):
    """
    User preferences for email notifications.
    Controls which notification types are sent via email.
    """

    DIGEST_FREQUENCIES = [
        ('IMMEDIATE', 'Immediate'),
        ('DAILY', 'Daily Digest'),
        ('WEEKLY', 'Weekly Digest'),
        ('NONE', 'No Emails'),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='email_preferences'
    )

    # Per notification type toggles
    email_approval_required = models.BooleanField(
        default=True,
        help_text='Receive email when approval is required'
    )
    email_approval_completed = models.BooleanField(
        default=True,
        help_text='Receive email when your submission is approved'
    )
    email_approval_rejected = models.BooleanField(
        default=True,
        help_text='Receive email when your submission is rejected'
    )
    email_contract_expiring = models.BooleanField(
        default=True,
        help_text='Receive email when contracts are expiring'
    )
    email_bid_received = models.BooleanField(
        default=True,
        help_text='Receive email when bids are received on RFQs'
    )
    email_goods_received = models.BooleanField(
        default=True,
        help_text='Receive email when goods are received'
    )
    email_invoice_matched = models.BooleanField(
        default=True,
        help_text='Receive email when invoices are matched'
    )
    email_document_submitted = models.BooleanField(
        default=True,
        help_text='Receive email when documents are submitted for review'
    )
    email_budget_alert = models.BooleanField(
        default=True,
        help_text='Receive email for budget alerts'
    )
    email_system_alert = models.BooleanField(
        default=True,
        help_text='Receive email for system alerts'
    )

    # Digest settings
    digest_frequency = models.CharField(
        max_length=20,
        choices=DIGEST_FREQUENCIES,
        default='IMMEDIATE',
        help_text='How often to receive notification emails'
    )

    class Meta:
        db_table = 'user_email_preference'
        verbose_name = 'User Email Preference'
        verbose_name_plural = 'User Email Preferences'

    def __str__(self):
        return f'Email Preferences for {self.user.email}'

    def should_send_email(self, notification_type: str) -> bool:
        """
        Check if email should be sent for a given notification type.
        """
        if self.digest_frequency == 'NONE':
            return False

        # Map notification types to preference fields
        type_mapping = {
            'APPROVAL_REQUIRED': self.email_approval_required,
            'APPROVAL_COMPLETED': self.email_approval_completed,
            'APPROVAL_REJECTED': self.email_approval_rejected,
            'CONTRACT_EXPIRING': self.email_contract_expiring,
            'BID_RECEIVED': self.email_bid_received,
            'GOODS_RECEIVED': self.email_goods_received,
            'INVOICE_MATCHED': self.email_invoice_matched,
            'DOCUMENT_SUBMITTED': self.email_document_submitted,
            'BUDGET_ALERT': self.email_budget_alert,
            'SYSTEM_ALERT': self.email_system_alert,
        }

        return type_mapping.get(notification_type, True)

    @classmethod
    def get_or_create_for_user(cls, user):
        """Get or create email preferences for a user with defaults."""
        preferences, created = cls.objects.get_or_create(user=user)
        return preferences
