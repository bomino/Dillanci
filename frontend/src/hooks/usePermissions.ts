/**
 * usePermissions Hook
 *
 * Provides permission checking utilities for the frontend RBAC system.
 * Works with the auth store to check user permissions.
 */

import { useMemo, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import type { PermissionCode } from '@/types';

interface UsePermissionsReturn {
  /** User's permission codes */
  permissions: string[];
  /** User's roles */
  roles: string[];
  /** Check if user has a specific permission */
  hasPermission: (permission: PermissionCode | string) => boolean;
  /** Check if user has any of the specified permissions */
  hasAnyPermission: (permissions: (PermissionCode | string)[]) => boolean;
  /** Check if user has all of the specified permissions */
  hasAllPermissions: (permissions: (PermissionCode | string)[]) => boolean;
  /** Check if user has a specific role by name */
  hasRole: (roleName: string) => boolean;
  /** Check if user has any of the specified roles */
  hasAnyRole: (roleNames: string[]) => boolean;
  /** Check if user is a superuser */
  isSuperuser: boolean;
  /** Check if user is staff */
  isStaff: boolean;
  /** Check if user has admin access (superuser, staff, or admin permission) */
  isAdmin: boolean;
  /** Loading state */
  isLoading: boolean;
}

/**
 * Hook for checking user permissions
 *
 * @example
 * ```tsx
 * const { hasPermission, hasAnyPermission } = usePermissions();
 *
 * // Check single permission
 * if (hasPermission(Permissions.USER_CREATE)) {
 *   // Show create user button
 * }
 *
 * // Check multiple permissions (OR logic)
 * if (hasAnyPermission([Permissions.USER_EDIT, Permissions.USER_DELETE])) {
 *   // Show edit/delete options
 * }
 * ```
 */
export function usePermissions(): UsePermissionsReturn {
  const { user, isLoading } = useAuthStore();

  // Memoize permissions array
  const permissions = useMemo(() => {
    if (!user) return [];
    return user.permissions || [];
  }, [user]);

  // Memoize roles array
  const roles = useMemo(() => {
    if (!user || !user.roles) return [];
    return user.roles.filter(r => r.is_valid).map(r => r.role_name);
  }, [user]);

  // Check superuser status
  const isSuperuser = useMemo(() => {
    return user?.is_superuser === true;
  }, [user]);

  // Check staff status
  const isStaff = useMemo(() => {
    return user?.is_staff === true;
  }, [user]);

  // Check if user has a specific permission
  const hasPermission = useCallback((permission: PermissionCode | string): boolean => {
    if (!user) return false;
    // Superusers have all permissions
    if (user.is_superuser) return true;
    return permissions.includes(permission);
  }, [user, permissions]);

  // Check if user has any of the specified permissions
  const hasAnyPermission = useCallback((perms: (PermissionCode | string)[]): boolean => {
    if (!user) return false;
    if (user.is_superuser) return true;
    return perms.some(p => permissions.includes(p));
  }, [user, permissions]);

  // Check if user has all of the specified permissions
  const hasAllPermissions = useCallback((perms: (PermissionCode | string)[]): boolean => {
    if (!user) return false;
    if (user.is_superuser) return true;
    return perms.every(p => permissions.includes(p));
  }, [user, permissions]);

  // Check if user has a specific role
  const hasRole = useCallback((roleName: string): boolean => {
    if (!user) return false;
    return roles.some(r => r.toLowerCase() === roleName.toLowerCase());
  }, [user, roles]);

  // Check if user has any of the specified roles
  const hasAnyRole = useCallback((roleNames: string[]): boolean => {
    if (!user) return false;
    const lowerRoles = roles.map(r => r.toLowerCase());
    return roleNames.some(rn => lowerRoles.includes(rn.toLowerCase()));
  }, [user, roles]);

  // Check if user has admin access
  const isAdmin = useMemo(() => {
    if (!user) return false;
    return (
      user.is_superuser === true ||
      user.is_staff === true ||
      permissions.includes('admin.full_access') ||
      permissions.includes('admin.manage_roles')
    );
  }, [user, permissions]);

  return {
    permissions,
    roles,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    isSuperuser,
    isStaff,
    isAdmin,
    isLoading,
  };
}

/**
 * Hook for checking a single permission
 *
 * @example
 * ```tsx
 * const canCreateUser = useHasPermission(Permissions.USER_CREATE);
 * ```
 */
export function useHasPermission(permission: PermissionCode | string): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
}

/**
 * Hook for checking multiple permissions (OR logic)
 *
 * @example
 * ```tsx
 * const canManageUsers = useHasAnyPermission([
 *   Permissions.USER_CREATE,
 *   Permissions.USER_EDIT,
 *   Permissions.USER_DELETE
 * ]);
 * ```
 */
export function useHasAnyPermission(permissions: (PermissionCode | string)[]): boolean {
  const { hasAnyPermission } = usePermissions();
  return hasAnyPermission(permissions);
}

/**
 * Hook for checking multiple permissions (AND logic)
 *
 * @example
 * ```tsx
 * const canFullyManageUsers = useHasAllPermissions([
 *   Permissions.USER_CREATE,
 *   Permissions.USER_EDIT,
 *   Permissions.USER_DELETE
 * ]);
 * ```
 */
export function useHasAllPermissions(permissions: (PermissionCode | string)[]): boolean {
  const { hasAllPermissions } = usePermissions();
  return hasAllPermissions(permissions);
}

export default usePermissions;
