"""
Tests for goods receiving services.
"""

import pytest
from decimal import Decimal

from apps.core.exceptions import InvalidStateTransitionError
from apps.receiving.services import GoodsReceiptService

from tests.factories import (
    DraftGoodsReceiptFactory,
    GoodsReceiptLineFactory,
    POLineFactory,
    SentPOFactory,
    ApprovedPOFactory,
    DraftPOFactory,
)


@pytest.mark.django_db
class TestGoodsReceiptServiceValidatePOStatus:
    """Tests for GoodsReceiptService.validate_po_status method."""

    def test_validate_po_status_sent_po_valid(self):
        """PO with SENT status should be valid for receiving."""
        po = SentPOFactory()

        # Should not raise any exception
        GoodsReceiptService.validate_po_status(po)

    def test_validate_po_status_received_po_valid(self):
        """PO with RECEIVED status should be valid for receiving."""
        po = SentPOFactory()
        po.status = 'RECEIVED'
        po.save()

        # Should not raise any exception
        GoodsReceiptService.validate_po_status(po)

    def test_validate_po_status_draft_po_invalid(self):
        """PO with DRAFT status should not be valid for receiving."""
        po = DraftPOFactory()

        with pytest.raises(InvalidStateTransitionError) as exc_info:
            GoodsReceiptService.validate_po_status(po)

        assert exc_info.value.entity == 'PurchaseOrder'
        assert exc_info.value.from_state == 'DRAFT'
        assert exc_info.value.to_state == 'receiving'

    def test_validate_po_status_approved_po_invalid(self):
        """PO with APPROVED status (not sent) should not be valid for receiving."""
        po = ApprovedPOFactory()

        with pytest.raises(InvalidStateTransitionError) as exc_info:
            GoodsReceiptService.validate_po_status(po)

        assert exc_info.value.entity == 'PurchaseOrder'
        assert exc_info.value.from_state == 'APPROVED'

    def test_validate_po_status_completed_po_invalid(self):
        """PO with COMPLETED status should not be valid for receiving."""
        po = SentPOFactory()
        po.status = 'COMPLETED'
        po.save()

        with pytest.raises(InvalidStateTransitionError):
            GoodsReceiptService.validate_po_status(po)

    def test_validate_po_status_cancelled_po_invalid(self):
        """PO with CANCELLED status should not be valid for receiving."""
        po = SentPOFactory()
        po.status = 'CANCELLED'
        po.save()

        with pytest.raises(InvalidStateTransitionError):
            GoodsReceiptService.validate_po_status(po)


@pytest.mark.django_db
class TestGoodsReceiptServiceValidateLineQuantities:
    """Tests for GoodsReceiptService.validate_line_quantities method."""

    def test_validate_line_quantities_valid(self):
        """Valid quantities should return no errors."""
        po = SentPOFactory()
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('100'),
            quantity_received=Decimal('0'),
        )
        gr = DraftGoodsReceiptFactory(purchase_order=po)
        GoodsReceiptLineFactory(
            goods_receipt=gr,
            po_line=po_line,
            quantity_received=Decimal('50'),
            quantity_accepted=Decimal('50'),
        )

        errors = GoodsReceiptService.validate_line_quantities(gr)

        assert errors == []

    def test_validate_line_quantities_exact_match(self):
        """Receiving exact remaining quantity should be valid."""
        po = SentPOFactory()
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('100'),
            quantity_received=Decimal('50'),
        )
        gr = DraftGoodsReceiptFactory(purchase_order=po)
        GoodsReceiptLineFactory(
            goods_receipt=gr,
            po_line=po_line,
            quantity_received=Decimal('50'),
            quantity_accepted=Decimal('50'),
        )

        errors = GoodsReceiptService.validate_line_quantities(gr)

        assert errors == []

    def test_validate_line_quantities_exceeds_po(self):
        """Receiving more than PO quantity should return error."""
        po = SentPOFactory()
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('100'),
            quantity_received=Decimal('0'),
        )
        gr = DraftGoodsReceiptFactory(purchase_order=po)
        GoodsReceiptLineFactory(
            goods_receipt=gr,
            po_line=po_line,
            quantity_received=Decimal('150'),
            quantity_accepted=Decimal('150'),
        )

        errors = GoodsReceiptService.validate_line_quantities(gr)

        assert len(errors) == 1
        assert 'would exceed PO qty' in errors[0]
        assert '150' in errors[0]
        assert '100' in errors[0]

    def test_validate_line_quantities_exceeds_with_prior_receipt(self):
        """Receiving more than remaining quantity should return error."""
        po = SentPOFactory()
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('100'),
            quantity_received=Decimal('80'),  # Already received 80
        )
        gr = DraftGoodsReceiptFactory(purchase_order=po)
        GoodsReceiptLineFactory(
            goods_receipt=gr,
            po_line=po_line,
            quantity_received=Decimal('30'),  # Trying to receive 30 more
            quantity_accepted=Decimal('30'),
        )

        errors = GoodsReceiptService.validate_line_quantities(gr)

        assert len(errors) == 1
        assert 'already received: 80' in errors[0]

    def test_validate_line_quantities_multiple_lines_one_error(self):
        """Multiple lines with one exceeding should return one error."""
        po = SentPOFactory()
        po_line1 = POLineFactory(
            purchase_order=po,
            line_number=1,
            quantity=Decimal('100'),
            quantity_received=Decimal('0'),
        )
        po_line2 = POLineFactory(
            purchase_order=po,
            line_number=2,
            quantity=Decimal('50'),
            quantity_received=Decimal('0'),
        )
        gr = DraftGoodsReceiptFactory(purchase_order=po)
        GoodsReceiptLineFactory(
            goods_receipt=gr,
            po_line=po_line1,
            line_number=1,
            quantity_received=Decimal('50'),  # Valid
            quantity_accepted=Decimal('50'),
        )
        GoodsReceiptLineFactory(
            goods_receipt=gr,
            po_line=po_line2,
            line_number=2,
            quantity_received=Decimal('100'),  # Exceeds
            quantity_accepted=Decimal('100'),
        )

        errors = GoodsReceiptService.validate_line_quantities(gr)

        assert len(errors) == 1
        assert 'Line 2' in errors[0]

    def test_validate_line_quantities_multiple_lines_multiple_errors(self):
        """Multiple lines exceeding should return multiple errors."""
        po = SentPOFactory()
        po_line1 = POLineFactory(
            purchase_order=po,
            line_number=1,
            quantity=Decimal('100'),
            quantity_received=Decimal('0'),
        )
        po_line2 = POLineFactory(
            purchase_order=po,
            line_number=2,
            quantity=Decimal('50'),
            quantity_received=Decimal('0'),
        )
        gr = DraftGoodsReceiptFactory(purchase_order=po)
        GoodsReceiptLineFactory(
            goods_receipt=gr,
            po_line=po_line1,
            line_number=1,
            quantity_received=Decimal('150'),  # Exceeds
            quantity_accepted=Decimal('150'),
        )
        GoodsReceiptLineFactory(
            goods_receipt=gr,
            po_line=po_line2,
            line_number=2,
            quantity_received=Decimal('100'),  # Exceeds
            quantity_accepted=Decimal('100'),
        )

        errors = GoodsReceiptService.validate_line_quantities(gr)

        assert len(errors) == 2

    def test_validate_line_quantities_uses_accepted_when_set(self):
        """Should use quantity_accepted when set, otherwise quantity_received."""
        po = SentPOFactory()
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('100'),
            quantity_received=Decimal('0'),
        )
        gr = DraftGoodsReceiptFactory(purchase_order=po)
        GoodsReceiptLineFactory(
            goods_receipt=gr,
            po_line=po_line,
            quantity_received=Decimal('200'),  # High received
            quantity_accepted=Decimal('50'),   # But accepted is lower
        )

        errors = GoodsReceiptService.validate_line_quantities(gr)

        # Should use quantity_accepted (50) not quantity_received (200)
        assert errors == []

    def test_validate_line_quantities_falls_back_to_received(self):
        """Should fall back to quantity_received when quantity_accepted is None."""
        po = SentPOFactory()
        po_line = POLineFactory(
            purchase_order=po,
            quantity=Decimal('100'),
            quantity_received=Decimal('0'),
        )
        gr = DraftGoodsReceiptFactory(purchase_order=po)
        gr_line = GoodsReceiptLineFactory(
            goods_receipt=gr,
            po_line=po_line,
            quantity_received=Decimal('150'),
        )
        # Set quantity_accepted to None after creation
        gr_line.quantity_accepted = None
        gr_line.save()

        errors = GoodsReceiptService.validate_line_quantities(gr)

        # Should use quantity_received (150) and return error
        assert len(errors) == 1
