import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type { Supplier, SupplierStatus, SupplierFilters, PaginatedResponse } from '@/types';

// Supplier creation/update payload
export interface SupplierPayload {
  name: string;
  legal_name?: string | null;
  tax_id?: string | null;
  duns_number?: string | null;
  status?: SupplierStatus;
  supplier_type: 'MANUFACTURER' | 'DISTRIBUTOR' | 'SERVICE_PROVIDER' | 'CONTRACTOR' | 'OTHER';
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  payment_terms?: string;
  currency?: string;
  is_active?: boolean;
}

const MOCK_MODE = import.meta.env.VITE_MOCK_API === 'true';

// API Functions
export async function fetchSuppliers(filters?: SupplierFilters): Promise<PaginatedResponse<Supplier>> {
  if (MOCK_MODE) {
    return getMockSuppliersList(filters);
  }
  const response = await apiClient.get('/suppliers/', { params: filters });
  return response.data;
}

export async function fetchSupplier(id: string): Promise<Supplier> {
  if (MOCK_MODE) {
    const mockList = getMockSuppliers();
    const supplier = mockList.find(s => s.id === id);
    if (supplier) return supplier;
    throw new Error('Supplier not found');
  }
  const response = await apiClient.get(`/suppliers/${id}/`);
  return response.data;
}

export async function createSupplier(payload: SupplierPayload): Promise<Supplier> {
  const response = await apiClient.post('/suppliers/', payload);
  return response.data;
}

export async function updateSupplier(id: string, payload: Partial<SupplierPayload>): Promise<Supplier> {
  const response = await apiClient.patch(`/suppliers/${id}/`, payload);
  return response.data;
}

export async function deleteSupplier(id: string): Promise<void> {
  await apiClient.delete(`/suppliers/${id}/`);
}

export async function approveSupplier(id: string): Promise<Supplier> {
  const response = await apiClient.post(`/suppliers/${id}/approve/`);
  return response.data;
}

export async function suspendSupplier(id: string, reason?: string): Promise<Supplier> {
  const response = await apiClient.post(`/suppliers/${id}/suspend/`, { reason });
  return response.data;
}

// React Query Hooks

// List suppliers with filters and pagination
export function useSuppliers(filters?: SupplierFilters) {
  return useQuery({
    queryKey: ['suppliers', filters],
    queryFn: () => fetchSuppliers(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get single supplier by ID
export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => fetchSupplier(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

// Create supplier mutation
export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

// Update supplier mutation
export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SupplierPayload> }) =>
      updateSupplier(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', variables.id] });
    },
  });
}

// Delete supplier mutation
export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

// Approve supplier mutation
export function useApproveSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveSupplier,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', id] });
    },
  });
}

// Suspend supplier mutation
export function useSuspendSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      suspendSupplier(id, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', variables.id] });
    },
  });
}

// Mock data for development
function getMockSuppliers(): Supplier[] {
  return [
    {
      id: '1',
      number: 'SUP-2025-0001',
      organization: 'org-1',
      name: 'STERIS Corporation',
      legal_name: 'STERIS Corporation',
      tax_id: '34-1482024',
      duns_number: '006914841',
      status: 'APPROVED',
      supplier_type: 'MANUFACTURER',
      address_line_1: '5960 Heisley Road',
      address_line_2: null,
      city: 'Mentor',
      state: 'OH',
      postal_code: '44060',
      country: 'USA',
      phone: '(440) 354-2600',
      email: 'orders@steris.com',
      website: 'https://www.steris.com',
      payment_terms: 'NET30',
      currency: 'USD',
      is_active: true,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-06-20T14:30:00Z',
    },
    {
      id: '2',
      number: 'SUP-2025-0002',
      organization: 'org-1',
      name: 'DANIS Construction',
      legal_name: 'DANIS Construction Company LLC',
      tax_id: '31-1234567',
      duns_number: '123456789',
      status: 'APPROVED',
      supplier_type: 'CONTRACTOR',
      address_line_1: '3800 Woodman Drive',
      address_line_2: 'Suite 200',
      city: 'Dayton',
      state: 'OH',
      postal_code: '45420',
      country: 'USA',
      phone: '(937) 287-6941',
      email: 'morgan.daugherty@danis.com',
      website: 'https://www.danis.com',
      payment_terms: 'NET45',
      currency: 'USD',
      is_active: true,
      created_at: '2024-02-10T09:15:00Z',
      updated_at: '2024-08-15T11:20:00Z',
    },
    {
      id: '3',
      number: 'SUP-2025-0003',
      organization: 'org-1',
      name: 'InPro Corporation',
      legal_name: 'InPro Corporation',
      tax_id: '39-1234568',
      duns_number: '234567890',
      status: 'APPROVED',
      supplier_type: 'MANUFACTURER',
      address_line_1: '450 W Wilson Bridge Rd',
      address_line_2: null,
      city: 'Worthington',
      state: 'OH',
      postal_code: '43085',
      country: 'USA',
      phone: '(800) 222-5556',
      email: 'adeschaine@inprocorp.com',
      website: 'https://www.inprocorp.com',
      payment_terms: 'NET30',
      currency: 'USD',
      is_active: true,
      created_at: '2024-03-05T08:00:00Z',
      updated_at: '2024-09-10T16:45:00Z',
    },
    {
      id: '4',
      number: 'SUP-2025-0004',
      organization: 'org-1',
      name: 'ASSA ABLOY Entrance Systems',
      legal_name: 'ASSA ABLOY Entrance Systems US Inc',
      tax_id: '45-6789012',
      duns_number: '345678901',
      status: 'APPROVED',
      supplier_type: 'MANUFACTURER',
      address_line_1: '110 Sargent Drive',
      address_line_2: null,
      city: 'New Haven',
      state: 'CT',
      postal_code: '06511',
      country: 'USA',
      phone: '(937) 431-8141',
      email: 'entrance.us@assaabloy.com',
      website: 'https://www.assaabloyentrance.us',
      payment_terms: 'NET30',
      currency: 'USD',
      is_active: true,
      created_at: '2024-04-12T13:30:00Z',
      updated_at: '2024-10-05T09:00:00Z',
    },
    {
      id: '5',
      number: 'SUP-2025-0005',
      organization: 'org-1',
      name: 'Medical Supplies Inc',
      legal_name: 'Medical Supplies Inc',
      tax_id: '56-7890123',
      duns_number: null,
      status: 'PENDING_REVIEW',
      supplier_type: 'DISTRIBUTOR',
      address_line_1: '1200 Healthcare Lane',
      address_line_2: 'Building A',
      city: 'Columbus',
      state: 'OH',
      postal_code: '43215',
      country: 'USA',
      phone: '(614) 555-0100',
      email: 'sales@medsupplies.com',
      website: 'https://www.medsuppliesinc.com',
      payment_terms: 'NET30',
      currency: 'USD',
      is_active: true,
      created_at: '2024-11-28T14:00:00Z',
      updated_at: '2024-11-28T14:00:00Z',
    },
    {
      id: '6',
      number: 'SUP-2025-0006',
      organization: 'org-1',
      name: 'Tech Solutions LLC',
      legal_name: 'Tech Solutions LLC',
      tax_id: '67-8901234',
      duns_number: null,
      status: 'PROSPECT',
      supplier_type: 'SERVICE_PROVIDER',
      address_line_1: '500 Innovation Way',
      address_line_2: null,
      city: 'Cincinnati',
      state: 'OH',
      postal_code: '45202',
      country: 'USA',
      phone: '(513) 555-0200',
      email: 'info@techsolutionsllc.com',
      website: 'https://www.techsolutionsllc.com',
      payment_terms: 'NET30',
      currency: 'USD',
      is_active: true,
      created_at: '2024-12-01T10:00:00Z',
      updated_at: '2024-12-01T10:00:00Z',
    },
    {
      id: '7',
      number: 'SUP-2025-0007',
      organization: 'org-1',
      name: 'Office Pro Supplies',
      legal_name: 'Office Pro Supplies Inc',
      tax_id: '78-9012345',
      duns_number: '456789012',
      status: 'SUSPENDED',
      supplier_type: 'DISTRIBUTOR',
      address_line_1: '800 Commerce Street',
      address_line_2: null,
      city: 'Cleveland',
      state: 'OH',
      postal_code: '44114',
      country: 'USA',
      phone: '(216) 555-0300',
      email: 'orders@officepro.com',
      website: 'https://www.officeprosupplies.com',
      payment_terms: 'NET15',
      currency: 'USD',
      is_active: false,
      created_at: '2024-05-20T11:30:00Z',
      updated_at: '2024-11-15T09:00:00Z',
    },
    {
      id: '8',
      number: 'SUP-2025-0008',
      organization: 'org-1',
      name: 'Midwest Janitorial Services',
      legal_name: 'Midwest Janitorial Services LLC',
      tax_id: '89-0123456',
      duns_number: null,
      status: 'APPROVED',
      supplier_type: 'SERVICE_PROVIDER',
      address_line_1: '2500 Industrial Parkway',
      address_line_2: null,
      city: 'Dayton',
      state: 'OH',
      postal_code: '45404',
      country: 'USA',
      phone: '(937) 555-0400',
      email: 'service@midwestjanitorial.com',
      website: null,
      payment_terms: 'NET30',
      currency: 'USD',
      is_active: true,
      created_at: '2024-06-15T08:45:00Z',
      updated_at: '2024-10-20T14:15:00Z',
    },
  ];
}

function getMockSuppliersList(filters?: SupplierFilters): PaginatedResponse<Supplier> {
  let suppliers = getMockSuppliers();

  // Apply filters
  if (filters?.status) {
    suppliers = suppliers.filter(s => s.status === filters.status);
  }

  if (filters?.search) {
    const search = filters.search.toLowerCase();
    suppliers = suppliers.filter(s =>
      s.name.toLowerCase().includes(search) ||
      s.number.toLowerCase().includes(search) ||
      s.email?.toLowerCase().includes(search) ||
      s.city?.toLowerCase().includes(search)
    );
  }

  // Pagination
  const page = filters?.page || 1;
  const pageSize = filters?.page_size || 10;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedSuppliers = suppliers.slice(startIndex, endIndex);

  return {
    count: suppliers.length,
    next: endIndex < suppliers.length ? `?page=${page + 1}` : null,
    previous: page > 1 ? `?page=${page - 1}` : null,
    results: paginatedSuppliers,
  };
}

// Status helper functions
export const supplierStatusConfig: Record<SupplierStatus, { label: string; color: string; bgColor: string }> = {
  PROSPECT: { label: 'Prospect', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  PENDING_REVIEW: { label: 'Pending Review', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  APPROVED: { label: 'Approved', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  SUSPENDED: { label: 'Suspended', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  BLOCKED: { label: 'Blocked', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export const supplierTypeConfig: Record<string, { label: string }> = {
  MANUFACTURER: { label: 'Manufacturer' },
  DISTRIBUTOR: { label: 'Distributor' },
  SERVICE_PROVIDER: { label: 'Service Provider' },
  CONTRACTOR: { label: 'Contractor' },
  OTHER: { label: 'Other' },
};
