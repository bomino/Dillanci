# Dillanci User Guide

## Enterprise Procurement Platform - Complete User Documentation

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Understanding Your Role](#3-understanding-your-role)
4. [Dashboard](#4-dashboard)
5. [Requisitions Module](#5-requisitions-module)
6. [RFQ Module](#6-rfq-module)
7. [RFP Module](#7-rfp-module)
8. [Purchase Orders Module](#8-purchase-orders-module)
9. [Receiving Module](#9-receiving-module)
10. [Invoices Module](#10-invoices-module)
11. [Suppliers Module](#11-suppliers-module)
12. [Contracts Module](#12-contracts-module)
13. [Budget Module](#13-budget-module)
14. [Reports & Analytics](#14-reports--analytics)
15. [Comments & Attachments](#15-comments--attachments)
16. [Notifications](#16-notifications)
17. [Administration](#17-administration)
18. [Appendix](#18-appendix)

---

## 1. Introduction

### What is Dillanci?

Dillanci is an enterprise-grade procurement platform designed to streamline and automate your organization's entire procure-to-pay (P2P) lifecycle. From the initial purchase request to final payment, Dillanci provides a unified platform for managing all procurement activities with full visibility, compliance, and efficiency.

### Platform Capabilities

Dillanci covers the complete procurement lifecycle:

| Phase | Description | Modules |
|-------|-------------|---------|
| **Plan** | Identify needs and budget | Requisitions, Budget |
| **Source** | Find and evaluate suppliers | RFQs, RFPs, Suppliers |
| **Contract** | Formalize agreements | Contracts |
| **Procure** | Create and manage orders | Purchase Orders |
| **Receive** | Accept and inspect goods | Receiving |
| **Pay** | Process invoices and payments | Invoices |
| **Analyze** | Monitor and optimize | Reports, Dashboard |

### Key Benefits

- **Efficiency**: Automate manual procurement processes and reduce cycle times
- **Visibility**: Real-time tracking of all procurement activities across the organization
- **Compliance**: Enforce approval workflows, spending limits, and audit trails
- **Savings**: Competitive bidding, spend analysis, and contract optimization
- **Collaboration**: Unified platform for procurement, finance, and business users
- **Integration**: Connect with your existing ERP, accounting, and supplier systems

---

## 2. Getting Started

### Accessing the Platform

1. Open your web browser and navigate to your organization's Dillanci URL
2. You will see the login page with the Dillanci logo

**Default Access URLs (Development):**
| URL | Description |
|-----|-------------|
| http://localhost:3000 | Frontend Application |
| http://localhost:8000/admin/ | Django Admin Panel |
| http://localhost:8000/api/docs/ | API Documentation |

**Default User Credentials:**
| Email | Password | Role |
|-------|----------|------|
| `admin@dillanci.com` | `Admin123!` | Superuser |
| `test@example.com` | `Test123!` | Staff |

### Logging In

1. Enter your **Email** address
2. Enter your **Password**
3. Click the **Sign In** button

> **Note**: If you've forgotten your password, click "Forgot Password?" to receive a reset link via email.

### First Login

On your first login, you may be prompted to:
- Set up a new password (if using a temporary password)
- Complete your user profile
- Review and accept terms of use

### Navigating the Interface

The Dillanci interface consists of three main areas:

#### Sidebar Navigation (Left)
The sidebar provides access to all modules based on your role:
- **Dashboard**: Overview and quick actions
- **Main Modules**: Requisitions, RFQs, RFPs, Purchase Orders, etc.
- **Admin Section**: User management, settings (admin roles only)

#### Header Bar (Top)
- **Search**: Quick search across all records
- **Notifications**: Bell icon showing unread notifications
- **User Menu**: Profile settings, logout

#### Main Content Area (Center)
- **List Views**: Tables showing records with filtering and sorting
- **Detail Views**: Individual record details with tabs
- **Forms**: Create and edit forms for data entry

### Setting Up Your Profile

1. Click your name/avatar in the top-right corner
2. Select **Profile** or **Settings**
3. Update your information:
   - First Name and Last Name
   - Email Address
   - Phone Number
   - Notification Preferences

---

## 3. Understanding Your Role

Dillanci uses Role-Based Access Control (RBAC) to ensure users can only access the features and data relevant to their job function. Each user is assigned one or more roles that determine their permissions.

### Available Roles

| Role | Description | Primary Responsibilities |
|------|-------------|-------------------------|
| **Requester** | End users who initiate purchase needs | Create and submit requisitions |
| **Budget Holder** | Department managers with budget authority | Approve requisitions within budget |
| **Procurement Officer** | Buyers handling sourcing | Manage RFQs, RFPs, create POs |
| **Procurement Manager** | Senior procurement authority | Full procurement access + approvals |
| **Accounts Payable** | Finance staff for payments | Process invoices, manage payments |
| **Warehouse Staff** | Inventory and receiving | Record goods receipts |
| **Finance Manager** | Financial oversight | Budget management, financial reports |
| **Auditor** | Compliance review | Read-only access to all records |
| **Organization Admin** | System administration | User management, system settings |

### Role-Permission Matrix

The following table shows which modules each role can access:

| Module | Requester | Budget Holder | Procurement Officer | Procurement Manager | Accounts Payable | Warehouse Staff | Finance Manager | Auditor | Org Admin |
|--------|:---------:|:-------------:|:------------------:|:-------------------:|:----------------:|:---------------:|:---------------:|:-------:|:---------:|
| Dashboard | View | View | View | View | View | View | View | View | View |
| Requisitions | Create/Edit | Approve | View | Full + Approve | - | - | - | View | - |
| RFQs | - | - | Full | Full + Award | - | - | - | View | - |
| RFPs | - | - | Full | Full + Award | - | - | - | View | - |
| Purchase Orders | - | - | Create/Edit | Full | View | View | - | View | - |
| Receiving | - | - | - | - | View | Full | - | View | - |
| Invoices | - | - | - | - | Full | - | Approve | View | - |
| Suppliers | View | View | Create/Edit | Full | View | View | - | View | - |
| Contracts | - | - | Create/Edit | Full | - | - | View | View | - |
| Budget | View | View | - | - | - | - | Full | View | - |
| Reports | - | View | View | Export | View | - | Full | Full | - |
| Admin | - | - | - | - | - | - | Audit | Audit | Full |

**Legend**: Full = All actions | View = Read-only | Create/Edit = Create and modify | Approve = Approval authority | - = No access

### Sidebar Visibility by Role

Your sidebar navigation will show only the modules relevant to your role:

**Requester sees**: Dashboard, Requisitions, Suppliers (view)

**Procurement Officer sees**: Dashboard, Requisitions, RFQs, RFPs, Purchase Orders, Suppliers, Contracts, Reports

**Accounts Payable sees**: Dashboard, Purchase Orders (view), Receiving (view), Invoices, Suppliers (view), Reports

**Organization Admin sees**: Dashboard, Settings, Users, Roles, Audit Logs

---

## 4. Dashboard

The Dashboard is your home base in Dillanci, providing an at-a-glance view of your procurement activities and quick access to common tasks.

### Dashboard Components

#### KPI Cards
The top of the dashboard displays key performance indicators relevant to your role:

- **Pending Approvals**: Number of items awaiting your approval
- **Open Requisitions**: Active requisitions in progress
- **Active POs**: Purchase orders currently in process
- **Pending Invoices**: Invoices awaiting processing
- **Budget Utilization**: Percentage of budget consumed
- **Overdue Items**: Items past their due date

#### Recent Activity
A timeline of recent actions in the system:
- New requisitions submitted
- Approvals completed
- POs sent to suppliers
- Goods received
- Invoices paid

#### Quick Actions
Common tasks available with one click:
- **New Requisition**: Create a new purchase request
- **Create RFQ**: Start a new quotation request
- **Create PO**: Generate a purchase order
- **View Pending**: See all items pending your action

#### Charts and Analytics
Visual representations of procurement data:
- Spend by category (pie chart)
- Monthly procurement volume (bar chart)
- Requisition status breakdown (donut chart)
- Top suppliers by spend (horizontal bar)

### Personalizing Your Dashboard

Some dashboard elements may be configurable based on your organization's settings:
- Rearrange widget positions
- Show/hide specific KPIs
- Set default date ranges for charts

---

## 5. Requisitions Module

A requisition (or purchase request) is the starting point of the procurement process. It captures what you need to purchase, why, and for when.

### Overview

Requisitions serve to:
- Document purchase needs with proper justification
- Obtain budget approval before spending
- Provide procurement teams with clear specifications
- Maintain an audit trail of purchase requests

### Accessing Requisitions

1. Click **Requisitions** in the sidebar
2. You'll see the requisitions list with filters and search

### Creating a New Requisition

#### Step 1: Start a New Requisition
1. Click the **New Requisition** button
2. Alternatively, use the **Quick Actions** on the Dashboard

#### Step 2: Fill in Header Information

| Field | Description | Required |
|-------|-------------|:--------:|
| Title | Brief descriptive name (e.g., "Office Supplies Q1 2025") | Yes |
| Department | Your department or cost center | Yes |
| Required Date | When you need the items | Yes |
| Priority | Low, Medium, High, or Urgent | No |
| Justification | Business reason for the purchase | Yes |
| Delivery Location | Where items should be delivered | No |
| Notes | Additional information | No |

#### Step 3: Add Line Items
For each item you need to purchase:

1. Click **Add Line Item**
2. Enter item details:
   - **Description**: What you're ordering
   - **Quantity**: How many units
   - **Unit of Measure**: Each, Box, Case, etc.
   - **Estimated Unit Price**: Approximate cost per unit
   - **Category**: Product/service category
   - **Specifications**: Detailed requirements (optional)

3. Repeat for each item
4. The system automatically calculates the total estimated value

#### Step 4: Attach Supporting Documents
1. Click the **Attachments** tab or section
2. Drag and drop files or click to browse
3. Supported formats: PDF, Word, Excel, images
4. Add descriptions to attachments if needed

#### Step 5: Save or Submit

- **Save as Draft**: Save your work and return later
- **Submit for Approval**: Send to the approval workflow

### Requisition Workflow States

| Status | Description | Next Actions |
|--------|-------------|--------------|
| **DRAFT** | Being prepared, not yet submitted | Edit, Submit, Delete |
| **SUBMITTED** | Sent for approval | (Awaiting approver action) |
| **PENDING_APPROVAL** | In approval queue | Approve, Reject |
| **APPROVED** | Approved and ready for sourcing | Create RFQ/RFP/PO |
| **REJECTED** | Not approved | Edit and resubmit |
| **CANCELLED** | Cancelled by requester or admin | - |
| **CONVERTED** | Converted to RFQ, RFP, or PO | View linked document |

### Approval Process

Requisitions follow a configurable approval workflow:

1. **Submission**: Requester submits the requisition
2. **Routing**: System routes to appropriate approver(s) based on:
   - Total value (approval thresholds)
   - Department
   - Category
3. **Approval**: Approver reviews and decides:
   - **Approve**: Move forward in workflow
   - **Reject**: Return to requester with comments
   - **Request Changes**: Ask for modifications
4. **Final Approval**: Once all required approvals are obtained, status becomes APPROVED

### Working with Requisition Templates

Templates save time for recurring purchases:

#### Using a Template
1. Click **New Requisition** > **From Template**
2. Select an existing template
3. Template data populates the form
4. Modify as needed and submit

#### Creating a Template
1. Open an existing requisition
2. Click **Save as Template**
3. Give the template a name
4. Template is available for future use

### Converting Approved Requisitions

Once approved, requisitions can be converted to:

- **RFQ**: For competitive bidding
- **RFP**: For complex evaluations with scoring
- **Purchase Order**: For direct purchase (known supplier/price)

To convert:
1. Open the approved requisition
2. Click **Actions** > **Convert to RFQ/RFP/PO**
3. The new document inherits line items from the requisition

---

## 6. RFQ Module

A Request for Quotation (RFQ) is used for competitive bidding when you need to compare prices from multiple suppliers for goods or services with clear specifications.

### When to Use RFQ vs RFP

| RFQ | RFP |
|-----|-----|
| Clear, well-defined specifications | Complex requirements |
| Price is the primary factor | Multiple evaluation criteria |
| Standard products/services | Custom solutions needed |
| Quick turnaround needed | Detailed evaluation process |

### Accessing RFQs

1. Click **RFQs** in the sidebar
2. View the list of all RFQs with status filters

### Creating a New RFQ

#### Step 1: Start the RFQ
1. Click **New RFQ**
2. Or convert from an approved requisition

#### Step 2: Fill in RFQ Details

| Field | Description | Required |
|-------|-------------|:--------:|
| Title | Descriptive name for the RFQ | Yes |
| Reference Number | Auto-generated or custom | Auto |
| Description | Scope of work or requirements | Yes |
| Response Deadline | When suppliers must respond by | Yes |
| Delivery Date | When goods/services are needed | No |
| Payment Terms | Net 30, Net 60, etc. | No |
| Terms & Conditions | Standard or custom terms | No |

#### Step 3: Add Line Items
1. Click **Add Line Item**
2. Enter specifications:
   - Description
   - Quantity
   - Unit of Measure
   - Technical specifications
   - Preferred brands (if any)
3. Add all items needed for quotation

#### Step 4: Attach Documents
Upload supporting documents:
- Technical specifications
- Drawings or diagrams
- Scope of work documents
- Terms and conditions

### Inviting Suppliers

#### Adding Suppliers to the RFQ
1. Go to the **Invited Suppliers** tab/section
2. Click **Add Supplier**
3. Search for suppliers by name or category
4. Select suppliers to invite
5. Optionally add a personalized message

#### Managing Invitations
- View list of invited suppliers
- See invitation status (Sent, Viewed, Responded)
- Send reminder notifications
- Add additional suppliers before deadline

### Publishing the RFQ

1. Review all RFQ details
2. Click **Publish RFQ**
3. Confirm the action
4. Invited suppliers receive notifications
5. Status changes to OPEN

### RFQ Workflow States

| Status | Description |
|--------|-------------|
| **DRAFT** | Being prepared |
| **OPEN** | Published and accepting quotes |
| **CLOSED** | Deadline passed, evaluating quotes |
| **AWARDED** | Vendor(s) selected |
| **CANCELLED** | RFQ terminated |

### Managing Received Quotes

#### Viewing Quotes
1. Open the RFQ
2. Go to the **Quotes** tab
3. View all submitted quotes with:
   - Supplier name
   - Total quoted amount
   - Submission date
   - Quote validity period

#### Comparing Quotes
1. Click **Compare Quotes**
2. View side-by-side comparison:
   - Line-by-line pricing
   - Total amounts
   - Delivery timelines
   - Terms offered

### Awarding the RFQ

#### Selecting a Winner
1. Review all quotes in comparison view
2. Click **Award** on the preferred quote
3. Add award justification if required
4. Confirm the award

#### Generating a Purchase Order
After awarding:
1. Click **Create PO**
2. PO is pre-populated with:
   - Awarded supplier details
   - Quoted prices
   - RFQ line items
3. Review and submit the PO

### Notifying Non-Winners
After award:
1. System can auto-notify unsuccessful bidders
2. Or manually send rejection notifications
3. Include feedback if appropriate

---

## 7. RFP Module

A Request for Proposal (RFP) is used for complex procurements where multiple criteria beyond price are evaluated. RFPs allow for weighted scoring, technical evaluations, and formal proposal processes.

### Overview

RFPs are ideal for:
- Complex projects with custom requirements
- Services requiring vendor expertise
- High-value procurements
- Situations where quality matters as much as price
- Formal evaluation processes

### Accessing RFPs

1. Click **RFPs** in the sidebar
2. View the RFP list with status filters

### Creating a New RFP

#### Step 1: Start the RFP
1. Click **New RFP**
2. Or convert from an approved requisition

#### Step 2: Fill in RFP Details

| Field | Description | Required |
|-------|-------------|:--------:|
| Title | Descriptive name | Yes |
| Reference Number | Auto-generated or custom | Auto |
| Description | Detailed scope and requirements | Yes |
| Estimated Value | Budget range or estimate | No |
| Submission Deadline | When proposals are due | Yes |
| Questions Deadline | Last date for vendor questions | No |
| BAFO Deadline | Best and Final Offer deadline | No |
| Contract Start Date | Expected contract commencement | No |
| Contract Duration | Length of engagement | No |

#### Step 3: Define Scope and Requirements
In the description or attachments, include:
- Background information
- Detailed requirements
- Deliverables expected
- Timeline and milestones
- Compliance requirements
- Format for proposals

### Setting Up Scoring Criteria

The Scoring Criteria Builder allows you to define how proposals will be evaluated.

#### Adding Criteria
1. Go to the **Evaluation Criteria** tab
2. Click **Add Criterion**
3. For each criterion, enter:

| Field | Description |
|-------|-------------|
| Category | Technical, Financial, Experience, etc. |
| Criterion Name | Specific evaluation point |
| Description | What evaluators should assess |
| Weight (%) | Importance relative to total (must sum to 100%) |
| Scoring Scale | 1-5, 1-10, or custom scale |

#### Example Criteria Structure

| Category | Criterion | Weight |
|----------|-----------|--------|
| Technical | Solution Approach | 20% |
| Technical | Technical Expertise | 15% |
| Experience | Relevant Experience | 15% |
| Experience | References | 10% |
| Financial | Pricing Competitiveness | 25% |
| Financial | Payment Terms | 5% |
| Delivery | Implementation Timeline | 10% |

#### Weight Validation
- Total weights must equal 100%
- System validates before allowing publish
- Rebalance if adding/removing criteria

### Setting Up Evaluation Team

#### Adding Evaluators
1. Go to the **Evaluation Team** tab
2. Click **Add Evaluator**
3. Search and select internal users
4. Assign evaluation roles:
   - **Lead Evaluator**: Coordinates evaluation
   - **Technical Evaluator**: Scores technical criteria
   - **Financial Evaluator**: Scores financial criteria
   - **Committee Member**: Full evaluation access

### Inviting Suppliers

Similar to RFQ process:
1. Go to **Invited Suppliers** tab
2. Add suppliers to invite
3. Suppliers receive notification when RFP is published

### Publishing the RFP

1. Ensure all sections are complete:
   - Details and scope
   - Evaluation criteria (totaling 100%)
   - Evaluation team assigned
   - Suppliers invited
2. Click **Publish RFP**
3. Status changes to PUBLISHED
4. Suppliers are notified

### RFP Workflow States

| Status | Description |
|--------|-------------|
| **DRAFT** | Being prepared |
| **PUBLISHED** | Open for vendor questions and proposals |
| **EVALUATION** | Deadline passed, evaluating proposals |
| **SHORTLISTED** | Top vendors identified |
| **BAFO** | Best and Final Offer requested |
| **AWARDED** | Winner selected |
| **CANCELLED** | RFP terminated |

### Q&A with Vendors

#### Viewing Vendor Questions
1. Go to the **Q&A** tab
2. View all questions submitted by vendors
3. Questions show:
   - Vendor name
   - Question text
   - Date submitted
   - Response status

#### Responding to Questions
1. Click on a question to respond
2. Enter your response
3. Choose visibility:
   - **Public**: Visible to all invited suppliers
   - **Private**: Only visible to asking vendor
4. Click **Publish Response**

### Managing Proposals

#### Viewing Submitted Proposals
1. Go to the **Proposals** tab
2. View all submitted proposals:
   - Supplier name
   - Submission date/time
   - Document attachments
   - Initial compliance check

#### Proposal Details
Click on a proposal to see:
- Executive summary
- Technical approach
- Team composition
- Pricing breakdown
- Relevant experience
- Attached documents

### Scoring Proposals

#### Individual Scoring
Each evaluator scores proposals independently:

1. Open a proposal
2. Go to **My Scores** or **Score** button
3. For each criterion:
   - Read the relevant proposal section
   - Assign a score (e.g., 1-5)
   - Add comments justifying the score
4. Save scores

#### Scoring Guidelines

| Score | Meaning |
|-------|---------|
| 5 | Exceptional - Exceeds all requirements |
| 4 | Good - Meets all requirements with some strengths |
| 3 | Acceptable - Meets basic requirements |
| 2 | Marginal - Partially meets requirements |
| 1 | Poor - Does not meet requirements |

#### Viewing Evaluation Summary
1. Go to **Evaluation Summary** tab
2. View:
   - Individual evaluator scores
   - Weighted averages per vendor
   - Overall ranking
   - Score distribution charts

### BAFO (Best and Final Offer)

BAFO is used to request final pricing or improvements from shortlisted vendors.

#### Initiating BAFO
1. Review evaluation scores
2. Identify shortlist (typically top 2-3 vendors)
3. Click **Request BAFO**
4. Select vendors for BAFO
5. Set BAFO deadline
6. Add BAFO instructions (what improvements to request)

#### Reviewing BAFO Responses
1. After deadline, view BAFO responses
2. Compare final offers
3. Update scores if needed
4. Proceed to award decision

### Award Decision

#### Preparing Award Recommendation
1. Review final scores and BAFO responses
2. Document award justification
3. Note any negotiation points

#### Making the Award
1. Click **Award RFP**
2. Select winning vendor
3. Enter award justification
4. Upload negotiation notes if applicable
5. Confirm award

#### Post-Award Actions
- Generate contract from RFP
- Create purchase order
- Notify all vendors of decision

---

## 8. Purchase Orders Module

A Purchase Order (PO) is a legally binding document sent to a supplier authorizing the purchase of goods or services at agreed prices and terms.

### Overview

Purchase Orders:
- Formalize purchase commitments
- Authorize suppliers to fulfill orders
- Reserve budget (encumbrance)
- Create legal obligations
- Enable receiving and invoice matching

### Accessing Purchase Orders

1. Click **Purchase Orders** in the sidebar
2. View PO list with status filters

### Creating a Purchase Order

POs can be created from:
- **RFQ Award**: Auto-populated from winning quote
- **RFP Award**: From awarded proposal
- **Requisition**: Direct conversion (known supplier)
- **Manual Entry**: New PO from scratch

#### Step 1: Start a New PO
1. Click **New Purchase Order**
2. Or use **Create PO** from RFQ/RFP award

#### Step 2: Select Supplier
1. Search for the supplier
2. Select from approved supplier list
3. Supplier details auto-populate:
   - Contact information
   - Payment terms
   - Tax status

#### Step 3: Fill in PO Header

| Field | Description | Required |
|-------|-------------|:--------:|
| PO Number | Auto-generated or custom | Auto |
| PO Date | Date of the order | Yes |
| Supplier | Selected supplier | Yes |
| Ship-To Address | Delivery location | Yes |
| Bill-To Address | Invoicing address | Yes |
| Payment Terms | Net 30, Net 60, etc. | Yes |
| Delivery Date | Expected delivery | Yes |
| Currency | Transaction currency | Yes |
| Notes to Supplier | Special instructions | No |

#### Step 4: Add Line Items

| Field | Description |
|-------|-------------|
| Item/SKU | Product code or identifier |
| Description | Detailed description |
| Quantity | Number of units |
| Unit of Measure | Each, Box, etc. |
| Unit Price | Price per unit |
| Tax | Applicable tax rate |
| Discount | Line discount (if any) |
| Extended Amount | Auto-calculated |

For each line:
1. Click **Add Line Item**
2. Enter item details
3. System calculates line total
4. Repeat for all items

#### Step 5: Review Totals

The PO summary shows:
- Subtotal (all lines)
- Discounts applied
- Taxes
- Shipping/Freight
- **Grand Total**

#### Step 6: Attach Documents
Add supporting documents:
- Source requisition
- Quotes received
- Specifications
- Terms and conditions

### PO Lifecycle States

| Status | Description | Available Actions |
|--------|-------------|-------------------|
| **DRAFT** | Being prepared | Edit, Delete, Submit |
| **PENDING_APPROVAL** | Awaiting approval | (Approver reviews) |
| **APPROVED** | Approved, ready to send | Send to Supplier |
| **SENT** | Dispatched to supplier | Await acknowledgment |
| **ACKNOWLEDGED** | Supplier confirmed receipt | Await delivery |
| **PARTIALLY_RECEIVED** | Some items received | Receive goods, Create invoice |
| **RECEIVED** | All items received | Create invoice |
| **PARTIALLY_INVOICED** | Some items invoiced | Create invoice |
| **INVOICED** | Fully invoiced | Process payment |
| **COMPLETED** | Fully paid and closed | - |
| **CANCELLED** | PO cancelled | - |

### Budget Encumbrance

When a PO is approved:
1. System checks available budget
2. If sufficient, budget is **encumbered** (reserved)
3. Encumbered amount = PO total
4. Available budget reduced accordingly

Budget encumbrance lifecycle:
- **Created**: When PO approved
- **Released**: When PO cancelled or reduced
- **Liquidated**: When invoice paid (converted to actual spend)

### Submitting for Approval

1. Review PO details
2. Click **Submit for Approval**
3. PO routes based on:
   - Total value (threshold-based)
   - Department
   - Category
4. Approvers notified

### Sending to Supplier

After approval:
1. Click **Send to Supplier**
2. Choose delivery method:
   - Email (PDF attachment)
   - Supplier portal
3. Confirm sending
4. Status changes to SENT
5. Supplier receives PO notification

### Supplier Acknowledgment

Suppliers can acknowledge POs:
1. Via supplier portal
2. Via email response
3. Acknowledgment recorded in system
4. Status changes to ACKNOWLEDGED

### PO Amendments

To modify an approved PO:

1. Open the PO
2. Click **Create Amendment**
3. Make changes:
   - Add/remove lines
   - Change quantities
   - Modify prices
4. Submit amendment for approval
5. New version created (v2, v3, etc.)

### Cancelling a Purchase Order

To cancel a PO:
1. Open the PO
2. Click **Cancel PO**
3. Enter cancellation reason
4. Confirm cancellation
5. Budget encumbrance released
6. Supplier notified

---

## 9. Receiving Module

The Receiving module records the actual receipt of goods ordered via Purchase Orders. Accurate receiving is essential for 3-way matching with invoices.

### Overview

Receiving (Goods Receipt) serves to:
- Confirm delivery of ordered items
- Record actual quantities received
- Document inspection results
- Identify discrepancies
- Enable invoice matching

### Accessing Receiving

1. Click **Receiving** in the sidebar
2. View list of receipts and pending deliveries

### Creating a Goods Receipt

#### Step 1: Select the Purchase Order
1. Click **New Receipt** or **Receive Goods**
2. Search for the PO by:
   - PO number
   - Supplier name
   - Date range
3. Select the PO to receive against

#### Step 2: Enter Receipt Details

| Field | Description |
|-------|-------------|
| Receipt Date | Date goods were received |
| Delivery Note # | Supplier's delivery document number |
| Carrier | Shipping company |
| Received By | Person who accepted delivery |
| Storage Location | Where goods were placed |
| Notes | General observations |

#### Step 3: Enter Received Quantities

For each PO line item:
1. View the ordered quantity
2. Enter the received quantity
3. Note any discrepancies

| Field | Description |
|-------|-------------|
| Ordered Qty | Quantity on PO |
| Previously Received | Prior partial receipts |
| Receiving Now | Quantity being received |
| Remaining | Outstanding balance |
| Variance | Difference from expected |

### Inspection Process

For items requiring quality inspection:

#### Recording Inspection Results
1. Go to the **Inspection** section
2. For each item:
   - Mark as **Pass** or **Fail**
   - Enter quality notes
   - Attach photos if needed
   - Record defect descriptions

#### Inspection Outcomes

| Result | Description | Action |
|--------|-------------|--------|
| **Pass** | Meets specifications | Accept into inventory |
| **Fail** | Does not meet specs | Reject, arrange return |
| **Conditional Pass** | Minor issues, acceptable | Accept with notes |

### Handling Discrepancies

Common discrepancies and how to handle them:

#### Short Shipment
- Quantity received < Quantity ordered
- Record actual quantity received
- Create note for supplier follow-up
- PO remains PARTIALLY_RECEIVED

#### Over Shipment
- Quantity received > Quantity ordered
- Record actual quantity
- Decide to accept or return excess
- Document decision

#### Wrong Items
- Item received doesn't match order
- Reject the item
- Document in notes
- Arrange return/replacement

#### Damaged Goods
- Items received but damaged
- Record damage in inspection
- Attach photos
- File claim with carrier/supplier

### Completing the Receipt

1. Review all line items
2. Ensure all quantities are entered
3. Complete any inspections
4. Click **Complete Receipt**
5. Confirm the action

### Receipt Status

| Status | Description |
|--------|-------------|
| **PENDING** | Receipt in progress |
| **COMPLETED** | All items received and accepted |
| **REJECTED** | Receipt rejected (damaged, wrong items) |

### Impact on Purchase Order

After receipt completion:
- PO status updates (PARTIALLY_RECEIVED or RECEIVED)
- Received quantities recorded against PO lines
- Receipt ready for invoice matching
- Inventory updated (if integrated)

---

## 10. Invoices Module

The Invoices module handles supplier invoice processing, from receipt through approval to payment. It includes 3-way matching to ensure you pay only for what was ordered and received.

### Overview

Invoice processing involves:
- Receiving supplier invoices
- Matching to POs and receipts (3-way match)
- Resolving discrepancies
- Obtaining payment approvals
- Recording payments

### Accessing Invoices

1. Click **Invoices** in the sidebar
2. View invoice list with status filters

### Creating an Invoice

#### Step 1: Start a New Invoice
1. Click **New Invoice**
2. Choose invoice type:
   - **PO-Based**: Linked to a purchase order
   - **Non-PO**: Standalone invoice

#### Step 2: Enter Invoice Header

| Field | Description | Required |
|-------|-------------|:--------:|
| Invoice Number | Supplier's invoice number | Yes |
| Invoice Date | Date on the invoice | Yes |
| Supplier | Invoice sender | Yes |
| Purchase Order | PO to match against | Conditional |
| Due Date | Payment due date | Yes |
| Currency | Invoice currency | Yes |
| Total Amount | Invoice total | Yes |

#### Step 3: Add Line Items

For PO-based invoices:
1. PO lines are pre-populated
2. Enter invoiced quantities and prices
3. System compares to PO and receipt data

For non-PO invoices:
1. Manually add line items
2. Enter descriptions, quantities, amounts
3. Assign GL coding

#### Step 4: Attach Invoice Document
1. Upload the actual invoice (PDF/image)
2. Add any supporting documents
3. Documents stored for audit trail

### 3-Way Matching

3-way matching compares three documents to ensure consistency:

| Document | What it Shows |
|----------|---------------|
| **Purchase Order** | What was ordered (qty, price) |
| **Goods Receipt** | What was received (qty) |
| **Invoice** | What supplier is charging (qty, price) |

#### Match Criteria
The system checks:
- **Quantity Match**: Invoice qty vs. received qty
- **Price Match**: Invoice price vs. PO price
- **Total Match**: Invoice total vs. calculated total

#### Tolerance Thresholds
Organizations can set acceptable variances:
- Quantity tolerance: e.g., ±2%
- Price tolerance: e.g., ±$0.10 or ±2%
- Total tolerance: e.g., ±$50

### Match Status

| Status | Description | Action Required |
|--------|-------------|-----------------|
| **MATCHED** | All values align within tolerance | Proceed to approval |
| **PARTIAL_MATCH** | Minor discrepancies within tolerance | Review and approve |
| **MISMATCH** | Significant discrepancies | Investigate and resolve |
| **EXCEPTION** | Cannot match (missing receipt, etc.) | Manual intervention |

### Resolving Discrepancies

#### Price Variance
1. Review PO price vs. invoice price
2. Contact supplier if error
3. Accept variance with justification
4. Or request credit memo

#### Quantity Variance
1. Verify received quantity
2. Check for missing receipt
3. Contact supplier about short shipment
4. Create adjustment if needed

#### Creating Exceptions
For issues that can't be resolved immediately:
1. Mark invoice as **Exception**
2. Add exception notes
3. Assign to appropriate person
4. Track resolution

### Invoice Approval Workflow

1. **Submission**: Invoice entered and matched
2. **Routing**: Based on amount thresholds
3. **Review**: Approver examines invoice and match results
4. **Decision**:
   - **Approve**: Ready for payment
   - **Reject**: Return with comments
   - **Hold**: Pending resolution

### Invoice Status

| Status | Description |
|--------|-------------|
| **DRAFT** | Being entered |
| **SUBMITTED** | Sent for matching/approval |
| **MATCHED** | Successfully matched |
| **PENDING_APPROVAL** | Awaiting approval |
| **APPROVED** | Approved for payment |
| **REJECTED** | Not approved |
| **ON_HOLD** | Pending issue resolution |
| **PAID** | Payment processed |
| **CANCELLED** | Invoice cancelled |

### Recording Payments

After approval:
1. Open the approved invoice
2. Click **Record Payment**
3. Enter payment details:
   - Payment date
   - Payment method (Check, ACH, Wire)
   - Reference number
   - Amount paid
4. Confirm payment
5. Status changes to PAID

### Budget Impact

When invoice is paid:
- Encumbrance is **liquidated**
- Amount moves from committed to actual spend
- Budget reports updated

---

## 11. Suppliers Module

The Suppliers module is your vendor master database, managing all supplier information, relationships, and performance tracking.

### Overview

Supplier management includes:
- Maintaining supplier master data
- Categorizing suppliers
- Managing bank account information
- Tracking supplier performance
- Providing portal access

### Accessing Suppliers

1. Click **Suppliers** in the sidebar
2. View supplier list with search and filters

### Adding a New Supplier

#### Step 1: Basic Information

| Field | Description | Required |
|-------|-------------|:--------:|
| Company Name | Legal entity name | Yes |
| DBA Name | Doing Business As (if different) | No |
| Tax ID | EIN, VAT number, etc. | Conditional |
| Website | Company website | No |
| Description | Brief company description | No |
| Status | Active, Pending, Suspended | Yes |

#### Step 2: Contact Information

| Field | Description |
|-------|-------------|
| Primary Contact | Main contact person name |
| Email | Primary email address |
| Phone | Primary phone number |
| Fax | Fax number (if applicable) |

#### Step 3: Address Information

**Headquarters Address:**
- Street Address
- City, State/Province
- Postal Code
- Country

**Remittance Address** (if different):
- Address where payments should be sent

#### Step 4: Categories and Classifications

| Field | Description |
|-------|-------------|
| Categories | Product/service categories (multi-select) |
| Minority/Diversity Status | MBE, WBE, SDVOB, etc. |
| Small Business | Yes/No |
| Local Supplier | Yes/No |

#### Step 5: Tax and Compliance

| Field | Description |
|-------|-------------|
| Tax Status | Taxable, Exempt |
| Tax Certificate | Upload exemption certificate |
| Insurance Certificate | Liability insurance document |
| W-9/W-8 Form | Tax form (US) |

### Supplier Profile

Click on a supplier to view their complete profile:

#### Overview Tab
- Basic company information
- Key metrics (total spend, PO count, rating)
- Quick links to related documents

#### Contacts Tab
- All contact persons
- Add/edit contacts
- Designate primary contact

#### Bank Accounts Tab
- Payment information
- Multiple accounts supported
- Primary account designation

#### Documents Tab
- Uploaded documents
- Certificates
- Contracts

#### Transactions Tab
- Purchase orders
- Invoices
- Receipts
- Payment history

#### Performance Tab
- Delivery metrics
- Quality scores
- Response times
- Overall rating

### Managing Bank Accounts

#### Adding a Bank Account
1. Go to supplier profile > **Bank Accounts** tab
2. Click **Add Bank Account**
3. Enter details:

| Field | Description |
|-------|-------------|
| Account Name | Nickname for the account |
| Bank Name | Financial institution |
| Account Number | Bank account number |
| Routing Number | Bank routing/transit number |
| Account Type | Checking, Savings |
| SWIFT/BIC | For international payments |
| IBAN | International account number |

4. Mark as **Primary** if default for payments
5. Save the account

### Supplier Portal

The Supplier Portal allows vendors to:
- View and respond to RFQs/RFPs
- Access their purchase orders
- Submit invoices
- Update their company profile
- Communicate with your organization

#### Inviting Suppliers to Portal
1. Open supplier profile
2. Click **Manage Portal Access**
3. Click **Invite to Portal**
4. Enter email address for portal user
5. Send invitation

#### Managing Portal Users
- View list of portal users for supplier
- Activate/deactivate access
- Resend invitations
- Remove users

### Performance Rating

Track supplier performance across key metrics:

| Metric | Description |
|--------|-------------|
| On-Time Delivery | % of orders delivered by due date |
| Quality | % of orders passing inspection |
| Responsiveness | Average response time to inquiries |
| Price Competitiveness | Price comparison to market |
| Invoice Accuracy | % of invoices matched on first try |

#### Rating Scale
- 5 Stars: Excellent
- 4 Stars: Good
- 3 Stars: Satisfactory
- 2 Stars: Needs Improvement
- 1 Star: Poor

### Supplier Status

| Status | Description | Can Transact? |
|--------|-------------|:-------------:|
| **ACTIVE** | Approved for transactions | Yes |
| **PENDING** | Awaiting approval | No |
| **SUSPENDED** | Temporarily blocked | No |
| **BLACKLISTED** | Permanently blocked | No |
| **INACTIVE** | No longer in use | No |

---

## 12. Contracts Module

The Contracts module manages the entire contract lifecycle from creation through renewal or termination.

### Overview

Contract management includes:
- Creating and storing contracts
- Tracking key dates and milestones
- Managing renewals
- Handling amendments
- Monitoring contract performance

### Accessing Contracts

1. Click **Contracts** in the sidebar
2. View contract list with status and expiration filters

### Creating a Contract

#### Step 1: Basic Information

| Field | Description | Required |
|-------|-------------|:--------:|
| Contract Title | Descriptive name | Yes |
| Contract Number | Unique identifier (auto or manual) | Yes |
| Supplier | Contracting party | Yes |
| Contract Type | Fixed Price, Time & Materials, etc. | Yes |

#### Contract Types

| Type | Description |
|------|-------------|
| **Fixed Price** | Total amount fixed upfront |
| **Time & Materials** | Hourly/daily rates + materials |
| **Cost Plus** | Actual costs plus markup |
| **Retainer** | Ongoing monthly/annual fee |
| **Blanket/Framework** | Umbrella agreement for multiple orders |

#### Step 2: Dates and Duration

| Field | Description |
|-------|-------------|
| Start Date | Contract effective date |
| End Date | Contract expiration date |
| Duration | Auto-calculated or manual entry |
| Renewal Type | Auto-renew, Manual, One-time |
| Notice Period | Days before expiry to notify |

#### Step 3: Financial Terms

| Field | Description |
|-------|-------------|
| Contract Value | Total or estimated value |
| Currency | Contract currency |
| Payment Terms | Net 30, Milestone-based, etc. |
| Payment Schedule | Payment frequency/timing |

#### Step 4: Attach Contract Document
1. Upload signed contract (PDF)
2. Add exhibits and schedules
3. Include any amendments

### Contract Lifecycle States

| Status | Description |
|--------|-------------|
| **DRAFT** | Being prepared |
| **PENDING_APPROVAL** | Awaiting authorization |
| **ACTIVE** | Currently in effect |
| **EXPIRING_SOON** | Within renewal notice period |
| **EXPIRED** | Past end date |
| **TERMINATED** | Ended before expiration |
| **RENEWED** | Extended to new term |

### Contract Dashboard

The contract list view shows:
- Contracts by status
- Upcoming expirations
- Renewal calendar
- Value by supplier

### Renewal Management

#### Renewal Alerts
System sends notifications:
- 90 days before expiration
- 60 days before expiration
- 30 days before expiration

Configure alert recipients:
- Contract owner
- Procurement team
- Stakeholders

#### Processing a Renewal
1. Open the expiring contract
2. Click **Renew Contract**
3. Options:
   - **Extend**: Same terms, new dates
   - **Renegotiate**: Modify terms
   - **Let Expire**: No renewal
4. If extending/renegotiating:
   - Update dates
   - Modify value if needed
   - Attach new documentation
5. Submit for approval

### Contract Amendments

To modify an active contract:

1. Open the contract
2. Click **Create Amendment**
3. Enter amendment details:
   - Amendment number (auto-generated)
   - Description of changes
   - Effective date
   - New terms/values
4. Attach amendment document
5. Submit for approval

Amendment history is maintained:
- View all amendments chronologically
- Access original and amended terms
- Track approval history

### Linking to Other Documents

Contracts can be linked to:
- **RFPs**: Source procurement document
- **Suppliers**: Contracting party
- **Purchase Orders**: Orders under contract
- **Invoices**: Payments against contract

### Contract Compliance

Monitor contract usage:
- Spending vs. contract value
- Orders placed under contract
- Compliance with terms
- Utilization rate

---

## 13. Budget Module

The Budget module enables financial planning and spend control, ensuring purchases stay within allocated amounts.

### Overview

Budget management includes:
- Setting up budget allocations
- Tracking encumbrances
- Monitoring actual spend
- Controlling over-spending
- Generating budget reports

### Budget Structure

Budgets can be organized by:
- **Fiscal Year**: Annual budget cycle
- **Department**: Organizational unit
- **Cost Center**: Specific cost allocation
- **Category**: Spend category
- **Project**: Project-based budgeting

### Viewing Budgets

1. Click **Budget** in the sidebar (if available to your role)
2. View budget overview:
   - Total allocated
   - Committed (encumbered)
   - Actual spent
   - Available balance

### Budget Cards

Each budget displays:

| Metric | Description |
|--------|-------------|
| **Allocated** | Total budget amount |
| **Committed** | Reserved for approved POs |
| **Spent** | Actually paid (invoices) |
| **Available** | Remaining for new purchases |

### Encumbrance Tracking

The encumbrance lifecycle:

1. **Requisition Submitted**: No encumbrance yet
2. **Requisition Approved**: Soft encumbrance (optional)
3. **PO Approved**: Hard encumbrance created
4. **PO Received**: Encumbrance remains
5. **Invoice Paid**: Encumbrance liquidated to actual spend

### Budget Checks

When creating/approving POs:
1. System checks available budget
2. If sufficient: PO proceeds
3. If insufficient: Warning or block (configurable)

### Budget Warnings

| Warning Level | Threshold | Action |
|---------------|-----------|--------|
| **Info** | 70% utilized | Notification only |
| **Warning** | 85% utilized | Approval required |
| **Critical** | 95% utilized | Escalated approval |
| **Over Budget** | 100%+ | Block or executive approval |

### Budget Transfers

To move budget between allocations:

1. Navigate to budget view
2. Click **Request Transfer**
3. Enter:
   - From budget
   - To budget
   - Amount
   - Justification
4. Submit for approval

### Budget Reports

Standard budget reports:
- **Budget vs. Actual**: Allocated vs. spent
- **Encumbrance Report**: Outstanding commitments
- **Spend by Category**: Breakdown by type
- **Department Spend**: Breakdown by org unit
- **Trend Analysis**: Month-over-month changes

---

## 14. Reports & Analytics

The Reports module provides visibility into procurement performance through dashboards, standard reports, and data exports.

### Accessing Reports

1. Click **Reports** in the sidebar
2. View available report categories

### Dashboard KPIs

Key Performance Indicators displayed on dashboard:

| KPI | Description |
|-----|-------------|
| **Procurement Cycle Time** | Days from requisition to PO |
| **On-Time Delivery** | % of POs delivered on time |
| **Invoice Accuracy** | % of invoices matching first time |
| **Budget Utilization** | % of budget consumed |
| **Supplier Count** | Active suppliers |
| **Open PO Value** | Total value of outstanding orders |

### Standard Reports

#### Requisition Reports
- Requisition aging report
- Requisitions by status
- Approval turnaround time
- Requisition volume trends

#### Purchase Order Reports
- PO status summary
- Open PO report
- PO value by supplier
- PO delivery performance

#### Receiving Reports
- Receiving discrepancy report
- Receipt aging
- Quality inspection summary
- Receiving by location

#### Invoice Reports
- Invoice aging report
- 3-way match exceptions
- Payment schedule
- Invoice processing time

#### Supplier Reports
- Supplier spend analysis
- Supplier performance scorecard
- Category spend
- Diversity spend report

#### Contract Reports
- Contract expiration report
- Contract utilization
- Renewal pipeline
- Contract value summary

### Running a Report

1. Select the report from the list
2. Set parameters:
   - Date range
   - Department/cost center
   - Supplier (if applicable)
   - Status filter
3. Click **Run Report**
4. View results in browser

### Exporting Data

Export options:
- **CSV**: For spreadsheet analysis
- **Excel**: Formatted with headers
- **PDF**: For printing/sharing

To export:
1. Run the report
2. Click **Export** button
3. Select format
4. Download file

### Custom Filters

Most reports support filtering:
- Date range (this month, quarter, year, custom)
- Department
- Supplier
- Category
- Status
- Amount range

### Scheduling Reports

For recurring reports (if enabled):
1. Set up report parameters
2. Click **Schedule**
3. Configure:
   - Frequency (daily, weekly, monthly)
   - Recipients (email addresses)
   - Format (PDF, Excel)
4. Save schedule

---

## 15. Comments & Attachments

Comments and attachments enable collaboration on procurement documents. These features are available across most modules.

### Comments

#### Adding a Comment
1. Open any document (requisition, PO, invoice, etc.)
2. Scroll to the **Comments** section
3. Type your comment in the text box
4. Click **Post** or **Add Comment**

#### Replying to Comments
1. Find the comment to reply to
2. Click **Reply**
3. Enter your response
4. Submit

#### Comment Threading
Comments support threaded conversations:
- Original comment at top
- Replies nested below
- Clear conversation flow

#### Editing/Deleting Comments
- Click the **...** menu on your comment
- Select **Edit** to modify
- Select **Delete** to remove
- Note: You can only edit/delete your own comments

#### @Mentions (if enabled)
- Type **@** followed by a user's name
- Select from suggestions
- User receives notification

### Attachments

#### Uploading Files
1. Open any document
2. Go to **Attachments** section
3. Click **Upload** or drag-and-drop files
4. Supported formats:
   - Documents: PDF, Word, Excel
   - Images: JPG, PNG, GIF
   - Other: TXT, CSV

#### File Size Limits
- Individual file: Typically 10-25 MB
- Check with your administrator for limits

#### Viewing Attachments
- Click on attachment to preview (if supported)
- Click download icon to save locally

#### Deleting Attachments
- Click the delete/trash icon
- Confirm deletion
- Note: May require permissions

### Collaboration Best Practices

1. **Be specific**: Reference line items or sections
2. **Use mentions**: Tag relevant people
3. **Attach evidence**: Include supporting documents
4. **Keep it professional**: Comments are part of audit trail
5. **Respond promptly**: Keep processes moving

---

## 16. Notifications

The notification system keeps you informed about procurement activities requiring your attention.

### Notification Types

| Type | Description | Example |
|------|-------------|---------|
| **Approval Request** | Item needs your approval | "REQ-001 requires your approval" |
| **Status Change** | Document status updated | "PO-123 has been approved" |
| **Mention** | Someone mentioned you | "John mentioned you in a comment" |
| **Deadline** | Upcoming or passed deadline | "RFQ-456 deadline is tomorrow" |
| **System Alert** | System notifications | "New supplier portal message" |

### Notification Center

1. Click the **bell icon** in the header
2. View notification dropdown
3. See:
   - Unread notifications (highlighted)
   - Recent notifications
   - Quick actions

### Managing Notifications

#### Marking as Read
- Click on a notification to mark as read
- Click **Mark All as Read** to clear all

#### Notification Actions
- Click notification to go to related item
- Quick approve (if supported)
- Dismiss notification

### Email Notifications

Configure which events trigger email alerts:

1. Go to **Profile** > **Notification Preferences**
2. Toggle email notifications for:
   - Approval requests
   - Status changes
   - Mentions
   - Daily digest
3. Save preferences

### Notification Settings

| Setting | Options |
|---------|---------|
| In-App | Always enabled |
| Email - Individual | Each event sends email |
| Email - Digest | Daily summary |
| Email - None | No email notifications |

---

## 17. Administration

The Administration section is available to Organization Admins and other roles with admin permissions.

### Accessing Admin

1. Click **Settings** or **Admin** in the sidebar
2. View admin modules

### User Management

#### Viewing Users
1. Go to **Admin** > **Users**
2. View user list with:
   - Name and email
   - Roles assigned
   - Status (active/inactive)
   - Last login

#### Creating a New User
1. Click **Add User**
2. Enter user details:
   - First Name, Last Name
   - Email address
   - Department
   - Initial password (or send invite)
3. Assign roles
4. Save user

#### Editing Users
1. Click on a user
2. Modify information
3. Add/remove roles
4. Change status
5. Save changes

#### Activating/Deactivating Users
- Toggle user status
- Deactivated users cannot log in
- Data is preserved

#### Password Reset
1. Open user profile
2. Click **Reset Password**
3. Choose:
   - Set new password manually
   - Send reset email to user

### Role Management

#### Viewing Roles
1. Go to **Admin** > **Roles**
2. View role list:
   - Role name
   - Description
   - Number of users
   - Permissions count

#### Role Permissions
1. Click on a role
2. View permission grid:
   - Module (Requisitions, POs, etc.)
   - Actions (view, create, edit, delete, approve)
   - Checkmarks show granted permissions

### Approval Thresholds

Configure approval requirements based on amount:

1. Go to **Admin** > **Workflows** or **Thresholds**
2. Set thresholds:

| Amount Range | Required Approvals |
|--------------|-------------------|
| $0 - $1,000 | Department Manager |
| $1,001 - $10,000 | Department Manager + Procurement Manager |
| $10,001 - $50,000 | + Finance Director |
| $50,001+ | + Executive Approval |

### Audit Logs

View all system activity:

1. Go to **Admin** > **Audit Logs**
2. View log entries:
   - Date/Time
   - User
   - Action (Created, Updated, Deleted)
   - Object type and ID
   - Changes made

#### Filtering Audit Logs
- By user
- By action type
- By date range
- By module

#### Exporting Audit Logs
1. Set filter criteria
2. Click **Export**
3. Download CSV or PDF

### Organization Settings

Configure organization-wide settings:

| Setting | Description |
|---------|-------------|
| Company Name | Organization name |
| Logo | Company logo for branding |
| Address | Headquarters address |
| Currency | Default currency |
| Fiscal Year | Start month of fiscal year |
| Date Format | MM/DD/YYYY, DD/MM/YYYY, etc. |
| Number Format | Thousand/decimal separators |

---

## 18. Appendix

### Status Reference Table

#### Requisition Statuses
| Status | Description |
|--------|-------------|
| DRAFT | Being prepared |
| SUBMITTED | Awaiting approval |
| PENDING_APPROVAL | In approval queue |
| APPROVED | Approved for sourcing |
| REJECTED | Not approved |
| CANCELLED | Cancelled |
| CONVERTED | Converted to RFQ/RFP/PO |

#### RFQ Statuses
| Status | Description |
|--------|-------------|
| DRAFT | Being prepared |
| OPEN | Accepting quotes |
| CLOSED | Deadline passed |
| AWARDED | Winner selected |
| CANCELLED | RFQ cancelled |

#### RFP Statuses
| Status | Description |
|--------|-------------|
| DRAFT | Being prepared |
| PUBLISHED | Open for proposals |
| EVALUATION | Evaluating proposals |
| SHORTLISTED | Finalists identified |
| BAFO | Best and Final Offer phase |
| AWARDED | Winner selected |
| CANCELLED | RFP cancelled |

#### Purchase Order Statuses
| Status | Description |
|--------|-------------|
| DRAFT | Being prepared |
| PENDING_APPROVAL | Awaiting approval |
| APPROVED | Approved, ready to send |
| SENT | Dispatched to supplier |
| ACKNOWLEDGED | Supplier confirmed |
| PARTIALLY_RECEIVED | Some items received |
| RECEIVED | All items received |
| PARTIALLY_INVOICED | Some items invoiced |
| INVOICED | Fully invoiced |
| COMPLETED | Fully paid |
| CANCELLED | PO cancelled |

#### Invoice Statuses
| Status | Description |
|--------|-------------|
| DRAFT | Being entered |
| SUBMITTED | Sent for processing |
| MATCHED | Successfully matched |
| PENDING_APPROVAL | Awaiting approval |
| APPROVED | Approved for payment |
| REJECTED | Not approved |
| ON_HOLD | Issue pending |
| PAID | Payment processed |
| CANCELLED | Invoice cancelled |

#### Contract Statuses
| Status | Description |
|--------|-------------|
| DRAFT | Being prepared |
| PENDING_APPROVAL | Awaiting approval |
| ACTIVE | Currently in effect |
| EXPIRING_SOON | Within notice period |
| EXPIRED | Past end date |
| TERMINATED | Ended early |
| RENEWED | Extended |

### Glossary

| Term | Definition |
|------|------------|
| **3-Way Match** | Comparison of PO, receipt, and invoice |
| **BAFO** | Best and Final Offer - final proposal round |
| **Blanket PO** | Standing order for ongoing purchases |
| **Encumbrance** | Budget reserved for approved POs |
| **GRN** | Goods Receipt Note - receiving document |
| **Net 30** | Payment due within 30 days |
| **P2P** | Procure-to-Pay - full procurement cycle |
| **PO** | Purchase Order |
| **Requisition** | Purchase request document |
| **RFP** | Request for Proposal |
| **RFQ** | Request for Quotation |
| **Spend** | Money paid to suppliers |
| **Threshold** | Amount triggering approval rules |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search bar |
| `N` | New item (context-dependent) |
| `E` | Edit current item |
| `Esc` | Close modal/dialog |
| `Enter` | Submit form/confirm |
| `Ctrl/Cmd + S` | Save draft |

### FAQ

**Q: I forgot my password. What do I do?**
A: Click "Forgot Password?" on the login page and follow the email instructions.

**Q: Why can't I see certain modules in the sidebar?**
A: Your role determines which modules you can access. Contact your administrator if you need additional access.

**Q: How do I change my email address?**
A: Go to Profile > Settings and update your email. Note: This may require admin approval.

**Q: Can I approve my own requisitions?**
A: No, the system prevents self-approval to maintain proper controls.

**Q: What happens if I reject a requisition?**
A: The requester is notified and can revise and resubmit the requisition.

**Q: How long are documents retained?**
A: This depends on your organization's retention policy. Contact your administrator for details.

**Q: Can I export data to Excel?**
A: Yes, most list views and reports have export functionality.

**Q: What file types can I attach?**
A: Common formats include PDF, Word, Excel, and images (JPG, PNG). Maximum file size is typically 10-25 MB.

### Getting Help

If you need assistance:

1. **In-App Help**: Look for `?` icons for contextual help
2. **User Guide**: This document (docs/USER_GUIDE.md)
3. **Administrator**: Contact your organization's system administrator
4. **Support**: Submit a support ticket through your IT help desk

---

*This user guide covers all major features of the Dillanci Enterprise Procurement Platform. For technical documentation, API references, and developer guides, please refer to the project README and technical documentation.*

---

**Document Version**: 1.0
**Last Updated**: December 2024
**Platform Version**: Dillanci v1.0
