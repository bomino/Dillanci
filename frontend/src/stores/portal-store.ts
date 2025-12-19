/**
 * Portal auth store for supplier portal.
 *
 * Manages authentication state for portal users separately from
 * the main app auth store.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PortalUser, PortalSupplier } from '@/lib/api/portal';

interface PortalState {
  // Auth state
  isAuthenticated: boolean;
  user: PortalUser | null;
  supplier: PortalSupplier | null;

  // Actions
  setAuth: (user: PortalUser, supplier: PortalSupplier) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<PortalUser>) => void;
  updateSupplier: (supplier: Partial<PortalSupplier>) => void;
}

export const usePortalStore = create<PortalState>()(
  persist(
    (set) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      supplier: null,

      // Set auth after login
      setAuth: (user, supplier) =>
        set({
          isAuthenticated: true,
          user,
          supplier,
        }),

      // Clear auth on logout
      clearAuth: () =>
        set({
          isAuthenticated: false,
          user: null,
          supplier: null,
        }),

      // Update user profile
      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      // Update supplier profile
      updateSupplier: (supplierData) =>
        set((state) => ({
          supplier: state.supplier ? { ...state.supplier, ...supplierData } : null,
        })),
    }),
    {
      name: 'portal-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        supplier: state.supplier,
      }),
    }
  )
);

// Selector hooks for convenience
export const usePortalUser = () => usePortalStore((state) => state.user);
export const usePortalSupplier = () => usePortalStore((state) => state.supplier);
export const usePortalIsAuthenticated = () => usePortalStore((state) => state.isAuthenticated);
