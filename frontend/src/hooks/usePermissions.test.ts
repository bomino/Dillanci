import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions, useHasPermission, useHasAnyPermission, useHasAllPermissions } from './usePermissions';
import { useAuthStore } from '@/stores/auth-store';
import type { User, UserRole } from '@/types';

// Helper to create a mock user
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  is_active: true,
  organization: 'test-org-id',
  permissions: ['requisition.view', 'requisition.create', 'supplier.view'],
  roles: [
    {
      id: 'role-1',
      user: 'test-user-id',
      role: 'requester-role-id',
      role_name: 'Requester',
      role_code: 'REQUESTER',
      valid_from: '2024-01-01',
      valid_to: null,
      delegated_by: null,
      custom_approval_limit: null,
      assigned_by: null,
      is_active: true,
      is_valid: true,
      is_delegated: false,
      approval_limit: null,
      created_at: '2024-01-01',
    } as UserRole,
  ],
  ...overrides,
});

describe('usePermissions', () => {
  beforeEach(() => {
    // Reset the auth store before each test
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  describe('when user is not authenticated', () => {
    it('returns empty permissions array', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.permissions).toEqual([]);
    });

    it('returns empty roles array', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.roles).toEqual([]);
    });

    it('hasPermission returns false', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission('requisition.view')).toBe(false);
    });

    it('hasAnyPermission returns false', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyPermission(['requisition.view', 'requisition.create'])).toBe(false);
    });

    it('hasAllPermissions returns false', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAllPermissions(['requisition.view', 'requisition.create'])).toBe(false);
    });

    it('isAdmin returns false', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isAdmin).toBe(false);
    });

    it('isSuperuser returns false', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isSuperuser).toBe(false);
    });

    it('isStaff returns false', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isStaff).toBe(false);
    });
  });

  describe('when user is authenticated with permissions', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    });

    it('returns user permissions', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.permissions).toEqual(['requisition.view', 'requisition.create', 'supplier.view']);
    });

    it('returns user roles', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.roles).toEqual(['Requester']);
    });

    it('hasPermission returns true for existing permission', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission('requisition.view')).toBe(true);
    });

    it('hasPermission returns false for non-existing permission', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission('admin.full_access')).toBe(false);
    });

    it('hasAnyPermission returns true if user has any of the permissions', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyPermission(['requisition.view', 'admin.full_access'])).toBe(true);
    });

    it('hasAnyPermission returns false if user has none of the permissions', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyPermission(['admin.full_access', 'user.delete'])).toBe(false);
    });

    it('hasAllPermissions returns true if user has all permissions', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAllPermissions(['requisition.view', 'requisition.create'])).toBe(true);
    });

    it('hasAllPermissions returns false if user is missing any permission', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAllPermissions(['requisition.view', 'admin.full_access'])).toBe(false);
    });

    it('hasRole returns true for matching role (case insensitive)', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasRole('requester')).toBe(true);
      expect(result.current.hasRole('REQUESTER')).toBe(true);
      expect(result.current.hasRole('Requester')).toBe(true);
    });

    it('hasRole returns false for non-matching role', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasRole('Admin')).toBe(false);
    });

    it('hasAnyRole returns true if user has any of the roles', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyRole(['Requester', 'Admin'])).toBe(true);
    });

    it('hasAnyRole returns false if user has none of the roles', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyRole(['Admin', 'Finance Manager'])).toBe(false);
    });
  });

  describe('when user is a superuser', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: createMockUser({ is_superuser: true, permissions: [] }),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    });

    it('isSuperuser returns true', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isSuperuser).toBe(true);
    });

    it('isAdmin returns true', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isAdmin).toBe(true);
    });

    it('hasPermission returns true for any permission', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission('any.permission')).toBe(true);
      expect(result.current.hasPermission('admin.full_access')).toBe(true);
    });

    it('hasAnyPermission returns true for any permissions', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyPermission(['any.permission', 'another.permission'])).toBe(true);
    });

    it('hasAllPermissions returns true for any permissions', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAllPermissions(['any.permission', 'another.permission'])).toBe(true);
    });
  });

  describe('when user is staff', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: createMockUser({ is_staff: true }),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    });

    it('isStaff returns true', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isStaff).toBe(true);
    });

    it('isAdmin returns true', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isAdmin).toBe(true);
    });
  });

  describe('when user has admin permissions', () => {
    it('isAdmin returns true with admin.full_access permission', () => {
      useAuthStore.setState({
        user: createMockUser({ permissions: ['admin.full_access'] }),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions());
      expect(result.current.isAdmin).toBe(true);
    });

    it('isAdmin returns true with admin.manage_roles permission', () => {
      useAuthStore.setState({
        user: createMockUser({ permissions: ['admin.manage_roles'] }),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions());
      expect(result.current.isAdmin).toBe(true);
    });
  });

  describe('loading state', () => {
    it('returns isLoading from auth store', () => {
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
      });

      const { result } = renderHook(() => usePermissions());
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('roles with invalid entries', () => {
    it('filters out invalid roles', () => {
      useAuthStore.setState({
        user: createMockUser({
          roles: [
            {
              id: 'role-1',
              user: 'test-user-id',
              role: 'valid-role-id',
              role_name: 'Valid Role',
              role_code: 'VALID',
              valid_from: '2024-01-01',
              valid_to: null,
              delegated_by: null,
              custom_approval_limit: null,
              assigned_by: null,
              is_active: true,
              is_valid: true,
              is_delegated: false,
              approval_limit: null,
              created_at: '2024-01-01',
            } as UserRole,
            {
              id: 'role-2',
              user: 'test-user-id',
              role: 'invalid-role-id',
              role_name: 'Invalid Role',
              role_code: 'INVALID',
              valid_from: '2024-01-01',
              valid_to: '2023-01-01', // Expired
              delegated_by: null,
              custom_approval_limit: null,
              assigned_by: null,
              is_active: true,
              is_valid: false, // Not valid
              is_delegated: false,
              approval_limit: null,
              created_at: '2024-01-01',
            } as UserRole,
          ],
        }),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions());
      expect(result.current.roles).toEqual(['Valid Role']);
    });
  });
});

describe('useHasPermission', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: createMockUser(),
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  });

  it('returns true for existing permission', () => {
    const { result } = renderHook(() => useHasPermission('requisition.view'));
    expect(result.current).toBe(true);
  });

  it('returns false for non-existing permission', () => {
    const { result } = renderHook(() => useHasPermission('admin.full_access'));
    expect(result.current).toBe(false);
  });
});

describe('useHasAnyPermission', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: createMockUser(),
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  });

  it('returns true when user has at least one permission', () => {
    const { result } = renderHook(() => useHasAnyPermission(['requisition.view', 'admin.full_access']));
    expect(result.current).toBe(true);
  });

  it('returns false when user has none of the permissions', () => {
    const { result } = renderHook(() => useHasAnyPermission(['admin.full_access', 'user.delete']));
    expect(result.current).toBe(false);
  });
});

describe('useHasAllPermissions', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: createMockUser(),
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  });

  it('returns true when user has all permissions', () => {
    const { result } = renderHook(() => useHasAllPermissions(['requisition.view', 'requisition.create']));
    expect(result.current).toBe(true);
  });

  it('returns false when user is missing any permission', () => {
    const { result } = renderHook(() => useHasAllPermissions(['requisition.view', 'admin.full_access']));
    expect(result.current).toBe(false);
  });
});
