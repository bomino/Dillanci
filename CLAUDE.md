# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dillanci is an enterprise procurement platform covering the full procure-to-pay lifecycle. It's a monorepo with a Django REST Framework backend and React TypeScript frontend. The platform supports multi-tenant organizations with role-based access control (RBAC).

## Commands

### Docker (Recommended for full stack)
```bash
docker-compose up -d                    # Start all services (db, redis, backend, frontend, celery)
docker-compose down                     # Stop all services
docker-compose logs -f backend          # Follow backend logs
docker-compose exec backend python manage.py migrate  # Run migrations
docker-compose exec backend python manage.py createsuperuser  # Create admin
docker-compose up -d --build            # Rebuild and start
```

### Backend (Django)
```bash
cd backend
pip install -r requirements/development.txt  # Install deps (includes test.txt and base.txt)
python manage.py runserver                   # Dev server on :8000
python manage.py migrate                     # Apply migrations
python manage.py makemigrations <app_name>   # Create migrations

# Testing
pytest                                       # Run all tests
pytest apps/<app_name>/                      # Run single app tests
pytest -k "test_name"                        # Run specific test
pytest --cov=apps --cov-report=term-missing  # With coverage
pytest -m "not slow"                         # Skip slow tests

# Code quality
black .                                      # Format code
isort .                                      # Sort imports
flake8                                       # Lint
mypy apps/                                   # Type check
```

### Frontend (React)
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Dev server on :3000
npm run build        # Production build (runs tsc first)
npm run lint         # ESLint
npm run preview      # Preview production build
```

## Architecture

### Backend Structure (`backend/`)
- **config/settings/** - Django settings split by environment (base.py, development.py, production.py, test.py)
- **apps/** - 16 Django apps organized by domain:
  - `core/` - Base models (BaseModel, SoftDeleteModel), exceptions, Notification model, ApprovalThreshold
  - `users/`, `organizations/` - Auth and multi-tenancy with RBAC (9 roles, 60+ permissions)
  - `suppliers/`, `catalog/`, `budget/` - Master data
  - `requisitions/`, `rfqs/`, `rfps/` - Sourcing workflow
  - `purchase_orders/`, `receiving/`, `invoices/` - Order-to-pay with 3-way matching
  - `contracts/`, `documents/`, `audit/`, `reports/` - Supporting modules

Each app follows the pattern: `models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `tests/`

### Frontend Structure (`frontend/src/`)
- **components/ui/** - Radix UI-based components (Button, Input, Card, DataTable, Dialog, Toast, etc.)
- **components/layout/** - App shell (Sidebar, Header, DashboardLayout)
- **components/auth/** - ProtectedRoute, RequirePermission, RequireAdmin guards
- **components/notifications/** - Notification system components
- **pages/** - Route-level components organized by module
- **stores/** - Zustand stores (`auth-store.ts`, `ui-store.ts`)
- **lib/api/** - Axios API clients per module with shared `client.ts` base
- **hooks/** - Custom hooks including `usePermissions.ts` for RBAC
- **types/** - TypeScript types including `Permissions` constants

### Key Architectural Patterns

**Backend Models:**
- All models extend `BaseModel` (UUID primary key, timestamps, soft delete)
- Use `SoftDeleteModel` for models where `.objects` should exclude deleted records
- Multi-tenancy via `organization` ForeignKey on most models

**Frontend API Pattern:**
```typescript
// lib/api/[module].ts - TanStack Query hooks
export function use[Module]s(filters?) {
  return useQuery({ queryKey: ['[module]s', filters], queryFn: fetch[Module]s });
}
export function useCreate[Module]() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries(['[module]s']) });
}
```

**Frontend RBAC:**
```typescript
// Check permissions in components
const { hasPermission, hasAnyPermission, isAdmin } = usePermissions();
if (hasPermission(Permissions.REQUISITION_CREATE)) { /* ... */ }

// Route protection
<ProtectedRoute permission={Permissions.PO_VIEW}><POPage /></ProtectedRoute>

// Inline guards
<RequirePermission permission={Permissions.USER_CREATE}><Button>Create</Button></RequirePermission>
```

**Authentication:** Session-based with CSRF tokens (not JWT). API client auto-handles CSRF via cookie.

**Forms:** React Hook Form + Zod validation. Form components follow pattern in `DEVELOPMENT_PLAN.md`.

**Styling:** Tailwind CSS v4 with Sahel Warm Industrial palette (desert clays, indigo accents).

## API Conventions
- All endpoints prefixed with `/api/v1/`
- Django REST Framework with drf-spectacular for OpenAPI docs
- API docs at `/api/docs/` (Swagger) and `/api/redoc/`
- Health check at `/api/v1/health/`

## Testing

Backend uses pytest with pytest-django (config in `pyproject.toml`):
- `DJANGO_SETTINGS_MODULE = "config.settings.test"`
- Factories in `tests/factories/` using factory-boy
- Coverage target: 80%+ (enforced via `fail_under = 80`)
- Markers: `@pytest.mark.slow`, `@pytest.mark.integration`, `@pytest.mark.unit`

## Environment Variables

Key variables (see `.env.example`):
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` - Database config
- `REDIS_URL` - Cache/Celery broker
- `SECRET_KEY` - Django secret
- `DEBUG` - Debug mode (True for dev)
- `VITE_API_URL` - Frontend API base URL (defaults to `/api/v1`)
- `VITE_MOCK_API` - Enable mock API mode for frontend-only dev

## Service Ports (Docker)
- Frontend: 3000 (configurable via `FRONTEND_PORT`)
- Backend: 8000 (configurable via `BACKEND_PORT`)
- PostgreSQL: 5432 (configurable via `POSTGRES_PORT`)
- Redis: 6379 (configurable via `REDIS_PORT`)

## Background Tasks
Celery worker and beat run in Docker for async tasks. Commands:
- `celery -A config worker -l INFO` (worker)
- `celery -A config beat -l INFO` (scheduler)

## RBAC - Role-Based Access Control

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

### Role Descriptions

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

### Permission Modules (14 total, 60+ permissions)

Permissions follow the pattern `module.action` (e.g., `requisition.create`, `purchase_order.approve`).

| Module | Actions |
|--------|---------|
| `user` | view, create, edit, delete, activate, deactivate, assign_roles |
| `organization` | view, edit, manage_settings |
| `supplier` | view, create, edit, delete, approve, suspend |
| `requisition` | view, view_all, create, edit, delete, submit, approve, reject |
| `rfq` | view, create, edit, delete, publish, award, cancel |
| `rfp` | view, create, edit, delete, publish, evaluate, award |
| `purchase_order` | view, view_all, create, edit, delete, submit, approve, reject, cancel, close |
| `receiving` | view, create, edit, complete |
| `invoice` | view, create, edit, delete, match, approve, reject, pay |
| `contract` | view, create, edit, delete, approve, terminate, renew |
| `budget` | view, create, edit, approve, transfer |
| `report` | view, export, advanced |
| `audit` | view, export |
| `admin` | full_access, manage_roles, view_all_orgs |

### RBAC Implementation Files

**Backend:**
- `backend/apps/users/models.py` - `Permissions` class, `RolePresets` class, `Role`, `UserRole` models
- `backend/apps/users/views.py` - Role management endpoints
- `backend/apps/users/serializers.py` - `UserWithRolesSerializer` includes permissions

**Frontend:**
- `frontend/src/types/index.ts` - `Permissions` constant (mirrors backend)
- `frontend/src/hooks/usePermissions.ts` - Permission checking hook
- `frontend/src/components/auth/ProtectedRoute.tsx` - Route guards
- `frontend/src/components/layout/Sidebar.tsx` - Permission-filtered navigation
