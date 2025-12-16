"""
ViewSets for Documents module.
"""

from django.contrib.contenttypes.models import ContentType
from django.http import FileResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import (
    FileTooLargeAPIException,
    FileTooLargeError,
    InvalidFileTypeAPIException,
    InvalidFileTypeError,
)
from apps.documents.models import Document, DocumentConfiguration
from apps.documents.serializers import (
    DocumentConfigurationSerializer,
    DocumentListSerializer,
    DocumentSerializer,
    DocumentUpdateSerializer,
    DocumentUploadSerializer,
    DocumentVersionSerializer,
    ForObjectRequestSerializer,
    NewVersionSerializer,
)
from apps.documents.services import DocumentService


class DocumentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for document management.

    Provides CRUD for documents with file upload/download capabilities.

    list:
        Get paginated list of documents for the organization.

    create:
        Upload a new document (multipart form data).

    retrieve:
        Get document metadata.

    update/partial_update:
        Update document metadata (not the file).

    destroy:
        Soft delete a document.

    download:
        Download the document file.

    new_version:
        Upload a new version of the document.

    versions:
        Get version history for the document.

    for_object:
        Get documents attached to a specific object.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.action == 'list':
            return DocumentListSerializer
        if self.action == 'create':
            return DocumentUploadSerializer
        if self.action in ['update', 'partial_update']:
            return DocumentUpdateSerializer
        if self.action == 'new_version':
            return NewVersionSerializer
        if self.action == 'versions':
            return DocumentVersionSerializer
        return DocumentSerializer

    def get_queryset(self):
        """Filter documents to user's organization."""
        user = self.request.user
        if not hasattr(user, 'organization') or not user.organization:
            return Document.objects.none()

        queryset = Document.objects.filter(
            organization=user.organization
        ).select_related('uploaded_by', 'content_type')

        # Filter by document type
        doc_type = self.request.query_params.get('document_type')
        if doc_type:
            queryset = queryset.filter(document_type=doc_type)

        # Filter by file type
        file_type = self.request.query_params.get('file_type')
        if file_type:
            queryset = queryset.filter(file_type=file_type)

        # Filter current versions only
        current_only = self.request.query_params.get('current_only', 'true')
        if current_only.lower() == 'true':
            queryset = queryset.filter(is_current=True)

        # Filter by tag
        tag = self.request.query_params.get('tag')
        if tag:
            queryset = queryset.filter(tags__contains=[tag])

        return queryset

    def create(self, request, *args, **kwargs):
        """Upload a new document."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        file = data['file']

        # Get content object if specified
        content_object = None
        if data.get('content_type') and data.get('object_id'):
            try:
                app_label, model = data['content_type'].split('.')
                ct = ContentType.objects.get(app_label=app_label, model=model)
                model_class = ct.model_class()
                content_object = model_class.objects.get(pk=data['object_id'])
            except (ValueError, ContentType.DoesNotExist, Exception):
                return Response(
                    {'error': f"Invalid content type or object: {data.get('content_type')}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            document = DocumentService.create_document(
                file=file,
                organization=request.user.organization,
                uploaded_by=request.user,
                name=data.get('name'),
                description=data.get('description', ''),
                document_type=data.get('document_type', Document.DocumentType.OTHER),
                content_object=content_object,
                tags=data.get('tags', []),
            )
        except FileTooLargeError as e:
            raise FileTooLargeAPIException(detail=str(e))
        except InvalidFileTypeError as e:
            raise InvalidFileTypeAPIException(detail=str(e))

        output_serializer = DocumentSerializer(document, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        """Soft delete the document."""
        instance.soft_delete()

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download the document file."""
        document = self.get_object()

        if not document.file:
            return Response(
                {'error': 'File not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        response = FileResponse(
            document.file.open('rb'),
            content_type=document.mime_type or 'application/octet-stream',
        )
        response['Content-Disposition'] = (
            f'attachment; filename="{document.original_filename}"'
        )
        return response

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def new_version(self, request, pk=None):
        """Upload a new version of the document."""
        document = self.get_object()

        serializer = NewVersionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file = serializer.validated_data['file']

        try:
            new_doc = DocumentService.create_new_version(
                document=document,
                file=file,
                uploaded_by=request.user,
            )
        except FileTooLargeError as e:
            raise FileTooLargeAPIException(detail=str(e))
        except InvalidFileTypeError as e:
            raise InvalidFileTypeAPIException(detail=str(e))

        output_serializer = DocumentSerializer(new_doc, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Get version history for the document."""
        document = self.get_object()
        versions = DocumentService.get_version_history(document)

        serializer = DocumentVersionSerializer(versions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def for_object(self, request):
        """
        Get documents attached to a specific object.

        Query params:
            content_type: Content type in format 'app_label.model_name'
            object_id: UUID of the object
        """
        serializer = ForObjectRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        content_type_str = serializer.validated_data['content_type']
        object_id = serializer.validated_data['object_id']

        try:
            app_label, model = content_type_str.split('.')
            content_type = ContentType.objects.get(app_label=app_label, model=model)
        except (ValueError, ContentType.DoesNotExist):
            return Response(
                {'error': f"Invalid content type: {content_type_str}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = self.get_queryset().filter(
            content_type=content_type,
            object_id=object_id,
            is_current=True,
        )

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = DocumentListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = DocumentListSerializer(queryset, many=True)
        return Response(serializer.data)


class DocumentConfigurationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing document configuration.

    Provides CRUD for organization document settings.
    Only allows access to the user's own organization config.
    """

    serializer_class = DocumentConfigurationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter to user's organization config only."""
        user = self.request.user
        if not hasattr(user, 'organization') or not user.organization:
            return DocumentConfiguration.objects.none()

        return DocumentConfiguration.objects.filter(
            organization=user.organization
        )

    def list(self, request, *args, **kwargs):
        """Get or create config for user's organization."""
        user = request.user
        if not hasattr(user, 'organization') or not user.organization:
            return Response({'results': []})

        config = DocumentConfiguration.get_for_organization(user.organization)
        serializer = self.get_serializer(config)
        return Response({'results': [serializer.data]})

    def create(self, request, *args, **kwargs):
        """Create is not allowed - config is auto-created."""
        return Response(
            {'error': 'Configuration is created automatically. Use PUT to update.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )
