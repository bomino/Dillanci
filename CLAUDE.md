# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dillanci is an enterprise procurement platform covering the full procure-to-pay lifecycle. It's a monorepo with a Django REST Framework backend and React TypeScript frontend.

## Commands

### Docker (Recommended for full stack)
```bash
docker-compose up -d                    # Start all services
docker-compose down                     # Stop all services
docker-compose logs -f backend          # Follow backend logs
docker-compose exec backend python manage.py migrate  # Run migrations
docker-compose exec backend python manage.py createsuperuser  # Create admin
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
  - `core/` - Base models, exceptions, shared utilities
  - `users/`, `organizations/` - Auth and multi-tenancy
  - `suppliers/`, `catalog/`, `budget/` - Master data
  - `requisitions/`, `rfqs/`, `rfps/` - Sourcing
  - `purchase_orders/`, `receiving/`, `invoices/` - Order-to-pay
  - `contracts/`, `documents/`, `audit/`, `reports/` - Supporting modules

Each app follows the pattern: `models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `tests/`

### Frontend Structure (`frontend/src/`)
- **components/ui/** - Reusable UI components (Button, Input, Card, DataTable, etc.) using Radix UI primitives
- **components/layout/** - App shell (Sidebar, Header, DashboardLayout)
- **pages/** - Route-level components organized by module
- **stores/** - Zustand stores (`auth-store.ts`, `ui-store.ts`)
- **lib/api/** - Axios API clients per module with shared `client.ts` base
- **lib/hooks/** - Custom React hooks
- **types/** - TypeScript type definitions

### Key Patterns
- **Authentication**: Session-based with CSRF tokens (not JWT)
- **API Client**: Axios with interceptors for CSRF and 401 handling (`lib/api/client.ts`)
- **State Management**: Zustand for global state, TanStack Query for server state
- **Forms**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS v4 with "Sahel Warm Industrial" design palette

### API Conventions
- All endpoints prefixed with `/api/v1/`
- Django REST Framework with drf-spectacular for OpenAPI docs
- API docs at `/api/docs/` (Swagger) and `/api/redoc/`
- Health check at `/api/v1/health/`

## Testing

Backend uses pytest with pytest-django. Test settings in `pyproject.toml`:
- `DJANGO_SETTINGS_MODULE = "config.settings.test"`
- Factories in `tests/factories/` using factory-boy
- Coverage target: 80%+

## Environment Variables

Key variables (see `.env.example`):
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` - Database config
- `REDIS_URL` - Cache/queue broker
- `SECRET_KEY` - Django secret
- `DEBUG` - Debug mode (True for dev)
- `VITE_API_URL` - Frontend API base URL (defaults to `/api/v1`)

## Service Ports (Docker)
- Frontend: 3000
- Backend: 8000
- PostgreSQL: 5432
- Redis: 6379
