# Dillanci

**Dillanci** - Enterprise Sourcing & Procurement Platform

> *"Dillanci"* means "procurement" in Hausa, reflecting the platform's purpose of streamlining enterprise procurement processes.

## Overview

Dillanci is a comprehensive, enterprise-grade procurement platform built with Django and Django REST Framework. It provides end-to-end procurement lifecycle management from requisitions to payments.

## Features

### Core Modules (16 Apps)
- **Users & Organizations** - Multi-tenant user management with organization hierarchy
- **Suppliers** - Supplier lifecycle management with state machine workflows
- **Catalog** - Category taxonomy and item master data
- **Budget** - Fiscal year budgets with encumbrance tracking
- **Requisitions** - Purchase requisition workflow with approvals
- **RFQs** - Request for Quotation with bid management
- **RFPs** - Request for Proposal with multi-criteria scoring and BAFO rounds
- **Purchase Orders** - PO creation, approval, and tracking
- **Receiving** - Goods receipt with inspection workflow
- **Invoices** - Invoice processing with 3-way matching
- **Contracts** - Contract lifecycle with milestones and spend tracking
- **Audit** - Comprehensive audit trail for compliance
- **Documents** - Document management with versioning
- **Reports** - Dashboard KPIs, spend analysis, supplier performance

### Key Capabilities
- State machine workflows for all major entities
- Budget encumbrance and liquidation
- 3-way matching (PO vs GR vs Invoice)
- Multi-criteria proposal evaluation with weighted scoring
- Organization-level data isolation (multi-tenancy)
- Soft delete pattern across all models
- Comprehensive audit logging

## Tech Stack

- **Backend**: Django 5.x, Django REST Framework
- **Database**: PostgreSQL 16
- **Cache/Queue**: Redis, Celery
- **API Documentation**: drf-spectacular (OpenAPI 3.0)
- **Testing**: pytest, pytest-django, factory_boy

## Project Stats

- **841 tests passing**
- **82%+ code coverage**
- **16 Django apps**

## Quick Start

### Prerequisites
- Python 3.12+
- PostgreSQL 16
- Redis

### Installation

```bash
# Clone the repository
git clone https://github.com/bomino/Dillanci.git
cd Dillanci

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements/development.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=apps --cov-report=term-missing

# Run specific app tests
pytest apps/reports/tests/ -v
```

## API Documentation

Once the server is running, access the API documentation at:
- **Swagger UI**: http://localhost:8000/api/schema/swagger-ui/
- **ReDoc**: http://localhost:8000/api/schema/redoc/

## Project Structure

```
dillanci/
├── apps/
│   ├── core/           # Base models, exceptions, permissions
│   ├── users/          # Custom user model
│   ├── organizations/  # Multi-tenant organizations
│   ├── suppliers/      # Supplier management
│   ├── catalog/        # Categories and items
│   ├── budget/         # Fiscal years and budget lines
│   ├── requisitions/   # Purchase requisitions
│   ├── rfqs/           # Request for quotations
│   ├── rfps/           # Request for proposals
│   ├── purchase_orders/# Purchase orders
│   ├── receiving/      # Goods receipts
│   ├── invoices/       # Invoice processing
│   ├── contracts/      # Contract management
│   ├── audit/          # Audit trail
│   ├── documents/      # Document management
│   └── reports/        # Reporting & analytics
├── config/
│   ├── settings/       # Django settings (base, dev, test, prod)
│   ├── urls.py         # URL routing
│   └── celery.py       # Celery configuration
├── requirements/       # Dependency files
├── manage.py
└── pyproject.toml      # Project configuration
```

## License

This project is proprietary software. All rights reserved.

## Contributing

This is a private project. Please contact the maintainers for contribution guidelines.

---

Built with Django and DRF
