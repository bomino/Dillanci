"""
Tests for Document services.
"""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.core.exceptions import FileTooLargeError, InvalidFileTypeError
from apps.documents.models import Document, DocumentConfiguration
from apps.documents.services import DocumentService
from apps.organizations.models import Organization
from apps.suppliers.models import Supplier
from apps.users.models import User


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(name='Test Org', code='TEST001')


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
def doc_config(db, organization):
    """Create document configuration."""
    return DocumentConfiguration.objects.create(
        organization=organization,
        max_file_size_mb=10,
        allowed_extensions=['pdf', 'docx', 'xlsx'],
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
class TestDocumentServiceValidation:
    """Tests for DocumentService.validate_file."""

    def test_validate_file_success(self, organization, doc_config):
        """Valid file passes validation."""
        file = SimpleUploadedFile(
            name='valid.pdf',
            content=b'x' * 1000,
            content_type='application/pdf',
        )

        # Should not raise
        DocumentService.validate_file(file, organization, doc_config)

    def test_validate_file_too_large(self, organization, doc_config):
        """Large file raises FileTooLargeError."""
        file = SimpleUploadedFile(
            name='large.pdf',
            content=b'x' * (11 * 1024 * 1024),  # 11 MB
            content_type='application/pdf',
        )

        with pytest.raises(FileTooLargeError) as exc_info:
            DocumentService.validate_file(file, organization, doc_config)

        assert 'large.pdf' in str(exc_info.value.message)

    def test_validate_file_invalid_type(self, organization, doc_config):
        """Invalid extension raises InvalidFileTypeError."""
        file = SimpleUploadedFile(
            name='file.exe',
            content=b'x' * 100,
            content_type='application/octet-stream',
        )

        with pytest.raises(InvalidFileTypeError) as exc_info:
            DocumentService.validate_file(file, organization, doc_config)

        assert 'file.exe' in str(exc_info.value.message)


@pytest.mark.django_db
class TestDocumentServiceCreate:
    """Tests for DocumentService.create_document."""

    def test_create_document_basic(self, organization, user, test_file, doc_config):
        """Can create a basic document."""
        doc = DocumentService.create_document(
            file=test_file,
            organization=organization,
            uploaded_by=user,
        )

        assert doc.id is not None
        assert doc.organization == organization
        assert doc.uploaded_by == user
        assert doc.version == 1
        assert doc.is_current is True

    def test_create_document_with_metadata(self, organization, user, doc_config):
        """Can create document with metadata."""
        file = SimpleUploadedFile(
            name='contract.pdf',
            content=b'%PDF-1.4',
            content_type='application/pdf',
        )

        doc = DocumentService.create_document(
            file=file,
            organization=organization,
            uploaded_by=user,
            name='Legal Contract',
            description='Important legal document',
            document_type=Document.DocumentType.CONTRACT,
            tags=['legal', 'important'],
        )

        assert doc.name == 'Legal Contract'
        assert doc.description == 'Important legal document'
        assert doc.document_type == Document.DocumentType.CONTRACT
        assert doc.tags == ['legal', 'important']

    def test_create_document_with_content_object(self, organization, user, supplier, doc_config):
        """Can create document attached to an object."""
        file = SimpleUploadedFile(
            name='supplier_cert.pdf',
            content=b'%PDF-1.4',
            content_type='application/pdf',
        )

        doc = DocumentService.create_document(
            file=file,
            organization=organization,
            uploaded_by=user,
            content_object=supplier,
        )

        assert doc.content_type is not None
        assert doc.object_id == supplier.pk
        assert doc.content_object == supplier

    def test_create_document_detects_file_type(self, organization, user, doc_config):
        """File type is detected from filename."""
        file = SimpleUploadedFile(
            name='spreadsheet.xlsx',
            content=b'x' * 100,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )

        doc = DocumentService.create_document(
            file=file,
            organization=organization,
            uploaded_by=user,
        )

        assert doc.file_type == Document.FileType.EXCEL

    def test_create_document_skip_validation(self, organization, user):
        """Can skip validation when needed."""
        # No config created, so validation would fail
        file = SimpleUploadedFile(
            name='file.exe',
            content=b'x' * 100,
            content_type='application/octet-stream',
        )

        # Should not raise with validate=False
        doc = DocumentService.create_document(
            file=file,
            organization=organization,
            uploaded_by=user,
            validate=False,
        )

        assert doc is not None


@pytest.mark.django_db
class TestDocumentServiceVersioning:
    """Tests for DocumentService.create_new_version."""

    def test_create_new_version(self, document, user, doc_config):
        """Can create a new version."""
        new_file = SimpleUploadedFile(
            name='v2.pdf',
            content=b'%PDF-1.4 v2',
            content_type='application/pdf',
        )

        new_doc = DocumentService.create_new_version(
            document=document,
            file=new_file,
            uploaded_by=user,
        )

        assert new_doc.version == 2
        assert new_doc.is_current is True
        assert new_doc.previous_version == document

    def test_get_version_history(self, document, user, doc_config):
        """Can get version history."""
        file_v2 = SimpleUploadedFile(
            name='v2.pdf',
            content=b'v2',
            content_type='application/pdf',
        )
        doc_v2 = DocumentService.create_new_version(document, file_v2, user)

        history = DocumentService.get_version_history(doc_v2)

        assert len(history) == 2
        assert history[0].version == 2

    def test_get_current_version(self, document, user, doc_config):
        """Can get current version from any version."""
        file_v2 = SimpleUploadedFile(
            name='v2.pdf',
            content=b'v2',
            content_type='application/pdf',
        )
        doc_v2 = DocumentService.create_new_version(document, file_v2, user)

        # Get current from v1
        document.refresh_from_db()
        current = DocumentService.get_current_version(document)

        assert current == doc_v2
        assert current.is_current is True


@pytest.mark.django_db
class TestDocumentServiceForObject:
    """Tests for DocumentService.get_documents_for_object."""

    def test_get_documents_for_object(self, organization, user, supplier, doc_config):
        """Can get documents for an object."""
        # Create documents attached to supplier
        for i in range(3):
            file = SimpleUploadedFile(
                name=f'doc{i}.pdf',
                content=b'%PDF',
                content_type='application/pdf',
            )
            DocumentService.create_document(
                file=file,
                organization=organization,
                uploaded_by=user,
                content_object=supplier,
            )

        docs = DocumentService.get_documents_for_object(supplier)

        assert docs.count() == 3

    def test_get_documents_current_only(self, organization, user, supplier, doc_config):
        """current_only filter works."""
        file = SimpleUploadedFile(
            name='doc.pdf',
            content=b'%PDF',
            content_type='application/pdf',
        )
        doc = DocumentService.create_document(
            file=file,
            organization=organization,
            uploaded_by=user,
            content_object=supplier,
        )

        # Create new version
        file_v2 = SimpleUploadedFile(
            name='v2.pdf',
            content=b'v2',
            content_type='application/pdf',
        )
        DocumentService.create_new_version(doc, file_v2, user)

        current_docs = DocumentService.get_documents_for_object(supplier, current_only=True)
        all_docs = DocumentService.get_documents_for_object(supplier, current_only=False)

        assert current_docs.count() == 1
        assert all_docs.count() == 2


@pytest.mark.django_db
class TestDocumentServiceAttachment:
    """Tests for DocumentService attachment methods."""

    def test_attach_to_object(self, document, supplier):
        """Can attach document to object."""
        DocumentService.attach_to_object(document, supplier)

        document.refresh_from_db()
        assert document.object_id == supplier.pk
        assert document.content_object == supplier

    def test_detach_from_object(self, organization, user, supplier, doc_config):
        """Can detach document from object."""
        file = SimpleUploadedFile(
            name='doc.pdf',
            content=b'%PDF',
            content_type='application/pdf',
        )
        doc = DocumentService.create_document(
            file=file,
            organization=organization,
            uploaded_by=user,
            content_object=supplier,
        )

        DocumentService.detach_from_object(doc)

        doc.refresh_from_db()
        assert doc.object_id is None
        assert doc.content_type is None


@pytest.mark.django_db
class TestDocumentServiceStorage:
    """Tests for DocumentService storage methods."""

    def test_count_documents_for_organization(self, organization, user, doc_config):
        """Can count documents for organization."""
        # Create some documents
        for i in range(5):
            file = SimpleUploadedFile(
                name=f'doc{i}.pdf',
                content=b'%PDF',
                content_type='application/pdf',
            )
            DocumentService.create_document(
                file=file,
                organization=organization,
                uploaded_by=user,
            )

        count = DocumentService.count_documents_for_organization(organization)

        assert count == 5

    def test_get_total_storage_used(self, organization, user, doc_config):
        """Can calculate total storage used."""
        # Create documents with known sizes
        for i in range(3):
            file = SimpleUploadedFile(
                name=f'doc{i}.pdf',
                content=b'x' * 1000,  # 1000 bytes each
                content_type='application/pdf',
            )
            DocumentService.create_document(
                file=file,
                organization=organization,
                uploaded_by=user,
            )

        total = DocumentService.get_total_storage_used(organization)

        assert total == 3000

    def test_get_storage_used_display(self, organization, user, doc_config):
        """Storage display is human readable."""
        file = SimpleUploadedFile(
            name='doc.pdf',
            content=b'x' * (2 * 1024 * 1024),  # 2 MB
            content_type='application/pdf',
        )
        DocumentService.create_document(
            file=file,
            organization=organization,
            uploaded_by=user,
        )

        display = DocumentService.get_storage_used_display(organization)

        assert 'MB' in display
