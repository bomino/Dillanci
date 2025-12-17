import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Contract, ContractStatus } from '@/types';

// Contract Status configuration
export const CONTRACT_STATUS_CONFIG: Record<ContractStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-neutral-700', bgColor: 'bg-neutral-100' },
  PENDING_APPROVAL: { label: 'Pending Approval', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  ACTIVE: { label: 'Active', color: 'text-green-700', bgColor: 'bg-green-100' },
  EXPIRED: { label: 'Expired', color: 'text-red-700', bgColor: 'bg-red-100' },
  TERMINATED: { label: 'Terminated', color: 'text-red-700', bgColor: 'bg-red-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-neutral-700', bgColor: 'bg-neutral-200' },
};

// Contract Type configuration
export const CONTRACT_TYPE_CONFIG: Record<Contract['contract_type'], { label: string; description: string }> = {
  BLANKET: { label: 'Blanket', description: 'Pre-negotiated pricing for recurring purchases' },
  FIXED_PRICE: { label: 'Fixed Price', description: 'Set price for defined scope of work' },
  TIME_MATERIALS: { label: 'Time & Materials', description: 'Billed based on time and materials used' },
  FRAMEWORK: { label: 'Framework', description: 'Master agreement for multiple orders' },
};

// Mock suppliers for contract creation
const mockSuppliers = [
  { id: 'sup-001', name: 'Tech Solutions Inc', code: 'TSI-001' },
  { id: 'sup-002', name: 'Office Supplies Co', code: 'OSC-002' },
  { id: 'sup-003', name: 'Industrial Parts Ltd', code: 'IPL-003' },
  { id: 'sup-004', name: 'Global Services Corp', code: 'GSC-004' },
];

// Mock Contracts
const mockContracts: Contract[] = [
  {
    id: 'con-001',
    number: 'CON-2024-001',
    organization: 'org-001',
    supplier: 'sup-001',
    supplier_name: 'Tech Solutions Inc',
    title: 'IT Equipment Supply Agreement',
    description: 'Annual contract for IT hardware and peripherals supply including laptops, monitors, and accessories.',
    status: 'ACTIVE',
    contract_type: 'BLANKET',
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    total_value: '500000.00',
    currency: 'USD',
    auto_renew: true,
    created_at: '2023-12-15T10:00:00Z',
    updated_at: '2024-01-02T09:00:00Z',
  },
  {
    id: 'con-002',
    number: 'CON-2024-002',
    organization: 'org-001',
    supplier: 'sup-002',
    supplier_name: 'Office Supplies Co',
    title: 'Office Supplies Framework Agreement',
    description: 'Framework agreement for office supplies including stationery, paper, and general office items.',
    status: 'ACTIVE',
    contract_type: 'FRAMEWORK',
    start_date: '2024-01-15',
    end_date: '2025-01-14',
    total_value: '150000.00',
    currency: 'USD',
    auto_renew: false,
    created_at: '2024-01-10T14:00:00Z',
    updated_at: '2024-01-15T08:30:00Z',
  },
  {
    id: 'con-003',
    number: 'CON-2024-003',
    organization: 'org-001',
    supplier: 'sup-003',
    supplier_name: 'Industrial Parts Ltd',
    title: 'Maintenance Services Contract',
    description: 'Time and materials contract for equipment maintenance and repair services.',
    status: 'PENDING_APPROVAL',
    contract_type: 'TIME_MATERIALS',
    start_date: '2024-03-01',
    end_date: '2025-02-28',
    total_value: '75000.00',
    currency: 'USD',
    auto_renew: false,
    created_at: '2024-02-15T11:00:00Z',
    updated_at: '2024-02-15T11:00:00Z',
  },
  {
    id: 'con-004',
    number: 'CON-2023-015',
    organization: 'org-001',
    supplier: 'sup-004',
    supplier_name: 'Global Services Corp',
    title: 'Consulting Services Agreement',
    description: 'Fixed price contract for business consulting and advisory services.',
    status: 'EXPIRED',
    contract_type: 'FIXED_PRICE',
    start_date: '2023-06-01',
    end_date: '2023-12-31',
    total_value: '120000.00',
    currency: 'USD',
    auto_renew: false,
    created_at: '2023-05-20T09:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'con-005',
    number: 'CON-2024-004',
    organization: 'org-001',
    supplier: 'sup-001',
    supplier_name: 'Tech Solutions Inc',
    title: 'Software Licensing Agreement',
    description: 'Draft contract for enterprise software licensing including support and maintenance.',
    status: 'DRAFT',
    contract_type: 'BLANKET',
    start_date: '2024-04-01',
    end_date: '2025-03-31',
    total_value: '250000.00',
    currency: 'USD',
    auto_renew: true,
    created_at: '2024-02-20T10:00:00Z',
    updated_at: '2024-02-20T10:00:00Z',
  },
];

// Filters type
export interface ContractApiFilters {
  search?: string;
  status?: ContractStatus | 'ALL';
  contract_type?: Contract['contract_type'] | 'ALL';
  supplier?: string;
  expiring_soon?: boolean;
}

// Payload types
export interface ContractPayload {
  supplier: string;
  title: string;
  description: string;
  contract_type: Contract['contract_type'];
  start_date: string;
  end_date: string;
  total_value: string;
  currency?: string;
  auto_renew?: boolean;
}

import apiClient from './client';

const MOCK_MODE = import.meta.env.VITE_MOCK_API === 'true';

// Simulated API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// API Functions
export async function fetchContracts(filters: ContractApiFilters = {}): Promise<Contract[]> {
  if (!MOCK_MODE) {
    // Clean up filters - remove 'ALL' values which the backend doesn't understand
    const cleanFilters: Record<string, string | boolean | undefined> = {};
    if (filters.search) cleanFilters.search = filters.search;
    if (filters.status && filters.status !== 'ALL') cleanFilters.status = filters.status;
    if (filters.contract_type && filters.contract_type !== 'ALL') cleanFilters.contract_type = filters.contract_type;
    if (filters.supplier) cleanFilters.supplier = filters.supplier;
    if (filters.expiring_soon) cleanFilters.expiring_soon = filters.expiring_soon;

    const response = await apiClient.get('/contracts/', { params: cleanFilters });
    return response.data.results || response.data;
  }

  await delay(500);

  let result = [...mockContracts];

  // Apply search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(
      contract =>
        contract.number.toLowerCase().includes(searchLower) ||
        contract.title.toLowerCase().includes(searchLower) ||
        contract.supplier_name?.toLowerCase().includes(searchLower) ||
        contract.description.toLowerCase().includes(searchLower)
    );
  }

  // Apply status filter
  if (filters.status && filters.status !== 'ALL') {
    result = result.filter(contract => contract.status === filters.status);
  }

  // Apply contract type filter
  if (filters.contract_type && filters.contract_type !== 'ALL') {
    result = result.filter(contract => contract.contract_type === filters.contract_type);
  }

  // Apply supplier filter
  if (filters.supplier) {
    result = result.filter(contract => contract.supplier === filters.supplier);
  }

  // Apply expiring soon filter (within 30 days)
  if (filters.expiring_soon) {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    result = result.filter(contract => {
      if (contract.status !== 'ACTIVE') return false;
      const endDate = new Date(contract.end_date);
      return endDate <= thirtyDaysFromNow && endDate >= today;
    });
  }

  // Sort by created_at descending
  result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return result;
}

export async function fetchContract(id: string): Promise<Contract> {
  if (!MOCK_MODE) {
    const response = await apiClient.get(`/contracts/${id}/`);
    return response.data;
  }

  await delay(300);

  const contract = mockContracts.find(c => c.id === id);
  if (!contract) {
    throw new Error('Contract not found');
  }
  return contract;
}

export async function createContract(data: ContractPayload): Promise<Contract> {
  if (!MOCK_MODE) {
    const response = await apiClient.post('/contracts/', data);
    return response.data;
  }

  await delay(500);

  const supplier = mockSuppliers.find(s => s.id === data.supplier);

  const newContract: Contract = {
    id: `con-${Date.now()}`,
    number: `CON-2024-${String(mockContracts.length + 1).padStart(3, '0')}`,
    organization: 'org-001',
    supplier: data.supplier,
    supplier_name: supplier?.name || 'Unknown',
    title: data.title,
    description: data.description,
    status: 'DRAFT',
    contract_type: data.contract_type,
    start_date: data.start_date,
    end_date: data.end_date,
    total_value: data.total_value,
    currency: data.currency || 'USD',
    auto_renew: data.auto_renew || false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mockContracts.unshift(newContract);
  return newContract;
}

export async function updateContract(id: string, data: Partial<ContractPayload>): Promise<Contract> {
  if (!MOCK_MODE) {
    const response = await apiClient.patch(`/contracts/${id}/`, data);
    return response.data;
  }

  await delay(500);

  const index = mockContracts.findIndex(contract => contract.id === id);
  if (index === -1) {
    throw new Error('Contract not found');
  }

  const existing = mockContracts[index];
  if (!['DRAFT', 'PENDING_APPROVAL'].includes(existing.status)) {
    throw new Error('Can only edit contracts in DRAFT or PENDING_APPROVAL status');
  }

  const supplier = data.supplier ? mockSuppliers.find(s => s.id === data.supplier) : null;

  const updated: Contract = {
    ...existing,
    supplier: data.supplier || existing.supplier,
    supplier_name: supplier?.name || existing.supplier_name,
    title: data.title || existing.title,
    description: data.description || existing.description,
    contract_type: data.contract_type || existing.contract_type,
    start_date: data.start_date || existing.start_date,
    end_date: data.end_date || existing.end_date,
    total_value: data.total_value || existing.total_value,
    currency: data.currency || existing.currency,
    auto_renew: data.auto_renew !== undefined ? data.auto_renew : existing.auto_renew,
    updated_at: new Date().toISOString(),
  };

  mockContracts[index] = updated;
  return updated;
}

export async function deleteContract(id: string): Promise<void> {
  if (!MOCK_MODE) {
    await apiClient.delete(`/contracts/${id}/`);
    return;
  }

  await delay(300);

  const index = mockContracts.findIndex(contract => contract.id === id);
  if (index === -1) {
    throw new Error('Contract not found');
  }

  const contract = mockContracts[index];
  if (contract.status !== 'DRAFT') {
    throw new Error('Can only delete contracts in DRAFT status');
  }

  mockContracts.splice(index, 1);
}

// Status action functions
export async function submitContract(id: string): Promise<Contract> {
  if (!MOCK_MODE) {
    const response = await apiClient.post(`/contracts/${id}/submit/`);
    return response.data;
  }

  await delay(400);

  const index = mockContracts.findIndex(contract => contract.id === id);
  if (index === -1) {
    throw new Error('Contract not found');
  }

  const contract = mockContracts[index];
  if (contract.status !== 'DRAFT') {
    throw new Error('Can only submit contracts in DRAFT status');
  }

  mockContracts[index] = {
    ...contract,
    status: 'PENDING_APPROVAL',
    updated_at: new Date().toISOString(),
  };

  return mockContracts[index];
}

export async function approveContract(id: string): Promise<Contract> {
  if (!MOCK_MODE) {
    const response = await apiClient.post(`/contracts/${id}/approve/`);
    return response.data;
  }

  await delay(400);

  const index = mockContracts.findIndex(contract => contract.id === id);
  if (index === -1) {
    throw new Error('Contract not found');
  }

  const contract = mockContracts[index];
  if (contract.status !== 'PENDING_APPROVAL') {
    throw new Error('Can only approve contracts in PENDING_APPROVAL status');
  }

  mockContracts[index] = {
    ...contract,
    status: 'ACTIVE',
    updated_at: new Date().toISOString(),
  };

  return mockContracts[index];
}

export async function rejectContract(id: string, reason: string): Promise<Contract> {
  if (!MOCK_MODE) {
    const response = await apiClient.post(`/contracts/${id}/reject/`, { reason });
    return response.data;
  }

  await delay(400);

  const index = mockContracts.findIndex(contract => contract.id === id);
  if (index === -1) {
    throw new Error('Contract not found');
  }

  const contract = mockContracts[index];
  if (contract.status !== 'PENDING_APPROVAL') {
    throw new Error('Can only reject contracts in PENDING_APPROVAL status');
  }

  mockContracts[index] = {
    ...contract,
    status: 'DRAFT',
    description: `${contract.description}\n\n[Rejected: ${reason}]`,
    updated_at: new Date().toISOString(),
  };

  return mockContracts[index];
}

export async function terminateContract(id: string, reason: string): Promise<Contract> {
  if (!MOCK_MODE) {
    const response = await apiClient.post(`/contracts/${id}/terminate/`, { reason });
    return response.data;
  }

  await delay(400);

  const index = mockContracts.findIndex(contract => contract.id === id);
  if (index === -1) {
    throw new Error('Contract not found');
  }

  const contract = mockContracts[index];
  if (contract.status !== 'ACTIVE') {
    throw new Error('Can only terminate ACTIVE contracts');
  }

  mockContracts[index] = {
    ...contract,
    status: 'TERMINATED',
    description: `${contract.description}\n\n[Terminated: ${reason}]`,
    updated_at: new Date().toISOString(),
  };

  return mockContracts[index];
}

export async function renewContract(id: string, newEndDate: string): Promise<Contract> {
  if (!MOCK_MODE) {
    const response = await apiClient.post(`/contracts/${id}/renew/`, { end_date: newEndDate });
    return response.data;
  }

  await delay(400);

  const index = mockContracts.findIndex(contract => contract.id === id);
  if (index === -1) {
    throw new Error('Contract not found');
  }

  const contract = mockContracts[index];
  if (!['ACTIVE', 'EXPIRED'].includes(contract.status)) {
    throw new Error('Can only renew ACTIVE or EXPIRED contracts');
  }

  mockContracts[index] = {
    ...contract,
    status: 'ACTIVE',
    end_date: newEndDate,
    updated_at: new Date().toISOString(),
  };

  return mockContracts[index];
}

export async function cancelContract(id: string): Promise<Contract> {
  if (!MOCK_MODE) {
    const response = await apiClient.post(`/contracts/${id}/cancel/`);
    return response.data;
  }

  await delay(400);

  const index = mockContracts.findIndex(contract => contract.id === id);
  if (index === -1) {
    throw new Error('Contract not found');
  }

  const contract = mockContracts[index];
  if (['CANCELLED', 'TERMINATED'].includes(contract.status)) {
    throw new Error('Contract is already cancelled or terminated');
  }

  mockContracts[index] = {
    ...contract,
    status: 'CANCELLED',
    updated_at: new Date().toISOString(),
  };

  return mockContracts[index];
}

// Get suppliers for contract creation
export async function fetchSuppliersForContract(): Promise<typeof mockSuppliers> {
  await delay(300);
  return mockSuppliers;
}

// React Query Hooks
export function useContracts(filters: ContractApiFilters = {}) {
  return useQuery({
    queryKey: ['contracts', filters],
    queryFn: () => fetchContracts(filters),
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: ['contract', id],
    queryFn: () => fetchContract(id),
    enabled: !!id,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContractPayload> }) =>
      updateContract(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract', variables.id] });
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}

export function useSubmitContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitContract,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
    },
  });
}

export function useApproveContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveContract,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
    },
  });
}

export function useRejectContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectContract(id, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract', variables.id] });
    },
  });
}

export function useTerminateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => terminateContract(id, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract', variables.id] });
    },
  });
}

export function useRenewContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, newEndDate }: { id: string; newEndDate: string }) => renewContract(id, newEndDate),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract', variables.id] });
    },
  });
}

export function useCancelContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelContract,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
    },
  });
}

export function useSuppliersForContract() {
  return useQuery({
    queryKey: ['suppliersForContract'],
    queryFn: fetchSuppliersForContract,
  });
}
