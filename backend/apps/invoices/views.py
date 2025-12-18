"""
ViewSets for Invoice management.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.bulk_action_mixin import BulkActionMixin
from apps.core.exceptions import InvalidStateTransitionError
from apps.core.export_mixin import ExportMixin
from apps.invoices.models import Invoice, InvoiceLine, MatchingConfiguration
from apps.invoices.serializers import (
    DisputeSerializer,
    InvoiceCreateSerializer,
    InvoiceLineCreateSerializer,
    InvoiceLineSerializer,
    InvoiceListSerializer,
    InvoiceSerializer,
    MatchingConfigurationSerializer,
    RejectSerializer,
)
from apps.invoices.services import InvoiceService, ThreeWayMatchingService


class InvoiceViewSet(BulkActionMixin, ExportMixin, viewsets.ModelViewSet):
    """
    ViewSet for Invoice management with workflow actions.

    Workflow actions:
    - validate: DRAFT -> VALIDATED
    - match: Perform 3-way matching (VALIDATED -> MATCHED)
    - force_match: Manual override match
    - approve: MATCHED -> APPROVED (liquidates encumbrance)
    - mark_paid: APPROVED -> PAID
    - reject: VALIDATED -> REJECTED
    - dispute: MATCHED -> DISPUTED
    - resolve_dispute: DISPUTED -> MATCHED
    - revise: REJECTED -> DRAFT
    - cancel: Any (except PAID) -> CANCELLED

    Bulk actions:
    - bulk-approve: Approve multiple MATCHED/VALIDATED invoices
    - bulk-reject: Reject multiple VALIDATED invoices
    - bulk-delete: Delete multiple DRAFT invoices
    """

    permission_classes = [IsAuthenticated]

    # Export configuration
    export_filename = 'invoices'
    export_fields = [
        ('number', 'Invoice #'),
        ('vendor_invoice_number', 'Vendor Invoice #'),
        ('status', 'Status'),
        ('supplier__name', 'Supplier'),
        ('purchase_order__number', 'PO #'),
        ('subtotal', 'Subtotal'),
        ('tax_amount', 'Tax'),
        ('total_amount', 'Total Amount'),
        ('invoice_date', 'Invoice Date'),
        ('due_date', 'Due Date'),
        ('created_at', 'Created Date'),
        ('approved_at', 'Approved Date'),
    ]

    # Bulk action configuration
    bulk_approve_method = 'approve'
    bulk_reject_method = 'reject'
    bulk_approvable_statuses = ['MATCHED', 'PARTIALLY_MATCHED', 'VALIDATED']
    bulk_rejectable_statuses = ['VALIDATED']
    bulk_deletable_statuses = ['DRAFT']

    def get_queryset(self):
        """Filter invoices by user's organization."""
        return Invoice.objects.filter(
            organization=self.request.user.organization
        ).select_related(
            'purchase_order', 'supplier', 'organization', 'created_by'
        )

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            return InvoiceCreateSerializer
        if self.action == 'list':
            return InvoiceListSerializer
        return InvoiceSerializer

    def create(self, request, *args, **kwargs):
        """Create an Invoice and return full serializer with id."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        response_serializer = InvoiceSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def _handle_workflow_action(self, invoice, action_func, *args):
        """Helper to handle workflow actions with error handling."""
        try:
            action_func(*args)
            invoice.refresh_from_db()
            return Response(InvoiceSerializer(invoice).data)
        except InvalidStateTransitionError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        """Validate the invoice (DRAFT -> VALIDATED)."""
        invoice = self.get_object()

        # Run validation checks
        is_valid, errors = InvoiceService.validate_invoice(invoice)
        if not is_valid:
            return Response(
                {'errors': errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return self._handle_workflow_action(
            invoice, invoice.validate, request.user
        )

    @action(detail=True, methods=['post'])
    def match(self, request, pk=None):
        """
        Perform 3-way matching (VALIDATED -> MATCHED if successful).

        Returns match results even if not all lines match.
        Automatically transitions to MATCHED if within tolerances.
        """
        invoice = self.get_object()

        if invoice.status != 'VALIDATED':
            return Response(
                {'error': 'Invoice must be validated before matching'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Perform matching
        matching_service = ThreeWayMatchingService(invoice.organization)
        results = matching_service.match_invoice(invoice)

        # If all lines match and within auto-match threshold, auto-match
        if results['overall_match'] and results['can_auto_match']:
            invoice.mark_matched(match_type='AUTO')
            results['invoice_status'] = invoice.status

        return Response(results)

    @action(detail=True, methods=['post'])
    def force_match(self, request, pk=None):
        """
        Force match invoice with manual override.

        Use when auto-match fails but business approves exception.
        """
        invoice = self.get_object()

        if invoice.status not in ['VALIDATED']:
            return Response(
                {'error': 'Invoice must be validated to force match'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return self._handle_workflow_action(
            invoice, invoice.mark_matched, 'OVERRIDE'
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Approve invoice (MATCHED -> APPROVED).

        This triggers budget liquidation if encumbrance linked.
        """
        invoice = self.get_object()

        # Link encumbrance if not already linked
        InvoiceService.link_encumbrance(invoice)

        return self._handle_workflow_action(
            invoice, invoice.approve, request.user
        )

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark invoice as paid (APPROVED -> PAID)."""
        invoice = self.get_object()

        # Update PO line quantities
        InvoiceService.update_po_quantities(invoice)

        return self._handle_workflow_action(invoice, invoice.mark_paid)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject invoice (VALIDATED -> REJECTED)."""
        invoice = self.get_object()
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get('reason', '')
        return self._handle_workflow_action(invoice, invoice.reject, reason)

    @action(detail=True, methods=['post'])
    def dispute(self, request, pk=None):
        """Dispute invoice (MATCHED -> DISPUTED)."""
        invoice = self.get_object()
        serializer = DisputeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data['reason']
        return self._handle_workflow_action(invoice, invoice.dispute, reason)

    @action(detail=True, methods=['post'])
    def resolve_dispute(self, request, pk=None):
        """Resolve dispute (DISPUTED -> MATCHED)."""
        invoice = self.get_object()
        return self._handle_workflow_action(invoice, invoice.resolve_dispute)

    @action(detail=True, methods=['post'])
    def revise(self, request, pk=None):
        """Return rejected invoice to draft (REJECTED -> DRAFT)."""
        invoice = self.get_object()
        return self._handle_workflow_action(invoice, invoice.revise)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel the invoice."""
        invoice = self.get_object()
        return self._handle_workflow_action(invoice, invoice.cancel)

    @action(detail=True, methods=['get', 'post'])
    def lines(self, request, pk=None):
        """Manage invoice lines."""
        invoice = self.get_object()

        if request.method == 'GET':
            serializer = InvoiceLineSerializer(invoice.lines.all(), many=True)
            return Response(serializer.data)

        if request.method == 'POST':
            # Can only add lines to draft invoices
            if invoice.status != 'DRAFT':
                return Response(
                    {'error': 'Can only add lines to draft invoices'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            serializer = InvoiceLineCreateSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(invoice=invoice)
                # Recalculate subtotal
                invoice.calculate_subtotal()
                invoice.save(update_fields=['subtotal'])

                return Response(
                    InvoiceLineSerializer(
                        InvoiceLine.objects.get(id=serializer.instance.id)
                    ).data,
                    status=status.HTTP_201_CREATED,
                )
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )


class InvoiceLineViewSet(viewsets.ModelViewSet):
    """ViewSet for managing individual invoice lines."""

    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceLineSerializer

    def get_queryset(self):
        """Filter lines by user's organization."""
        return InvoiceLine.objects.filter(
            invoice__organization=self.request.user.organization
        ).select_related('invoice', 'po_line')


class MatchingConfigurationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing organization matching configuration."""

    permission_classes = [IsAuthenticated]
    serializer_class = MatchingConfigurationSerializer

    def get_queryset(self):
        """Filter config by user's organization."""
        return MatchingConfiguration.objects.filter(
            organization=self.request.user.organization
        )

    def create(self, request, *args, **kwargs):
        """Create config, ensuring one per organization."""
        org = request.user.organization

        # Check if config already exists
        if MatchingConfiguration.objects.filter(organization=org).exists():
            return Response(
                {'error': 'Matching configuration already exists for this organization'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.data['organization'] = str(org.id)
        return super().create(request, *args, **kwargs)
