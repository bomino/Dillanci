# Dillanci Procurement Platform - Complete Workflow Documentation

## Executive Summary

Dillanci is an enterprise procurement platform implementing a complete **Procure-to-Pay (P2P)** workflow. The system manages the full procurement lifecycle from requisition creation through invoice payment, with built-in approval workflows, budget controls, and audit trails.

---

## 1. PROCUREMENT DOCUMENT LIFECYCLE

### 1.1 Document Types Overview

The P2P flow connects these document types:

```
┌─────────────┐    ┌─────────┐    ┌─────────────────┐    ┌───────────────┐
│ REQUISITION │───>│ RFQ/RFP │───>│ PURCHASE ORDER  │───>│ GOODS RECEIPT │
└─────────────┘    └─────────┘    └─────────────────┘    └───────────────┘
                                           │                      │
                                           v                      v
                                    ┌─────────────┐        ┌─────────────┐
                                    │  CONTRACT   │        │   INVOICE   │
                                    └─────────────┘        └─────────────┘
```

1. **REQUISITION** - Starting point (end user creates need)
2. **RFQ** (Request for Quote) - Simple competitive bidding
3. **RFP** (Request for Proposal) - Complex multi-criteria sourcing
4. **PURCHASE ORDER** - Formal commitment to buy
5. **GOODS RECEIPT** - Record of physical delivery
6. **INVOICE** - Supplier billing with 3-way matching
7. **CONTRACT** - Long-term supplier agreements

---

## 2. REQUISITION WORKFLOW

### 2.1 Purpose
A Requisition is a formal request to purchase goods or services. It is the starting point of most procurement processes.

### 2.2 Status Flow Diagram

```
┌───────┐     submit      ┌───────────┐     approve     ┌──────────┐
│ DRAFT │────────────────>│ SUBMITTED │────────────────>│ APPROVED │
└───────┘                 └───────────┘                 └──────────┘
    │                           │                            │
    │ cancel                    │ reject                     │ cancel
    v                           v                            v
┌───────────┐             ┌──────────┐                ┌───────────┐
│ CANCELLED │<────────────│ REJECTED │                │ CANCELLED │
└───────────┘    revise   └──────────┘                └───────────┘
                   │              │
                   └──────────────┘
                      (back to DRAFT)
```

### 2.3 Key Actions

| Action | From State | To State | Budget Effect |
|--------|------------|----------|---------------|
| Submit | DRAFT | SUBMITTED | Creates ACTIVE encumbrance |
| Approve | SUBMITTED | APPROVED | None (already encumbered) |
| Reject | SUBMITTED | REJECTED | Releases encumbrance |
| Revise | REJECTED | DRAFT | None |
| Cancel | DRAFT/APPROVED | CANCELLED | Releases encumbrance |

### 2.4 Business Rules
- Only the creator can submit their requisition
- Approvers must have `requisition.approve` permission
- Approval limits based on dollar thresholds
- Budget validation occurs at submission

---

## 3. RFQ (REQUEST FOR QUOTE) WORKFLOW

### 3.1 Purpose
Simple price-focused competitive bidding for straightforward purchases.

### 3.2 Status Flow Diagram

```
┌───────┐     open      ┌──────┐    close     ┌────────┐     award     ┌─────────┐
│ DRAFT │──────────────>│ OPEN │─────────────>│ CLOSED │─────────────>│ AWARDED │
└───────┘               └──────┘              └────────┘              └─────────┘
    │                       │                      │
    │ cancel                │ cancel               │ cancel
    v                       v                      v
┌───────────┐          ┌───────────┐          ┌───────────┐
│ CANCELLED │          │ CANCELLED │          │ CANCELLED │
└───────────┘          └───────────┘          └───────────┘
```

### 3.3 Related Entities

**Supplier Invitation Flow:**
```
┌─────────┐     view     ┌────────┐     submit_bid     ┌───────────────┐
│ PENDING │─────────────>│ VIEWED │───────────────────>│ BID_SUBMITTED │
└─────────┘              └────────┘                    └───────────────┘
                              │
                              │ decline
                              v
                         ┌──────────┐
                         │ DECLINED │
                         └──────────┘
```

**Bid Flow:**
```
┌───────┐     submit     ┌───────────┐     award     ┌─────────┐
│ DRAFT │───────────────>│ SUBMITTED │──────────────>│ AWARDED │
└───────┘                └───────────┘               └─────────┘
                              │
                              │ not_awarded
                              v
                         ┌─────────────┐
                         │ NOT_AWARDED │
                         └─────────────┘
```

---

## 4. RFP (REQUEST FOR PROPOSAL) WORKFLOW

### 4.1 Purpose
Complex procurements requiring multi-criteria scoring and detailed proposals.

### 4.2 Status Flow Diagram

```
┌───────┐  publish  ┌───────────┐  start_scoring  ┌─────────┐  bafo  ┌──────┐
│ DRAFT │──────────>│ PUBLISHED │────────────────>│ SCORING │──────>│ BAFO │
└───────┘           └───────────┘                 └─────────┘       └──────┘
                                                       │                │
                                                       │ close          │ close
                                                       v                v
                                                  ┌────────┐       ┌────────┐
                                                  │ CLOSED │       │ CLOSED │
                                                  └────────┘       └────────┘
                                                       │
                                                       │ award
                                                       v
                                                  ┌─────────┐
                                                  │ AWARDED │
                                                  └─────────┘
```

### 4.3 Related Entities

- **RFPSection** - Logical sections of the RFP document
- **RFPQuestion** - Specific questions suppliers must answer
- **ScoringCriteria** - Weighted criteria for proposal assessment
- **ScoringTeam** - Team members with roles (LEAD, TECHNICAL, PRICING, GENERAL)
- **Proposal** - Supplier responses

**Proposal Flow:**
```
┌───────┐  submit  ┌───────────┐  shortlist  ┌─────────────┐  award  ┌─────────┐
│ DRAFT │─────────>│ SUBMITTED │────────────>│ SHORTLISTED │───────>│ AWARDED │
└───────┘          └───────────┘             └─────────────┘        └─────────┘
                        │                          │
                        │ not_award                │ not_award
                        v                          v
                   ┌─────────────┐            ┌─────────────┐
                   │ NOT_AWARDED │            │ NOT_AWARDED │
                   └─────────────┘            └─────────────┘
```

---

## 5. PURCHASE ORDER WORKFLOW

### 5.1 Purpose
Formal commitment to buy goods/services from a supplier at agreed terms.

### 5.2 Status Flow Diagram

```
┌───────┐  submit  ┌───────────┐  approve  ┌──────────┐  send  ┌──────┐
│ DRAFT │─────────>│ SUBMITTED │──────────>│ APPROVED │──────>│ SENT │
└───────┘          └───────────┘           └──────────┘       └──────┘
    │                   │                       │                 │
    │                   │ reject                │                 │ receive
    │                   v                       │                 v
    │              ┌──────────┐                 │            ┌──────────┐
    │              │ REJECTED │                 │            │ RECEIVED │
    │              └──────────┘                 │            └──────────┘
    │                   │                       │                 │
    │                   │ revise                │                 │ complete
    │                   v                       │                 v
    │              ┌───────┐                    │            ┌───────────┐
    │              │ DRAFT │                    │            │ COMPLETED │
    │              └───────┘                    │            └───────────┘
    │                                           │
    │ cancel        (any state)                 │ cancel
    v                   │                       v
┌───────────┐          │                  ┌───────────┐
│ CANCELLED │<─────────┘                  │ CANCELLED │
└───────────┘                             └───────────┘
```

### 5.3 Key Actions

| Action | From State | To State | Budget Effect |
|--------|------------|----------|---------------|
| Submit | DRAFT | SUBMITTED | None |
| Approve | SUBMITTED | APPROVED | Creates ACTIVE encumbrance |
| Reject | SUBMITTED | REJECTED | None |
| Revise | REJECTED | DRAFT | None |
| Send | APPROVED | SENT | None |
| Acknowledge | SENT | SENT | None (supplier action) |
| Receive | SENT | RECEIVED | None |
| Complete | RECEIVED | COMPLETED | None |
| Cancel | Any | CANCELLED | Releases encumbrance |

### 5.4 Business Rules
- POs can be created from approved requisitions, awarded RFQ bids, or contracts
- Approval thresholds based on PO total value
- Supplier acknowledgment is tracked but optional
- Partial receipts are allowed

---

## 6. GOODS RECEIPT WORKFLOW

### 6.1 Purpose
Records physical receipt of goods against a Purchase Order.

### 6.2 Status Flow Diagram

```
┌───────┐     post      ┌────────┐
│ DRAFT │──────────────>│ POSTED │
└───────┘               └────────┘
    │
    │ cancel
    v
┌───────────┐
│ CANCELLED │
└───────────┘
```

### 6.3 Post Effects

When a Goods Receipt is posted:

1. Updates `POLine.quantity_received` for each line item
2. If all PO lines are fully received → Auto-transitions PO to `RECEIVED`
3. Creates audit trail with receipt details
4. Triggers notifications to relevant stakeholders

### 6.4 Receipt Line Details
- Links to specific PO line
- Quantity received
- Received date
- Storage location
- Quality notes/issues

---

## 7. INVOICE WORKFLOW

### 7.1 Purpose
Process supplier invoices with 3-way matching for payment authorization.

### 7.2 Status Flow Diagram

```
┌───────┐  validate  ┌───────────┐  match  ┌─────────┐  approve  ┌──────────┐  pay  ┌──────┐
│ DRAFT │───────────>│ VALIDATED │────────>│ MATCHED │─────────>│ APPROVED │─────>│ PAID │
└───────┘            └───────────┘         └─────────┘          └──────────┘      └──────┘
                          │                     │
                          │ reject              │ dispute
                          v                     v
                     ┌──────────┐          ┌──────────┐
                     │ REJECTED │          │ DISPUTED │
                     └──────────┘          └──────────┘
                          │                     │
                          │ revise              │ resolve
                          v                     v
                     ┌───────┐             ┌─────────┐
                     │ DRAFT │             │ MATCHED │
                     └───────┘             └─────────┘
```

### 7.3 3-Way Matching

The 3-way match compares:

| Document | What It Provides |
|----------|------------------|
| Purchase Order | Ordered quantity and agreed price |
| Goods Receipt | Actually received quantity |
| Invoice | Billed quantity and price |

**Match Verification:**
```
Invoice Qty ≤ GR Qty ≤ PO Qty
Invoice Price ≈ PO Price (within tolerance)
```

**Configuration Options:**
- `price_tolerance_percent` - Default: 5%
- `quantity_tolerance_percent` - Default: 2%
- `auto_match_max_amount` - Default: $10,000

### 7.4 Key Actions

| Action | From State | To State | Budget Effect |
|--------|------------|----------|---------------|
| Validate | DRAFT | VALIDATED | None |
| Match | VALIDATED | MATCHED | None |
| Dispute | MATCHED | DISPUTED | None |
| Resolve | DISPUTED | MATCHED | None |
| Approve | MATCHED | APPROVED | **Liquidates encumbrance** |
| Reject | VALIDATED | REJECTED | None |
| Mark Paid | APPROVED | PAID | None |

### 7.5 Business Rules
- Invoice approval triggers budget liquidation (converts encumbrance to actual expense)
- Auto-matching available for invoices under threshold
- Disputes create holds requiring resolution
- Payment date tracking for cash flow management

---

## 8. CONTRACT WORKFLOW

### 8.1 Purpose
Manage long-term supplier agreements with negotiated terms.

### 8.2 Contract Types

| Type | Description | Use Case |
|------|-------------|----------|
| BLANKET | Pre-negotiated pricing for recurring purchases | Office supplies, MRO items |
| FIXED_PRICE | Set price for defined scope | Construction, installations |
| TIME_MATERIALS | Billed based on time and materials | Consulting, repairs |
| FRAMEWORK | Master agreement for multiple orders | Multi-year supplier relationships |

### 8.3 Status Flow Diagram

```
┌───────┐  submit  ┌──────────────────┐  approve  ┌────────┐
│ DRAFT │─────────>│ PENDING_APPROVAL │──────────>│ ACTIVE │
└───────┘          └──────────────────┘           └────────┘
                                                      │
                          ┌───────────────────────────┤
                          │                           │
                          │ expire                    │ terminate
                          v                           v
                     ┌─────────┐               ┌────────────┐
                     │ EXPIRED │               │ TERMINATED │
                     └─────────┘               └────────────┘
                          │
                          │ renew
                          v
                     ┌────────┐
                     │ ACTIVE │
                     └────────┘
```

### 8.4 Spend Tracking

| Field | Description |
|-------|-------------|
| `total_value` | Maximum contract value |
| `total_spent` | Sum of POs issued against contract |
| `remaining_value` | `total_value - total_spent` |
| `utilization_percent` | `(total_spent / total_value) × 100` |

### 8.5 Business Rules
- Contracts can have renewal clauses
- Spend limits enforced at PO creation
- Expiration warnings configurable (30, 60, 90 days)
- Contract terms flow down to related POs

---

## 9. BUDGET INTEGRATION

### 9.1 Encumbrance Lifecycle

Encumbrances reserve budget funds for anticipated expenses:

```
┌────────┐                    ┌──────────┐                    ┌─────────────┐
│ ACTIVE │───────────────────>│ RELEASED │                    │ LIQUIDATED  │
└────────┘   (Cancel/Reject)  └──────────┘                    └─────────────┘
     │                                                              ^
     │                                                              │
     └──────────────────────────────────────────────────────────────┘
                        (Invoice Approval)
```

| State | Meaning |
|-------|---------|
| **ACTIVE** | Funds committed, reserved from budget |
| **RELEASED** | Commitment cancelled, funds returned to budget |
| **LIQUIDATED** | Converted to actual expense |

### 9.2 Budget-Affecting Actions

| Document | Action | Effect on Budget |
|----------|--------|------------------|
| Requisition | Submit | Creates ACTIVE encumbrance |
| Requisition | Reject | Releases encumbrance |
| Requisition | Cancel | Releases encumbrance |
| Purchase Order | Approve | Creates ACTIVE encumbrance |
| Purchase Order | Reject | No effect (not yet encumbered) |
| Purchase Order | Cancel | Releases encumbrance |
| Invoice | Approve | **Liquidates encumbrance** |

### 9.3 Budget Calculation

```
Available Budget = Allocated Budget - Active Encumbrances - Actual Expenses

Where:
- Allocated Budget = Annual/period budget allocation
- Active Encumbrances = Sum of all ACTIVE encumbrances
- Actual Expenses = Sum of all LIQUIDATED encumbrances (approved invoices)
```

---

## 10. APPROVAL AUTHORITY

### 10.1 Pre-defined Roles (9 Presets)

| Role | Key Permissions | Typical Use |
|------|-----------------|-------------|
| **Requester** | requisition.create, submit | End users creating purchase requests |
| **Budget Holder** | requisition.approve, reject | Department managers with budget authority |
| **Procurement Officer** | rfq.*, rfp.*, po.create | Procurement team members |
| **Procurement Manager** | All procurement + approvals | Procurement department leaders |
| **Accounts Payable** | invoice.* | AP clerks processing invoices |
| **Warehouse Staff** | receiving.* | Warehouse/logistics team |
| **Finance Manager** | budget.*, invoice.approve | Finance leadership |
| **Auditor** | All view + audit.* | Internal/external auditors |
| **Organization Admin** | user.*, admin.* | System administrators |

### 10.2 Approval Thresholds

Configurable per organization and document type:

| Setting | Description |
|---------|-------------|
| `min_amount` | Minimum dollar amount for this threshold |
| `max_amount` | Maximum dollar amount for this threshold |
| `required_role` | Role required to approve |
| `auto_approve` | Skip manual review if conditions met |
| `escalation_hours` | Hours before escalation triggers |
| `escalation_role` | Role that receives escalated items |

**Example Threshold Configuration:**

| Range | Approver | Auto-Approve |
|-------|----------|--------------|
| $0 - $1,000 | Budget Holder | Yes |
| $1,001 - $10,000 | Budget Holder | No |
| $10,001 - $50,000 | Finance Manager | No |
| $50,001+ | CFO | No |

---

## 11. AUDIT TRAIL

### 11.1 Tracked Events

| Event Type | Description |
|------------|-------------|
| CREATE | New entity created with all initial values |
| UPDATE | Field-level changes recorded (old → new) |
| DELETE | Record of deletion with final state |
| STATE_TRANSITION | Status changes with from/to states |

### 11.2 Audit Record Structure

```json
{
  "id": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "user": "john.doe",
  "user_email": "john.doe@company.com",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "content_type": "purchase_order",
  "object_id": "PO-2024-00123",
  "action": "STATE_TRANSITION",
  "changes": {
    "status": {
      "old": "SUBMITTED",
      "new": "APPROVED"
    }
  },
  "from_state": "SUBMITTED",
  "to_state": "APPROVED"
}
```

### 11.3 Retention & Access
- Audit logs retained indefinitely
- Read-only access for users with `audit.view` permission
- Export capability for compliance reporting
- Searchable by user, date range, action type, or object

---

## 12. COMPLETE P2P EXAMPLE

**Scenario: Purchasing 100 Laptops ($120,000)**

### Step 1: REQUISITION
```
Actor: IT Manager (Sarah)
Action: Creates requisition for 100 laptops @ $1,200 each
Status: DRAFT → SUBMITTED
Budget: $120,000 encumbered
Approver: Finance Manager (Mike) approves
Status: SUBMITTED → APPROVED
```

### Step 2: RFQ
```
Actor: Procurement Officer (Tom)
Action: Creates RFQ, invites Dell, HP, Lenovo
Status: DRAFT → OPEN
Suppliers: Submit bids
Status: OPEN → CLOSED
Winner: Dell at $118,000 (lowest conforming bid)
Status: CLOSED → AWARDED
```

### Step 3: PURCHASE ORDER
```
Actor: Tom creates PO from winning bid
PO Total: $118,000
Status: DRAFT → SUBMITTED
Approver: Procurement Manager (Lisa) approves
Status: SUBMITTED → APPROVED
Budget: Encumbrance adjusted to $118,000
Action: PO sent to Dell electronically
Status: APPROVED → SENT
```

### Step 4: GOODS RECEIPT
```
Actor: Warehouse Staff (Alex)
Action: Receives 100 laptops from Dell
Creates: Goods Receipt with 100 units
Status: DRAFT → POSTED
Effect: PO status → RECEIVED
```

### Step 5: INVOICE
```
Actor: Dell sends invoice for $118,000
AP Clerk: Enters invoice
Status: DRAFT → VALIDATED
3-Way Match: PO (100 @ $1,180) = GR (100) = Invoice (100 @ $1,180) ✓
Status: VALIDATED → MATCHED
Approver: Finance Manager (Mike) approves
Status: MATCHED → APPROVED
Budget: Encumbrance LIQUIDATED → Actual expense recorded
```

### Step 6: PAYMENT
```
Actor: AP processes payment
Status: APPROVED → PAID
Cycle: COMPLETE
```

### Timeline Summary
```
Day 1:   Requisition created and approved
Day 2-7: RFQ process (5 business days)
Day 8:   PO created and approved
Day 9:   PO sent to supplier
Day 14:  Goods received
Day 15:  Invoice received and matched
Day 16:  Invoice approved
Day 30:  Payment processed (Net 15 terms)
```

---

## 13. KEY BACKEND FILES

| Module | Model File | Description |
|--------|------------|-------------|
| Requisitions | `backend/apps/requisitions/models.py` | Requisition, RequisitionLine |
| RFQs | `backend/apps/rfqs/models.py` | RFQ, SupplierInvitation, Bid |
| RFPs | `backend/apps/rfps/models.py` | RFP, RFPSection, Proposal, Score |
| Purchase Orders | `backend/apps/purchase_orders/models.py` | PurchaseOrder, POLine |
| Receiving | `backend/apps/receiving/models.py` | GoodsReceipt, ReceiptLine |
| Invoices | `backend/apps/invoices/models.py` | Invoice, InvoiceLine, Match |
| Contracts | `backend/apps/contracts/models.py` | Contract, ContractLine |
| Budget | `backend/apps/budget/models.py` | Budget, Encumbrance |
| Users/RBAC | `backend/apps/users/models.py` | User, Role, Permission, UserRole |
| Audit | `backend/apps/audit/models.py` | AuditLog |

---

## 14. FRONTEND ROUTES

| Route | Purpose | Key Features |
|-------|---------|--------------|
| `/requisitions` | Requisition management | Create, submit, approve workflow |
| `/rfqs` | RFQ management | Create RFQ, invite suppliers, award |
| `/rfps` | RFP management | Complex scoring, multi-criteria |
| `/purchase-orders` | PO management | Create from req/bid, send to supplier |
| `/receiving` | Goods receipt | Record deliveries, update PO status |
| `/invoices` | Invoice processing | 3-way match, approve for payment |
| `/contracts` | Contract management | Terms, spend tracking, renewals |
| `/suppliers` | Supplier database | Supplier master data |
| `/admin/users` | User management | Create users, assign roles |
| `/admin/roles` | Role management | Define roles, set permissions |
| `/admin/workflows` | Approval thresholds | Configure approval rules |
| `/admin/audit-logs` | Audit viewer | Search and export audit trail |

---

## 15. GLOSSARY

| Term | Definition |
|------|------------|
| **P2P** | Procure-to-Pay - end-to-end procurement process |
| **Requisition** | Internal request to purchase goods/services |
| **RFQ** | Request for Quote - solicitation for pricing |
| **RFP** | Request for Proposal - solicitation for detailed proposals |
| **PO** | Purchase Order - commitment to buy from supplier |
| **GR** | Goods Receipt - record of physical delivery |
| **3-Way Match** | Verification of PO, GR, and Invoice alignment |
| **Encumbrance** | Reserved budget funds for anticipated expenses |
| **Liquidation** | Converting encumbrance to actual expense |
| **RBAC** | Role-Based Access Control |
| **BAFO** | Best and Final Offer (RFP stage) |

---

## Document Information

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | December 2024 |
| Platform | Dillanci Enterprise Procurement |
| Authors | System Documentation |

---

*This document provides a comprehensive overview of the Dillanci procurement workflow. For technical implementation details, refer to the backend model files and API documentation.*
