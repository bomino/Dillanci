"""
Tests for Document models.
"""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.documents.models import Document, DocumentConfiguration
from apps.organizations.models import Organization
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


@pytest.mark.django_db
class TestDocument:
    """Tests for Document model."""

    def test_document_creation(self, organization, user, test_file):
        """Can create a document."""
        doc = Document.objects.create(
            organization=organization,
            name='Test Doc',
            original_filename='test.pdf',
            file=test_file,
            file_type=Document.FileType.PDF,
            file_size=100,
            uploaded_by=user,
        )

        assert doc.id is not None
        assert doc.name == 'Test Doc'
        assert doc.version == 1
        assert doc.is_current is True

    def test_document_str(self, document):
        """Document has meaningful string representation."""
        doc_str = str(document)
        assert 'Test Document' in doc_str
        assert 'v1' in doc_str

    def test_document_extension(self, document):
        """Can get file extension."""
        assert document.extension == '.pdf'

    def test_document_file_size_display(self, document):
        """File size is formatted correctly."""
        # Small file
        document.file_size = 500
        assert 'B' in document.file_size_display

        document.file_size = 2048
        assert 'KB' in document.file_size_display

        document.file_size = 5 * 1024 * 1024
        assert 'MB' in document.file_size_display

    def test_detect_file_type_pdf(self):
        """Detects PDF file type."""
        assert Document.detect_file_type('test.pdf') == Document.FileType.PDF
        assert Document.detect_file_type('test.PDF') == Document.FileType.PDF

    def test_detect_file_type_excel(self):
        """Detects Excel file type."""
        assert Document.detect_file_type('test.xlsx') == Document.FileType.EXCEL
        assert Document.detect_file_type('test.xls') == Document.FileType.EXCEL

    def test_detect_file_type_word(self):
        """Detects Word file type."""
        assert Document.detect_file_type('test.docx') == Document.FileType.WORD
        assert Document.detect_file_type('test.doc') == Document.FileType.WORD

    def test_detect_file_type_image(self):
        """Detects image file type."""
        assert Document.detect_file_type('test.jpg') == Document.FileType.IMAGE
        assert Document.detect_file_type('test.png') == Document.FileType.IMAGE
        assert Document.detect_file_type('test.gif') == Document.FileType.IMAGE

    def test_detect_file_type_other(self):
        """Returns OTHER for unknown file types."""
        assert Document.detect_file_type('test.xyz') == Document.FileType.OTHER
        assert Document.detect_file_type('test.bin') == Document.FileType.OTHER

    def test_detect_file_type_from_mime(self):
        """Can detect file type from MIME type."""
        assert Document.detect_file_type('file', 'application/pdf') == Document.FileType.PDF
        assert Document.detect_file_type('file', 'image/jpeg') == Document.FileType.IMAGE

    def test_soft_delete(self, document):
        """Document can be soft deleted."""
        document.soft_delete()
        document.refresh_from_db()

        assert document.is_deleted is True
        assert document.deleted_at is not None

    def test_soft_delete_excluded_from_queryset(self, document):
        """Soft deleted documents excluded from default queryset."""
        doc_id = document.id
        document.soft_delete()

        assert not Document.objects.filter(id=doc_id).exists()
        assert Document.all_objects.filter(id=doc_id).exists()


@pytest.mark.django_db
class TestDocumentVersioning:
    """Tests for Document versioning."""

    def test_create_new_version(self, document, user):
        """Can create a new version of a document."""
        new_file = SimpleUploadedFile(
            name='test_v2.pdf',
            content=b'%PDF-1.4 Updated content',
            content_type='application/pdf',
        )

        new_doc = document.create_new_version(new_file, uploaded_by=user)

        assert new_doc.version == 2
        assert new_doc.is_current is True
        assert new_doc.previous_version == document

        document.refresh_from_db()
        assert document.is_current is False

    def test_get_all_versions(self, document, user):
        """Can get all versions of a document."""
        # Create version 2
        file_v2 = SimpleUploadedFile(
            name='v2.pdf',
            content=b'v2',
            content_type='application/pdf',
        )
        doc_v2 = document.create_new_version(file_v2, uploaded_by=user)

        # Create version 3
        file_v3 = SimpleUploadedFile(
            name='v3.pdf',
            content=b'v3',
            content_type='application/pdf',
        )
        doc_v3 = doc_v2.create_new_version(file_v3, uploaded_by=user)

        versions = doc_v3.get_all_versions()

        assert len(versions) == 3
        assert versions[0].version == 3  # Newest first
        assert versions[1].version == 2
        assert versions[2].version == 1

    def test_new_version_inherits_metadata(self, document, user):
        """New version inherits metadata from previous version."""
        document.document_type = Document.DocumentType.CONTRACT
        document.tags = ['important', 'legal']
        document.save()

        new_file = SimpleUploadedFile(
            name='v2.pdf',
            content=b'v2',
            content_type='application/pdf',
        )
        new_doc = document.create_new_version(new_file, uploaded_by=user)

        assert new_doc.document_type == Document.DocumentType.CONTRACT
        assert new_doc.tags == ['important', 'legal']
        assert new_doc.organization == document.organization


@pytest.mark.django_db
class TestDocumentConfiguration:
    """Tests for DocumentConfiguration model."""

    def test_config_creation(self, organization):
        """Can create document configuration."""
        config = DocumentConfiguration.objects.create(
            organization=organization,
            max_file_size_mb=20,
            allowed_extensions=['pdf', 'docx'],
        )

        assert config.organization == organization
        assert config.max_file_size_mb == 20
        assert config.allowed_extensions == ['pdf', 'docx']

    def test_get_for_organization_creates_if_not_exists(self, organization):
        """get_for_organization creates config if it doesn't exist."""
        assert not DocumentConfiguration.objects.filter(organization=organization).exists()

        config = DocumentConfiguration.get_for_organization(organization)

        assert config is not None
        assert config.organization == organization
        assert config.max_file_size_mb == 10  # Default

    def test_get_for_organization_returns_existing(self, organization):
        """get_for_organization returns existing config."""
        existing = DocumentConfiguration.objects.create(
            organization=organization,
            max_file_size_mb=50,
        )

        config = DocumentConfiguration.get_for_organization(organization)

        assert config == existing
        assert config.max_file_size_mb == 50

    def test_max_file_size_bytes(self, organization):
        """max_file_size_bytes returns correct value."""
        config = DocumentConfiguration.objects.create(
            organization=organization,
            max_file_size_mb=10,
        )

        assert config.max_file_size_bytes == 10 * 1024 * 1024

    def test_is_extension_allowed_empty_list(self, organization):
        """Empty allowed_extensions allows all."""
        config = DocumentConfiguration.objects.create(
            organization=organization,
            allowed_extensions=[],
        )

        assert config.is_extension_allowed('test.pdf') is True
        assert config.is_extension_allowed('test.xyz') is True

    def test_is_extension_allowed_with_list(self, organization):
        """Checks extension against allowed list."""
        config = DocumentConfiguration.objects.create(
            organization=organization,
            allowed_extensions=['pdf', 'docx'],
        )

        assert config.is_extension_allowed('test.pdf') is True
        assert config.is_extension_allowed('test.docx') is True
        assert config.is_extension_allowed('test.xlsx') is False
        assert config.is_extension_allowed('test.PDF') is True  # Case insensitive

    def test_is_file_size_allowed(self, organization):
        """Checks file size against limit."""
        config = DocumentConfiguration.objects.create(
            organization=organization,
            max_file_size_mb=10,
        )

        assert config.is_file_size_allowed(5 * 1024 * 1024) is True  # 5 MB
        assert config.is_file_size_allowed(10 * 1024 * 1024) is True  # Exactly 10 MB
        assert config.is_file_size_allowed(15 * 1024 * 1024) is False  # 15 MB

    def test_config_str(self, organization):
        """Config has meaningful string representation."""
        config = DocumentConfiguration.objects.create(
            organization=organization,
        )

        config_str = str(config)
        assert organization.name in config_str
