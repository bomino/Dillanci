<div align="center">

<img src="frontend/public/images/logo-256h.png" alt="Dillanci Logo" height="80"/>

### Enterprise Procurement Platform

[![Python](https://img.shields.io/badge/Python-3.11+-3776ab?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Django](https://img.shields.io/badge/Django-5.x-092E20?style=for-the-badge&logo=django&logoColor=white)](https://djangoproject.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)

[![Tests](https://img.shields.io/badge/Tests-1083%20Passing-success?style=flat-square)](https://github.com/bomino/Dillanci)
[![Coverage](https://img.shields.io/badge/Coverage-75%25-brightgreen?style=flat-square)](https://github.com/bomino/Dillanci)
[![Production Ready](https://img.shields.io/badge/Production%20Ready-95%2F100-blue?style=flat-square)](PRODUCTION_READINESS.md)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](LICENSE)

<br/>

[![Deploy with Docker](https://img.shields.io/badge/Deploy%20with-Docker%20Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](#quick-start-with-docker)

---

**A comprehensive enterprise procurement platform designed to streamline the entire procure-to-pay lifecycle.**

[Getting Started](#getting-started) •
[Features](#features) •
[Documentation](#documentation) •
[API Reference](#api-documentation) •
[Contributing](#contributing)

</div>

---

## Features

### Core Modules
- **Users & Organizations** - Multi-tenant user management with role-based access control
- **Suppliers** - Supplier lifecycle management with approval workflows
- **Catalog** - Product/service catalog with category taxonomy
- **Budget** - Fiscal year budgeting with encumbrance tracking

### Procurement Lifecycle
- **Requisitions** - Purchase request creation and approval workflows
- **RFQs (Request for Quotation)** - Competitive bidding with supplier invitations
- **RFPs (Request for Proposal)** - Multi-criteria weighted scoring and evaluation
- **Purchase Orders** - PO generation, approval, and tracking
- **Receiving** - Goods receipt management
- **Invoices** - 3-way matching (PO vs GR vs Invoice)

### Advanced Features
- **Contracts** - Contract lifecycle management with milestones
- **Audit Trail** - Comprehensive audit logging
- **Documents** - Document management with versioning
- **Reports** - Dashboard KPIs and analytics
- **Notifications** - In-app notification system with real-time updates
- **Admin Panel** - User management, roles & permissions, workflow configuration

### Documentation
- **[User Guide](docs/USER_GUIDE.md)** - Comprehensive user documentation for all platform modules
- **[Workflow Guide](docs/WORKFLOW_DOCUMENTATION.md)** - Detailed procurement workflows including REQ→PO conversion
- **[Security Audit](docs/SECURITY_AUDIT.md)** - Security assessment and recommendations
- **[Database Backups](docs/DATABASE_BACKUPS.md)** - Backup and restore procedures
- **[Load Testing](docs/LOAD_TESTING.md)** - Performance testing with Locust
- **[CDN & Monitoring](docs/CDN_MONITORING.md)** - Production monitoring setup

## Tech Stack

### Backend
- **Framework**: Django 5.x + Django REST Framework
- **Database**: PostgreSQL 16
- **Cache/Queue**: Redis
- **Task Queue**: Celery
- **Authentication**: Session-based

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Animations**: Framer Motion
- **Icons**: Lucide React

## Project Structure

```
Dillanci/
├── backend/                   # Django REST API
│   ├── apps/                  # Django apps
│   │   ├── core/              # Base models, exceptions
│   │   ├── users/             # User management
│   │   ├── organizations/     # Multi-tenant orgs
│   │   ├── suppliers/         # Supplier management
│   │   ├── catalog/           # Product catalog
│   │   ├── budget/            # Budget & encumbrances
│   │   ├── requisitions/      # Purchase requisitions
│   │   ├── rfqs/              # Request for quotation
│   │   ├── rfps/              # Request for proposal
│   │   ├── purchase_orders/   # Purchase orders
│   │   ├── receiving/         # Goods receipts
│   │   ├── invoices/          # Invoice processing
│   │   ├── contracts/         # Contract management
│   │   ├── audit/             # Audit logging
│   │   ├── documents/         # Document management
│   │   └── reports/           # Reporting & analytics
│   ├── config/                # Django settings
│   ├── requirements/          # Python dependencies
│   ├── tests/                 # Test utilities & factories
│   ├── Dockerfile             # Backend Docker image
│   └── manage.py              # Django CLI
│
├── frontend/                  # React SPA
│   ├── src/
│   │   ├── components/        # UI components
│   │   │   ├── ui/            # Base components (Button, Input, etc.)
│   │   │   ├── layout/        # Layout components (Sidebar, Header)
│   │   │   └── notifications/ # Notification system components
│   │   ├── pages/             # Page components
│   │   ├── stores/            # Zustand stores
│   │   ├── lib/               # Utilities & API clients
│   │   └── types/             # TypeScript types
│   ├── public/                # Static assets
│   └── Dockerfile             # Frontend Docker image
│
├── docker-compose.yml         # Development Docker setup
├── docker-compose.prod.yml    # Production Docker setup
└── README.md                  # This file
```

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone https://github.com/bomino/Dillanci.git
   cd Dillanci
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Run migrations and create admin user**
   ```bash
   docker-compose exec backend python manage.py migrate
   docker-compose exec backend python manage.py createsuperuser
   ```

5. **Access the application**

   | URL | Description |
   |-----|-------------|
   | http://localhost:3000 | Frontend Application |
   | http://localhost:8000/admin/ | Django Admin Panel |
   | http://localhost:8000/api/docs/ | Swagger API Documentation |
   | http://localhost:8000/api/redoc/ | ReDoc API Documentation |
   | http://localhost:8000/api/v1/ | API Base URL |

   **Default User Credentials:**

   | Email | Password | Organization | Role |
   |-------|----------|--------------|------|
   | `admin@dillanci.com` | `Admin123!` | Dillanci Demo | Superuser |
   | `test@example.com` | `Test123!` | Test Org | Staff |

### Local Development

#### Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
.\venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements/development.txt

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_DB` | Database name | `dillanci` |
| `POSTGRES_USER` | Database user | `dillanci` |
| `POSTGRES_PASSWORD` | Database password | - |
| `POSTGRES_PORT` | Database port | `5434` |
| `REDIS_PORT` | Redis port | `6380` |
| `BACKEND_PORT` | Backend API port | `8001` |
| `FRONTEND_PORT` | Frontend port | `3001` |
| `VITE_MOCK_API` | Enable mock API mode | `false` |
| `DEBUG` | Django debug mode | `True` |
| `SECRET_KEY` | Django secret key | - |

## Role-Based Access Control (RBAC)

Dillanci implements a comprehensive RBAC system with full backend and frontend integration.

### Backend RBAC
The Django Admin Panel provides comprehensive administration capabilities:

- **User Management** - Create, edit, deactivate users with role badges
- **Role-Based Access Control** - 9 pre-defined roles with 60+ permissions
- **Organization Management** - Multi-tenant organization setup with default roles
- **Audit Logging** - Track all role changes and user actions

### Frontend RBAC

The React frontend implements complete permission-based access control:

#### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `usePermissions` | `hooks/usePermissions.ts` | Hook for checking permissions, roles, admin status |
| `ProtectedRoute` | `components/auth/ProtectedRoute.tsx` | Route guard with redirect |
| `RequirePermission` | `components/auth/ProtectedRoute.tsx` | Inline permission check with fallback |
| `RequireAdmin` | `components/auth/ProtectedRoute.tsx` | Admin-only content wrapper |

#### Permission Checking

```typescript
// In any component
import { usePermissions } from '@/hooks/usePermissions';
import { Permissions } from '@/types';

function MyComponent() {
  const { hasPermission, hasAnyPermission, isAdmin, isSuperuser } = usePermissions();

  // Single permission check
  if (hasPermission(Permissions.REQUISITION_CREATE)) {
    // Can create requisitions
  }

  // Multiple permissions (any)
  if (hasAnyPermission([Permissions.PO_VIEW, Permissions.PO_CREATE])) {
    // Can view or create POs
  }

  // Admin check
  if (isAdmin) {
    // Show admin features
  }
}
```

#### Route Protection

```tsx
// In App.tsx
<Route path="/admin/users" element={
  <ProtectedRoute
    anyPermission={[Permissions.USER_VIEW, Permissions.USER_ASSIGN_ROLES]}
    requireAdmin
  >
    <UsersPage />
  </ProtectedRoute>
} />
```

#### Inline Permission Guards

```tsx
// Hide UI elements based on permissions
import { RequirePermission, RequireAdmin } from '@/components/auth/ProtectedRoute';

<RequirePermission permission={Permissions.REQUISITION_CREATE}>
  <Button>Create Requisition</Button>
</RequirePermission>

<RequireAdmin fallback={<span>Admin only</span>}>
  <AdminPanel />
</RequireAdmin>
```

### Pre-defined Roles

| Role | Description | Primary Modules |
|------|-------------|-----------------|
| **Requester** | End users who create purchase requisitions | Requisitions |
| **Budget Holder** | Department managers who approve within budget | Requisitions (approve) |
| **Procurement Officer** | Buyers handling sourcing and PO creation | RFQs, RFPs, POs, Suppliers |
| **Procurement Manager** | Full procurement authority with approvals | All procurement + approvals |
| **Accounts Payable** | Finance staff managing invoices and payments | Invoices, 3-way matching |
| **Warehouse Staff** | Goods receipt and inventory management | Receiving |
| **Finance Manager** | Financial oversight and budget control | Budget, Reports, Audit |
| **Auditor** | Read-only access for compliance review | All modules (view only) |
| **Organization Admin** | System administration and user management | Admin panel only |

### Role → Module Access Matrix

| Role | Requisitions | RFQs | RFPs | Purchase Orders | Receiving | Invoices | Suppliers | Contracts | Budget | Reports | Admin |
|------|:------------:|:----:|:----:|:---------------:|:---------:|:--------:|:---------:|:---------:|:------:|:-------:|:-----:|
| **Requester** | ✅ Create/Edit | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ View | ❌ | 👁️ View | ❌ | ❌ |
| **Budget Holder** | ✅ Approve | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ View | ❌ | 👁️ View | 👁️ View | ❌ |
| **Procurement Officer** | 👁️ View | ✅ Full | ✅ Full | ✅ Create/Edit | ❌ | ❌ | ✅ Create/Edit | ✅ Create/Edit | ❌ | 👁️ View | ❌ |
| **Procurement Manager** | ✅ Approve | ✅ Full+Award | ✅ Full+Award | ✅ Full | ❌ | ❌ | ✅ Full | ✅ Full | ❌ | ✅ Export | ❌ |
| **Accounts Payable** | ❌ | ❌ | ❌ | 👁️ View | 👁️ View | ✅ Full | 👁️ View | ❌ | ❌ | 👁️ View | ❌ |
| **Warehouse Staff** | ❌ | ❌ | ❌ | 👁️ View | ✅ Full | ❌ | 👁️ View | ❌ | ❌ | ❌ | ❌ |
| **Finance Manager** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Approve | ❌ | 👁️ View | ✅ Full | ✅ Full | Audit |
| **Auditor** | 👁️ View All | 👁️ View | 👁️ View | 👁️ View All | 👁️ View | 👁️ View | 👁️ View | 👁️ View | 👁️ View | ✅ Full | Audit |
| **Organization Admin** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Full |

**Legend:** ✅ = Full/specified access | 👁️ = View only | ❌ = No access

### Sidebar Visibility by Role

| Role | Main Navigation | Admin Section |
|------|-----------------|---------------|
| Requester | Dashboard, Requisitions, Suppliers | ❌ |
| Budget Holder | Dashboard, Requisitions, Suppliers, Reports | ❌ |
| Procurement Officer | Dashboard, Requisitions, RFQs, RFPs, POs, Suppliers, Contracts, Reports | ❌ |
| Procurement Manager | Dashboard, Requisitions, RFQs, RFPs, POs, Suppliers, Contracts, Reports | ❌ |
| Accounts Payable | Dashboard, POs, Receiving, Invoices, Suppliers, Reports | ❌ |
| Warehouse Staff | Dashboard, POs, Receiving, Suppliers | ❌ |
| Finance Manager | Dashboard, Invoices, Contracts, Reports | Audit Logs |
| Auditor | Dashboard, All Main Modules | Audit Logs |
| Organization Admin | Dashboard, Settings | Users, Roles, Workflows, Organization |

### Permission Categories (50+ Permissions)

| Module | Permissions |
|--------|-------------|
| Users | view, create, edit, delete, activate, deactivate, assign_roles |
| Organization | view, edit, manage_settings |
| Suppliers | view, create, edit, delete, approve, suspend |
| Requisitions | view, view_all, create, edit, delete, submit, approve, reject |
| RFQs | view, create, edit, delete, publish, award, cancel |
| RFPs | view, create, edit, delete, publish, evaluate, award |
| Purchase Orders | view, view_all, create, edit, delete, submit, approve, reject, cancel, close |
| Receiving | view, create, edit, complete |
| Invoices | view, create, edit, delete, match, approve, reject, pay |
| Contracts | view, create, edit, delete, approve, terminate, renew |
| Budget | view, create, edit, approve, transfer |
| Reports | view, export, advanced |
| Audit | view, export |
| Admin | full_access, manage_roles, view_all_orgs |

### Admin Login
- URL: http://localhost:8000/admin/
- Default credentials: `admin@dillanci.com` / `Admin123!`
- The "View Site" link redirects to the React frontend at http://localhost:3000

## API Documentation

The API follows REST conventions with the following base endpoints:

| Module | Endpoint | Description |
|--------|----------|-------------|
| Auth | `/api/v1/users/auth/` | Authentication |
| Users | `/api/v1/users/` | User management |
| Organizations | `/api/v1/organizations/` | Organization management |
| Suppliers | `/api/v1/suppliers/` | Supplier management |
| Catalog | `/api/v1/catalog/` | Product catalog |
| Budget | `/api/v1/budget/` | Budget management |
| Requisitions | `/api/v1/requisitions/` | Purchase requisitions |
| RFQs | `/api/v1/rfqs/` | Request for quotation |
| RFPs | `/api/v1/rfps/` | Request for proposal |
| Purchase Orders | `/api/v1/purchase-orders/` | Purchase orders |
| Receiving | `/api/v1/receiving/` | Goods receipts |
| Invoices | `/api/v1/invoices/` | Invoice processing |
| Contracts | `/api/v1/contracts/` | Contract management |
| Reports | `/api/v1/reports/` | Reports & analytics |
| Notifications | `/api/v1/notifications/` | In-app notifications |
| Comments | `/api/v1/comments/` | Generic comments for any object |
| Attachments | `/api/v1/attachments/` | File attachments for any object |

### Notifications API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/notifications/` | GET | List user's notifications |
| `/api/v1/notifications/summary/` | GET | Get unread/urgent counts |
| `/api/v1/notifications/{id}/mark-read/` | POST | Mark single notification as read |
| `/api/v1/notifications/mark-all-read/` | POST | Mark all notifications as read |
| `/api/v1/notifications/{id}/archive/` | POST | Archive a notification |
| `/api/v1/notifications/archive-all-read/` | POST | Archive all read notifications |

### Comments API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/comments/?object_type=xxx&object_id=yyy` | GET | List comments for an object |
| `/api/v1/comments/` | POST | Create a new comment |
| `/api/v1/comments/{id}/` | PATCH | Update a comment (author only) |
| `/api/v1/comments/{id}/` | DELETE | Delete a comment (author only) |

### Attachments API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/attachments/?object_type=xxx&object_id=yyy` | GET | List attachments for an object |
| `/api/v1/attachments/` | POST | Upload a new attachment (multipart/form-data) |
| `/api/v1/attachments/{id}/` | DELETE | Delete an attachment (uploader only) |

## Testing

### Backend Tests
```bash
cd backend
pytest --cov=apps --cov-report=term-missing
```

### Frontend Tests
```bash
cd frontend
npm run test
```

## Design System

Dillanci uses the **Sahel "Warm Industrial"** design palette:

### Colors
- **Primary**: Desert Clay browns (#8B4513 to #B8860B)
- **Accent**: Indigo blues (#2d5a87)
- **Success**: Forest green (#2d6a4f)
- **Warning**: Warm orange (#e07b39)
- **Error**: Deep red (#c1292e)

### Typography
- **Sans**: Plus Jakarta Sans
- **Mono**: JetBrains Mono

## Backend Stats
- **1,083 tests passing**
- **75%+ code coverage**
- **16 Django apps**
- **Production readiness score: 95/100**

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For support, please contact the development team or open an issue on GitHub.

---

<div align="center">

**Built with care by the Dillanci Team**

<img src="frontend/public/images/icon-64.png" alt="Dillanci Icon" width="40"/>

[![Made with Django](https://img.shields.io/badge/Made%20with-Django-092E20?style=flat-square&logo=django)](https://djangoproject.com)
[![Made with React](https://img.shields.io/badge/Made%20with-React-61DAFB?style=flat-square&logo=react)](https://reactjs.org)

</div>
