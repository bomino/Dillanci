# Dillanci Frontend

React + TypeScript + Vite frontend for the Dillanci Enterprise Procurement Platform.

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand (with persist middleware)
- **Data Fetching**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation

## Project Structure

```
src/
├── components/
│   ├── ui/              # Base UI components (Button, Input, Card, etc.)
│   ├── layout/          # Layout components (Sidebar, Header, DashboardLayout)
│   ├── auth/            # Authentication components (ProtectedRoute)
│   └── notifications/   # Notification system components
├── pages/
│   ├── auth/            # Login page
│   ├── dashboard/       # Dashboard
│   ├── requisitions/    # Requisition management
│   ├── rfqs/            # RFQ management
│   ├── rfps/            # RFP management
│   ├── purchase-orders/ # PO management
│   ├── receiving/       # Goods receipt
│   ├── invoices/        # Invoice processing
│   ├── suppliers/       # Supplier management
│   ├── contracts/       # Contract management
│   ├── reports/         # Reports & analytics
│   ├── settings/        # User settings
│   ├── profile/         # User profile
│   └── admin/           # Admin pages (users, roles, audit, workflows)
├── hooks/
│   └── usePermissions.ts  # RBAC permission checking hook
├── stores/
│   ├── auth-store.ts    # Authentication state
│   └── ui-store.ts      # UI state (sidebar, theme)
├── lib/
│   ├── api/             # API clients
│   │   ├── client.ts    # Axios client
│   │   ├── auth.ts      # Auth API
│   │   ├── notifications.ts # Notifications API
│   │   └── ...          # Module APIs
│   └── utils.ts         # Utility functions
├── types/
│   └── index.ts         # TypeScript types & RBAC permissions
├── App.tsx              # Main app with routes
└── main.tsx             # Entry point
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000/api/v1` |
| `VITE_MOCK_API` | Enable mock mode | `false` |

## Role-Based Access Control (RBAC)

The frontend implements comprehensive permission-based access control that mirrors the backend RBAC system.

### Permission System Overview

#### Permission Codes

All permissions are defined in `types/index.ts`:

```typescript
export const Permissions = {
  // User Management
  USER_VIEW: 'user.view',
  USER_CREATE: 'user.create',
  USER_EDIT: 'user.edit',
  USER_DELETE: 'user.delete',
  USER_ASSIGN_ROLES: 'user.assign_roles',

  // Requisitions
  REQUISITION_VIEW: 'requisition.view',
  REQUISITION_CREATE: 'requisition.create',
  REQUISITION_EDIT: 'requisition.edit',
  REQUISITION_APPROVE: 'requisition.approve',

  // ... 50+ permissions total
} as const;
```

### Using the usePermissions Hook

The `usePermissions` hook provides all permission checking utilities:

```typescript
import { usePermissions } from '@/hooks/usePermissions';
import { Permissions } from '@/types';

function MyComponent() {
  const {
    // Permission checks
    hasPermission,       // Check single permission
    hasAnyPermission,    // Check if user has ANY of the permissions
    hasAllPermissions,   // Check if user has ALL permissions

    // Role checks
    hasRole,             // Check for specific role code
    hasAnyRole,          // Check for any of multiple roles

    // User type checks
    isAdmin,             // is_staff && has admin roles
    isSuperuser,         // is_superuser (full access)
    isStaff,             // is_staff flag

    // Raw data
    permissions,         // string[] of all permission codes
    roles,               // UserRole[] array

    // Loading state
    isLoading            // true while auth is being checked
  } = usePermissions();

  // Example usage
  const canCreateReq = hasPermission(Permissions.REQUISITION_CREATE);
  const canAccessPO = hasAnyPermission([Permissions.PO_VIEW, Permissions.PO_CREATE]);
  const canApproveAll = hasAllPermissions([
    Permissions.REQUISITION_APPROVE,
    Permissions.PO_APPROVE,
    Permissions.INVOICE_APPROVE
  ]);
}
```

### Route Protection

#### ProtectedRoute Component

Wrap routes with `ProtectedRoute` to restrict access:

```tsx
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Permissions } from '@/types';

// Single permission required
<Route path="/requisitions/new" element={
  <ProtectedRoute permission={Permissions.REQUISITION_CREATE}>
    <CreateRequisitionPage />
  </ProtectedRoute>
} />

// Any of multiple permissions
<Route path="/requisitions" element={
  <ProtectedRoute anyPermission={[Permissions.REQUISITION_VIEW, Permissions.REQUISITION_CREATE]}>
    <RequisitionsPage />
  </ProtectedRoute>
} />

// All permissions required
<Route path="/admin/settings" element={
  <ProtectedRoute allPermissions={[Permissions.ORG_VIEW, Permissions.ORG_EDIT]}>
    <SettingsPage />
  </ProtectedRoute>
} />

// Admin-only routes
<Route path="/admin/users" element={
  <ProtectedRoute requireAdmin anyPermission={[Permissions.USER_VIEW]}>
    <UsersPage />
  </ProtectedRoute>
} />

// Superuser-only
<Route path="/system" element={
  <ProtectedRoute requireSuperuser>
    <SystemPage />
  </ProtectedRoute>
} />
```

#### ProtectedRoute Props

| Prop | Type | Description |
|------|------|-------------|
| `permission` | `string` | Single permission required |
| `anyPermission` | `string[]` | User needs ANY of these |
| `allPermissions` | `string[]` | User needs ALL of these |
| `anyRole` | `string[]` | User needs any of these role codes |
| `requireAdmin` | `boolean` | Requires admin status |
| `requireSuperuser` | `boolean` | Requires superuser status |
| `requireStaff` | `boolean` | Requires staff status |
| `redirectTo` | `string` | Redirect path on failure (default: `/dashboard`) |

### Inline Permission Guards

For conditionally rendering UI elements:

```tsx
import {
  RequirePermission,
  RequireAnyPermission,
  RequireAdmin
} from '@/components/auth/ProtectedRoute';

// Single permission
<RequirePermission
  permission={Permissions.REQUISITION_CREATE}
  fallback={<span>No access</span>}
>
  <Button>Create Requisition</Button>
</RequirePermission>

// Any of multiple permissions
<RequireAnyPermission
  permissions={[Permissions.PO_APPROVE, Permissions.PO_EDIT]}
>
  <ActionButtons />
</RequireAnyPermission>

// Admin only
<RequireAdmin fallback={<span>Admin access required</span>}>
  <AdminPanel />
</RequireAdmin>
```

### Permission-Based Navigation

The Sidebar automatically filters navigation based on permissions:

```typescript
// In Sidebar.tsx
const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard />,
    // No permission = visible to all authenticated users
  },
  {
    label: 'Requisitions',
    href: '/requisitions',
    icon: <FileText />,
    anyPermission: [Permissions.REQUISITION_VIEW, Permissions.REQUISITION_CREATE],
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: <BarChart3 />,
    permission: Permissions.REPORT_VIEW,  // Single permission
  },
];

// Admin section only shows for admins with visible items
const adminNavItems = [
  {
    label: 'Users',
    href: '/admin/users',
    anyPermission: [Permissions.USER_VIEW, Permissions.USER_ASSIGN_ROLES],
  },
  {
    label: 'Roles',
    href: '/admin/roles',
    permission: Permissions.ADMIN_MANAGE_ROLES,
  },
];
```

### Auth Store Integration

The auth store fetches and caches user permissions:

```typescript
import { useAuthStore } from '@/stores/auth-store';

// Access user with permissions
const { user } = useAuthStore();
console.log(user?.permissions); // ['requisition.view', 'requisition.create', ...]
console.log(user?.roles);       // [{ role_name: 'Requester', ... }, ...]

// Refresh permissions after role changes
const { refreshPermissions } = useAuthStore();
await refreshPermissions();
```

### Mock Mode for Development

Enable mock mode for frontend development without backend:

```bash
VITE_MOCK_API=true npm run dev
```

This provides:
- Mock user with Organization Admin permissions
- Simulated API delays
- All features accessible for testing

## Development

### Adding New Permissions

1. Add to backend `Permissions` class
2. Add to frontend `Permissions` const in `types/index.ts`
3. Update relevant routes in `App.tsx`
4. Update navigation items in `Sidebar.tsx`
5. Add inline guards where needed

### Creating Protected Pages

```tsx
// pages/my-feature/MyFeaturePage.tsx
import { RequirePermission } from '@/components/auth/ProtectedRoute';
import { Permissions } from '@/types';

export function MyFeaturePage() {
  return (
    <div>
      <h1>My Feature</h1>

      {/* Only show create button if user has permission */}
      <RequirePermission permission={Permissions.MY_FEATURE_CREATE}>
        <Button>Create New</Button>
      </RequirePermission>

      {/* Content visible to all with view permission */}
      <DataTable />
    </div>
  );
}
```

## Notification System

The frontend includes an in-app notification system with real-time updates.

### Features
- **Bell icon with unread count** in the header navbar
- **Dropdown notification panel** with scrollable list
- **Type-specific icons and colors** for different notification types
- **Priority indicators** (colored borders for urgent/high priority)
- **Mark as read** - Single or all notifications
- **Auto-refresh** via polling every 30 seconds
- **Click to navigate** - Direct links to related documents

### Notification Types

| Type | Icon | Use Case |
|------|------|----------|
| `APPROVAL_REQUIRED` | AlertCircle (warning) | Document needs approval |
| `APPROVAL_COMPLETED` | CheckCircle (success) | Document was approved |
| `APPROVAL_REJECTED` | XCircle (error) | Document was rejected |
| `DOCUMENT_SUBMITTED` | FileText (primary) | Document submitted for review |
| `BID_RECEIVED` | FileText (primary) | New bid on RFQ/RFP |
| `CONTRACT_EXPIRING` | Clock (warning) | Contract approaching expiration |
| `INVOICE_MATCHED` | CheckSquare (success) | Invoice passed 3-way matching |
| `GOODS_RECEIVED` | Package (info) | Goods receipt posted |
| `BUDGET_ALERT` | DollarSign (warning) | Budget threshold reached |
| `SYSTEM_ALERT` | Bell (neutral) | System announcements |

### Using Notifications API

```typescript
import {
  useNotifications,
  useNotificationSummary,
  useMarkAsRead,
  useMarkAllAsRead
} from '@/lib/api/notifications';

function MyComponent() {
  // Fetch all notifications (polls every 30s)
  const { data: notifications, isLoading } = useNotifications();

  // Get unread count for badges
  const { data: summary } = useNotificationSummary();
  console.log(summary?.unread); // number of unread

  // Mark single notification as read
  const markAsRead = useMarkAsRead();
  markAsRead.mutate('notification-id');

  // Mark all as read
  const markAllAsRead = useMarkAllAsRead();
  markAllAsRead.mutate();
}
```

### Mock Mode

When `VITE_MOCK_API=true`, notifications use mock data with 5 sample notifications of different types. This allows frontend development without a backend.

## Key Files

| File | Purpose |
|------|---------|
| `src/types/index.ts` | All TypeScript types including Permissions const |
| `src/hooks/usePermissions.ts` | RBAC permission checking hook |
| `src/components/auth/ProtectedRoute.tsx` | Route guards and inline permission components |
| `src/components/notifications/` | Notification panel and item components |
| `src/lib/api/notifications.ts` | Notification API hooks with polling |
| `src/stores/auth-store.ts` | Authentication state with permissions |
| `src/lib/api/auth.ts` | Auth API including permission fetching |
| `src/components/layout/Sidebar.tsx` | Permission-filtered navigation |
| `src/App.tsx` | All protected routes |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## License

Proprietary - All rights reserved.
