# Dillanci - Enterprise Procurement Platform

Dillanci is a comprehensive enterprise procurement platform designed to streamline the entire procure-to-pay lifecycle. Built with Django REST Framework backend and React TypeScript frontend.

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

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| Requester | Creates purchase requisitions | Create/view requisitions |
| Budget Holder | Manages department budgets | Approve requisitions, manage budgets |
| Procurement Officer | Handles sourcing activities | Manage RFQs/RFPs, create POs |
| Procurement Manager | Oversees procurement team | Full procurement access |
| Accounts Payable | Processes invoices | Manage invoices, process payments |
| Warehouse Staff | Handles receiving | Manage goods receipts |
| Finance Manager | Financial oversight | Full financial access |
| Auditor | Read-only audit access | View all records |
| Organization Admin | Full system access | All permissions |

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
- Default credentials: Set via `createsuperuser` command

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
- **841 tests passing**
- **82%+ code coverage**
- **16 Django apps**

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

Built with care by the Dillanci Team
