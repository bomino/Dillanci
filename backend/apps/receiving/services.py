"""
Services for goods receipt operations.
"""

from typing import List

from apps.core.exceptions import InvalidStateTransitionError


class GoodsReceiptService:
    """Service for goods receipt operations."""

    @staticmethod
    def validate_po_status(po) -> None:
        """
        Ensure PO is in valid state for receiving.

        Args:
            po: PurchaseOrder instance

        Raises:
            InvalidStateTransitionError: If PO is not in valid state
        """
        if po.status not in ['SENT', 'RECEIVED']:
            raise InvalidStateTransitionError(
                from_state=po.status,
                to_state='receiving',
                entity='PurchaseOrder',
            )

    @staticmethod
    def validate_line_quantities(gr) -> List[str]:
        """
        Validate receipt quantities don't exceed PO quantities.

        Args:
            gr: GoodsReceipt instance

        Returns:
            List of error messages (empty if valid)
        """
        errors = []
        for gr_line in gr.lines.all():
            po_line = gr_line.po_line
            accepted = gr_line.quantity_accepted or gr_line.quantity_received
            total_received = po_line.quantity_received + accepted

            if total_received > po_line.quantity:
                errors.append(
                    f'Line {gr_line.line_number}: Receipt qty {accepted} '
                    f'would exceed PO qty {po_line.quantity} '
                    f'(already received: {po_line.quantity_received})'
                )

        return errors
