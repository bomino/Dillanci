"""
Admin configuration for Document models.
"""

from django.contrib import admin
from django.utils.html import format_html

from apps.documents.models import Document, DocumentConfiguration


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    """Admin configuration for Document."""

    list_display = [
        'name',
        'original_filename',
        'file_type',
        'document_type',
        'file_size_display',
        'version',
        'is_current',
        'uploaded_by',
        'upload_date',
        'organization',
    ]
    list_filter = [
        'file_type',
        'document_type',
        'is_current',
        'organization',
        'upload_date',
    ]
    search_fields = [
        'name',
        'original_filename',
        'description',
        'tags',
    ]
    readonly_fields = [
        'id',
        'file_size',
        'file_size_display',
        'extension',
        'upload_date',
        'version',
        'previous_version',
        'file_link',
        'created_at',
        'updated_at',
        'is_deleted',
        'deleted_at',
    ]
    date_hierarchy = 'upload_date'
    ordering = ['-upload_date']

    fieldsets = (
        (None, {
            'fields': (
                'id',
                'organization',
                'name',
                'description',
            )
        }),
        ('File Info', {
            'fields': (
                'file',
                'file_link',
                'original_filename',
                'file_type',
                'mime_type',
                'file_size',
                'file_size_display',
                'extension',
            )
        }),
        ('Classification', {
            'fields': (
                'document_type',
                'tags',
            )
        }),
        ('Attachment', {
            'fields': (
                'content_type',
                'object_id',
            ),
            'classes': ('collapse',),
        }),
        ('Versioning', {
            'fields': (
                'version',
                'is_current',
                'previous_version',
            ),
            'classes': ('collapse',),
        }),
        ('Upload Info', {
            'fields': (
                'uploaded_by',
                'upload_date',
            )
        }),
        ('Timestamps', {
            'fields': (
                'created_at',
                'updated_at',
                'is_deleted',
                'deleted_at',
            ),
            'classes': ('collapse',),
        }),
    )

    def file_link(self, obj):
        """Display a clickable link to the file."""
        if obj.file:
            return format_html(
                '<a href="{}" target="_blank">Download {}</a>',
                obj.file.url,
                obj.original_filename,
            )
        return '-'
    file_link.short_description = 'File Link'


@admin.register(DocumentConfiguration)
class DocumentConfigurationAdmin(admin.ModelAdmin):
    """Admin configuration for DocumentConfiguration."""

    list_display = [
        'organization',
        'max_file_size_mb',
        'require_document_type',
        'allowed_extensions_display',
    ]
    search_fields = [
        'organization__name',
    ]

    fieldsets = (
        (None, {
            'fields': (
                'organization',
            )
        }),
        ('Settings', {
            'fields': (
                'max_file_size_mb',
                'allowed_extensions',
                'require_document_type',
            )
        }),
    )

    def allowed_extensions_display(self, obj):
        """Display allowed extensions."""
        if obj.allowed_extensions:
            return ', '.join(obj.allowed_extensions[:5])
        return 'All'
    allowed_extensions_display.short_description = 'Allowed Extensions'
