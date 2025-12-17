import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { DashboardLayout } from '@/components/layout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { SuppliersPage, SupplierDetailPage, CreateSupplierPage } from '@/pages/suppliers';
import { RequisitionsPage, RequisitionDetailPage, CreateRequisitionPage } from '@/pages/requisitions';
import { RFQsPage, RFQDetailPage, CreateRFQPage } from '@/pages/rfqs';
import { PurchaseOrdersPage, PODetailPage, CreatePOPage } from '@/pages/purchase-orders';
import { ReceivingPage, ReceivingDetailPage, CreateReceivingPage } from '@/pages/receiving';
import { InvoicesPage, InvoiceDetailPage, CreateInvoicePage } from '@/pages/invoices';
import { ContractsPage, ContractDetailPage, CreateContractPage } from '@/pages/contracts';
import { RFPsPage, RFPDetailPage, CreateRFPPage } from '@/pages/rfps';
import { ReportsPage } from '@/pages/reports';
import { SettingsPage } from '@/pages/settings';
import { ProfilePage } from '@/pages/profile';
import { Toaster } from '@/components/ui/toast';

// Admin Pages
import { UsersPage, UserDetailPage } from '@/pages/admin/users';
import { RolesPage, RoleDetailPage } from '@/pages/admin/roles';
import { AuditLogsPage } from '@/pages/admin/audit';
import { WorkflowsPage } from '@/pages/admin/workflows';
import { AdminSettingsPage } from '@/pages/admin/settings';

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
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return <>{children}</>;
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
              <Route path="/requisitions" element={<RequisitionsPage />} />
              <Route path="/requisitions/new" element={<CreateRequisitionPage />} />
              <Route path="/requisitions/:id" element={<RequisitionDetailPage />} />
              <Route path="/requisitions/:id/edit" element={<RequisitionDetailPage />} />
              <Route path="/rfqs" element={<RFQsPage />} />
              <Route path="/rfqs/new" element={<CreateRFQPage />} />
              <Route path="/rfqs/:id" element={<RFQDetailPage />} />
              <Route path="/rfqs/:id/edit" element={<RFQDetailPage />} />
              <Route path="/rfps" element={<RFPsPage />} />
              <Route path="/rfps/new" element={<CreateRFPPage />} />
              <Route path="/rfps/:id" element={<RFPDetailPage />} />
              <Route path="/rfps/:id/edit" element={<RFPDetailPage />} />
              <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
              <Route path="/purchase-orders/new" element={<CreatePOPage />} />
              <Route path="/purchase-orders/:id" element={<PODetailPage />} />
              <Route path="/purchase-orders/:id/edit" element={<PODetailPage />} />
              <Route path="/receiving" element={<ReceivingPage />} />
              <Route path="/receiving/new" element={<CreateReceivingPage />} />
              <Route path="/receiving/:id" element={<ReceivingDetailPage />} />
              <Route path="/receiving/:id/edit" element={<ReceivingDetailPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/invoices/new" element={<CreateInvoicePage />} />
              <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="/invoices/:id/edit" element={<InvoiceDetailPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/suppliers/new" element={<CreateSupplierPage />} />
              <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
              <Route path="/suppliers/:id/edit" element={<SupplierDetailPage />} />
              <Route path="/contracts" element={<ContractsPage />} />
              <Route path="/contracts/new" element={<CreateContractPage />} />
              <Route path="/contracts/:id" element={<ContractDetailPage />} />
              <Route path="/contracts/:id/edit" element={<ContractDetailPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              {/* Admin routes */}
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/users/:id" element={<UserDetailPage />} />
              <Route path="/admin/roles" element={<RolesPage />} />
              <Route path="/admin/roles/:id" element={<RoleDetailPage />} />
              <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
              <Route path="/admin/workflows" element={<WorkflowsPage />} />
              <Route path="/admin/organization" element={<AdminSettingsPage />} />
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
