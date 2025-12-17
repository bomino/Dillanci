/**
 * ProtectedRoute Component
 *
 * Route guard component that checks user permissions before rendering children.
 * Redirects to appropriate page if user lacks required permissions.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionCode } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Single permission required to access this route */
  permission?: PermissionCode | string;
  /** Multiple permissions - user needs ANY of these (OR logic) */
  anyPermission?: (PermissionCode | string)[];
  /** Multiple permissions - user needs ALL of these (AND logic) */
  allPermissions?: (PermissionCode | string)[];
  /** Role names - user needs ANY of these roles */
  anyRole?: string[];
  /** Require admin access (superuser, staff, or admin permission) */
  requireAdmin?: boolean;
  /** Require superuser status */
  requireSuperuser?: boolean;
  /** Require staff status */
  requireStaff?: boolean;
  /** Custom redirect path when access denied (default: /dashboard) */
  redirectTo?: string;
  /** Fallback component to show when loading */
  loadingComponent?: React.ReactNode;
  /** Component to show when access is denied */
  accessDeniedComponent?: React.ReactNode;
}

/**
 * Default access denied component
 */
function DefaultAccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="text-6xl mb-4">🔒</div>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Access Denied</h1>
      <p className="text-neutral-600 text-center max-w-md">
        You don't have permission to access this page. Please contact your administrator
        if you believe this is an error.
      </p>
    </div>
  );
}

/**
 * Default loading component
 */
function DefaultLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  );
}

/**
 * ProtectedRoute - Guards routes based on user permissions
 *
 * @example
 * ```tsx
 * // Require specific permission
 * <ProtectedRoute permission={Permissions.USER_CREATE}>
 *   <CreateUserPage />
 * </ProtectedRoute>
 *
 * // Require any of multiple permissions
 * <ProtectedRoute anyPermission={[Permissions.USER_EDIT, Permissions.USER_DELETE]}>
 *   <ManageUsersPage />
 * </ProtectedRoute>
 *
 * // Require admin access
 * <ProtectedRoute requireAdmin>
 *   <AdminDashboard />
 * </ProtectedRoute>
 *
 * // Require specific role
 * <ProtectedRoute anyRole={['Finance Manager', 'Accounts Payable']}>
 *   <InvoicesPage />
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({
  children,
  permission,
  anyPermission,
  allPermissions,
  anyRole,
  requireAdmin = false,
  requireSuperuser = false,
  requireStaff = false,
  redirectTo = '/dashboard',
  loadingComponent,
  accessDeniedComponent,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const location = useLocation();
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasAnyRole,
    isAdmin,
    isSuperuser,
    isStaff,
    isLoading: permLoading,
  } = usePermissions();

  // Show loading state
  if (authLoading || permLoading) {
    return <>{loadingComponent || <DefaultLoading />}</>;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check permission requirements
  let hasAccess = true;

  // Check superuser requirement
  if (requireSuperuser && !isSuperuser) {
    hasAccess = false;
  }

  // Check staff requirement
  if (requireStaff && !isStaff) {
    hasAccess = false;
  }

  // Check admin requirement
  if (requireAdmin && !isAdmin) {
    hasAccess = false;
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    hasAccess = false;
  }

  // Check any permission (OR logic)
  if (anyPermission && anyPermission.length > 0 && !hasAnyPermission(anyPermission)) {
    hasAccess = false;
  }

  // Check all permissions (AND logic)
  if (allPermissions && allPermissions.length > 0 && !hasAllPermissions(allPermissions)) {
    hasAccess = false;
  }

  // Check any role
  if (anyRole && anyRole.length > 0 && !hasAnyRole(anyRole)) {
    hasAccess = false;
  }

  // Handle access denied
  if (!hasAccess) {
    // If a custom access denied component is provided, show it
    if (accessDeniedComponent) {
      return <>{accessDeniedComponent}</>;
    }

    // If we're already at the redirect target, show access denied
    if (location.pathname === redirectTo) {
      return <DefaultAccessDenied />;
    }

    // Redirect to dashboard or custom redirect path
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

/**
 * RequirePermission - Simple wrapper for single permission check
 */
export function RequirePermission({
  permission,
  children,
  fallback = null,
}: {
  permission: PermissionCode | string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * RequireAnyPermission - Wrapper for any-of permission check
 */
export function RequireAnyPermission({
  permissions,
  children,
  fallback = null,
}: {
  permissions: (PermissionCode | string)[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasAnyPermission } = usePermissions();

  if (!hasAnyPermission(permissions)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * RequireAdmin - Wrapper for admin access check
 */
export function RequireAdmin({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isAdmin } = usePermissions();

  if (!isAdmin) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
