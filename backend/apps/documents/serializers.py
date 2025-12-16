"""
Serializers for Documents module.
"""

from rest_framework import serializers

from apps.documents.models import Document, DocumentConfiguration


class DocumentSerializer(serializers.ModelSerializer):
    """Serializer for Document read operations."""

    file_url = serializers.SerializerMethodField()
    file_size_display = serializers.CharField(read_only=True)
    extension = serializers.CharField(read_only=True)
    content_type_name = serializers.SerializerMethodField()
    file_type_display = serializers.CharField(source='get_file_type_display', read_only=True)
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    uploaded_by_email = serializers.EmailField(source='uploaded_by.email', read_only=True)

    class Meta:
        model = Document
        fields = [
            'id',
            'name',
            'original_filename',
            'description',
            'file_url',
            'file_type',
            'file_type_display',
            'mime_type',
            'file_size',
            'file_size_display',
            'extension',
            'document_type',
            'document_type_display',
            'uploaded_by',
            'uploaded_by_email',
            'upload_date',
            'content_type',
            'content_type_name',
            'object_id',
            'version',
            'is_current',
            'previous_version',
            'tags',
            'organization',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'file_size',
            'file_size_display',
            'extension',
            'upload_date',
            'version',
            'is_current',
            'previous_version',
            'created_at',
            'updated_at',
        ]

    def get_file_url(self, obj):
        """Get the file URL."""
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None

    def get_content_type_name(self, obj):
        """Return human-readable content type name."""
        if obj.content_type:
            return f"{obj.content_type.app_label}.{obj.content_type.model}"
        return None


class DocumentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""

    file_size_display = serializers.CharField(read_only=True)
    file_type_display = serializers.CharField(source='get_file_type_display', read_only=True)
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)

    class Meta:
        model = Document
        fields = [
            'id',
            'name',
            'original_filename',
            'file_type',
            'file_type_display',
            'file_size',
            'file_size_display',
            'document_type',
            'document_type_display',
            'upload_date',
            'version',
            'is_current',
        ]
        read_only_fields = fields


class DocumentUploadSerializer(serializers.Serializer):
    """Serializer for document upload."""

    file = serializers.FileField(required=True)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    document_type = serializers.ChoiceField(
        choices=Document.DocumentType.choices,
        required=False,
        default=Document.DocumentType.OTHER,
    )
    content_type = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Content type in format 'app_label.model_name'",
    )
    object_id = serializers.UUIDField(required=False, allow_null=True)
    tags = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )


class DocumentUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating document metadata."""

    class Meta:
        model = Document
        fields = [
            'name',
            'description',
            'document_type',
            'tags',
        ]


class NewVersionSerializer(serializers.Serializer):
    """Serializer for uploading a new version."""

    file = serializers.FileField(required=True)


class DocumentVersionSerializer(serializers.ModelSerializer):
    """Serializer for version history."""

    file_size_display = serializers.CharField(read_only=True)
    uploaded_by_email = serializers.EmailField(source='uploaded_by.email', read_only=True)

    class Meta:
        model = Document
        fields = [
            'id',
            'version',
            'is_current',
            'original_filename',
            'file_size',
            'file_size_display',
            'upload_date',
            'uploaded_by',
            'uploaded_by_email',
        ]
        read_only_fields = fields


class ForObjectRequestSerializer(serializers.Serializer):
    """Serializer for for_object endpoint request parameters."""

    content_type = serializers.CharField(
        help_text="Content type in format 'app_label.model_name'"
    )
    object_id = serializers.UUIDField(
        help_text="UUID of the object"
    )


class DocumentConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for DocumentConfiguration."""

    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True,
    )
    max_file_size_bytes = serializers.IntegerField(read_only=True)

    class Meta:
        model = DocumentConfiguration
        fields = [
            'organization',
            'organization_name',
            'max_file_size_mb',
            'max_file_size_bytes',
            'allowed_extensions',
            'require_document_type',
        ]
        read_only_fields = ['organization', 'organization_name', 'max_file_size_bytes']
