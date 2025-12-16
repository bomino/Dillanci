"""
Document Service for file validation, upload, and versioning.
"""

import mimetypes
import os
from typing import Optional

from django.contrib.contenttypes.models import ContentType
from django.core.files.uploadedfile import UploadedFile
from django.db.models import Model

from apps.core.exceptions import FileTooLargeError, InvalidFileTypeError
from apps.documents.models import Document, DocumentConfiguration


class DocumentService:
    """
    Service for managing documents.

    Provides methods for:
    - Validating files before upload
    - Creating documents with proper metadata
    - Handling document versioning
    - Retrieving documents for objects
    """

    @staticmethod
    def validate_file(
        file: UploadedFile,
        organization,
        config: Optional[DocumentConfiguration] = None,
    ) -> None:
        """
        Validate an uploaded file against organization settings.

        Args:
            file: The uploaded file to validate
            organization: The organization context
            config: Optional pre-fetched configuration

        Raises:
            FileTooLargeError: If file exceeds size limit
            InvalidFileTypeError: If file extension is not allowed
        """
        if config is None:
            config = DocumentConfiguration.get_for_organization(organization)

        # Check file size
        if not config.is_file_size_allowed(file.size):
            raise FileTooLargeError(
                filename=file.name,
                size_bytes=file.size,
                max_size_bytes=config.max_file_size_bytes,
            )

        # Check file extension
        if not config.is_extension_allowed(file.name):
            raise InvalidFileTypeError(
                filename=file.name,
                allowed_extensions=config.allowed_extensions,
            )

    @staticmethod
    def create_document(
        file: UploadedFile,
        organization,
        uploaded_by=None,
        name: Optional[str] = None,
        description: str = '',
        document_type: str = Document.DocumentType.OTHER,
        content_object: Optional[Model] = None,
        tags: Optional[list] = None,
        validate: bool = True,
    ) -> Document:
        """
        Create a new document from an uploaded file.

        Args:
            file: The uploaded file
            organization: The organization context
            uploaded_by: The user uploading the file
            name: Display name (defaults to original filename)
            description: Optional description
            document_type: Type of document
            content_object: Optional object to attach to
            tags: Optional list of tags
            validate: Whether to validate the file (default True)

        Returns:
            The created Document instance

        Raises:
            FileTooLargeError: If file exceeds size limit
            InvalidFileTypeError: If file extension is not allowed
        """
        if validate:
            DocumentService.validate_file(file, organization)

        # Detect file type and MIME type
        file_type = Document.detect_file_type(
            file.name,
            getattr(file, 'content_type', ''),
        )
        mime_type = getattr(file, 'content_type', None)
        if not mime_type:
            mime_type, _ = mimetypes.guess_type(file.name)
            mime_type = mime_type or 'application/octet-stream'

        # Prepare content type for generic relation
        content_type = None
        object_id = None
        if content_object:
            content_type = ContentType.objects.get_for_model(content_object)
            object_id = content_object.pk

        # Create the document
        document = Document.objects.create(
            organization=organization,
            name=name or os.path.splitext(file.name)[0],
            original_filename=file.name,
            description=description,
            file=file,
            file_type=file_type,
            mime_type=mime_type,
            file_size=file.size,
            document_type=document_type,
            uploaded_by=uploaded_by,
            content_type=content_type,
            object_id=object_id,
            tags=tags or [],
        )

        return document

    @staticmethod
    def create_new_version(
        document: Document,
        file: UploadedFile,
        uploaded_by=None,
        validate: bool = True,
    ) -> Document:
        """
        Create a new version of an existing document.

        Args:
            document: The existing document to version
            file: The new file
            uploaded_by: The user uploading
            validate: Whether to validate the file

        Returns:
            The new Document version

        Raises:
            FileTooLargeError: If file exceeds size limit
            InvalidFileTypeError: If file extension is not allowed
        """
        if validate:
            DocumentService.validate_file(file, document.organization)

        return document.create_new_version(file, uploaded_by)

    @staticmethod
    def get_documents_for_object(
        content_object: Model,
        current_only: bool = True,
        include_deleted: bool = False,
    ):
        """
        Get all documents attached to an object.

        Args:
            content_object: The object to get documents for
            current_only: Only return current versions (default True)
            include_deleted: Include soft-deleted documents (default False)

        Returns:
            QuerySet of Documents
        """
        content_type = ContentType.objects.get_for_model(content_object)

        if include_deleted:
            qs = Document.all_objects.filter(
                content_type=content_type,
                object_id=content_object.pk,
            )
        else:
            qs = Document.objects.filter(
                content_type=content_type,
                object_id=content_object.pk,
            )

        if current_only:
            qs = qs.filter(is_current=True)

        return qs.order_by('-upload_date')

    @staticmethod
    def attach_to_object(
        document: Document,
        content_object: Model,
    ) -> Document:
        """
        Attach a document to an object.

        Args:
            document: The document to attach
            content_object: The object to attach to

        Returns:
            The updated Document
        """
        content_type = ContentType.objects.get_for_model(content_object)
        document.content_type = content_type
        document.object_id = content_object.pk
        document.save(update_fields=['content_type', 'object_id', 'updated_at'])
        return document

    @staticmethod
    def detach_from_object(document: Document) -> Document:
        """
        Detach a document from its current object.

        Args:
            document: The document to detach

        Returns:
            The updated Document
        """
        document.content_type = None
        document.object_id = None
        document.save(update_fields=['content_type', 'object_id', 'updated_at'])
        return document

    @staticmethod
    def get_version_history(document: Document):
        """
        Get all versions of a document.

        Args:
            document: Any version of the document

        Returns:
            List of Document versions, newest first
        """
        return document.get_all_versions()

    @staticmethod
    def get_current_version(document: Document) -> Document:
        """
        Get the current version of a document.

        Args:
            document: Any version of the document

        Returns:
            The current version Document
        """
        # If this is already current, return it
        if document.is_current:
            return document

        # Find the current version in the chain
        versions = document.get_all_versions()
        for version in versions:
            if version.is_current:
                return version

        # Fallback to the latest version
        return versions[0] if versions else document

    @staticmethod
    def count_documents_for_organization(organization) -> int:
        """
        Count total documents for an organization.

        Args:
            organization: The organization

        Returns:
            Count of non-deleted documents
        """
        return Document.objects.filter(organization=organization).count()

    @staticmethod
    def get_total_storage_used(organization) -> int:
        """
        Get total storage used by organization in bytes.

        Args:
            organization: The organization

        Returns:
            Total storage in bytes
        """
        from django.db.models import Sum

        result = Document.objects.filter(
            organization=organization
        ).aggregate(total=Sum('file_size'))

        return result['total'] or 0

    @staticmethod
    def get_storage_used_display(organization) -> str:
        """
        Get human-readable storage used.

        Args:
            organization: The organization

        Returns:
            Human-readable storage string
        """
        size = DocumentService.get_total_storage_used(organization)
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"
