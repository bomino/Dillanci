import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginCredentials } from '@/types';
import { authApi } from '@/lib/api/auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  /** Refresh user's permissions and roles from the backend */
  refreshPermissions: () => Promise<void>;
  /** Update user data locally (for optimistic updates) */
  updateUser: (updates: Partial<User>) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      // Login action
      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.login(credentials);
          // After login, fetch full user with permissions
          const fullUser = await authApi.getCurrentUser();
          set({
            user: fullUser,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      // Logout action
      logout: async () => {
        set({ isLoading: true });
        try {
          await authApi.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      // Check authentication status
      checkAuth: async () => {
        // Always verify with the backend to ensure session is valid
        set({ isLoading: true });
        try {
          const user = await authApi.getCurrentUser();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch {
          // Session invalid or expired - clear local state
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null, // Don't show error for auth check failures
          });
        }
      },

      // Refresh permissions (useful after role changes)
      refreshPermissions: async () => {
        const { user } = get();
        if (!user) return;

        try {
          const [permissions, roles] = await Promise.all([
            authApi.fetchUserPermissions(user.id),
            authApi.fetchUserRoles(user.id),
          ]);

          set({
            user: {
              ...user,
              permissions,
              roles,
            },
          });
        } catch (error) {
          console.error('Failed to refresh permissions:', error);
        }
      },

      // Update user data locally
      updateUser: (updates) => {
        const { user } = get();
        if (!user) return;

        set({
          user: {
            ...user,
            ...updates,
          },
        });
      },

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'dillanci-auth',
      // Only persist user data, not loading/error states
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
