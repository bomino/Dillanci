// API Response Types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

// =============================================================================
// RBAC Types - Role-Based Access Control
// =============================================================================

// Permission codes - must match backend Permissions class
export const Permissions = {
  // User Management
  USER_VIEW: 'user.view',
  USER_CREATE: 'user.create',
  USER_EDIT: 'user.edit',
  USER_DELETE: 'user.delete',
  USER_ACTIVATE: 'user.activate',
  USER_DEACTIVATE: 'user.deactivate',
  USER_ASSIGN_ROLES: 'user.assign_roles',

  // Organization Management
  ORG_VIEW: 'organization.view',
  ORG_EDIT: 'organization.edit',
  ORG_MANAGE_SETTINGS: 'organization.manage_settings',

  // Supplier Management
  SUPPLIER_VIEW: 'supplier.view',
  SUPPLIER_CREATE: 'supplier.create',
  SUPPLIER_EDIT: 'supplier.edit',
  SUPPLIER_DELETE: 'supplier.delete',
  SUPPLIER_APPROVE: 'supplier.approve',
  SUPPLIER_SUSPEND: 'supplier.suspend',

  // Requisition Management
  REQUISITION_VIEW: 'requisition.view',
  REQUISITION_VIEW_ALL: 'requisition.view_all',
  REQUISITION_CREATE: 'requisition.create',
  REQUISITION_EDIT: 'requisition.edit',
  REQUISITION_DELETE: 'requisition.delete',
  REQUISITION_SUBMIT: 'requisition.submit',
  REQUISITION_APPROVE: 'requisition.approve',
  REQUISITION_REJECT: 'requisition.reject',

  // RFQ Management
  RFQ_VIEW: 'rfq.view',
  RFQ_CREATE: 'rfq.create',
  RFQ_EDIT: 'rfq.edit',
  RFQ_DELETE: 'rfq.delete',
  RFQ_PUBLISH: 'rfq.publish',
  RFQ_AWARD: 'rfq.award',
  RFQ_CANCEL: 'rfq.cancel',

  // RFP Management
  RFP_VIEW: 'rfp.view',
  RFP_CREATE: 'rfp.create',
  RFP_EDIT: 'rfp.edit',
  RFP_DELETE: 'rfp.delete',
  RFP_PUBLISH: 'rfp.publish',
  RFP_EVALUATE: 'rfp.evaluate',
  RFP_AWARD: 'rfp.award',

  // Purchase Order Management
  PO_VIEW: 'purchase_order.view',
  PO_VIEW_ALL: 'purchase_order.view_all',
  PO_CREATE: 'purchase_order.create',
  PO_EDIT: 'purchase_order.edit',
  PO_DELETE: 'purchase_order.delete',
  PO_SUBMIT: 'purchase_order.submit',
  PO_APPROVE: 'purchase_order.approve',
  PO_REJECT: 'purchase_order.reject',
  PO_CANCEL: 'purchase_order.cancel',
  PO_CLOSE: 'purchase_order.close',

  // Receiving/Goods Receipt
  RECEIVING_VIEW: 'receiving.view',
  RECEIVING_CREATE: 'receiving.create',
  RECEIVING_EDIT: 'receiving.edit',
  RECEIVING_COMPLETE: 'receiving.complete',

  // Invoice Management
  INVOICE_VIEW: 'invoice.view',
  INVOICE_CREATE: 'invoice.create',
  INVOICE_EDIT: 'invoice.edit',
  INVOICE_DELETE: 'invoice.delete',
  INVOICE_MATCH: 'invoice.match',
  INVOICE_APPROVE: 'invoice.approve',
  INVOICE_REJECT: 'invoice.reject',
  INVOICE_PAY: 'invoice.pay',

  // Contract Management
  CONTRACT_VIEW: 'contract.view',
  CONTRACT_CREATE: 'contract.create',
  CONTRACT_EDIT: 'contract.edit',
  CONTRACT_DELETE: 'contract.delete',
  CONTRACT_APPROVE: 'contract.approve',
  CONTRACT_TERMINATE: 'contract.terminate',
  CONTRACT_RENEW: 'contract.renew',

  // Budget Management
  BUDGET_VIEW: 'budget.view',
  BUDGET_CREATE: 'budget.create',
  BUDGET_EDIT: 'budget.edit',
  BUDGET_APPROVE: 'budget.approve',
  BUDGET_TRANSFER: 'budget.transfer',

  // Reports
  REPORT_VIEW: 'report.view',
  REPORT_EXPORT: 'report.export',
  REPORT_ADVANCED: 'report.advanced',

  // Audit
  AUDIT_VIEW: 'audit.view',
  AUDIT_EXPORT: 'audit.export',

  // System Administration
  ADMIN_FULL_ACCESS: 'admin.full_access',
  ADMIN_MANAGE_ROLES: 'admin.manage_roles',
  ADMIN_VIEW_ALL_ORGS: 'admin.view_all_orgs',
} as const;

export type PermissionCode = typeof Permissions[keyof typeof Permissions];

// Role types
export type RoleType = 'SYSTEM' | 'ORGANIZATION' | 'CUSTOM';

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  role_type: RoleType;
  organization: string | null;
  permissions: string[];
  parent_role: string | null;
  approval_limit: string | null;
  currency: string;
  is_active: boolean;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
  // Computed fields from API
  user_count?: number;
  permission_count?: number;
}

export interface UserRole {
  id: string;
  user: string;
  role: string;
  role_name: string;
  role_code: string;
  valid_from: string;
  valid_to: string | null;
  delegated_by: string | null;
  delegated_by_name?: string;
  custom_approval_limit: string | null;
  assigned_by: string | null;
  assigned_by_name?: string;
  is_active: boolean;
  is_valid: boolean;
  is_delegated: boolean;
  approval_limit: string | null;
  created_at: string;
}

// User & Auth Types
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  employee_id?: string;
  organization: string | null;
  organization_name?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  is_active: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  created_at?: string;
  updated_at?: string;
  // Legacy fields for backwards compatibility
  date_joined?: string;
  last_login?: string | null;
  // RBAC fields
  roles?: UserRole[];
  permissions?: string[];
}

export interface LoginResponse {
  message: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Organization Types
export interface Organization {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  is_active: boolean;
  created_at: string;
}

// Requisition Types
export type RequisitionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED'
  | 'CANCELLED';

export type RequisitionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// Related PO info for display in Requisition detail
export interface RelatedPOLine {
  id: string;
  purchase_order_number: string;
  quantity: string;
}

export interface RelatedPurchaseOrder {
  id: string;
  number: string;
  status: string;
  supplier_name: string;
  total_amount: string;
  created_at: string;
}

export interface RequisitionLine {
  id: string;
  requisition: string;
  line_number: number;
  description: string;
  quantity: string;
  unit_of_measure: string;
  estimated_unit_price: string | null;
  estimated_amount: string | null;
  catalog_item: string | null;
  notes: string | null;
  // Line fulfillment tracking
  is_converted?: boolean;
  po_lines?: RelatedPOLine[];
  created_at: string;
}

export interface Requisition {
  id: string;
  number: string;
  organization: string;
  requester: string;
  requester_name?: string;
  department: string;
  title: string;
  description: string | null;
  status: RequisitionStatus;
  priority: RequisitionPriority;
  required_date: string | null;
  approved_date: string | null;
  approved_by: string | null;
  approved_by_name?: string;
  rejection_reason: string | null;
  total_amount: string;
  currency: string;
  lines: RequisitionLine[];
  // Related purchase orders created from this requisition
  purchase_orders?: RelatedPurchaseOrder[];
  created_at: string;
  updated_at: string;
}

// Supplier Types
export type SupplierStatus =
  | 'PROSPECT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'SUSPENDED'
  | 'BLOCKED';

export type PerformanceTier = 'STRATEGIC' | 'PREFERRED' | 'APPROVED' | 'CONDITIONAL' | 'PROBATION' | '';

export interface Supplier {
  id: string;
  number: string;
  organization: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  duns_number: string | null;
  status: SupplierStatus;
  supplier_type: 'MANUFACTURER' | 'DISTRIBUTOR' | 'SERVICE_PROVIDER' | 'CONTRACTOR' | 'OTHER';
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  payment_terms: string;
  currency: string;
  is_active: boolean;
  // Performance scores (0-100 scale)
  overall_score: string | null;
  delivery_score: string | null;
  quality_score: string | null;
  cost_score: string | null;
  scores_calculated_at: string | null;
  is_preferred: boolean;
  performance_tier: PerformanceTier;
  performance_tier_display: string | null;
  created_at: string;
  updated_at: string;
}

// RFQ Types
export type RFQStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'CLOSED'
  | 'AWARDED'
  | 'CANCELLED';

export type RFQBidType = 'OPEN' | 'SEALED' | 'INVITED';

export type RFQPaymentTerms =
  | 'NET15'
  | 'NET30'
  | 'NET45'
  | 'NET60'
  | 'NET90'
  | 'DUE_ON_RECEIPT'
  | 'ADVANCE'
  | 'MILESTONE'
  | 'OTHER';

export interface EvaluationCriterion {
  name: string;
  weight: number;
  description?: string;
}

export interface RFQLine {
  id: string;
  rfq: string;
  line_number: number;
  description: string;
  quantity: string;
  unit_of_measure: string;
  target_unit_price: string | null;
  catalog_item: string | null;
  created_at: string;
}

export interface SupplierInvitation {
  id: string;
  rfq: string;
  supplier: string;
  supplier_name: string;
  invited_by: string;
  invited_by_name: string;
  invited_at: string;
  status: 'PENDING' | 'VIEWED' | 'BID_SUBMITTED' | 'DECLINED';
  status_display: string;
  viewed_at: string | null;
  responded_at: string | null;
  decline_reason: string;
}

export interface RFQ {
  id: string;
  number: string;
  organization: string;
  organization_name?: string;
  created_by: string;
  created_by_name?: string;
  created_by_email?: string;
  title: string;
  description: string;
  status: RFQStatus;
  status_display?: string;
  bid_type: RFQBidType;
  bid_type_display?: string;
  // Buyer Contact
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  department: string;
  // Project Background
  project_background: string;
  // Critical Timelines
  issue_date: string | null;
  qa_deadline: string | null;
  submission_deadline: string | null;
  expected_award_date: string | null;
  open_date: string | null;
  close_date: string | null;
  awarded_date: string | null;
  // Commercial Terms
  payment_terms: RFQPaymentTerms;
  payment_terms_display?: string;
  payment_terms_notes: string;
  contract_duration_months: number | null;
  contract_renewal_options: string;
  currency: string;
  // Delivery Requirements
  delivery_address: string;
  delivery_terms: string;
  required_delivery_date: string | null;
  // Evaluation Criteria
  evaluation_criteria: EvaluationCriterion[] | null;
  required_certifications: string;
  required_attachments_description: string;
  // Terms and Conditions
  terms_and_conditions: string;
  nda_required: boolean;
  // Financial
  total_amount?: string;
  // Award Info
  awarded_supplier: string | null;
  awarded_supplier_name?: string;
  awarded_bid: string | null;
  // Relations
  requisition: string | null;
  requisition_number?: string;
  lines?: RFQLine[];
  invitations?: SupplierInvitation[];
  // Counts for list view
  invitation_count?: number;
  bid_count?: number;
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Purchase Order Types
export type POStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface POLine {
  id: string;
  purchase_order: string;
  line_number: number;
  description: string;
  quantity: string;
  unit_price: string;
  extended_amount: string;
  quantity_received: string;
  unit_of_measure: string;
  requisition_line?: string | null;
  requisition_line_id?: string | null;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  organization: string;
  supplier: string;
  supplier_name?: string;
  status: POStatus;
  order_date: string;
  expected_delivery_date: string | null;
  total_amount: string;
  currency: string;
  payment_terms: string;
  shipping_address: string | null;
  notes: string | null;
  lines?: POLine[];
  // Source requisition link (optional)
  requisition?: string | null;
  requisition_id?: string | null;
  requisition_number?: string | null;
  requisition_title?: string | null;
  created_at: string;
  updated_at: string;
}

// Goods Receipt / Receiving Types
export type GoodsReceiptStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'CANCELLED';

export interface GoodsReceiptLine {
  id: string;
  goods_receipt: string;
  po_line: string;
  po_line_description?: string;
  line_number: number;
  quantity_received: string;
  quantity_ordered: string;
  unit_of_measure: string;
  notes: string | null;
}

export interface GoodsReceipt {
  id: string;
  number: string;
  organization: string;
  purchase_order: string;
  po_number?: string;
  supplier: string;
  supplier_name?: string;
  status: GoodsReceiptStatus;
  receipt_date: string;
  received_by: string;
  received_by_name?: string;
  delivery_note_number: string | null;
  notes: string | null;
  lines?: GoodsReceiptLine[];
  created_at: string;
  updated_at: string;
}

// Invoice Types
export type InvoiceStatus =
  | 'DRAFT'
  | 'PENDING_VALIDATION'
  | 'VALIDATED'
  | 'MATCHED'
  | 'PARTIALLY_MATCHED'
  | 'APPROVED'
  | 'PAID'
  | 'CANCELLED'
  | 'REJECTED'
  | 'DISPUTED';

export type MatchStatus = 'MATCHED' | 'PARTIAL' | 'UNMATCHED' | 'VARIANCE';

export interface InvoiceLine {
  id: string;
  invoice: string;
  po_line: string | null;
  po_line_description?: string;
  line_number: number;
  description: string;
  quantity: string;
  unit_price: string;
  extended_amount: string;
  match_status: MatchStatus;
  variance_amount: string | null;
  variance_reason: string | null;
}

export interface ThreeWayMatchData {
  po_quantity: string;
  po_unit_price: string;
  po_amount: string;
  gr_quantity: string;
  invoice_quantity: string;
  invoice_unit_price: string;
  invoice_amount: string;
  quantity_variance: string;
  price_variance: string;
  amount_variance: string;
  match_status: MatchStatus;
}

export interface Invoice {
  id: string;
  number: string;
  supplier_invoice_number: string;
  purchase_order: string;
  po_number?: string;
  goods_receipt: string | null;
  gr_number?: string;
  supplier: string;
  supplier_name?: string;
  organization: string;
  status: InvoiceStatus;
  invoice_date: string;
  due_date: string;
  payment_terms: string;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  currency: string;
  match_status: MatchStatus;
  notes: string | null;
  lines?: InvoiceLine[];
  match_data?: ThreeWayMatchData[];
  created_at: string;
  updated_at: string;
}

// Contract Types
export type ContractStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'CANCELLED';

export interface Contract {
  id: string;
  number: string;
  organization: string;
  supplier: string;
  supplier_name?: string;
  title: string;
  description: string;
  status: ContractStatus;
  contract_type: 'BLANKET' | 'FIXED_PRICE' | 'TIME_MATERIALS' | 'FRAMEWORK';
  start_date: string;
  end_date: string;
  total_value: string;
  currency: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// RFP Types (Request for Proposal) - Enhanced for comprehensive RFP workflow
// =============================================================================

export type RFPStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'EVALUATION'
  | 'UNDER_EVALUATION'  // Backward compatibility alias for EVALUATION
  | 'BAFO'
  | 'SHORTLISTED'       // Backward compatibility alias
  | 'CLOSED'
  | 'AWARDED'
  | 'CANCELLED';

// Backward compatibility alias
export type RFPCategory = 'GOODS' | 'SERVICES' | 'WORKS' | 'CONSULTING';

export type RFPType = 'SERVICES' | 'GOODS' | 'COMBINED' | 'WORKS' | 'CONSULTING';

export type RFPBiddingType = 'OPEN' | 'SEALED' | 'MULTI_ROUND';

export type RFPVisibility = 'INVITED' | 'PUBLIC';

export type IPOwnership = 'CLIENT' | 'VENDOR' | 'SHARED' | 'NEGOTIABLE';

export type RFPSectionType =
  | 'ADMINISTRATIVE'
  | 'TECHNICAL'
  | 'MANAGEMENT'
  | 'PRICING'
  | 'TERMS'
  | 'QUALIFICATIONS';

export type RFPQuestionType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'SINGLE_CHOICE'
  | 'MULTI_CHOICE'
  | 'NUMBER'
  | 'DATE'
  | 'FILE'
  | 'RATING';

export type RFPInvitationStatus =
  | 'PENDING'
  | 'VIEWED'
  | 'PROPOSAL_SUBMITTED'
  | 'DECLINED'
  | 'DISQUALIFIED';

export type IntentToBid = 'YES' | 'NO' | 'UNDECIDED';

export type ProposalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'SHORTLISTED'
  | 'BAFO_REQUESTED'
  | 'BAFO_SUBMITTED'
  | 'AWARDED'
  | 'NOT_AWARDED'
  | 'WITHDRAWN'
  | 'DISQUALIFIED';

export type EvaluatorRole = 'LEAD' | 'TECHNICAL' | 'PRICING' | 'GENERAL';

export type BAFORoundStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

export type QAVisibility = 'PRIVATE' | 'PUBLIC' | 'ALL_BIDDERS';

// RFP Question with compliance tracking
export interface RFPQuestion {
  id: string;
  section: string;
  question_number: number;
  question_text: string;
  question_type: RFPQuestionType;
  options: string[] | null;
  is_required: boolean;
  max_score: string;
  scoring_guidance: string;
  order: number;
  // Compliance tracking fields
  is_mandatory_attachment: boolean;
  attachment_type: string;
  min_attachments: number;
  created_at: string;
  updated_at: string;
}

// RFP Section with nested questions
export interface RFPSection {
  id: string;
  rfp: string;
  section_number: number;
  title: string;
  section_type: RFPSectionType;
  weight: string;
  instructions: string;
  is_scorable: boolean;
  order: number;
  questions: RFPQuestion[];
  question_count: number;
  created_at: string;
  updated_at: string;
}

// RFP Line Item for pricing
export interface RFPLineItem {
  id: string;
  rfp: string;
  section: string | null;
  line_number: number;
  description: string;
  quantity: string;
  unit_of_measure: string;
  target_unit_price: string | null;
  catalog_item: string | null;
  catalog_item_name?: string;
  extended_amount: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// Scoring Criteria with hierarchy
export interface ScoringCriteria {
  id: string;
  rfp: string;
  name: string;
  description: string;
  weight: string;
  section: string | null;
  parent: string | null;
  max_score: string;
  order: number;
  sub_criteria: ScoringCriteria[];
  created_at: string;
  updated_at: string;
}

// RFP Invitation with intent tracking
export interface RFPInvitation {
  id: string;
  rfp: string;
  supplier: string;
  supplier_name: string;
  invited_by: string;
  invited_by_name: string;
  invited_at: string;
  status: RFPInvitationStatus;
  status_display: string;
  viewed_at: string | null;
  responded_at: string | null;
  intent_to_bid: IntentToBid | null;
  decline_reason: string;
  disqualified: boolean;
  disqualification_reason: string;
  created_at: string;
  updated_at: string;
}

// Question Response in a proposal
export interface QuestionResponse {
  id: string;
  proposal: string;
  question: string;
  question_text: string;
  question_type: RFPQuestionType;
  answer_text: string;
  answer_choice: string[] | null;
  answer_number: string | null;
  answer_date: string | null;
  created_at: string;
  updated_at: string;
}

// Proposal Line Item
export interface ProposalLineItem {
  id: string;
  proposal: string;
  rfp_line_item: string;
  rfp_line_description: string;
  quantity: string;
  unit_price: string;
  extended_price: string;
  lead_time_days: number | null;
  manufacturer: string;
  part_number: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// Proposal Section
export interface ProposalSection {
  id: string;
  proposal: string;
  rfp_section: string;
  section_title: string;
  section_score: string | null;
  evaluator_comments: string;
  created_at: string;
  updated_at: string;
}

// Proposal
export interface Proposal {
  id: string;
  rfp: string;
  rfp_number: string;
  rfp_title: string;
  supplier: string;
  supplier_name: string;
  submitted_by: string;
  submitted_by_name: string;
  proposal_number: string;
  status: ProposalStatus;
  status_display: string;
  submitted_at: string | null;
  revision_number: number;
  is_latest: boolean;
  technical_score: string | null;
  management_score: string | null;
  pricing_score: string | null;
  overall_score: string | null;
  rank: number | null;
  valid_until: string | null;
  notes: string;
  total_amount: string;
  question_responses: QuestionResponse[];
  line_items: ProposalLineItem[];
  sections: ProposalSection[];
  created_at: string;
  updated_at: string;
}

// Evaluation Team Member
export interface EvaluationTeam {
  id: string;
  rfp: string;
  evaluator: string;
  evaluator_name: string;
  evaluator_email: string;
  role: EvaluatorRole;
  role_display: string;
  assigned_sections: string[];
  assigned_at: string;
  assigned_by: string;
  assigned_by_name: string;
  created_at: string;
  updated_at: string;
}

// Evaluation Score
export interface EvaluationScore {
  id: string;
  proposal: string;
  evaluator: string;
  evaluator_name: string;
  criteria: string | null;
  section: string | null;
  question: string | null;
  score: string;
  max_score: string;
  score_percentage: string;
  comments: string;
  is_final: boolean;
  scored_at: string;
  created_at: string;
  updated_at: string;
}

// BAFO Response
export interface BAFOResponse {
  id: string;
  bafo_round: string;
  proposal: string;
  proposal_number: string;
  supplier_name: string;
  status: 'DRAFT' | 'SUBMITTED';
  status_display: string;
  submitted_at: string | null;
  response_data: Record<string, unknown> | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

// BAFO Round
export interface BAFORound {
  id: string;
  rfp: string;
  rfp_number: string;
  round_number: number;
  status: BAFORoundStatus;
  status_display: string;
  opened_at: string | null;
  deadline: string | null;
  closed_at: string | null;
  instructions: string;
  focus_areas: string[] | null;
  created_by: string;
  created_by_name: string;
  responses: BAFOResponse[];
  response_count: number;
  created_at: string;
  updated_at: string;
}

// RFP Q&A
export interface RFPQA {
  id: string;
  rfp: string;
  supplier: string | null;
  supplier_name: string | null;
  asked_by: string;
  asked_by_name: string;
  question: string;
  answer: string;
  answered_by: string | null;
  answered_by_name: string | null;
  answered_at: string | null;
  visibility: QAVisibility;
  visibility_display: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

// Backward compatibility interfaces for existing pages
export interface RFPRequirement {
  id: string;
  rfp: string;
  requirement_number: number;
  category: string;
  description: string;
  is_mandatory: boolean;
  weight: number;
  created_at: string;
}

export interface RFPEvaluationCriteria {
  id: string;
  rfp: string;
  criteria_number: number;
  name: string;
  description: string;
  weight: number;
  max_score: number;
}

// Main RFP interface with all essential sections
export interface RFP {
  id: string;
  number: string;
  organization: string;
  organization_name?: string;
  created_by: string;
  created_by_name: string;
  title: string;
  description: string;
  status: RFPStatus;
  status_display?: string;
  rfp_type: RFPType;
  estimated_value: string | null;
  bidding_type: RFPBiddingType;
  visibility: RFPVisibility;
  requisition: string | null;
  notes?: string;

  // Backward compatibility fields
  category?: RFPCategory;
  submission_deadline?: string | null;
  evaluation_deadline?: string | null;
  requirements?: RFPRequirement[];
  evaluation_criteria?: RFPEvaluationCriteria[];

  // Project Overview fields (Essential RFP Section 1)
  executive_summary?: string;
  current_state_description?: string;
  future_state_goals?: string;
  organization_context?: string;

  // Timeline fields (Essential RFP Section 4)
  publish_date: string | null;
  question_deadline: string | null;
  response_deadline: string | null;
  evaluation_start_date?: string | null;
  award_target_date?: string | null;
  qa_session_date?: string | null;
  shortlist_announcement_date?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;

  // Budget Framework fields (Essential RFP Section 5)
  budget_min: string | null;
  budget_max: string | null;
  currency: string;

  // Terms & Conditions fields (Essential RFP Section 7)
  nda_required?: boolean;
  payment_terms?: string;
  ip_ownership?: IPOwnership;
  ip_ownership_display?: string;
  insurance_requirements?: string;
  confidentiality_terms?: string;

  // Award info
  awarded_supplier: string | null;
  awarded_supplier_name?: string | null;
  awarded_proposal?: string | null;
  awarded_date: string | null;

  // Related data (new structure)
  sections?: RFPSection[];
  questions?: RFPQuestion[];
  criteria?: ScoringCriteria[];
  scoring_criteria?: ScoringCriteria[];
  line_items?: RFPLineItem[];
  invitations?: RFPInvitation[];
  total_section_weight?: string;
  proposal_count?: number;
  invitation_count?: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// RFP List item (lightweight for list views)
export interface RFPListItem {
  id: string;
  number: string;
  organization: string;
  organization_name: string;
  title: string;
  status: RFPStatus;
  status_display: string;
  rfp_type: RFPType;
  estimated_value: string | null;
  budget_min: string | null;
  budget_max: string | null;
  currency: string;
  response_deadline: string | null;
  award_target_date: string | null;
  proposal_count: number;
  invitation_count: number;
  created_at: string;
}

// Dashboard KPI Types
export interface DashboardKPI {
  kpi_type: string;
  label: string;
  numeric_value: string | null;
  percentage_value: string | null;
  count_value: number | null;
  previous_value: string | null;
  change_percent: string | null;
  period_start: string;
  period_end: string;
}

export interface DashboardData {
  kpis: DashboardKPI[];
  pending_actions: number;
  recent_activity: Activity[];
}

export interface Activity {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  user: string;
}

// Filter Types
export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface RFQFilters extends PaginationParams {
  status?: RFQStatus;
  search?: string;
}

export interface SupplierFilters extends PaginationParams {
  status?: SupplierStatus;
  search?: string;
}

export interface POFilters extends PaginationParams {
  status?: POStatus;
  supplier?: string;
  search?: string;
}

export interface RequisitionFilters extends PaginationParams {
  status?: RequisitionStatus;
  priority?: RequisitionPriority;
  department?: string;
  search?: string;
}

export interface GoodsReceiptFilters extends PaginationParams {
  status?: GoodsReceiptStatus;
  purchase_order?: string;
  supplier?: string;
  search?: string;
}

export interface InvoiceFilters extends PaginationParams {
  status?: InvoiceStatus;
  match_status?: MatchStatus;
  supplier?: string;
  purchase_order?: string;
  search?: string;
  overdue?: boolean;
}

export interface RFPFilters extends PaginationParams {
  status?: RFPStatus;
  rfp_type?: RFPType;
  category?: RFPCategory;  // Backward compatibility
  search?: string;
}

// =============================================================================
// Notification Types
// =============================================================================

export type NotificationStatus = 'UNREAD' | 'READ' | 'ARCHIVED';

export type NotificationType =
  | 'APPROVAL_REQUIRED'       // Document needs your approval
  | 'APPROVAL_COMPLETED'      // Your document was approved
  | 'APPROVAL_REJECTED'       // Your document was rejected
  | 'DOCUMENT_SUBMITTED'      // Document submitted for review
  | 'BID_RECEIVED'            // New bid on your RFQ/RFP
  | 'CONTRACT_EXPIRING'       // Contract approaching expiration
  | 'INVOICE_MATCHED'         // Invoice passed 3-way matching
  | 'GOODS_RECEIVED'          // Goods receipt posted
  | 'BUDGET_ALERT'            // Budget threshold reached
  | 'SYSTEM_ALERT'            // System-wide announcements
  // RFP-specific notification types
  | 'RFP_PUBLISHED'           // RFP published and invitations sent
  | 'RFP_INVITATION'          // Invited to respond to an RFP
  | 'RFP_DEADLINE_REMINDER'   // RFP submission deadline approaching
  | 'RFP_QA_ANSWERED'         // Q&A question answered
  | 'PROPOSAL_RECEIVED'       // New proposal submitted
  | 'PROPOSAL_SHORTLISTED'    // Your proposal was shortlisted
  | 'PROPOSAL_AWARDED'        // Your proposal was awarded
  | 'PROPOSAL_NOT_AWARDED'    // Your proposal was not selected
  | 'BAFO_REQUESTED'          // BAFO round opened, action required
  | 'BAFO_RECEIVED'           // BAFO response received
  | 'RFP_EVALUATION_COMPLETE' // All evaluators finished scoring
  | 'RFP_CLOSED'              // RFP has been closed
  // RFQ-specific notification types
  | 'RFQ_PUBLISHED'           // RFQ published
  | 'RFQ_INVITATION'          // Invited to respond to an RFQ
  | 'RFQ_DEADLINE_REMINDER'   // RFQ deadline approaching
  | 'QUOTE_RECEIVED'          // New quote received
  | 'RFQ_AWARDED'             // RFQ awarded
  | 'RFQ_CLOSED';             // RFQ closed

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  related_object_type: string | null;  // 'requisition', 'purchase_order', etc.
  related_object_id: string | null;
  link: string | null;                  // URL to navigate to
  read_at: string | null;
  created_at: string;
}

export interface NotificationSummary {
  total: number;
  unread: number;
  urgent: number;
}

// =============================================================================
// Bulk Action Types
// =============================================================================

export interface BulkActionResult {
  success: string[];
  failed: { id: string; error: string }[];
  total_processed: number;
  total_success: number;
  total_failed: number;
}
