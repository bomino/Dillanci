/**
 * ProtectedRoute Component Tests
 *
 * Tests the route protection logic for RBAC-based access control.
 * Uses lightweight mocks to avoid memory issues on Windows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import type { User, UserRole } from '@/types';

// Mock ProtectedRoute components to test logic without heavy imports
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to}>Redirecting to {to}</div>,
  };
});

// Import after mocking
import { ProtectedRoute, RequirePermission, RequireAdmin } from './ProtectedRoute';

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

// Wrapper component for routing
const TestWrapper = ({ children, initialEntry = '/' }: { children: React.ReactNode; initialEntry?: string }) => (
  <MemoryRouter initialEntries={[initialEntry]}>
    {children}
  </MemoryRouter>
);

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  describe('when loading', () => {
    it('shows loading state', () => {
      useAuthStore.setState({ isLoading: true });

      render(
        <TestWrapper>
          <ProtectedRoute>
            <div>Protected</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.queryByText('Protected')).not.toBeInTheDocument();
    });
  });

  describe('when not authenticated', () => {
    it('redirects to login', () => {
      render(
        <TestWrapper initialEntry="/protected">
          <ProtectedRoute>
            <div>Protected</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      const navigate = screen.getByTestId('navigate');
      expect(navigate).toHaveAttribute('data-to', '/login');
    });
  });

  describe('when authenticated', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    });

    it('renders children when no permission required', () => {
      render(
        <TestWrapper>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('renders children when user has permission', () => {
      render(
        <TestWrapper>
          <ProtectedRoute permission="requisition.view">
            <div>Protected Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('redirects when user lacks permission', () => {
      render(
        <TestWrapper initialEntry="/admin">
          <ProtectedRoute permission="admin.full_access" redirectTo="/dashboard">
            <div>Admin Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    });

    it('renders children when user has any of required permissions', () => {
      render(
        <TestWrapper>
          <ProtectedRoute anyPermission={['admin.full_access', 'requisition.view']}>
            <div>Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('renders children when user has all required permissions', () => {
      render(
        <TestWrapper>
          <ProtectedRoute allPermissions={['requisition.view', 'requisition.create']}>
            <div>Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('shows custom access denied component', () => {
      render(
        <TestWrapper>
          <ProtectedRoute
            permission="admin.full_access"
            accessDeniedComponent={<div>No Access</div>}
          >
            <div>Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByText('No Access')).toBeInTheDocument();
    });
  });

  describe('superuser access', () => {
    it('allows superuser access for admin routes', () => {
      useAuthStore.setState({
        user: createMockUser({ is_superuser: true, permissions: [] }),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      render(
        <TestWrapper>
          <ProtectedRoute requireAdmin>
            <div>Admin Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });

    it('allows staff access for admin routes', () => {
      useAuthStore.setState({
        user: createMockUser({ is_staff: true, permissions: [] }),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      render(
        <TestWrapper>
          <ProtectedRoute requireAdmin>
            <div>Admin Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });
  });
});

describe('RequirePermission', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: createMockUser(),
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  });

  it('renders children when user has permission', () => {
    render(
      <TestWrapper>
        <RequirePermission permission="requisition.view">
          <button>Action</button>
        </RequirePermission>
      </TestWrapper>
    );

    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('renders fallback when user lacks permission', () => {
    render(
      <TestWrapper>
        <RequirePermission permission="admin.full_access" fallback={<span>No Access</span>}>
          <button>Action</button>
        </RequirePermission>
      </TestWrapper>
    );

    expect(screen.getByText('No Access')).toBeInTheDocument();
    expect(screen.queryByText('Action')).not.toBeInTheDocument();
  });
});

describe('RequireAdmin', () => {
  it('renders children for superuser', () => {
    useAuthStore.setState({
      user: createMockUser({ is_superuser: true }),
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    render(
      <TestWrapper>
        <RequireAdmin>
          <button>Admin Action</button>
        </RequireAdmin>
      </TestWrapper>
    );

    expect(screen.getByText('Admin Action')).toBeInTheDocument();
  });

  it('renders fallback for non-admin', () => {
    useAuthStore.setState({
      user: createMockUser({ is_superuser: false, is_staff: false, permissions: [] }),
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    render(
      <TestWrapper>
        <RequireAdmin fallback={<span>Not Admin</span>}>
          <button>Admin Action</button>
        </RequireAdmin>
      </TestWrapper>
    );

    expect(screen.getByText('Not Admin')).toBeInTheDocument();
  });
});
