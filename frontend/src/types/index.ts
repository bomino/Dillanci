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

// Invoice Types
export type InvoiceStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'MATCHED'
  | 'APPROVED'
  | 'PAID'
  | 'CANCELLED'
  | 'REJECTED'
  | 'DISPUTED';

export interface Invoice {
  id: string;
  number: string;
  supplier_invoice_number: string;
  purchase_order: string;
  supplier: string;
  supplier_name?: string;
  organization: string;
  status: InvoiceStatus;
  invoice_date: string;
  due_date: string;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
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
