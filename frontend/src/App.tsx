import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { DashboardLayout } from '@/components/layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Permissions } from '@/types';

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
        <ErrorBoundary>
          <AuthProvider>
            <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes - all require authentication */}
            <Route element={<DashboardLayout />}>
              {/* Dashboard - accessible to all authenticated users */}
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Requisitions */}
              <Route path="/requisitions" element={
                <ProtectedRoute anyPermission={[Permissions.REQUISITION_VIEW, Permissions.REQUISITION_CREATE]}>
                  <RequisitionsPage />
                </ProtectedRoute>
              } />
              <Route path="/requisitions/new" element={
                <ProtectedRoute permission={Permissions.REQUISITION_CREATE}>
                  <CreateRequisitionPage />
                </ProtectedRoute>
              } />
              <Route path="/requisitions/:id" element={
                <ProtectedRoute permission={Permissions.REQUISITION_VIEW}>
                  <RequisitionDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/requisitions/:id/edit" element={
                <ProtectedRoute permission={Permissions.REQUISITION_EDIT}>
                  <RequisitionDetailPage />
                </ProtectedRoute>
              } />

              {/* RFQs */}
              <Route path="/rfqs" element={
                <ProtectedRoute anyPermission={[Permissions.RFQ_VIEW, Permissions.RFQ_CREATE]}>
                  <RFQsPage />
                </ProtectedRoute>
              } />
              <Route path="/rfqs/new" element={
                <ProtectedRoute permission={Permissions.RFQ_CREATE}>
                  <CreateRFQPage />
                </ProtectedRoute>
              } />
              <Route path="/rfqs/:id" element={
                <ProtectedRoute permission={Permissions.RFQ_VIEW}>
                  <RFQDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/rfqs/:id/edit" element={
                <ProtectedRoute permission={Permissions.RFQ_EDIT}>
                  <RFQDetailPage />
                </ProtectedRoute>
              } />

              {/* RFPs */}
              <Route path="/rfps" element={
                <ProtectedRoute anyPermission={[Permissions.RFP_VIEW, Permissions.RFP_CREATE]}>
                  <RFPsPage />
                </ProtectedRoute>
              } />
              <Route path="/rfps/new" element={
                <ProtectedRoute permission={Permissions.RFP_CREATE}>
                  <CreateRFPPage />
                </ProtectedRoute>
              } />
              <Route path="/rfps/:id" element={
                <ProtectedRoute permission={Permissions.RFP_VIEW}>
                  <RFPDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/rfps/:id/edit" element={
                <ProtectedRoute permission={Permissions.RFP_EDIT}>
                  <RFPDetailPage />
                </ProtectedRoute>
              } />

              {/* Purchase Orders */}
              <Route path="/purchase-orders" element={
                <ProtectedRoute anyPermission={[Permissions.PO_VIEW, Permissions.PO_CREATE]}>
                  <PurchaseOrdersPage />
                </ProtectedRoute>
              } />
              <Route path="/purchase-orders/new" element={
                <ProtectedRoute permission={Permissions.PO_CREATE}>
                  <CreatePOPage />
                </ProtectedRoute>
              } />
              <Route path="/purchase-orders/:id" element={
                <ProtectedRoute permission={Permissions.PO_VIEW}>
                  <PODetailPage />
                </ProtectedRoute>
              } />
              <Route path="/purchase-orders/:id/edit" element={
                <ProtectedRoute permission={Permissions.PO_EDIT}>
                  <PODetailPage />
                </ProtectedRoute>
              } />

              {/* Receiving */}
              <Route path="/receiving" element={
                <ProtectedRoute anyPermission={[Permissions.RECEIVING_VIEW, Permissions.RECEIVING_CREATE]}>
                  <ReceivingPage />
                </ProtectedRoute>
              } />
              <Route path="/receiving/new" element={
                <ProtectedRoute permission={Permissions.RECEIVING_CREATE}>
                  <CreateReceivingPage />
                </ProtectedRoute>
              } />
              <Route path="/receiving/:id" element={
                <ProtectedRoute permission={Permissions.RECEIVING_VIEW}>
                  <ReceivingDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/receiving/:id/edit" element={
                <ProtectedRoute permission={Permissions.RECEIVING_EDIT}>
                  <ReceivingDetailPage />
                </ProtectedRoute>
              } />

              {/* Invoices */}
              <Route path="/invoices" element={
                <ProtectedRoute anyPermission={[Permissions.INVOICE_VIEW, Permissions.INVOICE_CREATE]}>
                  <InvoicesPage />
                </ProtectedRoute>
              } />
              <Route path="/invoices/new" element={
                <ProtectedRoute permission={Permissions.INVOICE_CREATE}>
                  <CreateInvoicePage />
                </ProtectedRoute>
              } />
              <Route path="/invoices/:id" element={
                <ProtectedRoute permission={Permissions.INVOICE_VIEW}>
                  <InvoiceDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/invoices/:id/edit" element={
                <ProtectedRoute permission={Permissions.INVOICE_EDIT}>
                  <InvoiceDetailPage />
                </ProtectedRoute>
              } />

              {/* Suppliers */}
              <Route path="/suppliers" element={
                <ProtectedRoute anyPermission={[Permissions.SUPPLIER_VIEW, Permissions.SUPPLIER_CREATE]}>
                  <SuppliersPage />
                </ProtectedRoute>
              } />
              <Route path="/suppliers/new" element={
                <ProtectedRoute permission={Permissions.SUPPLIER_CREATE}>
                  <CreateSupplierPage />
                </ProtectedRoute>
              } />
              <Route path="/suppliers/:id" element={
                <ProtectedRoute permission={Permissions.SUPPLIER_VIEW}>
                  <SupplierDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/suppliers/:id/edit" element={
                <ProtectedRoute permission={Permissions.SUPPLIER_EDIT}>
                  <SupplierDetailPage />
                </ProtectedRoute>
              } />

              {/* Contracts */}
              <Route path="/contracts" element={
                <ProtectedRoute anyPermission={[Permissions.CONTRACT_VIEW, Permissions.CONTRACT_CREATE]}>
                  <ContractsPage />
                </ProtectedRoute>
              } />
              <Route path="/contracts/new" element={
                <ProtectedRoute permission={Permissions.CONTRACT_CREATE}>
                  <CreateContractPage />
                </ProtectedRoute>
              } />
              <Route path="/contracts/:id" element={
                <ProtectedRoute permission={Permissions.CONTRACT_VIEW}>
                  <ContractDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/contracts/:id/edit" element={
                <ProtectedRoute permission={Permissions.CONTRACT_EDIT}>
                  <ContractDetailPage />
                </ProtectedRoute>
              } />

              {/* Reports */}
              <Route path="/reports" element={
                <ProtectedRoute permission={Permissions.REPORT_VIEW}>
                  <ReportsPage />
                </ProtectedRoute>
              } />

              {/* Settings & Profile - accessible to all authenticated users */}
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              {/* Admin routes - protected by specific permissions */}
              <Route path="/admin/users" element={
                <ProtectedRoute anyPermission={[Permissions.USER_VIEW, Permissions.USER_ASSIGN_ROLES]} requireAdmin>
                  <UsersPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/users/:id" element={
                <ProtectedRoute anyPermission={[Permissions.USER_VIEW, Permissions.USER_ASSIGN_ROLES]} requireAdmin>
                  <UserDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/roles" element={
                <ProtectedRoute permission={Permissions.ADMIN_MANAGE_ROLES} requireAdmin>
                  <RolesPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/roles/:id" element={
                <ProtectedRoute permission={Permissions.ADMIN_MANAGE_ROLES} requireAdmin>
                  <RoleDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/audit-logs" element={
                <ProtectedRoute permission={Permissions.AUDIT_VIEW} requireAdmin>
                  <AuditLogsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/workflows" element={
                <ProtectedRoute permission={Permissions.ORG_MANAGE_SETTINGS} requireAdmin>
                  <WorkflowsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/organization" element={
                <ProtectedRoute anyPermission={[Permissions.ORG_VIEW, Permissions.ORG_EDIT]} requireAdmin>
                  <AdminSettingsPage />
                </ProtectedRoute>
              } />
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
        </ErrorBoundary>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
