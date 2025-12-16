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
├── apps/                      # Django apps
│   ├── core/                  # Base models, exceptions
│   ├── users/                 # User management
│   ├── organizations/         # Multi-tenant orgs
│   ├── suppliers/             # Supplier management
│   ├── catalog/               # Product catalog
│   ├── budget/                # Budget & encumbrances
│   ├── requisitions/          # Purchase requisitions
│   ├── rfqs/                  # Request for quotation
│   ├── rfps/                  # Request for proposal
│   ├── purchase_orders/       # Purchase orders
│   ├── receiving/             # Goods receipts
│   ├── invoices/              # Invoice processing
│   ├── contracts/             # Contract management
│   ├── audit/                 # Audit logging
│   ├── documents/             # Document management
│   └── reports/               # Reporting & analytics
├── config/                    # Django settings
├── requirements/              # Python dependencies
│
├── frontend/                  # React SPA
│   ├── src/
│   │   ├── components/        # UI components
│   │   │   ├── ui/            # Base components (Button, Input, etc.)
│   │   │   └── layout/        # Layout components (Sidebar, Header)
│   │   ├── pages/             # Page components
│   │   ├── stores/            # Zustand stores
│   │   ├── lib/               # Utilities & API clients
│   │   └── types/             # TypeScript types
│   └── public/                # Static assets
│
├── docker-compose.yml         # Development Docker setup
└── docker-compose.prod.yml    # Production Docker setup
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

4. **Access the application**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:8001/api/v1/
   - API Docs: http://localhost:8001/api/v1/docs/

### Local Development

#### Backend Setup
```bash
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
