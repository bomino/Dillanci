"""
Factory Boy factories for test data generation.

Import all factories here for easy access:
    from tests.factories import UserFactory, OrganizationFactory
"""

# Base factories (users, organizations)
from .base import (
    AdminUserFactory,
    OrganizationFactory,
    StaffUserFactory,
    UserFactory,
)

# Budget factories
from .budget import (
    ActiveEncumbranceFactory,
    BudgetLineFactory,
    EncumbranceFactory,
    FiscalYearFactory,
    LiquidatedEncumbranceFactory,
    ReleasedEncumbranceFactory,
)

# Contract factories
from .contracts import (
    ActiveContractFactory,
    CompletedMilestoneFactory,
    ContractFactory,
    ContractLineFactory,
    ContractMilestoneFactory,
    ContractSpendFactory,
    DraftContractFactory,
    ExpiredContractFactory,
    ExpiringContractFactory,
    OverdueMilestoneFactory,
    PendingApprovalContractFactory,
)

# Core factories (notifications)
from .core import (
    ApprovalNotificationFactory,
    ArchivedNotificationFactory,
    BidReceivedNotificationFactory,
    ContractExpiringNotificationFactory,
    NotificationFactory,
    ReadNotificationFactory,
)

# Invoice factories
from .invoices import (
    ApprovedInvoiceFactory,
    DisputedInvoiceFactory,
    DraftInvoiceFactory,
    InvoiceFactory,
    InvoiceLineFactory,
    MatchedInvoiceFactory,
    MatchedInvoiceLineFactory,
    MatchingConfigurationFactory,
    PaidInvoiceFactory,
    PriceMismatchInvoiceLineFactory,
    QuantityMismatchInvoiceLineFactory,
    ValidatedInvoiceFactory,
)

# Purchase order factories
from .purchase_orders import (
    AcknowledgedPOAcknowledgmentFactory,
    ApprovedPOFactory,
    CompletedPOFactory,
    DraftPOFactory,
    FullyReceivedPOLineFactory,
    PartiallyReceivedPOLineFactory,
    POAcknowledgmentFactory,
    POLineFactory,
    PurchaseOrderFactory,
    ReceivedPOFactory,
    SentPOFactory,
    SubmittedPOFactory,
)

# Receiving factories
from .receiving import (
    CancelledGoodsReceiptFactory,
    DraftGoodsReceiptFactory,
    GoodsReceiptFactory,
    GoodsReceiptLineFactory,
    PartialGoodsReceiptLineFactory,
    PostedGoodsReceiptFactory,
    RejectedGoodsReceiptLineFactory,
)

# Requisition factories
from .requisitions import (
    ApprovedRequisitionFactory,
    DraftRequisitionFactory,
    RequisitionFactory,
    RequisitionLineFactory,
    RequisitionTemplateFactory,
    RequisitionTemplateLineFactory,
    SubmittedRequisitionFactory,
)

# RFP factories
from .rfps import (
    AnsweredRFPQAFactory,
    AwardedProposalFactory,
    AwardedRFPFactory,
    BAFORFPFactory,
    BAFORequestedProposalFactory,
    BAFOResponseFactory,
    BAFORoundFactory,
    BAFOSubmittedProposalFactory,
    ClosedBAFORoundFactory,
    ClosedRFPFactory,
    DeclinedInvitationFactory,
    DraftProposalFactory,
    DraftRFPFactory,
    EvaluationRFPFactory,
    EvaluationScoreFactory,
    EvaluationTeamFactory,
    FinalEvaluationScoreFactory,
    LeadEvaluatorFactory,
    ManagementSectionFactory,
    NotAwardedProposalFactory,
    OpenBAFORoundFactory,
    PricingSectionFactory,
    ProposalFactory,
    ProposalLineItemFactory,
    ProposalSectionFactory,
    PublishedRFPFactory,
    QuestionResponseFactory,
    RFPFactory,
    RFPInvitationFactory,
    RFPLineItemFactory,
    RFPQAFactory,
    RFPQuestionFactory,
    RFPSectionFactory,
    ScoringCriteriaFactory,
    ShortlistedProposalFactory,
    SubmittedBAFOResponseFactory,
    SubmittedProposalFactory,
    TechnicalEvaluatorFactory,
    TechnicalSectionFactory,
    ViewedInvitationFactory,
)

# Supplier factories
from .suppliers import (
    ApprovedSupplierFactory,
    PortalInvitationFactory,
    PortalUserFactory,
    SupplierFactory,
)

__all__ = [
    # Base
    'OrganizationFactory',
    'UserFactory',
    'AdminUserFactory',
    'StaffUserFactory',
    # Budget
    'FiscalYearFactory',
    'BudgetLineFactory',
    'EncumbranceFactory',
    'ActiveEncumbranceFactory',
    'ReleasedEncumbranceFactory',
    'LiquidatedEncumbranceFactory',
    # Contracts
    'ContractFactory',
    'DraftContractFactory',
    'PendingApprovalContractFactory',
    'ActiveContractFactory',
    'ExpiredContractFactory',
    'ExpiringContractFactory',
    'ContractLineFactory',
    'ContractMilestoneFactory',
    'CompletedMilestoneFactory',
    'OverdueMilestoneFactory',
    'ContractSpendFactory',
    # Core
    'NotificationFactory',
    'ApprovalNotificationFactory',
    'ReadNotificationFactory',
    'ArchivedNotificationFactory',
    'ContractExpiringNotificationFactory',
    'BidReceivedNotificationFactory',
    # Invoices
    'MatchingConfigurationFactory',
    'InvoiceFactory',
    'DraftInvoiceFactory',
    'ValidatedInvoiceFactory',
    'MatchedInvoiceFactory',
    'ApprovedInvoiceFactory',
    'PaidInvoiceFactory',
    'DisputedInvoiceFactory',
    'InvoiceLineFactory',
    'MatchedInvoiceLineFactory',
    'QuantityMismatchInvoiceLineFactory',
    'PriceMismatchInvoiceLineFactory',
    # Purchase Orders
    'PurchaseOrderFactory',
    'DraftPOFactory',
    'SubmittedPOFactory',
    'ApprovedPOFactory',
    'SentPOFactory',
    'ReceivedPOFactory',
    'CompletedPOFactory',
    'POLineFactory',
    'PartiallyReceivedPOLineFactory',
    'FullyReceivedPOLineFactory',
    'POAcknowledgmentFactory',
    'AcknowledgedPOAcknowledgmentFactory',
    # Receiving
    'GoodsReceiptFactory',
    'DraftGoodsReceiptFactory',
    'PostedGoodsReceiptFactory',
    'CancelledGoodsReceiptFactory',
    'GoodsReceiptLineFactory',
    'PartialGoodsReceiptLineFactory',
    'RejectedGoodsReceiptLineFactory',
    # Requisitions
    'RequisitionFactory',
    'DraftRequisitionFactory',
    'SubmittedRequisitionFactory',
    'ApprovedRequisitionFactory',
    'RequisitionLineFactory',
    'RequisitionTemplateFactory',
    'RequisitionTemplateLineFactory',
    # Suppliers
    'SupplierFactory',
    'ApprovedSupplierFactory',
    'PortalUserFactory',
    'PortalInvitationFactory',
    # RFPs
    'RFPFactory',
    'DraftRFPFactory',
    'PublishedRFPFactory',
    'EvaluationRFPFactory',
    'BAFORFPFactory',
    'ClosedRFPFactory',
    'AwardedRFPFactory',
    'RFPSectionFactory',
    'TechnicalSectionFactory',
    'ManagementSectionFactory',
    'PricingSectionFactory',
    'RFPQuestionFactory',
    'RFPLineItemFactory',
    'ScoringCriteriaFactory',
    'RFPInvitationFactory',
    'ViewedInvitationFactory',
    'DeclinedInvitationFactory',
    'ProposalFactory',
    'DraftProposalFactory',
    'SubmittedProposalFactory',
    'ShortlistedProposalFactory',
    'BAFORequestedProposalFactory',
    'BAFOSubmittedProposalFactory',
    'AwardedProposalFactory',
    'NotAwardedProposalFactory',
    'ProposalSectionFactory',
    'QuestionResponseFactory',
    'ProposalLineItemFactory',
    'EvaluationTeamFactory',
    'LeadEvaluatorFactory',
    'TechnicalEvaluatorFactory',
    'EvaluationScoreFactory',
    'FinalEvaluationScoreFactory',
    'BAFORoundFactory',
    'OpenBAFORoundFactory',
    'ClosedBAFORoundFactory',
    'BAFOResponseFactory',
    'SubmittedBAFOResponseFactory',
    'RFPQAFactory',
    'AnsweredRFPQAFactory',
]
