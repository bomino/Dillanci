# Dillanci Frontend Development Plan

## Overview

This document outlines the complete frontend development plan for the Dillanci Procurement Application. The plan follows standard procurement workflow order and builds upon the existing foundation.

---

## Current State (Completed)

### Foundation Layer
- [x] Project setup (React 18 + TypeScript + Vite)
- [x] Tailwind CSS with Sahel color palette
- [x] React Query for server state
- [x] Zustand for client state (auth-store, ui-store)
- [x] React Router v6 routing

### UI Components Library
- [x] Button, Input, Label, Textarea, Checkbox
- [x] Select (with Radix UI)
- [x] Card (with variants)
- [x] Badge, StatusBadge
- [x] Dialog (modal)
- [x] Toast notifications
- [x] Skeleton loaders
- [x] DataTable (TanStack Table)
- [x] MetricCard
- [x] Charts (Line, Bar, Pie via Recharts)
- [x] CommandPalette (Cmd+K)
- [x] Logo

### Layout Components
- [x] DashboardLayout (with Outlet)
- [x] Sidebar (navigation)
- [x] Header (search, notifications, profile)

### Pages Completed
- [x] LoginPage (authentication flow)
- [x] DashboardPage (KPIs, charts, activity feed)
- [x] SuppliersPage (list with DataTable)
- [x] CreateSupplierPage (form)
- [x] SupplierDetailPage (view/edit)

### API Layer
- [x] API client (axios + interceptors)
- [x] Auth hooks (login, logout, checkAuth)
- [x] Dashboard hooks (useKPIs)
- [x] Suppliers hooks (CRUD)

---

## Development Phases

### Phase 1: Requisitions Module
**Priority: HIGH** | **Estimated Files: 8**

The starting point for procurement workflow. Internal requests for goods/services.

#### Files to Create
```
src/lib/api/requisitions.ts          - API hooks & mock data
src/pages/requisitions/index.ts       - Barrel export
src/pages/requisitions/RequisitionsPage.tsx    - List view
src/pages/requisitions/RequisitionDetailPage.tsx - View/Edit
src/pages/requisitions/CreateRequisitionPage.tsx - Create form
src/components/requisitions/index.ts  - Barrel export
src/components/requisitions/RequisitionForm.tsx  - Form component
src/components/requisitions/LineItemsTable.tsx   - Editable line items
```

#### Features
- DataTable with search, status filter, date range filter
- Multi-line item requisitions (add/edit/remove lines)
- Status workflow: DRAFT → SUBMITTED → APPROVED → REJECTED → CONVERTED
- Approval/Reject actions
- Convert to RFQ or PO action
- Attachments support (future)

#### Types (already in types/index.ts - need to add)
```typescript
type RequisitionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVERTED' | 'CANCELLED';

interface RequisitionLine {
  id: string;
  line_number: number;
  description: string;
  quantity: string;
  unit_of_measure: string;
  estimated_unit_price: string | null;
  estimated_amount: string | null;
  catalog_item: string | null;
}

interface Requisition {
  id: string;
  number: string;
  organization: string;
  requester: string;
  requester_name?: string;
  department: string;
  title: string;
  description: string;
  status: RequisitionStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  required_date: string | null;
  total_amount: string;
  lines?: RequisitionLine[];
  created_at: string;
  updated_at: string;
}
```

---

### Phase 2: RFQs Module (Request for Quotation)
**Priority: HIGH** | **Estimated Files: 9**

Soliciting quotes from suppliers for requisitioned items.

#### Files to Create
```
src/lib/api/rfqs.ts                  - API hooks & mock data
src/pages/rfqs/index.ts              - Barrel export
src/pages/rfqs/RFQsPage.tsx          - List view
src/pages/rfqs/RFQDetailPage.tsx     - View/Edit with quotes
src/pages/rfqs/CreateRFQPage.tsx     - Create from requisition or manual
src/components/rfqs/index.ts         - Barrel export
src/components/rfqs/RFQForm.tsx      - Form component
src/components/rfqs/RFQLineItems.tsx - Line items management
src/components/rfqs/QuotesComparison.tsx - Compare supplier quotes
```

#### Features
- Create RFQ from requisition or manual entry
- Invite multiple suppliers
- Set open/close dates
- Receive and compare quotes
- Quote comparison matrix
- Award to winning supplier
- Status workflow: DRAFT → OPEN → CLOSED → AWARDED → CANCELLED

#### Types (extend existing in types/index.ts)
```typescript
interface RFQQuote {
  id: string;
  rfq: string;
  supplier: string;
  supplier_name: string;
  submitted_date: string;
  total_amount: string;
  is_winner: boolean;
  lines: RFQQuoteLine[];
}

interface RFQQuoteLine {
  id: string;
  rfq_line: string;
  unit_price: string;
  extended_amount: string;
  lead_time_days: number;
  notes: string | null;
}
```

---

### Phase 3: RFPs Module (Request for Proposal)
**Priority: MEDIUM** | **Estimated Files: 8**

Complex procurement requiring detailed proposals (services, projects).

#### Files to Create
```
src/lib/api/rfps.ts                  - API hooks & mock data
src/pages/rfps/index.ts              - Barrel export
src/pages/rfps/RFPsPage.tsx          - List view
src/pages/rfps/RFPDetailPage.tsx     - View/Edit with proposals
src/pages/rfps/CreateRFPPage.tsx     - Create form
src/components/rfps/index.ts         - Barrel export
src/components/rfps/RFPForm.tsx      - Form with sections
src/components/rfps/ProposalScoring.tsx - Score/evaluate proposals
```

#### Features
- Rich text description with sections
- Evaluation criteria with weights
- Supplier proposal submissions
- Scoring matrix
- Status workflow: DRAFT → PUBLISHED → CLOSED → EVALUATION → AWARDED → CANCELLED

---

### Phase 4: Purchase Orders Module
**Priority: HIGH** | **Estimated Files: 9**

Formal orders to suppliers after approval.

#### Files to Create
```
src/lib/api/purchase-orders.ts       - API hooks & mock data
src/pages/purchase-orders/index.ts   - Barrel export
src/pages/purchase-orders/PurchaseOrdersPage.tsx - List view
src/pages/purchase-orders/PODetailPage.tsx       - View/Edit
src/pages/purchase-orders/CreatePOPage.tsx       - Create (manual or from RFQ)
src/components/purchase-orders/index.ts          - Barrel export
src/components/purchase-orders/POForm.tsx        - Form component
src/components/purchase-orders/POLineItems.tsx   - Line items with pricing
src/components/purchase-orders/POPrintView.tsx   - Print-friendly view
```

#### Features
- Create from awarded RFQ or manual entry
- Multi-line items with pricing
- Approval workflow
- Send to supplier (email integration placeholder)
- Track delivery status
- Print/Export PO as PDF
- Status workflow: DRAFT → PENDING_APPROVAL → APPROVED → SENT → PARTIALLY_RECEIVED → RECEIVED → CANCELLED

---

### Phase 5: Goods Receipt / Receiving Module
**Priority: HIGH** | **Estimated Files: 7**

Recording received goods against purchase orders.

#### Files to Create
```
src/lib/api/goods-receipts.ts        - API hooks & mock data
src/pages/receiving/index.ts         - Barrel export
src/pages/receiving/ReceivingPage.tsx           - List view
src/pages/receiving/GoodsReceiptDetailPage.tsx  - View receipt
src/pages/receiving/CreateGoodsReceiptPage.tsx  - Create from PO
src/components/receiving/index.ts    - Barrel export
src/components/receiving/ReceiptForm.tsx        - Receipt form
```

#### Features
- Create receipt against PO
- Partial receipts support
- Quantity validation (can't exceed PO)
- Quality inspection notes
- Update PO received quantities
- Status: PENDING → INSPECTING → ACCEPTED → REJECTED

#### Types
```typescript
interface GoodsReceipt {
  id: string;
  number: string;
  purchase_order: string;
  po_number?: string;
  supplier: string;
  supplier_name?: string;
  receipt_date: string;
  status: 'PENDING' | 'INSPECTING' | 'ACCEPTED' | 'REJECTED';
  notes: string | null;
  lines: GoodsReceiptLine[];
  created_at: string;
}

interface GoodsReceiptLine {
  id: string;
  po_line: string;
  quantity_received: string;
  quantity_accepted: string;
  quantity_rejected: string;
  rejection_reason: string | null;
}
```

---

### Phase 6: Invoices Module
**Priority: HIGH** | **Estimated Files: 8**

Invoice processing with 3-way matching.

#### Files to Create
```
src/lib/api/invoices.ts              - API hooks & mock data
src/pages/invoices/index.ts          - Barrel export
src/pages/invoices/InvoicesPage.tsx  - List view
src/pages/invoices/InvoiceDetailPage.tsx - View with matching
src/pages/invoices/CreateInvoicePage.tsx - Create/Enter invoice
src/components/invoices/index.ts     - Barrel export
src/components/invoices/InvoiceForm.tsx         - Form component
src/components/invoices/ThreeWayMatch.tsx       - Match visualization
```

#### Features
- Enter supplier invoices
- 3-way matching (PO vs GR vs Invoice)
- Match/Unmatch actions
- Variance highlighting (price, quantity)
- Approval for payment
- Payment status tracking
- Status: DRAFT → VALIDATED → MATCHED → APPROVED → PAID → DISPUTED → CANCELLED

---

### Phase 7: Contracts Module
**Priority: MEDIUM** | **Estimated Files: 7**

Supplier contracts and blanket agreements.

#### Files to Create
```
src/lib/api/contracts.ts             - API hooks & mock data
src/pages/contracts/index.ts         - Barrel export
src/pages/contracts/ContractsPage.tsx           - List view
src/pages/contracts/ContractDetailPage.tsx      - View/Edit
src/pages/contracts/CreateContractPage.tsx      - Create form
src/components/contracts/index.ts    - Barrel export
src/components/contracts/ContractForm.tsx       - Form component
```

#### Features
- Contract types: Blanket, Fixed Price, Time & Materials, Framework
- Start/End dates with expiration alerts
- Auto-renewal tracking
- Linked POs under contract
- Document attachments
- Status: DRAFT → PENDING_APPROVAL → ACTIVE → EXPIRED → TERMINATED → CANCELLED

---

### Phase 8: Reports Module
**Priority: MEDIUM** | **Estimated Files: 6**

Analytics and reporting dashboard.

#### Files to Create
```
src/lib/api/reports.ts               - API hooks for report data
src/pages/reports/index.ts           - Barrel export
src/pages/reports/ReportsPage.tsx    - Report selection
src/pages/reports/SpendAnalysisPage.tsx         - Spend by category/supplier
src/pages/reports/SupplierPerformancePage.tsx   - Supplier metrics
src/components/reports/index.ts      - Barrel export
```

#### Features
- Spend analysis by category, supplier, time period
- Supplier performance scorecards
- PO cycle time metrics
- Budget vs Actual
- Export to CSV/Excel
- Date range filters

---

### Phase 9: Settings Module
**Priority: LOW** | **Estimated Files: 6**

Application configuration.

#### Files to Create
```
src/pages/settings/index.ts          - Barrel export
src/pages/settings/SettingsPage.tsx  - Settings hub
src/pages/settings/OrganizationSettings.tsx     - Org config
src/pages/settings/ApprovalWorkflows.tsx        - Workflow config
src/pages/settings/NotificationSettings.tsx     - Email preferences
src/components/settings/index.ts     - Barrel export
```

#### Features
- Organization profile
- User management (admin only)
- Approval workflow configuration
- Notification preferences
- System preferences

---

### Phase 10: User Profile Module
**Priority: LOW** | **Estimated Files: 3**

User account management.

#### Files to Create
```
src/pages/profile/index.ts           - Barrel export
src/pages/profile/ProfilePage.tsx    - Profile view/edit
src/pages/profile/ChangePasswordPage.tsx        - Password change
```

#### Features
- View/Edit profile
- Change password
- Notification preferences
- Activity history

---

## Shared Components to Create

During development, these shared components will be needed:

```
src/components/shared/PageHeader.tsx         - Consistent page headers
src/components/shared/EmptyState.tsx         - No data states
src/components/shared/ErrorState.tsx         - Error display
src/components/shared/ConfirmDialog.tsx      - Confirmation modals
src/components/shared/StatusTimeline.tsx     - Status history
src/components/shared/FileUpload.tsx         - Attachment handling
src/components/shared/DateRangePicker.tsx    - Date range selection
src/components/shared/CurrencyInput.tsx      - Currency formatting
src/components/shared/SearchableSelect.tsx   - Async searchable dropdown
```

---

## Implementation Order Summary

| Order | Module | Priority | Dependencies | Est. Files |
|-------|--------|----------|--------------|------------|
| 1 | Requisitions | HIGH | Suppliers | 8 |
| 2 | RFQs | HIGH | Requisitions, Suppliers | 9 |
| 3 | Purchase Orders | HIGH | RFQs, Suppliers | 9 |
| 4 | Goods Receipt | HIGH | Purchase Orders | 7 |
| 5 | Invoices | HIGH | Purchase Orders, Goods Receipt | 8 |
| 6 | RFPs | MEDIUM | Suppliers | 8 |
| 7 | Contracts | MEDIUM | Suppliers | 7 |
| 8 | Reports | MEDIUM | All modules | 6 |
| 9 | Settings | LOW | None | 6 |
| 10 | Profile | LOW | None | 3 |

**Total Estimated Files: ~71 new files**

---

## Technical Patterns to Follow

### API Layer Pattern
```typescript
// src/lib/api/[module].ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

// List with filters
export function use[Module]s(filters?: [Module]Filters) {
  return useQuery({
    queryKey: ['[module]s', filters],
    queryFn: () => fetch[Module]s(filters),
  });
}

// Single item
export function use[Module](id?: string) {
  return useQuery({
    queryKey: ['[module]', id],
    queryFn: () => fetch[Module](id!),
    enabled: !!id,
  });
}

// Mutations
export function useCreate[Module]() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: create[Module],
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['[module]s'] }),
  });
}
```

### Page Component Pattern
```typescript
// List page structure
export default function [Module]sPage() {
  // 1. Hooks (router, state, queries)
  // 2. Handlers
  // 3. Column definitions
  // 4. Render: Header → Filters → DataTable → Dialogs
}

// Detail page structure
export default function [Module]DetailPage() {
  // 1. Hooks (params, router, queries, mutations)
  // 2. State (isEditing, dialogs)
  // 3. Handlers
  // 4. Loading/Error states
  // 5. Edit mode vs View mode render
}
```

### Form Component Pattern
```typescript
// Using React Hook Form + Zod
const schema = z.object({ ... });

export default function [Module]Form({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  mode = 'create',
}: [Module]FormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialData || defaults,
  });
  // Render form cards with FormField components
}
```

---

## Git Workflow

After completing each module:
1. Run TypeScript check: `npm run build` or `npx tsc --noEmit`
2. Fix any type errors
3. Commit with descriptive message
4. Push to remote

Commit message format:
```
Add [Module] module with full CRUD functionality

- Create [Module]sPage with DataTable, filters, actions
- Create [Module]DetailPage with view/edit modes
- Create [Module]Form component with validation
- Add API hooks with mock data
- Update App.tsx routes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Notes

- All modules use mock data initially for frontend development
- Backend API integration happens when backend endpoints are ready
- Each module follows existing patterns from Suppliers implementation
- Consistent styling using Tailwind + Sahel color palette
- Loading states use Skeleton components
- All forms use React Hook Form + Zod validation
- Status badges use StatusBadge component with appropriate colors

---

## Next Step

**Begin Phase 1: Requisitions Module**

Starting with:
1. Add Requisition types to `types/index.ts`
2. Create `src/lib/api/requisitions.ts`
3. Create `src/pages/requisitions/RequisitionsPage.tsx`
4. Continue with remaining files...
