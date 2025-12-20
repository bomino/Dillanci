import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './auth-store';
import { authApi } from '@/lib/api/auth';
import type { User, UserRole } from '@/types';

// Mock the auth API
vi.mock('@/lib/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    fetchUserPermissions: vi.fn(),
    fetchUserRoles: vi.fn(),
  },
}));

// Helper to create a mock user
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  is_active: true,
  organization: 'test-org-id',
  permissions: ['requisition.view', 'requisition.create'],
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

describe('auth-store', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('has correct initial state', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('login', () => {
    it('sets loading state during login', async () => {
      const mockUser = createMockUser();
      vi.mocked(authApi.login).mockResolvedValue(mockUser);
      vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

      const loginPromise = useAuthStore.getState().login({
        email: 'test@example.com',
        password: 'password123',
      });

      // Check loading state was set
      expect(useAuthStore.getState().isLoading).toBe(true);

      await loginPromise;
    });

    it('updates state on successful login', async () => {
      const mockUser = createMockUser();
      vi.mocked(authApi.login).mockResolvedValue(mockUser);
      vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

      await useAuthStore.getState().login({
        email: 'test@example.com',
        password: 'password123',
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('calls authApi.login with credentials', async () => {
      const mockUser = createMockUser();
      const credentials = { email: 'test@example.com', password: 'password123' };

      vi.mocked(authApi.login).mockResolvedValue(mockUser);
      vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

      await useAuthStore.getState().login(credentials);

      expect(authApi.login).toHaveBeenCalledWith(credentials);
    });

    it('fetches full user after login', async () => {
      const mockUser = createMockUser();
      vi.mocked(authApi.login).mockResolvedValue(mockUser);
      vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

      await useAuthStore.getState().login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(authApi.getCurrentUser).toHaveBeenCalled();
    });

    it('sets error state on login failure', async () => {
      const error = new Error('Invalid credentials');
      vi.mocked(authApi.login).mockRejectedValue(error);

      await expect(
        useAuthStore.getState().login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Invalid credentials');
    });

    it('clears previous error on new login attempt', async () => {
      // First, set an error state
      useAuthStore.setState({ error: 'Previous error' });

      const mockUser = createMockUser();
      vi.mocked(authApi.login).mockResolvedValue(mockUser);
      vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

      await useAuthStore.getState().login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      // Set up authenticated state
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    });

    it('clears user state on logout', async () => {
      vi.mocked(authApi.logout).mockResolvedValue(undefined);

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('calls authApi.logout', async () => {
      vi.mocked(authApi.logout).mockResolvedValue(undefined);

      await useAuthStore.getState().logout();

      expect(authApi.logout).toHaveBeenCalled();
    });

    it('clears state even if API call fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(authApi.logout).mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);

      consoleError.mockRestore();
    });
  });

  describe('checkAuth', () => {
    it('sets authenticated state when user is logged in', async () => {
      const mockUser = createMockUser();
      vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('clears state when not authenticated', async () => {
      vi.mocked(authApi.getCurrentUser).mockRejectedValue(new Error('Not authenticated'));

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull(); // Should not show error for auth check failures
    });

    it('sets loading state during check', async () => {
      vi.mocked(authApi.getCurrentUser).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockUser()), 100))
      );

      const checkPromise = useAuthStore.getState().checkAuth();

      // Check loading state was set
      expect(useAuthStore.getState().isLoading).toBe(true);

      await checkPromise;
    });
  });

  describe('refreshPermissions', () => {
    it('updates user permissions and roles', async () => {
      const mockUser = createMockUser();
      const newPermissions = ['admin.full_access', 'user.create'];
      const newRoles: UserRole[] = [
        {
          id: 'role-2',
          user: 'test-user-id',
          role: 'admin-role-id',
          role_name: 'Admin',
          role_code: 'ADMIN',
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
        },
      ];

      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      vi.mocked(authApi.fetchUserPermissions).mockResolvedValue(newPermissions);
      vi.mocked(authApi.fetchUserRoles).mockResolvedValue(newRoles);

      await useAuthStore.getState().refreshPermissions();

      const state = useAuthStore.getState();
      expect(state.user?.permissions).toEqual(newPermissions);
      expect(state.user?.roles).toEqual(newRoles);
    });

    it('does nothing if no user is logged in', async () => {
      await useAuthStore.getState().refreshPermissions();

      expect(authApi.fetchUserPermissions).not.toHaveBeenCalled();
      expect(authApi.fetchUserRoles).not.toHaveBeenCalled();
    });

    it('handles errors gracefully', async () => {
      const mockUser = createMockUser();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      vi.mocked(authApi.fetchUserPermissions).mockRejectedValue(new Error('Network error'));
      vi.mocked(authApi.fetchUserRoles).mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().refreshPermissions();

      // User should remain unchanged
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);

      consoleError.mockRestore();
    });
  });

  describe('updateUser', () => {
    it('updates user data locally', () => {
      const mockUser = createMockUser();
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      useAuthStore.getState().updateUser({
        first_name: 'Updated',
        last_name: 'Name',
      });

      const state = useAuthStore.getState();
      expect(state.user?.first_name).toBe('Updated');
      expect(state.user?.last_name).toBe('Name');
      expect(state.user?.email).toBe(mockUser.email); // Other fields unchanged
    });

    it('does nothing if no user is logged in', () => {
      useAuthStore.getState().updateUser({
        first_name: 'Updated',
      });

      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('clearError', () => {
    it('clears the error state', () => {
      useAuthStore.setState({ error: 'Some error' });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
