"""
API tests for Document endpoints.
"""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient

from apps.documents.models import Document, DocumentConfiguration
from apps.organizations.models import Organization
from apps.suppliers.models import Supplier
from apps.users.models import User


@pytest.fixture
def api_client():
    """Return an API client instance."""
    return APIClient()


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(name='Test Org', code='TEST001')


@pytest.fixture
def other_organization(db):
    """Create another organization for isolation tests."""
    return Organization.objects.create(name='Other Org', code='OTHER001')


@pytest.fixture
def user(db, organization):
    """Create a test user."""
    return User.objects.create_user(
        email='user@example.com',
        password='testpass123',
        first_name='Test',
        last_name='User',
        organization=organization,
    )


@pytest.fixture
def authenticated_client(api_client, user):
    """Return an authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def doc_config(db, organization):
    """Create document configuration."""
    return DocumentConfiguration.objects.create(
        organization=organization,
        max_file_size_mb=10,
        allowed_extensions=['pdf', 'docx', 'xlsx', 'jpg', 'png'],
    )


@pytest.fixture
def test_file():
    """Create a test file for upload."""
    return SimpleUploadedFile(
        name='test_document.pdf',
        content=b'%PDF-1.4 Test PDF content',
        content_type='application/pdf',
    )


@pytest.fixture
def document(db, organization, user, test_file):
    """Create a test document."""
    return Document.objects.create(
        organization=organization,
        name='Test Document',
        original_filename='test_document.pdf',
        file=test_file,
        file_type=Document.FileType.PDF,
        mime_type='application/pdf',
        file_size=len(b'%PDF-1.4 Test PDF content'),
        document_type=Document.DocumentType.CONTRACT,
        uploaded_by=user,
    )


@pytest.fixture
def supplier(db, organization):
    """Create a test supplier."""
    return Supplier.objects.create(
        organization=organization,
        code='SUP001',
        name='Test Supplier',
        status='PROSPECT',
    )


@pytest.mark.django_db
class TestDocumentViewSet:
    """Tests for /api/v1/documents/ endpoints."""

    def test_list_documents(self, authenticated_client, document):
        """Can list documents for organization."""
        response = authenticated_client.get('/api/v1/documents/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['id'] == str(document.id)

    def test_list_documents_organization_isolation(
        self, authenticated_client, document, other_organization
    ):
        """Can only see documents for own organization."""
        # Create document in other organization
        other_file = SimpleUploadedFile(
            name='other.pdf',
            content=b'other',
            content_type='application/pdf',
        )
        Document.objects.create(
            organization=other_organization,
            name='Other Doc',
            original_filename='other.pdf',
            file=other_file,
            file_type=Document.FileType.PDF,
            file_size=5,
        )

        response = authenticated_client.get('/api/v1/documents/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1  # Only own org's doc

    def test_list_documents_filter_by_document_type(
        self, authenticated_client, document, organization, user, doc_config
    ):
        """Can filter documents by document_type."""
        # Create another document with different type
        file = SimpleUploadedFile(
            name='invoice.pdf',
            content=b'invoice',
            content_type='application/pdf',
        )
        Document.objects.create(
            organization=organization,
            name='Invoice',
            original_filename='invoice.pdf',
            file=file,
            file_type=Document.FileType.PDF,
            file_size=7,
            document_type=Document.DocumentType.INVOICE,
            uploaded_by=user,
        )

        response = authenticated_client.get(
            '/api/v1/documents/?document_type=CONTRACT'
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['document_type'] == 'CONTRACT'

    def test_upload_document(self, authenticated_client, organization, doc_config):
        """Can upload a new document."""
        file = SimpleUploadedFile(
            name='new_doc.pdf',
            content=b'%PDF-1.4 New document',
            content_type='application/pdf',
        )

        response = authenticated_client.post(
            '/api/v1/documents/',
            {
                'file': file,
                'name': 'New Document',
                'document_type': 'CONTRACT',
            },
            format='multipart',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'New Document'
        assert response.data['document_type'] == 'CONTRACT'
        assert Document.objects.filter(name='New Document').exists()

    def test_upload_document_validates_size(self, authenticated_client, organization, doc_config):
        """Upload rejects files that are too large."""
        large_file = SimpleUploadedFile(
            name='large.pdf',
            content=b'x' * (11 * 1024 * 1024),  # 11 MB
            content_type='application/pdf',
        )

        response = authenticated_client.post(
            '/api/v1/documents/',
            {'file': large_file},
            format='multipart',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_document_validates_type(self, authenticated_client, organization, doc_config):
        """Upload rejects files with invalid extensions."""
        invalid_file = SimpleUploadedFile(
            name='malware.exe',
            content=b'malware',
            content_type='application/octet-stream',
        )

        response = authenticated_client.post(
            '/api/v1/documents/',
            {'file': invalid_file},
            format='multipart',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_document_detail(self, authenticated_client, document):
        """Can get document details."""
        response = authenticated_client.get(f'/api/v1/documents/{document.id}/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(document.id)
        assert response.data['name'] == 'Test Document'
        assert 'file_url' in response.data

    def test_update_document_metadata(self, authenticated_client, document):
        """Can update document metadata."""
        response = authenticated_client.patch(
            f'/api/v1/documents/{document.id}/',
            {
                'name': 'Updated Name',
                'description': 'Updated description',
            },
        )

        assert response.status_code == status.HTTP_200_OK
        document.refresh_from_db()
        assert document.name == 'Updated Name'
        assert document.description == 'Updated description'

    def test_delete_document(self, authenticated_client, document):
        """Can soft delete a document."""
        response = authenticated_client.delete(f'/api/v1/documents/{document.id}/')

        assert response.status_code == status.HTTP_204_NO_CONTENT
        document.refresh_from_db()
        assert document.is_deleted is True

    def test_download_document(self, authenticated_client, document):
        """Can download document file."""
        response = authenticated_client.get(
            f'/api/v1/documents/{document.id}/download/'
        )

        assert response.status_code == status.HTTP_200_OK
        assert 'attachment' in response.get('Content-Disposition', '')

    def test_upload_new_version(self, authenticated_client, document, doc_config):
        """Can upload new version of document."""
        new_file = SimpleUploadedFile(
            name='v2.pdf',
            content=b'%PDF-1.4 Version 2',
            content_type='application/pdf',
        )

        response = authenticated_client.post(
            f'/api/v1/documents/{document.id}/new_version/',
            {'file': new_file},
            format='multipart',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['version'] == 2
        assert response.data['is_current'] is True

    def test_get_version_history(self, authenticated_client, document, user, doc_config):
        """Can get version history."""
        # Create v2
        new_file = SimpleUploadedFile(
            name='v2.pdf',
            content=b'v2',
            content_type='application/pdf',
        )
        doc_v2 = document.create_new_version(new_file, user)

        # Get versions from the current version (v2)
        response = authenticated_client.get(
            f'/api/v1/documents/{doc_v2.id}/versions/'
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_for_object_endpoint(self, authenticated_client, organization, user, supplier, doc_config):
        """Can get documents for specific object."""
        # Create document attached to supplier
        file = SimpleUploadedFile(
            name='supplier_doc.pdf',
            content=b'%PDF',
            content_type='application/pdf',
        )
        from apps.documents.services import DocumentService
        DocumentService.create_document(
            file=file,
            organization=organization,
            uploaded_by=user,
            content_object=supplier,
        )

        response = authenticated_client.get(
            f'/api/v1/documents/for_object/'
            f'?content_type=suppliers.supplier&object_id={supplier.pk}'
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_for_object_invalid_content_type(self, authenticated_client, supplier):
        """for_object returns 400 for invalid content type."""
        response = authenticated_client.get(
            f'/api/v1/documents/for_object/'
            f'?content_type=invalid.model&object_id={supplier.pk}'
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_access_denied(self, api_client, document):
        """Unauthenticated users cannot access documents."""
        response = api_client.get('/api/v1/documents/')

        # DRF returns 403 for session auth when not authenticated
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]


@pytest.mark.django_db
class TestDocumentConfigurationViewSet:
    """Tests for /api/v1/documents/config/ endpoints."""

    def test_list_config(self, authenticated_client, doc_config):
        """Can get document configuration."""
        response = authenticated_client.get('/api/v1/documents/config/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['max_file_size_mb'] == 10

    def test_list_config_creates_if_not_exists(self, authenticated_client, organization):
        """List creates config if it doesn't exist."""
        assert not DocumentConfiguration.objects.filter(organization=organization).exists()

        response = authenticated_client.get('/api/v1/documents/config/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert DocumentConfiguration.objects.filter(organization=organization).exists()

    def test_update_config(self, authenticated_client, doc_config):
        """Can update document configuration."""
        response = authenticated_client.patch(
            f'/api/v1/documents/config/{doc_config.organization_id}/',
            {
                'max_file_size_mb': 50,
                'require_document_type': True,
            },
        )

        assert response.status_code == status.HTTP_200_OK
        doc_config.refresh_from_db()
        assert doc_config.max_file_size_mb == 50
        assert doc_config.require_document_type is True

    def test_update_allowed_extensions(self, authenticated_client, doc_config):
        """Can update allowed extensions list."""
        response = authenticated_client.patch(
            f'/api/v1/documents/config/{doc_config.organization_id}/',
            {
                'allowed_extensions': ['pdf', 'doc'],
            },
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        doc_config.refresh_from_db()
        assert doc_config.allowed_extensions == ['pdf', 'doc']

    def test_create_config_not_allowed(self, authenticated_client, organization):
        """Cannot manually create config via POST."""
        response = authenticated_client.post(
            '/api/v1/documents/config/',
            {
                'organization': str(organization.id),
                'max_file_size_mb': 20,
            },
        )

        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_config_organization_isolation(
        self, authenticated_client, doc_config, other_organization
    ):
        """Can only access own organization's config."""
        other_config = DocumentConfiguration.objects.create(
            organization=other_organization,
            max_file_size_mb=50,
        )

        response = authenticated_client.get(
            f'/api/v1/documents/config/{other_config.organization_id}/'
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
