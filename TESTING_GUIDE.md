# Dillanci Platform - Comprehensive Testing Guide

This document provides step-by-step instructions for end-to-end testing of the Dillanci procurement platform.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Test Environment Setup](#test-environment-setup)
3. [Authentication Testing](#authentication-testing)
4. [User & Role Management Testing](#user--role-management-testing)
5. [Supplier Management Testing](#supplier-management-testing)
6. [Requisition Workflow Testing](#requisition-workflow-testing)
7. [RFQ Workflow Testing](#rfq-workflow-testing)
8. [RFP Workflow Testing](#rfp-workflow-testing) *(Enhanced: BAFO, Q&A, Compliance, Multi-Evaluator)*
9. [Purchase Order Workflow Testing](#purchase-order-workflow-testing) *(Enhanced: PO from RFP)*
10. [Receiving (Goods Receipt) Testing](#receiving-goods-receipt-testing)
11. [Invoice & 3-Way Match Testing](#invoice--3-way-match-testing)
12. [Contract Management Testing](#contract-management-testing) *(Enhanced: Contract from RFP)*
13. [Notifications Testing](#notifications-testing) *(Enhanced: RFP notifications)*
14. [Reports & Dashboard Testing](#reports--dashboard-testing) *(Enhanced: RFP KPIs)*
15. [Admin Panel Testing](#admin-panel-testing)
16. [API Testing](#api-testing)
17. [Cross-Cutting Features Testing](#cross-cutting-features-testing)
18. [Supplier Portal Testing](#supplier-portal-testing) *(New)*
19. [Test Data Cleanup](#test-data-cleanup)

---

## Prerequisites

### Access URLs
| Service | URL |
|---------|-----|
| Frontend Application | http://localhost:3000 |
| Django Admin Panel | http://localhost:8000/admin/ |
| API Documentation (Swagger) | http://localhost:8000/api/docs/ |
| API Documentation (ReDoc) | http://localhost:8000/api/redoc/ |

### Test Credentials
Create these users via Django Admin before testing:

| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| Superuser | admin@dillanci.com | Admin123! | Full system access |
| Procurement Manager | procmgr@dillanci.com | Test123! | Procurement workflows |
| Requester | requester@dillanci.com | Test123! | Create requisitions |
| Budget Holder | budget@dillanci.com | Test123! | Approve requisitions |
| Accounts Payable | ap@dillanci.com | Test123! | Invoice processing |
| Warehouse Staff | warehouse@dillanci.com | Test123! | Goods receiving |

---

## Test Environment Setup

### TC-001: Verify Docker Services Running

**Steps:**
1. Open terminal in project directory
2. Run: `docker-compose ps`

**Expected Result:**
All 6 containers running:
- dillanci-backend (healthy)
- dillanci-frontend (running)
- dillanci-db (healthy)
- dillanci-redis (healthy)
- dillanci-celery (running)
- dillanci-celery-beat (running)

### TC-002: Verify Backend Health

**Steps:**
1. Open browser to http://localhost:8000/api/v1/health/

**Expected Result:**
```json
{"status": "healthy"}
```

### TC-003: Verify Frontend Loads

**Steps:**
1. Open browser to http://localhost:3000

**Expected Result:**
- Login page displays
- Dillanci branding visible
- No console errors

---

## Authentication Testing

### TC-010: Login with Valid Credentials

**Steps:**
1. Navigate to http://localhost:3000
2. Enter email: admin@dillanci.com
3. Enter password: Admin123!
4. Click "Sign In"

**Expected Result:**
- Redirected to Dashboard
- User name displayed in header
- Sidebar navigation visible

### TC-011: Login with Invalid Credentials

**Steps:**
1. Navigate to http://localhost:3000
2. Enter email: admin@dillanci.com
3. Enter password: wrongpassword
4. Click "Sign In"

**Expected Result:**
- Error message displayed: "Invalid credentials"
- Remains on login page

### TC-012: Logout

**Steps:**
1. Login as any user
2. Click user avatar in header
3. Click "Sign Out"

**Expected Result:**
- Redirected to login page
- Session cleared

### TC-013: Session Persistence

**Steps:**
1. Login as admin@dillanci.com
2. Close browser tab (not browser)
3. Open new tab to http://localhost:3000

**Expected Result:**
- User remains logged in
- Dashboard displays

### TC-014: Protected Route Access

**Steps:**
1. Log out
2. Navigate directly to http://localhost:3000/requisitions

**Expected Result:**
- Redirected to login page

---

## User & Role Management Testing

### TC-020: View Users List (Admin)

**Steps:**
1. Login as admin@dillanci.com
2. Navigate to Admin > Users

**Expected Result:**
- Users list displays with columns: Name, Email, Roles, Status, Actions
- Search bar functional
- Status filter works

### TC-021: Create New User

**Steps:**
1. Navigate to Admin > Users
2. Click "Add User"
3. Fill form:
   - First Name: Test
   - Last Name: User
   - Email: testuser@dillanci.com
   - Password: Test123!
   - Role: Requester
4. Click "Create"

**Expected Result:**
- Success toast message
- New user appears in list
- User can login with credentials

### TC-022: Edit User

**Steps:**
1. Navigate to Admin > Users
2. Click on a user row
3. Change first name to "Updated"
4. Click "Save"

**Expected Result:**
- Success toast message
- Name updated in list

### TC-023: Deactivate User

**Steps:**
1. Navigate to Admin > Users
2. Click actions dropdown for a user
3. Click "Deactivate"
4. Confirm action

**Expected Result:**
- User status changes to "Inactive"
- User cannot login

### TC-024: View Roles List

**Steps:**
1. Navigate to Admin > Roles

**Expected Result:**
- 9 pre-defined roles displayed
- Role type badges (System, Organization, Custom)
- Permission count shown

### TC-025: View Role Permissions

**Steps:**
1. Navigate to Admin > Roles
2. Click on "Procurement Officer" role

**Expected Result:**
- Role details displayed
- Permissions grouped by module
- Checkboxes indicate assigned permissions

---

## Supplier Management Testing

### TC-030: View Suppliers List

**Steps:**
1. Login as procmgr@dillanci.com
2. Navigate to Suppliers

**Expected Result:**
- Suppliers list with columns: Name, Code, Category, Status, Rating
- Summary cards: Total, Approved, Pending, Suspended
- Search and filter functional

### TC-031: Create New Supplier

**Steps:**
1. Navigate to Suppliers
2. Click "Add Supplier"
3. Fill required fields:
   - Company Name: Acme Corp
   - Supplier Code: SUP-001
   - Category: General Supplies
   - Contact Name: John Smith
   - Email: john@acme.com
   - Phone: 555-0100
   - Address fields
4. Click "Create"

**Expected Result:**
- Success toast message
- Supplier appears in list with "Pending Review" status

### TC-032: Approve Supplier

**Steps:**
1. Find supplier with "Pending Review" status
2. Click actions dropdown
3. Click "Approve"
4. Confirm action

**Expected Result:**
- Status changes to "Approved"
- Success notification

### TC-033: Suspend Supplier

**Steps:**
1. Find an "Approved" supplier
2. Click actions dropdown
3. Click "Suspend"
4. Enter reason: "Payment issues"
5. Confirm

**Expected Result:**
- Status changes to "Suspended"
- Reason recorded

### TC-034: View Supplier Details

**Steps:**
1. Click on a supplier name in the list

**Expected Result:**
- Detail page with all supplier info
- Tabs: Overview, Contacts, Documents, Purchase History
- Comments section visible
- Attachments section visible

### TC-035: Add Comment to Supplier

**Steps:**
1. Open supplier detail page
2. Scroll to Comments section
3. Enter: "Excellent supplier, always on time"
4. Click "Add Comment"

**Expected Result:**
- Comment appears in list
- Author and timestamp shown

### TC-036: Upload Attachment to Supplier

**Steps:**
1. Open supplier detail page
2. Scroll to Attachments section
3. Click "Upload" or drag file
4. Select a PDF file

**Expected Result:**
- File uploaded with progress indicator
- File appears in attachments list
- Download link works

### TC-037: Export Suppliers List

**Steps:**
1. Navigate to Suppliers list
2. Click "Export" dropdown
3. Select "CSV"

**Expected Result:**
- CSV file downloads
- Contains all visible columns

---

## Requisition Workflow Testing

### TC-040: Create Requisition (Draft)

**Steps:**
1. Login as requester@dillanci.com
2. Navigate to Requisitions
3. Click "New Requisition"
4. Fill header:
   - Title: Office Supplies Q1
   - Description: Quarterly office supplies order
   - Department: Operations
   - Required Date: (2 weeks from today)
5. Add line items:
   - Item 1: Printer Paper, Qty: 50, Unit: Box, Price: $35
   - Item 2: Pens, Qty: 100, Unit: Pack, Price: $12
6. Click "Save as Draft"

**Expected Result:**
- Requisition created with "Draft" status
- REQ number assigned (e.g., REQ-2024-0001)
- Appears in list

### TC-041: Edit Draft Requisition

**Steps:**
1. Open draft requisition
2. Change quantity of Printer Paper to 75
3. Add new line: Stapler, Qty: 10, Price: $15
4. Click "Save"

**Expected Result:**
- Changes saved
- Total recalculated

### TC-042: Submit Requisition for Approval

**Steps:**
1. Open draft requisition
2. Click "Submit for Approval"
3. Confirm action

**Expected Result:**
- Status changes to "Submitted"
- Approval actions appear for approvers
- Requester can no longer edit

### TC-043: Approve Requisition

**Steps:**
1. Login as budget@dillanci.com
2. Navigate to Requisitions
3. Filter by "Submitted" status
4. Open the submitted requisition
5. Click "Approve"
6. Add comment: "Approved within budget"

**Expected Result:**
- Status changes to "Approved"
- Approval timestamp recorded
- Notification sent to requester

### TC-044: Reject Requisition

**Steps:**
1. Login as budget@dillanci.com
2. Open a submitted requisition
3. Click "Reject"
4. Enter reason: "Exceeds quarterly budget"
5. Confirm

**Expected Result:**
- Status changes to "Rejected"
- Rejection reason visible
- Requester can revise and resubmit

### TC-045: Cancel Requisition

**Steps:**
1. Login as requester@dillanci.com
2. Open a draft requisition
3. Click "Cancel"
4. Confirm action

**Expected Result:**
- Status changes to "Cancelled"
- Cannot be edited further

### TC-046: View Requisition Activity Log

**Steps:**
1. Open any requisition
2. Check for Activity/History tab or section

**Expected Result:**
- Shows all status changes with timestamps
- Shows who performed each action

---

## RFQ Workflow Testing

### TC-050: Create RFQ from Requisition

**Steps:**
1. Login as procmgr@dillanci.com
2. Open an approved requisition
3. Click "Create RFQ"
4. Configure RFQ:
   - Due Date: (1 week from today)
   - Select suppliers to invite (at least 3)
5. Click "Create"

**Expected Result:**
- RFQ created in "Draft" status
- Line items copied from requisition
- Linked to source requisition

### TC-051: Create RFQ Manually

**Steps:**
1. Navigate to RFQs
2. Click "New RFQ"
3. Fill details:
   - Title: IT Equipment Q1
   - Category: IT Equipment
   - Due Date: (1 week from today)
4. Add line items:
   - Laptop, Qty: 10, Spec: "15-inch, 16GB RAM"
5. Click "Save as Draft"

**Expected Result:**
- RFQ created with "Draft" status
- RFQ number assigned

### TC-052: Publish RFQ (Open for Bidding)

**Steps:**
1. Open draft RFQ
2. Add supplier invitations (minimum 3)
3. Click "Publish"
4. Confirm action

**Expected Result:**
- Status changes to "Open"
- Cannot add more suppliers
- Bidding deadline shown

### TC-053: Record Supplier Bid

**Steps:**
1. Open published RFQ
2. Go to Bids/Quotes tab
3. Click "Add Bid"
4. Select supplier
5. Enter bid details:
   - Unit Price: $1,200
   - Delivery Days: 14
   - Notes: "Includes warranty"
6. Click "Save Bid"

**Expected Result:**
- Bid recorded
- Appears in bid comparison

### TC-054: Compare Bids

**Steps:**
1. Open RFQ with multiple bids
2. Go to Bid Comparison tab

**Expected Result:**
- Side-by-side comparison of all bids
- Price, delivery, terms visible
- Lowest price highlighted

### TC-055: Award RFQ to Supplier

**Steps:**
1. Open RFQ with bids
2. Select winning bid
3. Click "Award"
4. Confirm action

**Expected Result:**
- RFQ status changes to "Awarded"
- Winning supplier marked
- Other bids marked as "Not Awarded"
- "Create PO" button appears

### TC-056: Close RFQ Without Award

**Steps:**
1. Open an open RFQ
2. Click "Close"
3. Select reason: "All bids exceeded budget"
4. Confirm

**Expected Result:**
- Status changes to "Closed"
- No winner selected

---

## RFP Workflow Testing

### TC-060: Create RFP

**Steps:**
1. Navigate to RFPs
2. Click "New RFP"
3. Fill details:
   - Title: ERP System Implementation
   - Category: Software
   - Budget Range: $500,000 - $1,000,000
   - Submission Deadline: (4 weeks from today)
4. Add sections:
   - Technical Requirements
   - Implementation Approach
   - Pricing
5. Click "Save as Draft"

**Expected Result:**
- RFP created with "Draft" status
- RFP number assigned

### TC-061: Configure Evaluation Criteria

**Steps:**
1. Open draft RFP
2. Go to Evaluation Criteria tab
3. Add criteria:
   - Technical Capability: Weight 40%
   - Price: Weight 30%
   - Experience: Weight 20%
   - Implementation Timeline: Weight 10%
4. Save

**Expected Result:**
- Criteria saved
- Weights sum to 100%

### TC-062: Assign Evaluation Team

**Steps:**
1. Open draft RFP
2. Go to Evaluation Team tab
3. Add team members:
   - IT Director (Lead)
   - Finance Manager (Pricing)
   - Technical Architect (Technical)
4. Save

**Expected Result:**
- Team members assigned with roles
- Ready for evaluation

### TC-063: Publish RFP

**Steps:**
1. Open draft RFP with criteria and team
2. Click "Publish"
3. Confirm

**Expected Result:**
- Status changes to "Published"
- Visible to invited suppliers

### TC-064: Record Proposal

**Steps:**
1. Open published RFP
2. Go to Proposals tab
3. Click "Add Proposal"
4. Select supplier and enter details
5. Upload proposal document
6. Click "Save"

**Expected Result:**
- Proposal recorded
- Document attached

### TC-065: Score Proposal

**Steps:**
1. Open RFP in Scoring status
2. Go to Evaluation/Scoring tab
3. Select a proposal
4. Enter scores for each criterion (1-10)
5. Add evaluation comments
6. Click "Submit Scores"

**Expected Result:**
- Scores recorded
- Weighted total calculated
- Ranking updated

### TC-066: Award RFP

**Steps:**
1. After all evaluators submit scores
2. Review final rankings
3. Select winner
4. Click "Award"
5. Confirm

**Expected Result:**
- Status changes to "Awarded"
- Winner notification
- "Create Contract" option available

### TC-067: Configure BAFO Round

**Steps:**
1. Open RFP in Evaluation status with shortlisted proposals
2. Go to BAFO tab
3. Click "Start BAFO Round"
4. Enter BAFO details:
   - Instructions: "Please provide your best pricing"
   - Focus Areas: ["Pricing", "Timeline"]
   - Deadline: (3 days from today)
5. Click "Create"

**Expected Result:**
- BAFO round created in "Draft" status
- Shortlisted suppliers see BAFO request
- Original proposals preserved for comparison

### TC-068: Submit BAFO Response

**Steps:**
1. Login as supplier (via portal or simulated)
2. Open RFP with BAFO request
3. Submit revised proposal with new pricing/terms
4. Click "Submit BAFO"

**Expected Result:**
- BAFO response status changes to "Submitted"
- Original proposal preserved for comparison
- Timestamp recorded

### TC-069: Close BAFO Round

**Steps:**
1. After deadline passes or all responses received
2. Open BAFO tab
3. Click "Close BAFO Round"
4. Review BAFO comparison

**Expected Result:**
- Round status changes to "Closed"
- Comparison shows BAFO vs original proposals side-by-side
- Price/terms differences highlighted

### TC-070: Q&A Portal - Submit Question

**Steps:**
1. Open published RFP
2. Go to Q&A tab
3. Click "Ask Question"
4. Enter question text: "What is the expected implementation timeline?"
5. Submit

**Expected Result:**
- Question appears in list with "Pending" status
- RFP owner receives notification
- Question timestamp recorded

### TC-071: Q&A Portal - Answer and Broadcast

**Steps:**
1. Open Q&A tab as RFP owner
2. Click on pending question
3. Enter answer
4. Select "Broadcast to All Bidders"
5. Click "Publish"

**Expected Result:**
- Answer published with timestamp
- All invited suppliers can see Q&A
- Amendment logged if terms affected
- Notification sent to all bidders

### TC-072: Compliance Matrix Check

**Steps:**
1. Open RFP with mandatory requirements defined
2. Go to Proposals tab
3. Check compliance indicators per proposal

**Expected Result:**
- Green checkmark for compliant proposals
- Red X for missing mandatory items
- Summary: "X of Y vendors compliant"
- Non-compliant items listed per proposal

### TC-073: Multi-Evaluator Scoring

**Steps:**
1. Assign 3 evaluators to RFP
2. Each evaluator logs in and submits scores for each criterion
3. View consensus/summary tab

**Expected Result:**
- Individual scores recorded per evaluator
- Average/weighted scores calculated automatically
- Ranking updated based on weighted scores
- Score variance visible across evaluators

### TC-074: Proposal Comparison Matrix

**Steps:**
1. Open RFP with multiple shortlisted proposals
2. Go to Comparison tab

**Expected Result:**
- Side-by-side view of all proposals
- Scores highlighted (best in green, worst in red)
- Pricing totals compared
- Key differentiators visible

---

## Purchase Order Workflow Testing

### TC-080: Create PO from Awarded RFQ

**Steps:**
1. Open awarded RFQ
2. Click "Create PO"
3. Review pre-populated details
4. Add/adjust:
   - Payment Terms: Net 30
   - Shipping Method: Ground
   - Delivery Address
5. Click "Create"

**Expected Result:**
- PO created in "Draft" status
- Linked to RFQ and requisition
- Supplier auto-selected

### TC-081: Create PO from Awarded RFP Proposal

**Steps:**
1. Open awarded RFP
2. Go to winning proposal
3. Click "Create PO"
4. Review pre-populated details:
   - Supplier from winning proposal
   - Line items from proposal
   - Pricing from proposal
5. Select budget line
6. Click "Create"

**Expected Result:**
- PO created in "Draft" status
- Linked to RFP and Proposal
- Line items copied from proposal
- Pricing matches proposal

### TC-082: Create PO Manually

**Steps:**
1. Navigate to Purchase Orders
2. Click "New PO"
3. Select supplier
4. Add line items:
   - Product, Qty, Unit Price
5. Set terms and dates
6. Click "Save as Draft"

**Expected Result:**
- PO created with "Draft" status
- PO number assigned

### TC-083: Submit PO for Approval

**Steps:**
1. Open draft PO
2. Review all details
3. Click "Submit"
4. Confirm

**Expected Result:**
- Status changes to "Submitted"
- Pending approval indicator

### TC-084: Approve PO

**Steps:**
1. Login as procmgr@dillanci.com
2. Open submitted PO
3. Click "Approve"
4. Add comment if needed

**Expected Result:**
- Status changes to "Approved"
- Ready to send to supplier

### TC-085: Send PO to Supplier

**Steps:**
1. Open approved PO
2. Click "Send to Supplier"
3. Confirm email/method

**Expected Result:**
- Status changes to "Sent"
- Sent timestamp recorded
- PDF generated (if applicable)

### TC-086: Export PO to PDF

**Steps:**
1. Open any PO
2. Click "Export" or "Print"
3. Select PDF format

**Expected Result:**
- Professional PDF generated
- Contains all PO details
- Company letterhead/branding

### TC-087: Record Partial Receipt on PO

**Steps:**
1. Open sent PO
2. Go to Receiving tab
3. Click "Record Receipt"
4. Enter partial quantities
5. Click "Save"

**Expected Result:**
- Receipt recorded
- Quantities received updated
- Status remains "Sent" or changes to "Partially Received"

---

## Receiving (Goods Receipt) Testing

### TC-090: Create Goods Receipt

**Steps:**
1. Login as warehouse@dillanci.com
2. Navigate to Receiving
3. Click "New Receipt"
4. Select PO from dropdown
5. Enter receipt details:
   - Receipt Date: Today
   - Received By: (auto-filled)
   - Location: Warehouse A
6. Enter quantities received per line
7. Click "Save as Draft"

**Expected Result:**
- GRN created in "Draft" status
- GRN number assigned
- Linked to PO

### TC-091: Post Goods Receipt

**Steps:**
1. Open draft GRN
2. Verify all quantities
3. Click "Post"
4. Confirm

**Expected Result:**
- Status changes to "Posted"
- PO quantities updated
- Cannot edit after posting

### TC-092: Record Quality Inspection

**Steps:**
1. Open a GRN
2. Go to Inspection tab
3. For each line item:
   - Inspection Status: Passed/Failed
   - Quantity Accepted
   - Quantity Rejected
   - Notes
4. Save

**Expected Result:**
- Inspection results recorded
- Accepted/rejected quantities tracked

### TC-093: Partial Receipt

**Steps:**
1. Create GRN for a PO
2. Enter quantities less than ordered
3. Post receipt
4. Check PO status

**Expected Result:**
- PO shows partially received
- Remaining quantities available for future GRNs

### TC-094: Complete Receipt

**Steps:**
1. Record remaining quantities on PO
2. Post final GRN

**Expected Result:**
- PO status changes to "Received"
- All quantities fulfilled

---

## Invoice & 3-Way Match Testing

### TC-100: Create Invoice

**Steps:**
1. Login as ap@dillanci.com
2. Navigate to Invoices
3. Click "New Invoice"
4. Fill details:
   - Supplier: (select)
   - Invoice Number: INV-12345
   - Invoice Date: Today
   - Due Date: (Net 30)
   - PO Reference: (select PO)
5. Add line items (auto-populated from PO)
6. Click "Save as Draft"

**Expected Result:**
- Invoice created in "Draft" status
- Linked to PO

### TC-101: Validate Invoice

**Steps:**
1. Open draft invoice
2. Verify all details correct
3. Click "Validate"

**Expected Result:**
- Status changes to "Validated"
- Ready for matching

### TC-102: Perform 3-Way Match (Pass)

**Steps:**
1. Open validated invoice
2. Click "Match"
3. System compares:
   - Invoice vs PO (price, quantity)
   - Invoice vs GRN (quantity received)

**Expected Result (Pass):**
- All tolerances within limits
- Status changes to "Matched"
- Green checkmarks on comparison

### TC-103: 3-Way Match with Variance

**Steps:**
1. Create invoice with slightly different price (within tolerance)
2. Perform matching

**Expected Result:**
- Match passes with warnings
- Variance percentage shown
- Flagged for review if over threshold

### TC-104: 3-Way Match Failure

**Steps:**
1. Create invoice with major discrepancy:
   - Price 20% higher than PO
   - Or quantity exceeds received
2. Perform matching

**Expected Result:**
- Match fails
- Red indicators on mismatched items
- Status changes to "Disputed"
- Requires resolution

### TC-105: Approve Matched Invoice

**Steps:**
1. Open matched invoice
2. Click "Approve"
3. Confirm

**Expected Result:**
- Status changes to "Approved"
- Ready for payment

### TC-106: Mark Invoice as Paid

**Steps:**
1. Open approved invoice
2. Click "Mark as Paid"
3. Enter payment details:
   - Payment Date
   - Payment Method
   - Reference Number

**Expected Result:**
- Status changes to "Paid"
- Payment date recorded

---

## Contract Management Testing

### TC-110: Create Contract

**Steps:**
1. Navigate to Contracts
2. Click "New Contract"
3. Fill details:
   - Title: Annual IT Support
   - Type: Fixed Price
   - Supplier: (select)
   - Start Date: Jan 1
   - End Date: Dec 31
   - Total Value: $120,000
4. Add milestones:
   - Q1 Review, Q2 Review, Q3 Review, Final Review
5. Click "Save as Draft"

**Expected Result:**
- Contract created in "Draft" status
- Contract number assigned

### TC-111: Create Contract from Awarded RFP

**Steps:**
1. Open an awarded RFP
2. Click "Create Contract"
3. Review pre-populated details:
   - Supplier from winning proposal
   - Value from proposal total
   - Terms from RFP
   - Scope from proposal
4. Adjust contract dates and terms as needed
5. Click "Create"

**Expected Result:**
- Contract created in "Draft" status
- Linked to RFP and Proposal
- Key terms pre-populated from RFP
- Supplier auto-selected from winning proposal

### TC-112: Submit Contract for Approval

**Steps:**
1. Open draft contract
2. Click "Submit for Approval"

**Expected Result:**
- Status changes to "Pending Approval"
- Sent to appropriate approver

### TC-113: Approve Contract

**Steps:**
1. Login as approver
2. Open pending contract
3. Click "Approve"

**Expected Result:**
- Status changes to "Active"
- Start date tracking begins

### TC-114: Track Contract Spend

**Steps:**
1. Open active contract
2. Create POs against this contract
3. Check contract spend dashboard

**Expected Result:**
- Spend amount increases with each PO
- Utilization percentage calculated
- Remaining value shown

### TC-115: Renew Expiring Contract

**Steps:**
1. Find contract near expiration
2. Click "Renew"
3. Enter new dates and terms
4. Confirm

**Expected Result:**
- New contract version created
- Or existing contract extended
- History preserved

### TC-116: Terminate Contract

**Steps:**
1. Open active contract
2. Click "Terminate"
3. Enter reason: "Vendor breach of terms"
4. Confirm

**Expected Result:**
- Status changes to "Terminated"
- Termination reason recorded
- No new POs allowed against it

---

## Notifications Testing

### TC-120: View Notifications

**Steps:**
1. Login as any user with notifications
2. Click bell icon in header

**Expected Result:**
- Dropdown shows recent notifications
- Unread count displayed on bell
- Unread notifications highlighted

### TC-121: Mark Notification as Read

**Steps:**
1. Open notifications dropdown
2. Click on an unread notification

**Expected Result:**
- Notification marked as read
- Unread count decreases
- Navigates to related item

### TC-122: Mark All as Read

**Steps:**
1. Open notifications dropdown
2. Click "Mark all as read"

**Expected Result:**
- All notifications marked read
- Badge count becomes 0

### TC-123: Receive Approval Notification

**Steps:**
1. Login as requester@dillanci.com
2. Create and submit a requisition
3. Login as budget@dillanci.com
4. Approve the requisition
5. Login as requester@dillanci.com again

**Expected Result:**
- Notification received about approval
- Correct type and message
- Link navigates to requisition

### TC-124: Test Notification API

**Steps:**
1. Using browser dev tools or curl:
   ```bash
   curl http://localhost:8000/api/v1/notifications/summary/ \
     -H "Cookie: sessionid=<your-session-id>"
   ```

**Expected Result:**
```json
{
  "total": 5,
  "unread": 2,
  "urgent": 0
}
```

### TC-125: RFP Notification Types

**Steps:**
1. Test each RFP notification type:
   - Publish RFP → Notification to invited suppliers
   - Submit proposal → Notification to RFP owner
   - Start BAFO → Notification to shortlisted vendors
   - Award RFP → Notification to winner and non-winners
   - Q&A broadcast → Notification to all bidders

**Expected Result:**
- Each action triggers appropriate notification
- Correct recipients receive notifications
- Notification links navigate to relevant page

---

## Reports & Dashboard Testing

### TC-130: View Dashboard

**Steps:**
1. Login and navigate to Dashboard (home page)

**Expected Result:**
- KPI cards display: Total Spend, Open POs, Pending Approvals, Suppliers
- Spend by Category chart
- Monthly Trend chart
- Pending Actions list
- Recent Activity feed

### TC-131: Dashboard KPI Drill-down

**Steps:**
1. Click on "Open POs" KPI card

**Expected Result:**
- Navigates to filtered PO list
- Shows only open POs

### TC-132: View Reports Page

**Steps:**
1. Navigate to Reports

**Expected Result:**
- Multiple chart types displayed
- Filters available (date range, category)

### TC-133: Apply Date Range Filter

**Steps:**
1. On Reports page
2. Click date range picker
3. Select "Last 30 Days"
4. Click Apply

**Expected Result:**
- All charts update with filtered data
- Date range shown in filter

### TC-134: Export Report

**Steps:**
1. On Reports page
2. Click "Export" button
3. Select format (CSV or PDF)

**Expected Result:**
- Report downloads in selected format
- Contains visible data

### TC-135: RFP Dashboard KPIs

**Steps:**
1. Navigate to Dashboard
2. Check for RFP-specific KPI cards

**Expected Result:**
These KPIs should display (if data exists):
- Open RFPs count
- Proposals Received (MTD)
- Avg Evaluation Score
- Active BAFO Rounds
- Supplier Response Rate %
- Evaluation Completion Rate %
- RFP Awarded Value (MTD/YTD)
- Avg Time to Award (days)

### TC-136: RFP KPI API

**Steps:**
1. Call GET /api/v1/reports/kpis/
2. Review KPI types returned

**Expected Result:**
- All 21 KPI types returned (12 core + 9 RFP-specific)
- RFP KPIs include:
  - open_rfps
  - proposals_received_mtd
  - avg_evaluation_score
  - active_bafo_rounds
  - supplier_response_rate
  - evaluation_completion_rate
  - rfp_awarded_value_mtd
  - rfp_awarded_value_ytd
  - avg_time_to_award
- Values calculated correctly based on data

---

## Admin Panel Testing

### TC-140: Access Django Admin

**Steps:**
1. Navigate to http://localhost:8000/admin/
2. Login with admin@dillanci.com

**Expected Result:**
- Django admin dashboard displays
- All registered models visible
- Dillanci branding applied

### TC-141: View/Edit User in Admin

**Steps:**
1. In admin, click Users
2. Click on a user
3. Edit email address
4. Click Save

**Expected Result:**
- User updated
- Change logged in history

### TC-142: View Audit Logs

**Steps:**
1. Navigate to Admin > Audit Logs

**Expected Result:**
- List of all system actions
- Filterable by user, action, date
- Details show old/new values

### TC-143: Configure Approval Thresholds

**Steps:**
1. Navigate to Admin > Workflows
2. Add new threshold:
   - Document Type: Requisition
   - Min Amount: $0
   - Max Amount: $5,000
   - Required Role: Budget Holder
3. Save

**Expected Result:**
- Threshold created
- Applied to new requisitions in that range

### TC-144: Admin Logout Redirect

**Steps:**
1. In Django admin, click "Log out"

**Expected Result:**
- Redirected to http://localhost:8000/admin/login/
- Not to default Django logout page

---

## API Testing

Use Swagger UI (http://localhost:8000/api/docs/) or curl for these tests.

### TC-150: API Authentication

**Steps:**
1. Call API without authentication:
   ```bash
   curl http://localhost:8000/api/v1/requisitions/
   ```

**Expected Result:**
- 401 Unauthorized or 403 Forbidden

### TC-151: List Requisitions API

**Steps:**
1. Login via Swagger "Authorize"
2. Call GET /api/v1/requisitions/

**Expected Result:**
- 200 OK
- JSON array of requisitions
- Pagination info included

### TC-152: Create Requisition API

**Steps:**
1. Call POST /api/v1/requisitions/
2. With JSON body:
   ```json
   {
     "title": "API Test Requisition",
     "description": "Created via API",
     "required_date": "2024-12-31"
   }
   ```

**Expected Result:**
- 201 Created
- Returns created requisition

### TC-153: CSRF Protection

**Steps:**
1. Try POST without CSRF token (from different origin)

**Expected Result:**
- 403 Forbidden
- CSRF validation error

### TC-154: Rate Limiting

**Steps:**
1. Make 150+ requests in quick succession

**Expected Result:**
- After limit exceeded: 429 Too Many Requests
- Retry-After header present

---

## Cross-Cutting Features Testing

### TC-160: Comments on Any Entity

**Steps:**
1. Open any detail page (Requisition, PO, Supplier, etc.)
2. Scroll to Comments section
3. Add a comment
4. Verify it appears

**Expected Result:**
- Comment saved with author/timestamp
- Visible to all users with access

### TC-161: Attachments on Any Entity

**Steps:**
1. Open any detail page
2. Scroll to Attachments section
3. Upload a file (PDF, image)
4. Download it back

**Expected Result:**
- File uploaded successfully
- Can be downloaded
- File type/size restrictions enforced

### TC-162: Export from Any List

**Steps:**
1. Navigate to any list page
2. Apply some filters
3. Click Export > CSV

**Expected Result:**
- CSV contains filtered data
- All visible columns included

### TC-163: Search Functionality

**Steps:**
1. On any list page, use search bar
2. Enter partial text

**Expected Result:**
- Results filter in real-time
- Matches on relevant fields

### TC-164: Pagination

**Steps:**
1. On list with many items
2. Navigate to page 2
3. Change page size

**Expected Result:**
- Page navigation works
- Page size changes item count

### TC-165: Responsive Design

**Steps:**
1. Open application on mobile device or resize browser
2. Navigate through pages

**Expected Result:**
- Layout adapts to screen size
- Sidebar collapses to hamburger menu
- Tables become scrollable
- All features accessible

---

## Supplier Portal Testing

### TC-170: Portal Login

**Steps:**
1. Navigate to http://localhost:3000/portal
2. Login with supplier credentials

**Expected Result:**
- Supplier portal dashboard displays
- Shows available RFPs/RFQs
- Only sees own organization's data

### TC-171: View RFP Invitation

**Steps:**
1. In portal, click on an RFP invitation
2. Review RFP details, sections, requirements

**Expected Result:**
- All RFP details visible
- Deadline prominently displayed
- Q&A section accessible
- Attachments downloadable

### TC-172: Submit Proposal via Portal

**Steps:**
1. Open RFP invitation
2. Click "Submit Proposal"
3. Fill each section:
   - Technical responses per requirement
   - Team profiles (file uploads)
   - Pricing per line item
4. Click "Submit"

**Expected Result:**
- Proposal submitted successfully
- Status changes to "Submitted"
- Confirmation notification received
- Cannot edit after submission deadline

### TC-173: Ask Question via Portal

**Steps:**
1. In portal, open an RFP
2. Go to Q&A section
3. Click "Ask Question"
4. Enter question and submit

**Expected Result:**
- Question submitted with "Pending" status
- Visible in question list
- Cannot see other vendors' questions until published

### TC-174: Respond to BAFO Request

**Steps:**
1. View BAFO request in portal
2. Review original proposal terms
3. Enter revised pricing/terms
4. Click "Submit BAFO"

**Expected Result:**
- BAFO response recorded
- Both original and BAFO versions preserved
- Confirmation notification sent

### TC-175: View Award Notification

**Steps:**
1. Wait for RFP to be awarded
2. Check notifications in portal
3. Click on award notification

**Expected Result:**
- Winner sees "Congratulations" message with next steps
- Non-winners see "Thank you for participating" message
- All can view their scores (if configured)

---

## Test Data Cleanup

### TC-180: Delete Test Data

**Steps:**
1. Login to Django admin
2. Delete test records in reverse order:
   - Invoices
   - Goods Receipts
   - Purchase Orders
   - RFQs/RFPs
   - Requisitions
   - Suppliers
   - Test Users

**Note:** Be careful not to delete production data!

### TC-181: Reset Database (Development Only)

**Steps:**
1. Stop containers: `docker-compose down`
2. Remove volumes: `docker-compose down -v`
3. Restart: `docker-compose up -d`
4. Run migrations: `docker-compose exec backend python manage.py migrate`
5. Create superuser: `docker-compose exec backend python manage.py createsuperuser`

**Warning:** This deletes ALL data!

---

## Test Summary Checklist

| Module | Test Cases | Pass | Fail | Notes |
|--------|------------|------|------|-------|
| Environment Setup | TC-001 to TC-003 | | | |
| Authentication | TC-010 to TC-014 | | | |
| User Management | TC-020 to TC-025 | | | |
| Suppliers | TC-030 to TC-037 | | | |
| Requisitions | TC-040 to TC-046 | | | |
| RFQs | TC-050 to TC-056 | | | |
| RFPs (Basic) | TC-060 to TC-066 | | | |
| RFPs (BAFO) | TC-067 to TC-069 | | | New: BAFO workflow |
| RFPs (Q&A) | TC-070 to TC-071 | | | New: Q&A portal |
| RFPs (Compliance) | TC-072 | | | New: Compliance matrix |
| RFPs (Evaluation) | TC-073 to TC-074 | | | New: Multi-evaluator, comparison |
| Purchase Orders | TC-080 to TC-087 | | | Includes PO from RFP (TC-081) |
| Receiving | TC-090 to TC-094 | | | |
| Invoices | TC-100 to TC-106 | | | |
| Contracts | TC-110 to TC-116 | | | Includes Contract from RFP (TC-111) |
| Notifications | TC-120 to TC-125 | | | Includes RFP notifications (TC-125) |
| Reports & KPIs | TC-130 to TC-136 | | | Includes RFP KPIs (TC-135-136) |
| Admin Panel | TC-140 to TC-144 | | | |
| API | TC-150 to TC-154 | | | |
| Cross-Cutting | TC-160 to TC-165 | | | |
| Supplier Portal | TC-170 to TC-175 | | | New: Vendor-side testing |
| Test Data Cleanup | TC-180 to TC-181 | | | |

---

## Known Issues & Workarounds

Document any known issues discovered during testing:

| Issue | Workaround | Status |
|-------|------------|--------|
| | | |

---

## Testing Tools Recommended

1. **Browser DevTools** - Network tab for API calls, Console for errors
2. **Postman/Insomnia** - API testing
3. **Swagger UI** - Interactive API documentation
4. **BrowserStack/LambdaTest** - Cross-browser testing
5. **Lighthouse** - Performance and accessibility audit

---

*Document Version: 2.0*
*Last Updated: December 2024*
*Platform Version: Dillanci 1.1*

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | December 2024 | Initial release with core module testing |
| 2.0 | December 2024 | Added RFP enhancements (BAFO, Q&A, Compliance, Multi-Evaluator), Supplier Portal testing, RFP KPIs, Contract/PO from RFP flows |
