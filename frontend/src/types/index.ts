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

// User & Auth Types
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  organization: string;
  organization_name?: string;
  date_joined: string;
  last_login: string | null;
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

export interface RFQ {
  id: string;
  number: string;
  organization: string;
  created_by: string;
  title: string;
  description: string;
  status: RFQStatus;
  open_date: string | null;
  close_date: string | null;
  awarded_date: string | null;
  awarded_supplier: string | null;
  total_amount?: string;
  lines?: RFQLine[];
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

// RFP Types (Request for Proposal)
export type RFPStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'UNDER_EVALUATION'
  | 'SHORTLISTED'
  | 'AWARDED'
  | 'CANCELLED';

export type RFPCategory =
  | 'GOODS'
  | 'SERVICES'
  | 'WORKS'
  | 'CONSULTING';

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

export interface RFP {
  id: string;
  number: string;
  organization: string;
  created_by: string;
  created_by_name?: string;
  title: string;
  description: string;
  category: RFPCategory;
  status: RFPStatus;
  budget_min: string | null;
  budget_max: string | null;
  currency: string;
  publish_date: string | null;
  submission_deadline: string | null;
  evaluation_deadline: string | null;
  awarded_date: string | null;
  awarded_supplier: string | null;
  awarded_supplier_name?: string;
  requirements?: RFPRequirement[];
  evaluation_criteria?: RFPEvaluationCriteria[];
  created_at: string;
  updated_at: string;
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
  category?: RFPCategory;
  search?: string;
}
