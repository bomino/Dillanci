import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { DashboardLayout } from '@/components/layout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { SuppliersPage, SupplierDetailPage, CreateSupplierPage } from '@/pages/suppliers';
import { Toaster } from '@/components/ui/toast';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Auth check component
function AuthProvider({ children }: { children: React.ReactNode }) {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return <>{children}</>;
}

// Placeholder pages for routes
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
      <p className="text-neutral-500">This page is under construction.</p>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes */}
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/requisitions" element={<PlaceholderPage title="Requisitions" />} />
              <Route path="/rfqs" element={<PlaceholderPage title="RFQs" />} />
              <Route path="/rfps" element={<PlaceholderPage title="RFPs" />} />
              <Route path="/purchase-orders" element={<PlaceholderPage title="Purchase Orders" />} />
              <Route path="/receiving" element={<PlaceholderPage title="Receiving" />} />
              <Route path="/invoices" element={<PlaceholderPage title="Invoices" />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/suppliers/new" element={<CreateSupplierPage />} />
              <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
              <Route path="/suppliers/:id/edit" element={<SupplierDetailPage />} />
              <Route path="/contracts" element={<PlaceholderPage title="Contracts" />} />
              <Route path="/reports" element={<PlaceholderPage title="Reports" />} />
              <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
              <Route path="/profile" element={<PlaceholderPage title="Profile" />} />
            </Route>

            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* 404 */}
            <Route
              path="*"
              element={
                <div className="min-h-screen flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-neutral-900">404</h1>
                    <p className="text-neutral-500 mt-2">Page not found</p>
                  </div>
                </div>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
