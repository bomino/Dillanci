import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// Check if we're in mock mode (no backend available)
const MOCK_MODE = import.meta.env.VITE_MOCK_API === 'true';

// =============================================================================
// Mock Data
// =============================================================================

const mockSystemPreferences: SystemPreference[] = [
  {
    id: 'pref-1',
    organization: 'org-1',
    key: 'organization.name',
    value: 'Dillanci Demo',
    typed_value: 'Dillanci Demo',
    value_type: 'STRING',
    category: 'GENERAL',
    label: 'Organization Name',
    description: 'The display name for your organization',
    is_secret: false,
    is_editable: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'pref-2',
    organization: 'org-1',
    key: 'organization.timezone',
    value: 'America/New_York',
    typed_value: 'America/New_York',
    value_type: 'STRING',
    category: 'GENERAL',
    label: 'Default Timezone',
    description: 'Default timezone for displaying dates and times',
    is_secret: false,
    is_editable: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'pref-3',
    organization: 'org-1',
    key: 'organization.currency',
    value: 'USD',
    typed_value: 'USD',
    value_type: 'STRING',
    category: 'GENERAL',
    label: 'Default Currency',
    description: 'Default currency for financial transactions',
    is_secret: false,
    is_editable: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

const mockAPIKeys: APIKey[] = [
  {
    id: 'key-1',
    organization: 'org-1',
    name: 'Production API Key',
    key_prefix: 'dk_prod_xxx',
    scopes: ['read', 'write'],
    rate_limit: 1000,
    expires_at: null,
    last_used_at: '2025-12-15T10:30:00Z',
    is_active: true,
    is_expired: false,
    is_valid: true,
    created_by: 'user-1',
    created_by_email: 'admin@dillanci.com',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'key-2',
    organization: 'org-1',
    name: 'Development API Key',
    key_prefix: 'dk_dev_xxx',
    scopes: ['read'],
    rate_limit: 100,
    expires_at: '2026-01-01T00:00:00Z',
    last_used_at: null,
    is_active: true,
    is_expired: false,
    is_valid: true,
    created_by: 'user-1',
    created_by_email: 'admin@dillanci.com',
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
  },
];

const mockApprovalThresholds: Record<string, ApprovalThreshold[]> = {
  REQUISITION: [
    {
      id: 'thresh-req-1',
      organization: 'org-1',
      organization_name: 'Dillanci Demo',
      document_type: 'REQUISITION',
      min_amount: '0.00',
      max_amount: '5000.00',
      currency: 'USD',
      required_role: null,
      required_role_name: null,
      auto_approve: true,
      require_budget_check: true,
      escalation_hours: 24,
      escalation_role: null,
      escalation_role_name: null,
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'thresh-req-2',
      organization: 'org-1',
      organization_name: 'Dillanci Demo',
      document_type: 'REQUISITION',
      min_amount: '5000.01',
      max_amount: '25000.00',
      currency: 'USD',
      required_role: 'role-budget-holder',
      required_role_name: 'Budget Holder',
      auto_approve: false,
      require_budget_check: true,
      escalation_hours: 48,
      escalation_role: 'role-finance-mgr',
      escalation_role_name: 'Finance Manager',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'thresh-req-3',
      organization: 'org-1',
      organization_name: 'Dillanci Demo',
      document_type: 'REQUISITION',
      min_amount: '25000.01',
      max_amount: null,
      currency: 'USD',
      required_role: 'role-finance-mgr',
      required_role_name: 'Finance Manager',
      auto_approve: false,
      require_budget_check: true,
      escalation_hours: 72,
      escalation_role: 'role-org-admin',
      escalation_role_name: 'Organization Admin',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ],
  PURCHASE_ORDER: [
    {
      id: 'thresh-po-1',
      organization: 'org-1',
      organization_name: 'Dillanci Demo',
      document_type: 'PURCHASE_ORDER',
      min_amount: '0.00',
      max_amount: '10000.00',
      currency: 'USD',
      required_role: 'role-proc-officer',
      required_role_name: 'Procurement Officer',
      auto_approve: false,
      require_budget_check: true,
      escalation_hours: 24,
      escalation_role: 'role-proc-mgr',
      escalation_role_name: 'Procurement Manager',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'thresh-po-2',
      organization: 'org-1',
      organization_name: 'Dillanci Demo',
      document_type: 'PURCHASE_ORDER',
      min_amount: '10000.01',
      max_amount: '50000.00',
      currency: 'USD',
      required_role: 'role-proc-mgr',
      required_role_name: 'Procurement Manager',
      auto_approve: false,
      require_budget_check: true,
      escalation_hours: 48,
      escalation_role: 'role-finance-mgr',
      escalation_role_name: 'Finance Manager',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ],
  INVOICE: [
    {
      id: 'thresh-inv-1',
      organization: 'org-1',
      organization_name: 'Dillanci Demo',
      document_type: 'INVOICE',
      min_amount: '0.00',
      max_amount: '5000.00',
      currency: 'USD',
      required_role: 'role-ap-clerk',
      required_role_name: 'Accounts Payable',
      auto_approve: false,
      require_budget_check: false,
      escalation_hours: 24,
      escalation_role: 'role-finance-mgr',
      escalation_role_name: 'Finance Manager',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'thresh-inv-2',
      organization: 'org-1',
      organization_name: 'Dillanci Demo',
      document_type: 'INVOICE',
      min_amount: '5000.01',
      max_amount: null,
      currency: 'USD',
      required_role: 'role-finance-mgr',
      required_role_name: 'Finance Manager',
      auto_approve: false,
      require_budget_check: false,
      escalation_hours: 48,
      escalation_role: 'role-org-admin',
      escalation_role_name: 'Organization Admin',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ],
  CONTRACT: [
    {
      id: 'thresh-con-1',
      organization: 'org-1',
      organization_name: 'Dillanci Demo',
      document_type: 'CONTRACT',
      min_amount: '0.00',
      max_amount: null,
      currency: 'USD',
      required_role: 'role-proc-mgr',
      required_role_name: 'Procurement Manager',
      auto_approve: false,
      require_budget_check: true,
      escalation_hours: 72,
      escalation_role: 'role-org-admin',
      escalation_role_name: 'Organization Admin',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ],
};

// =============================================================================
// Types
// =============================================================================

export interface Permission {
  code: string;
  label: string;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  role_type: 'SYSTEM' | 'ORGANIZATION' | 'CUSTOM';
  organization: string | null;
  organization_name: string | null;
  permissions: Permission[];
  permissions_grouped: PermissionGroup[];
  parent_role: string | null;
  approval_limit: string | null;
  currency: string;
  is_active: boolean;
  is_system_role: boolean;
  user_count: number;
  permission_count: number;
  created_at: string;
  updated_at: string;
}

export interface RolePreset {
  name: string;
  description: string;
  permissions: string[];
}

export interface UserRole {
  id: string;
  user: string;
  user_email: string;
  user_name: string;
  role: string;
  role_name: string;
  role_code: string;
  valid_from: string;
  valid_to: string | null;
  delegated_by: string | null;
  delegation_reason: string;
  custom_approval_limit: string | null;
  effective_approval_limit: string | null;
  assigned_by: string | null;
  is_active: boolean;
  is_valid: boolean;
  is_delegated: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface UserWithRoles {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  employee_id: string | null;
  organization: string;
  organization_name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
  roles: {
    id: string;
    role_id: string;
    role_name: string;
    role_code: string;
    valid_from: string;
    valid_to: string | null;
    is_delegated: boolean;
    approval_limit: string | null;
  }[];
  permissions: string[];
}

export interface PermissionGroup {
  module: string;
  label: string;
  permissions: {
    code: string;
    label: string;
  }[];
}

export interface RoleChangeLog {
  id: string;
  user: string;
  user_email: string;
  role: string | null;
  role_name: string;
  action: string;
  performed_by: string | null;
  performed_by_email: string | null;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  reason: string;
  ip_address: string | null;
  created_at: string;
}

export interface ApprovalThreshold {
  id: string;
  organization: string;
  organization_name: string;
  document_type: 'REQUISITION' | 'PURCHASE_ORDER' | 'INVOICE' | 'CONTRACT';
  min_amount: string;
  max_amount: string | null;
  currency: string;
  required_role: string | null;
  required_role_name: string | null;
  auto_approve: boolean;
  require_budget_check: boolean;
  escalation_hours: number;
  escalation_role: string | null;
  escalation_role_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemPreference {
  id: string;
  organization: string;
  key: string;
  value: string;
  typed_value: unknown;
  value_type: 'STRING' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'JSON';
  category: 'GENERAL' | 'NOTIFICATIONS' | 'SECURITY' | 'WORKFLOW' | 'INTEGRATION';
  label: string;
  description: string;
  is_secret: boolean;
  is_editable: boolean;
  created_at: string;
  updated_at: string;
}

export interface APIKey {
  id: string;
  organization: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit: number;
  expires_at: string | null;
  last_used_at: string | null;
  is_active: boolean;
  is_expired: boolean;
  is_valid: boolean;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
}

export interface RoleStats {
  system_roles: number;
  organization_roles: number;
  custom_roles: number;
  total_assignments: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// =============================================================================
// API Functions - Users
// =============================================================================

export async function fetchUsers(params?: Record<string, string>): Promise<PaginatedResponse<UserWithRoles>> {
  const response = await apiClient.get('/users/', { params });
  return response.data;
}

export async function fetchUser(id: string): Promise<UserWithRoles> {
  const response = await apiClient.get(`/users/${id}/`);
  return response.data;
}

export async function fetchUserStats(): Promise<UserStats> {
  const response = await apiClient.get('/users/stats/');
  return response.data;
}

export async function fetchUserRoles(userId: string): Promise<UserRole[]> {
  try {
    const response = await apiClient.get(`/users/${userId}/roles/`);
    // Handle both array response and paginated response with results
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (response.data?.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    // Return empty array if response format is unexpected
    return [];
  } catch {
    // Return empty array if endpoint fails
    return [];
  }
}

export async function fetchUserPermissions(userId: string): Promise<{ permissions: string[] }> {
  const response = await apiClient.get(`/users/${userId}/permissions/`);
  return response.data;
}

export async function activateUser(id: string): Promise<UserWithRoles> {
  const response = await apiClient.post(`/users/${id}/activate/`);
  return response.data;
}

export async function deactivateUser(id: string): Promise<UserWithRoles> {
  const response = await apiClient.post(`/users/${id}/deactivate/`);
  return response.data;
}

export async function suspendUser(id: string): Promise<UserWithRoles> {
  const response = await apiClient.post(`/users/${id}/suspend/`);
  return response.data;
}

export async function assignRole(
  userId: string,
  data: { role_id: string; valid_from?: string; valid_to?: string | null; custom_approval_limit?: string | null; notes?: string }
): Promise<UserRole> {
  const response = await apiClient.post(`/users/${userId}/assign-role/`, data);
  return response.data;
}

export async function removeRole(userId: string, roleId: string, reason?: string): Promise<{ message: string }> {
  const response = await apiClient.post(`/users/${userId}/remove-role/`, { role_id: roleId, reason });
  return response.data;
}

export async function inviteUser(data: {
  email: string;
  first_name: string;
  last_name: string;
  role_ids?: string[];
}): Promise<{ user: UserWithRoles; message: string; temp_password?: string }> {
  const response = await apiClient.post('/users/invite/', data);
  return response.data;
}

// =============================================================================
// API Functions - Roles
// =============================================================================

export async function fetchRoles(params?: Record<string, string>): Promise<PaginatedResponse<Role>> {
  const response = await apiClient.get('/roles/', { params });
  return response.data;
}

export async function fetchRole(id: string): Promise<Role> {
  const response = await apiClient.get(`/roles/${id}/`);
  return response.data;
}

export async function fetchRoleStats(): Promise<RoleStats> {
  const response = await apiClient.get('/roles/stats/');
  return response.data;
}

export async function fetchRolePresets(): Promise<RolePreset[]> {
  const response = await apiClient.get('/roles/presets/');
  return response.data;
}

export async function fetchRoleUsers(roleId: string): Promise<UserRole[]> {
  const response = await apiClient.get(`/roles/${roleId}/users/`);
  return response.data;
}

export async function fetchPermissions(): Promise<PermissionGroup[]> {
  const response = await apiClient.get('/roles/permissions/');
  return response.data;
}

export async function createRole(data: {
  name: string;
  code: string;
  description?: string;
  permissions: string[];
  approval_limit?: string | null;
  currency?: string;
}): Promise<Role> {
  const response = await apiClient.post('/roles/', data);
  return response.data;
}

export async function createRoleFromPreset(presetName: string, customName?: string): Promise<Role> {
  const response = await apiClient.post('/roles/from-preset/', {
    preset_name: presetName,
    name: customName,
  });
  return response.data;
}

export async function updateRole(id: string, data: Partial<Role>): Promise<Role> {
  const response = await apiClient.patch(`/roles/${id}/`, data);
  return response.data;
}

export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete(`/roles/${id}/`);
}

// =============================================================================
// API Functions - Role Change Logs
// =============================================================================

export async function fetchRoleChangeLogs(params?: Record<string, string>): Promise<PaginatedResponse<RoleChangeLog>> {
  const response = await apiClient.get('/role-changes/', { params });
  return response.data;
}

// =============================================================================
// API Functions - Approval Thresholds
// =============================================================================

export async function fetchApprovalThresholds(params?: Record<string, string>): Promise<PaginatedResponse<ApprovalThreshold>> {
  // Get mock data based on document_type filter
  const getMockData = () => {
    const docType = params?.document_type as keyof typeof mockApprovalThresholds | undefined;
    if (docType && mockApprovalThresholds[docType]) {
      return mockApprovalThresholds[docType];
    }
    // Return all thresholds if no filter
    return Object.values(mockApprovalThresholds).flat();
  };

  if (MOCK_MODE) {
    await new Promise(resolve => setTimeout(resolve, 200));
    const mockData = getMockData();
    return {
      count: mockData.length,
      next: null,
      previous: null,
      results: mockData,
    };
  }

  try {
    const response = await apiClient.get('/admin/thresholds/', { params });
    return response.data;
  } catch {
    // Return mock data if endpoint doesn't exist yet
    const mockData = getMockData();
    return {
      count: mockData.length,
      next: null,
      previous: null,
      results: mockData,
    };
  }
}

export async function fetchApprovalThreshold(id: string): Promise<ApprovalThreshold> {
  const response = await apiClient.get(`/admin/thresholds/${id}/`);
  return response.data;
}

export async function createApprovalThreshold(data: Partial<ApprovalThreshold>): Promise<ApprovalThreshold> {
  const response = await apiClient.post('/admin/thresholds/', data);
  return response.data;
}

export async function updateApprovalThreshold(id: string, data: Partial<ApprovalThreshold>): Promise<ApprovalThreshold> {
  const response = await apiClient.patch(`/admin/thresholds/${id}/`, data);
  return response.data;
}

export async function deleteApprovalThreshold(id: string): Promise<void> {
  await apiClient.delete(`/admin/thresholds/${id}/`);
}

// =============================================================================
// API Functions - System Preferences
// =============================================================================

export async function fetchSystemPreferences(params?: Record<string, string>): Promise<PaginatedResponse<SystemPreference>> {
  if (MOCK_MODE) {
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      count: mockSystemPreferences.length,
      next: null,
      previous: null,
      results: mockSystemPreferences,
    };
  }

  try {
    const response = await apiClient.get('/admin/preferences/', { params });
    return response.data;
  } catch {
    // Return mock data if endpoint doesn't exist yet
    return {
      count: mockSystemPreferences.length,
      next: null,
      previous: null,
      results: mockSystemPreferences,
    };
  }
}

export async function fetchPreferenceByKey(key: string): Promise<SystemPreference> {
  const response = await apiClient.get(`/admin/preferences/by-key/${key}/`);
  return response.data;
}

export async function updateSystemPreference(id: string, data: Partial<SystemPreference>): Promise<SystemPreference> {
  const response = await apiClient.patch(`/admin/preferences/${id}/`, data);
  return response.data;
}

export async function bulkUpdatePreferences(preferences: { key: string; value: unknown }[]): Promise<{
  updated: string[];
  errors: { key: string; error: string }[];
}> {
  const response = await apiClient.post('/admin/preferences/bulk-update/', { preferences });
  return response.data;
}

export async function initializeDefaultPreferences(): Promise<{ message: string; created: string[] }> {
  const response = await apiClient.post('/admin/preferences/initialize-defaults/');
  return response.data;
}

// =============================================================================
// API Functions - API Keys
// =============================================================================

export async function fetchAPIKeys(params?: Record<string, string>): Promise<PaginatedResponse<APIKey>> {
  if (MOCK_MODE) {
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      count: mockAPIKeys.length,
      next: null,
      previous: null,
      results: mockAPIKeys,
    };
  }

  try {
    const response = await apiClient.get('/admin/api-keys/', { params });
    return response.data;
  } catch {
    // Return mock data if endpoint doesn't exist yet
    return {
      count: mockAPIKeys.length,
      next: null,
      previous: null,
      results: mockAPIKeys,
    };
  }
}

export async function createAPIKey(data: {
  name: string;
  scopes?: string[];
  rate_limit?: number;
  expires_at?: string | null;
}): Promise<{ api_key: APIKey; key: string }> {
  const response = await apiClient.post('/admin/api-keys/', data);
  return response.data;
}

export async function revokeAPIKey(id: string): Promise<{ message: string }> {
  const response = await apiClient.post(`/admin/api-keys/${id}/revoke/`);
  return response.data;
}

export async function regenerateAPIKey(id: string): Promise<{ api_key: APIKey; key: string }> {
  const response = await apiClient.post(`/admin/api-keys/${id}/regenerate/`);
  return response.data;
}

// =============================================================================
// React Query Hooks - Users
// =============================================================================

export function useUsers(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => fetchUsers(params),
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'users', id],
    queryFn: () => fetchUser(id!),
    enabled: !!id,
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: ['admin', 'users', 'stats'],
    queryFn: fetchUserStats,
  });
}

export function useUserRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'users', userId, 'roles'],
    queryFn: () => fetchUserRoles(userId!),
    enabled: !!userId,
  });
}

export function useActivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: suspendUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...data }: { userId: string; role_id: string; valid_from?: string; valid_to?: string | null; custom_approval_limit?: string | null; notes?: string }) =>
      assignRole(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
  });
}

export function useRemoveRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId, reason }: { userId: string; roleId: string; reason?: string }) =>
      removeRole(userId, roleId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

// =============================================================================
// React Query Hooks - Roles
// =============================================================================

export function useRoles(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'roles', params],
    queryFn: () => fetchRoles(params),
  });
}

export function useRole(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'roles', id],
    queryFn: () => fetchRole(id!),
    enabled: !!id,
  });
}

export function useRoleStats() {
  return useQuery({
    queryKey: ['admin', 'roles', 'stats'],
    queryFn: fetchRoleStats,
  });
}

export function useRolePresets() {
  return useQuery({
    queryKey: ['admin', 'roles', 'presets'],
    queryFn: fetchRolePresets,
  });
}

export function useRoleUsers(roleId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'roles', roleId, 'users'],
    queryFn: () => fetchRoleUsers(roleId!),
    enabled: !!roleId,
  });
}

export function usePermissions() {
  return useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: fetchPermissions,
    staleTime: Infinity,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
  });
}

export function useCreateRoleFromPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ presetName, customName }: { presetName: string; customName?: string }) =>
      createRoleFromPreset(presetName, customName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Role>) => updateRole(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles', variables.id] });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
  });
}

// =============================================================================
// React Query Hooks - Role Change Logs
// =============================================================================

export function useRoleChangeLogs(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'role-changes', params],
    queryFn: () => fetchRoleChangeLogs(params),
  });
}

// =============================================================================
// React Query Hooks - Approval Thresholds
// =============================================================================

export function useApprovalThresholds(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'thresholds', params],
    queryFn: () => fetchApprovalThresholds(params),
  });
}

export function useCreateApprovalThreshold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createApprovalThreshold,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'thresholds'] });
    },
  });
}

export function useUpdateApprovalThreshold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<ApprovalThreshold>) =>
      updateApprovalThreshold(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'thresholds'] });
    },
  });
}

export function useDeleteApprovalThreshold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteApprovalThreshold,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'thresholds'] });
    },
  });
}

// =============================================================================
// React Query Hooks - System Preferences
// =============================================================================

export function useSystemPreferences(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'preferences', params],
    queryFn: () => fetchSystemPreferences(params),
  });
}

export function useUpdateSystemPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<SystemPreference>) =>
      updateSystemPreference(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'preferences'] });
    },
  });
}

export function useBulkUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkUpdatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'preferences'] });
    },
  });
}

export function useInitializeDefaultPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: initializeDefaultPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'preferences'] });
    },
  });
}

// =============================================================================
// React Query Hooks - API Keys
// =============================================================================

export function useAPIKeys(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin', 'api-keys', params],
    queryFn: () => fetchAPIKeys(params),
  });
}

export function useCreateAPIKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAPIKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
    },
  });
}

export function useRevokeAPIKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeAPIKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
    },
  });
}

export function useRegenerateAPIKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: regenerateAPIKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
    },
  });
}

// =============================================================================
// Mock Data - Audit Logs
// =============================================================================

const mockAuditLogs: AuditLog[] = [
  {
    id: 'audit-1',
    timestamp: '2025-12-17T10:30:00Z',
    user: 'user-1',
    user_email: 'admin@dillanci.com',
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    organization: 'org-1',
    content_type: 'requisitions.requisition',
    content_type_name: 'Requisition',
    object_id: 'req-123',
    object_repr: 'REQ-2025-001',
    action: 'CREATE',
    action_display: 'Created',
    from_state: null,
    to_state: 'DRAFT',
    changes: {
      title: { old: null, new: 'Office Supplies Request' },
      total_amount: { old: null, new: '2500.00' },
    },
    extra_data: null,
  },
  {
    id: 'audit-2',
    timestamp: '2025-12-17T11:15:00Z',
    user: 'user-1',
    user_email: 'admin@dillanci.com',
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    organization: 'org-1',
    content_type: 'requisitions.requisition',
    content_type_name: 'Requisition',
    object_id: 'req-123',
    object_repr: 'REQ-2025-001',
    action: 'STATE_TRANSITION',
    action_display: 'Status Changed',
    from_state: 'DRAFT',
    to_state: 'SUBMITTED',
    changes: {
      status: { old: 'DRAFT', new: 'SUBMITTED' },
    },
    extra_data: null,
  },
  {
    id: 'audit-3',
    timestamp: '2025-12-17T14:00:00Z',
    user: 'user-2',
    user_email: 'manager@dillanci.com',
    ip_address: '192.168.1.101',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    organization: 'org-1',
    content_type: 'requisitions.requisition',
    content_type_name: 'Requisition',
    object_id: 'req-123',
    object_repr: 'REQ-2025-001',
    action: 'STATE_TRANSITION',
    action_display: 'Status Changed',
    from_state: 'SUBMITTED',
    to_state: 'APPROVED',
    changes: {
      status: { old: 'SUBMITTED', new: 'APPROVED' },
      approved_by: { old: null, new: 'manager@dillanci.com' },
    },
    extra_data: { approval_comment: 'Approved for Q1 budget' },
  },
  {
    id: 'audit-4',
    timestamp: '2025-12-16T09:00:00Z',
    user: 'user-1',
    user_email: 'admin@dillanci.com',
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    organization: 'org-1',
    content_type: 'suppliers.supplier',
    content_type_name: 'Supplier',
    object_id: 'sup-456',
    object_repr: 'Acme Corp',
    action: 'UPDATE',
    action_display: 'Updated',
    from_state: null,
    to_state: null,
    changes: {
      contact_email: { old: 'old@acme.com', new: 'new@acme.com' },
      phone: { old: '555-0100', new: '555-0200' },
    },
    extra_data: null,
  },
  {
    id: 'audit-5',
    timestamp: '2025-12-15T16:30:00Z',
    user: 'user-3',
    user_email: 'procurement@dillanci.com',
    ip_address: '192.168.1.102',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    organization: 'org-1',
    content_type: 'purchase_orders.purchaseorder',
    content_type_name: 'Purchase Order',
    object_id: 'po-789',
    object_repr: 'PO-2025-042',
    action: 'CREATE',
    action_display: 'Created',
    from_state: null,
    to_state: 'DRAFT',
    changes: {
      supplier: { old: null, new: 'Acme Corp' },
      total_amount: { old: null, new: '15000.00' },
    },
    extra_data: null,
  },
];

// =============================================================================
// Types - Audit Logs
// =============================================================================

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string | null;
  user_email: string;
  ip_address: string | null;
  user_agent: string | null;
  organization: string;
  content_type: string;
  content_type_name: string;
  object_id: string;
  object_repr: string;
  action: string;
  action_display: string;
  from_state: string | null;
  to_state: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  extra_data: Record<string, unknown> | null;
}

// =============================================================================
// API Functions - Audit Logs
// =============================================================================

export async function fetchAuditLogs(params?: Record<string, string>): Promise<PaginatedResponse<AuditLog>> {
  if (MOCK_MODE) {
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      count: mockAuditLogs.length,
      next: null,
      previous: null,
      results: mockAuditLogs,
    };
  }

  try {
    const response = await apiClient.get<PaginatedResponse<AuditLog>>('/audit/logs/', { params });
    return response.data;
  } catch {
    // Return mock data if endpoint doesn't exist yet
    return {
      count: mockAuditLogs.length,
      next: null,
      previous: null,
      results: mockAuditLogs,
    };
  }
}

export async function fetchAuditLog(id: string): Promise<AuditLog> {
  const response = await apiClient.get<AuditLog>(`/audit/logs/${id}/`);
  return response.data;
}

export async function fetchObjectHistory(contentType: string, objectId: string): Promise<AuditLog[]> {
  const response = await apiClient.get<PaginatedResponse<AuditLog>>('/audit/logs/for_object/', {
    params: { content_type: contentType, object_id: objectId },
  });
  return response.data.results;
}

// =============================================================================
// React Query Hooks - Audit Logs
// =============================================================================

export function useAuditLogs(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['audit', 'logs', params],
    queryFn: () => fetchAuditLogs(params),
  });
}

export function useAuditLog(id: string | undefined) {
  return useQuery({
    queryKey: ['audit', 'logs', id],
    queryFn: () => fetchAuditLog(id!),
    enabled: !!id,
  });
}

export function useObjectHistory(contentType: string | undefined, objectId: string | undefined) {
  return useQuery({
    queryKey: ['audit', 'object-history', contentType, objectId],
    queryFn: () => fetchObjectHistory(contentType!, objectId!),
    enabled: !!contentType && !!objectId,
  });
}
