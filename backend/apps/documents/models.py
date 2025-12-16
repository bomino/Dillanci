"""
Document Management models.
"""

import os
import uuid

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.core.models import SoftDeleteModel


def document_upload_path(instance, filename):
    """
    Generate upload path for documents.

    Path format: documents/{year}/{month}/{uuid}_{filename}
    """
    from django.utils import timezone

    now = timezone.now()
    ext = os.path.splitext(filename)[1]
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    return f"documents/{now.year}/{now.month:02d}/{unique_filename}"


class Document(SoftDeleteModel):
    """
    Document model for storing file attachments.

    Can be attached to any model via GenericForeignKey.
    Supports versioning with linked list pattern.
    """

    class FileType(models.TextChoices):
        PDF = 'PDF', 'PDF Document'
        EXCEL = 'EXCEL', 'Excel Spreadsheet'
        WORD = 'WORD', 'Word Document'
        IMAGE = 'IMAGE', 'Image'
        OTHER = 'OTHER', 'Other'

    class DocumentType(models.TextChoices):
        CONTRACT = 'CONTRACT', 'Contract'
        INVOICE = 'INVOICE', 'Invoice'
        QUOTE = 'QUOTE', 'Quote/Quotation'
        SPECIFICATION = 'SPECIFICATION', 'Specification'
        CERTIFICATE = 'CERTIFICATE', 'Certificate'
        PHOTO = 'PHOTO', 'Photo/Image'
        REPORT = 'REPORT', 'Report'
        OTHER = 'OTHER', 'Other'

    # Organization for multi-tenancy
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='documents',
    )

    # Document metadata
    name = models.CharField(
        max_length=255,
        help_text='Display name for the document',
    )
    original_filename = models.CharField(
        max_length=255,
        help_text='Original filename when uploaded',
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text='Optional description of the document',
    )

    # File storage
    file = models.FileField(
        upload_to=document_upload_path,
    )
    file_type = models.CharField(
        max_length=10,
        choices=FileType.choices,
        default=FileType.OTHER,
    )
    mime_type = models.CharField(
        max_length=100,
        blank=True,
        default='',
    )
    file_size = models.PositiveIntegerField(
        default=0,
        help_text='File size in bytes',
    )

    # Document classification
    document_type = models.CharField(
        max_length=20,
        choices=DocumentType.choices,
        default=DocumentType.OTHER,
    )

    # Upload info
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_documents',
    )
    upload_date = models.DateTimeField(
        auto_now_add=True,
    )

    # Generic relation to attached object
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    object_id = models.UUIDField(
        null=True,
        blank=True,
    )
    content_object = GenericForeignKey('content_type', 'object_id')

    # Versioning
    version = models.PositiveIntegerField(
        default=1,
    )
    is_current = models.BooleanField(
        default=True,
        help_text='Whether this is the current version',
    )
    previous_version = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='next_versions',
    )

    # Tags for categorization
    tags = models.JSONField(
        default=list,
        blank=True,
    )

    class Meta:
        ordering = ['-upload_date']
        indexes = [
            models.Index(fields=['organization', 'upload_date']),
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['document_type']),
            models.Index(fields=['is_current']),
        ]
        verbose_name = 'Document'
        verbose_name_plural = 'Documents'

    def __str__(self):
        return f"{self.name} (v{self.version})"

    @property
    def extension(self):
        """Get file extension."""
        if self.original_filename:
            return os.path.splitext(self.original_filename)[1].lower()
        return ''

    @property
    def file_size_display(self):
        """Human-readable file size."""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"

    def create_new_version(self, file, uploaded_by=None):
        """
        Create a new version of this document.

        Returns the new Document instance.
        """
        # Mark current version as not current
        self.is_current = False
        self.save(update_fields=['is_current', 'updated_at'])

        # Create new version
        new_doc = Document.objects.create(
            organization=self.organization,
            name=self.name,
            original_filename=file.name,
            description=self.description,
            file=file,
            file_type=self.file_type,
            mime_type=getattr(file, 'content_type', self.mime_type),
            file_size=file.size,
            document_type=self.document_type,
            uploaded_by=uploaded_by,
            content_type=self.content_type,
            object_id=self.object_id,
            version=self.version + 1,
            is_current=True,
            previous_version=self,
            tags=self.tags,
        )

        return new_doc

    def get_all_versions(self):
        """Get all versions of this document, newest first."""
        # Find the root document
        root = self
        while root.previous_version:
            root = root.previous_version

        # Traverse forward to collect all versions
        versions = []
        current = root
        while current:
            versions.append(current)
            current = current.next_versions.first()

        return sorted(versions, key=lambda d: d.version, reverse=True)

    @classmethod
    def detect_file_type(cls, filename, mime_type=''):
        """Detect file type from filename or MIME type."""
        ext = os.path.splitext(filename)[1].lower()

        # PDF
        if ext == '.pdf' or 'pdf' in mime_type:
            return cls.FileType.PDF

        # Excel
        if ext in ['.xls', '.xlsx', '.xlsm'] or 'spreadsheet' in mime_type:
            return cls.FileType.EXCEL

        # Word
        if ext in ['.doc', '.docx'] or 'word' in mime_type:
            return cls.FileType.WORD

        # Images
        if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'] or 'image' in mime_type:
            return cls.FileType.IMAGE

        return cls.FileType.OTHER


class DocumentConfiguration(models.Model):
    """
    Per-organization document configuration settings.

    Controls:
    - Maximum file size
    - Allowed file extensions
    - Whether document type is required
    """

    organization = models.OneToOneField(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='document_config',
        primary_key=True,
    )
    max_file_size_mb = models.PositiveIntegerField(
        default=10,
        help_text='Maximum file size in MB',
    )
    allowed_extensions = models.JSONField(
        default=list,
        blank=True,
        help_text='List of allowed file extensions (empty = all allowed)',
    )
    require_document_type = models.BooleanField(
        default=False,
        help_text='Require document type to be specified on upload',
    )

    class Meta:
        verbose_name = 'Document Configuration'
        verbose_name_plural = 'Document Configurations'

    def __str__(self):
        return f"Document Config for {self.organization.name}"

    @classmethod
    def get_for_organization(cls, organization):
        """Get or create document configuration for an organization."""
        config, _ = cls.objects.get_or_create(
            organization=organization,
            defaults={
                'allowed_extensions': [
                    'pdf', 'doc', 'docx', 'xls', 'xlsx',
                    'jpg', 'jpeg', 'png', 'gif',
                ],
            }
        )
        return config

    @property
    def max_file_size_bytes(self):
        """Maximum file size in bytes."""
        return self.max_file_size_mb * 1024 * 1024

    def is_extension_allowed(self, filename):
        """Check if file extension is allowed."""
        if not self.allowed_extensions:
            return True  # All allowed if list is empty

        ext = os.path.splitext(filename)[1].lower().lstrip('.')
        return ext in self.allowed_extensions

    def is_file_size_allowed(self, size_bytes):
        """Check if file size is within limits."""
        return size_bytes <= self.max_file_size_bytes
