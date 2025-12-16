"""
Custom exceptions for the Procurement Platform.
"""

from rest_framework import status
from rest_framework.exceptions import APIException


class ProcurementPlatformError(Exception):
    """Base exception for all procurement platform errors."""
    pass


class InvalidStateTransitionError(ProcurementPlatformError):
    """Raised when an invalid state transition is attempted."""

    def __init__(self, from_state: str, to_state: str, entity: str):
        self.from_state = from_state
        self.to_state = to_state
        self.entity = entity
        self.message = (
            f"Invalid state transition for {entity}: "
            f"cannot transition from {from_state} to {to_state}"
        )
        super().__init__(self.message)


class InsufficientBudgetError(ProcurementPlatformError):
    """Raised when budget is insufficient for an operation."""

    def __init__(self, requested: float, available: float, budget_line: str):
        self.requested = requested
        self.available = available
        self.budget_line = budget_line
        self.shortfall = requested - available
        self.message = (
            f"Insufficient budget for {budget_line}: "
            f"requested {requested}, available {available}, shortfall {self.shortfall}"
        )
        super().__init__(self.message)


class TenantMismatchError(Exception):
    """Raised when accessing data from a different tenant."""

    def __init__(self, message="Access denied: tenant mismatch"):
        self.message = message
        super().__init__(self.message)


# API Exceptions (for DRF views)
class InvalidStateTransitionAPIException(APIException):
    """API exception for invalid state transitions."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Invalid state transition.'
    default_code = 'invalid_state_transition'


class InsufficientBudgetAPIException(APIException):
    """API exception for insufficient budget."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Insufficient budget available.'
    default_code = 'insufficient_budget'


# RFQ-specific exceptions
class RFQError(ProcurementPlatformError):
    """Base exception for RFQ-related errors."""
    pass


class RFQNotOpenError(RFQError):
    """Raised when bid submission attempted on non-open RFQ."""

    def __init__(self, rfq_number: str, status: str):
        self.rfq_number = rfq_number
        self.status = status
        self.message = (
            f"Cannot submit bid for RFQ {rfq_number}: "
            f"RFQ status is {status}, must be OPEN"
        )
        super().__init__(self.message)


class BidAlreadySubmittedError(RFQError):
    """Raised when trying to modify a submitted bid."""

    def __init__(self, bid_id: str):
        self.bid_id = bid_id
        self.message = f"Cannot modify bid {bid_id}: bid has already been submitted"
        super().__init__(self.message)


class DuplicateInvitationError(RFQError):
    """Raised when inviting the same supplier twice to an RFQ."""

    def __init__(self, rfq_number: str, supplier_name: str):
        self.rfq_number = rfq_number
        self.supplier_name = supplier_name
        self.message = (
            f"Supplier {supplier_name} has already been invited to RFQ {rfq_number}"
        )
        super().__init__(self.message)


# Goods Receipt / Invoice exceptions
class ReceivingError(ProcurementPlatformError):
    """Base exception for goods receipt errors."""
    pass


class QuantityExceedsOrderError(ReceivingError):
    """Raised when receipt quantity exceeds PO quantity."""

    def __init__(self, po_line_description: str, ordered: float, received: float):
        self.po_line_description = po_line_description
        self.ordered = ordered
        self.received = received
        self.message = (
            f"Receipt quantity ({received}) exceeds ordered quantity ({ordered}) "
            f"for '{po_line_description}'"
        )
        super().__init__(self.message)


class InvoiceError(ProcurementPlatformError):
    """Base exception for invoice errors."""
    pass


class InvoiceMismatchError(InvoiceError):
    """Raised when invoice doesn't match PO/GR."""

    def __init__(self, invoice_number: str, reason: str):
        self.invoice_number = invoice_number
        self.reason = reason
        self.message = f"Invoice {invoice_number} mismatch: {reason}"
        super().__init__(self.message)


class OverInvoicingError(InvoiceError):
    """Raised when invoice exceeds PO quantity."""

    def __init__(self, po_line_description: str, ordered: float, invoiced: float):
        self.po_line_description = po_line_description
        self.ordered = ordered
        self.invoiced = invoiced
        self.message = (
            f"Invoice quantity ({invoiced}) exceeds ordered quantity ({ordered}) "
            f"for '{po_line_description}'"
        )
        super().__init__(self.message)


# Document exceptions
class DocumentError(ProcurementPlatformError):
    """Base exception for document-related errors."""
    pass


class FileTooLargeError(DocumentError):
    """Raised when uploaded file exceeds size limit."""

    def __init__(self, filename: str, size_bytes: int, max_size_bytes: int):
        self.filename = filename
        self.size_bytes = size_bytes
        self.max_size_bytes = max_size_bytes
        size_mb = size_bytes / (1024 * 1024)
        max_mb = max_size_bytes / (1024 * 1024)
        self.message = (
            f"File '{filename}' ({size_mb:.1f} MB) exceeds "
            f"maximum size ({max_mb:.1f} MB)"
        )
        super().__init__(self.message)


class InvalidFileTypeError(DocumentError):
    """Raised when file type is not allowed."""

    def __init__(self, filename: str, allowed_extensions: list):
        self.filename = filename
        self.allowed_extensions = allowed_extensions
        self.message = (
            f"File '{filename}' has an invalid extension. "
            f"Allowed: {', '.join(allowed_extensions)}"
        )
        super().__init__(self.message)


class DocumentNotFoundError(DocumentError):
    """Raised when document is not found."""

    def __init__(self, document_id: str):
        self.document_id = document_id
        self.message = f"Document with ID '{document_id}' not found"
        super().__init__(self.message)


# Document API Exceptions (for DRF views)
class FileTooLargeAPIException(APIException):
    """API exception for file too large."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'File exceeds maximum allowed size.'
    default_code = 'file_too_large'


class InvalidFileTypeAPIException(APIException):
    """API exception for invalid file type."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'File type is not allowed.'
    default_code = 'invalid_file_type'


# Contract exceptions
class ContractError(ProcurementPlatformError):
    """Base exception for contract-related errors."""
    pass


class ContractExpiredError(ContractError):
    """Raised when attempting operation on expired contract."""

    def __init__(self, contract_number: str, end_date: str):
        self.contract_number = contract_number
        self.end_date = end_date
        self.message = (
            f"Contract {contract_number} expired on {end_date}"
        )
        super().__init__(self.message)


class ContractNotActiveError(ContractError):
    """Raised when attempting operation on non-active contract."""

    def __init__(self, contract_number: str, status: str):
        self.contract_number = contract_number
        self.status = status
        self.message = (
            f"Contract {contract_number} is not active (status: {status})"
        )
        super().__init__(self.message)


class SpendLimitExceededError(ContractError):
    """Raised when spend would exceed contract total value."""

    def __init__(self, contract_number: str, requested: float, remaining: float):
        self.contract_number = contract_number
        self.requested = requested
        self.remaining = remaining
        self.message = (
            f"Spend amount ({requested}) exceeds remaining contract value ({remaining}) "
            f"for contract {contract_number}"
        )
        super().__init__(self.message)


class ContractValidationError(ContractError):
    """Raised when contract validation fails."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)


# Contract API Exceptions (for DRF views)
class ContractExpiredAPIException(APIException):
    """API exception for expired contract."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Contract has expired.'
    default_code = 'contract_expired'


class SpendLimitExceededAPIException(APIException):
    """API exception for spend limit exceeded."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Spend would exceed contract value.'
    default_code = 'spend_limit_exceeded'


# RFP exceptions
class RFPError(ProcurementPlatformError):
    """Base exception for RFP-related errors."""
    pass


class RFPNotPublishedError(RFPError):
    """Raised when proposal submission attempted on non-published RFP."""

    def __init__(self, rfp_number: str, status: str):
        self.rfp_number = rfp_number
        self.status = status
        self.message = (
            f"Cannot submit proposal for RFP {rfp_number}: "
            f"RFP status is {status}, must be PUBLISHED"
        )
        super().__init__(self.message)


class ProposalError(RFPError):
    """Base exception for proposal-related errors."""
    pass


class ProposalAlreadySubmittedError(ProposalError):
    """Raised when trying to modify a submitted proposal."""

    def __init__(self, proposal_number: str):
        self.proposal_number = proposal_number
        self.message = f"Cannot modify proposal {proposal_number}: proposal has already been submitted"
        super().__init__(self.message)


class ScoringError(RFPError):
    """Base exception for scoring-related errors."""
    pass


class InvalidScoringWeightError(ScoringError):
    """Raised when scoring weights don't sum to 100%."""

    def __init__(self, total_weight: float, rfp_number: str):
        self.total_weight = total_weight
        self.rfp_number = rfp_number
        self.message = (
            f"Scoring weights for RFP {rfp_number} sum to {total_weight}%, "
            f"must sum to 100%"
        )
        super().__init__(self.message)


class BAFOError(RFPError):
    """Base exception for BAFO-related errors."""
    pass


class BAFORoundNotOpenError(BAFOError):
    """Raised when BAFO submission attempted on non-open round."""

    def __init__(self, rfp_number: str, round_number: int, status: str):
        self.rfp_number = rfp_number
        self.round_number = round_number
        self.status = status
        self.message = (
            f"Cannot submit BAFO for RFP {rfp_number} round {round_number}: "
            f"round status is {status}, must be OPEN"
        )
        super().__init__(self.message)


# RFP API Exceptions (for DRF views)
class RFPNotPublishedAPIException(APIException):
    """API exception for non-published RFP."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'RFP is not published.'
    default_code = 'rfp_not_published'


class ProposalAlreadySubmittedAPIException(APIException):
    """API exception for already submitted proposal."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Proposal has already been submitted.'
    default_code = 'proposal_already_submitted'


class InvalidScoringWeightAPIException(APIException):
    """API exception for invalid scoring weights."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Scoring weights must sum to 100%.'
    default_code = 'invalid_scoring_weight'


class BAFORoundNotOpenAPIException(APIException):
    """API exception for non-open BAFO round."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'BAFO round is not open.'
    default_code = 'bafo_round_not_open'


# ============ Report Exceptions ============

class ReportError(ProcurementPlatformError):
    """Base exception for report-related errors."""
    pass


class ReportExecutionError(ReportError):
    """Raised when report execution fails."""

    def __init__(self, report_code: str, error_message: str):
        self.report_code = report_code
        self.error_message = error_message
        self.message = f"Report execution failed for {report_code}: {error_message}"
        super().__init__(self.message)


class ReportDefinitionNotFoundError(ReportError):
    """Raised when a report definition is not found."""

    def __init__(self, report_code: str):
        self.report_code = report_code
        self.message = f"Report definition not found: {report_code}"
        super().__init__(self.message)


class InvalidReportFilterError(ReportError):
    """Raised when invalid filters are provided for a report."""

    def __init__(self, filter_name: str, message: str):
        self.filter_name = filter_name
        self.message = f"Invalid filter '{filter_name}': {message}"
        super().__init__(self.message)


class ExportError(ProcurementPlatformError):
    """Base exception for export-related errors."""
    pass


class ExportFormatNotSupportedError(ExportError):
    """Raised when an unsupported export format is requested."""

    def __init__(self, format_type: str, supported_formats: list):
        self.format_type = format_type
        self.supported_formats = supported_formats
        self.message = (
            f"Export format '{format_type}' is not supported. "
            f"Supported formats: {', '.join(supported_formats)}"
        )
        super().__init__(self.message)


class ExportFileTooLargeError(ExportError):
    """Raised when export would produce a file exceeding size limits."""

    def __init__(self, row_count: int, max_rows: int):
        self.row_count = row_count
        self.max_rows = max_rows
        self.message = (
            f"Export too large: {row_count} rows exceeds maximum of {max_rows}. "
            "Please apply additional filters to reduce result set."
        )
        super().__init__(self.message)


# Report API Exceptions (for DRF views)
class ReportExecutionAPIException(APIException):
    """API exception for report execution failure."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Report execution failed.'
    default_code = 'report_execution_failed'


class ReportNotFoundAPIException(APIException):
    """API exception for report not found."""

    status_code = status.HTTP_404_NOT_FOUND
    default_detail = 'Report definition not found.'
    default_code = 'report_not_found'


class ExportFormatAPIException(APIException):
    """API exception for unsupported export format."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Export format not supported.'
    default_code = 'export_format_not_supported'
