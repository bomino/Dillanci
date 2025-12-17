import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PurchaseOrder, POStatus } from '@/types';

// PO Status configuration
export const PO_STATUS_CONFIG: Record<POStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-neutral-700', bgColor: 'bg-neutral-100' },
  PENDING_APPROVAL: { label: 'Pending Approval', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  APPROVED: { label: 'Approved', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  SENT: { label: 'Sent', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  PARTIALLY_RECEIVED: { label: 'Partially Received', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  RECEIVED: { label: 'Received', color: 'text-green-700', bgColor: 'bg-green-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' },
};

// Mock suppliers data
const mockSuppliers = [
  { id: 'sup-001', name: 'Tech Solutions Inc', code: 'TSI-001' },
  { id: 'sup-002', name: 'Office Supplies Co', code: 'OSC-002' },
  { id: 'sup-003', name: 'Industrial Parts Ltd', code: 'IPL-003' },
  { id: 'sup-004', name: 'Global Materials Corp', code: 'GMC-004' },
];

// Mock PO data
const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-001',
    number: 'PO-2024-001',
    organization: 'org-001',
    supplier: 'sup-001',
    supplier_name: 'Tech Solutions Inc',
    status: 'APPROVED',
    order_date: '2024-01-15',
    expected_delivery_date: '2024-02-01',
    total_amount: '15750.00',
    currency: 'USD',
    payment_terms: 'Net 30',
    shipping_address: '123 Main Street, Suite 100, New York, NY 10001',
    notes: 'Urgent order for Q1 project',
    lines: [
      {
        id: 'pol-001',
        purchase_order: 'po-001',
        line_number: 1,
        description: 'Dell Latitude 5540 Laptop',
        quantity: '10',
        unit_price: '1200.00',
        extended_amount: '12000.00',
        quantity_received: '0',
        unit_of_measure: 'EA',
      },
      {
        id: 'pol-002',
        purchase_order: 'po-001',
        line_number: 2,
        description: 'Wireless Mouse and Keyboard Combo',
        quantity: '10',
        unit_price: '75.00',
        extended_amount: '750.00',
        quantity_received: '0',
        unit_of_measure: 'EA',
      },
      {
        id: 'pol-003',
        purchase_order: 'po-001',
        line_number: 3,
        description: 'USB-C Docking Station',
        quantity: '10',
        unit_price: '300.00',
        extended_amount: '3000.00',
        quantity_received: '0',
        unit_of_measure: 'EA',
      },
    ],
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-16T14:30:00Z',
  },
  {
    id: 'po-002',
    number: 'PO-2024-002',
    organization: 'org-001',
    supplier: 'sup-002',
    supplier_name: 'Office Supplies Co',
    status: 'SENT',
    order_date: '2024-01-18',
    expected_delivery_date: '2024-01-25',
    total_amount: '2340.00',
    currency: 'USD',
    payment_terms: 'Net 15',
    shipping_address: '456 Corporate Blvd, Chicago, IL 60601',
    notes: null,
    lines: [
      {
        id: 'pol-004',
        purchase_order: 'po-002',
        line_number: 1,
        description: 'A4 Copy Paper (Case of 10 reams)',
        quantity: '50',
        unit_price: '35.00',
        extended_amount: '1750.00',
        quantity_received: '0',
        unit_of_measure: 'CS',
      },
      {
        id: 'pol-005',
        purchase_order: 'po-002',
        line_number: 2,
        description: 'Ballpoint Pens (Box of 12)',
        quantity: '20',
        unit_price: '8.50',
        extended_amount: '170.00',
        quantity_received: '0',
        unit_of_measure: 'BX',
      },
      {
        id: 'pol-006',
        purchase_order: 'po-002',
        line_number: 3,
        description: 'File Folders (Box of 100)',
        quantity: '10',
        unit_price: '42.00',
        extended_amount: '420.00',
        quantity_received: '0',
        unit_of_measure: 'BX',
      },
    ],
    created_at: '2024-01-18T10:15:00Z',
    updated_at: '2024-01-19T08:45:00Z',
  },
  {
    id: 'po-003',
    number: 'PO-2024-003',
    organization: 'org-001',
    supplier: 'sup-003',
    supplier_name: 'Industrial Parts Ltd',
    status: 'PARTIALLY_RECEIVED',
    order_date: '2024-01-10',
    expected_delivery_date: '2024-01-20',
    total_amount: '8500.00',
    currency: 'USD',
    payment_terms: 'Net 45',
    shipping_address: '789 Industrial Way, Detroit, MI 48201',
    notes: 'Partial delivery acceptable',
    lines: [
      {
        id: 'pol-007',
        purchase_order: 'po-003',
        line_number: 1,
        description: 'Industrial Bearings (SKF 6205)',
        quantity: '100',
        unit_price: '45.00',
        extended_amount: '4500.00',
        quantity_received: '60',
        unit_of_measure: 'EA',
      },
      {
        id: 'pol-008',
        purchase_order: 'po-003',
        line_number: 2,
        description: 'Hydraulic Seals Kit',
        quantity: '50',
        unit_price: '80.00',
        extended_amount: '4000.00',
        quantity_received: '50',
        unit_of_measure: 'KT',
      },
    ],
    created_at: '2024-01-10T14:00:00Z',
    updated_at: '2024-01-22T11:30:00Z',
  },
  {
    id: 'po-004',
    number: 'PO-2024-004',
    organization: 'org-001',
    supplier: 'sup-004',
    supplier_name: 'Global Materials Corp',
    status: 'DRAFT',
    order_date: '2024-01-22',
    expected_delivery_date: null,
    total_amount: '25000.00',
    currency: 'USD',
    payment_terms: 'Net 30',
    shipping_address: null,
    notes: 'Pending budget approval',
    lines: [
      {
        id: 'pol-009',
        purchase_order: 'po-004',
        line_number: 1,
        description: 'Steel Plates (4x8 ft, 1/4" thick)',
        quantity: '20',
        unit_price: '850.00',
        extended_amount: '17000.00',
        quantity_received: '0',
        unit_of_measure: 'EA',
      },
      {
        id: 'pol-010',
        purchase_order: 'po-004',
        line_number: 2,
        description: 'Aluminum Tubing (2" diameter)',
        quantity: '100',
        unit_price: '80.00',
        extended_amount: '8000.00',
        quantity_received: '0',
        unit_of_measure: 'LF',
      },
    ],
    created_at: '2024-01-22T16:00:00Z',
    updated_at: '2024-01-22T16:00:00Z',
  },
  {
    id: 'po-005',
    number: 'PO-2024-005',
    organization: 'org-001',
    supplier: 'sup-001',
    supplier_name: 'Tech Solutions Inc',
    status: 'PENDING_APPROVAL',
    order_date: '2024-01-23',
    expected_delivery_date: '2024-02-10',
    total_amount: '45000.00',
    currency: 'USD',
    payment_terms: 'Net 30',
    shipping_address: '123 Main Street, Suite 100, New York, NY 10001',
    notes: 'Server infrastructure upgrade',
    lines: [
      {
        id: 'pol-011',
        purchase_order: 'po-005',
        line_number: 1,
        description: 'Dell PowerEdge R750 Server',
        quantity: '2',
        unit_price: '18000.00',
        extended_amount: '36000.00',
        quantity_received: '0',
        unit_of_measure: 'EA',
      },
      {
        id: 'pol-012',
        purchase_order: 'po-005',
        line_number: 2,
        description: 'Network Switch (48-port)',
        quantity: '3',
        unit_price: '3000.00',
        extended_amount: '9000.00',
        quantity_received: '0',
        unit_of_measure: 'EA',
      },
    ],
    created_at: '2024-01-23T09:30:00Z',
    updated_at: '2024-01-23T09:30:00Z',
  },
  {
    id: 'po-006',
    number: 'PO-2024-006',
    organization: 'org-001',
    supplier: 'sup-002',
    supplier_name: 'Office Supplies Co',
    status: 'RECEIVED',
    order_date: '2024-01-05',
    expected_delivery_date: '2024-01-12',
    total_amount: '1850.00',
    currency: 'USD',
    payment_terms: 'Net 15',
    shipping_address: '456 Corporate Blvd, Chicago, IL 60601',
    notes: 'Completed order',
    lines: [
      {
        id: 'pol-013',
        purchase_order: 'po-006',
        line_number: 1,
        description: 'Ergonomic Office Chair',
        quantity: '5',
        unit_price: '350.00',
        extended_amount: '1750.00',
        quantity_received: '5',
        unit_of_measure: 'EA',
      },
      {
        id: 'pol-014',
        purchase_order: 'po-006',
        line_number: 2,
        description: 'Monitor Stand',
        quantity: '5',
        unit_price: '20.00',
        extended_amount: '100.00',
        quantity_received: '5',
        unit_of_measure: 'EA',
      },
    ],
    created_at: '2024-01-05T11:00:00Z',
    updated_at: '2024-01-12T15:00:00Z',
  },
  {
    id: 'po-007',
    number: 'PO-2024-007',
    organization: 'org-001',
    supplier: 'sup-003',
    supplier_name: 'Industrial Parts Ltd',
    status: 'CANCELLED',
    order_date: '2024-01-08',
    expected_delivery_date: '2024-01-15',
    total_amount: '3200.00',
    currency: 'USD',
    payment_terms: 'Net 30',
    shipping_address: '789 Industrial Way, Detroit, MI 48201',
    notes: 'Cancelled due to project scope change',
    lines: [
      {
        id: 'pol-015',
        purchase_order: 'po-007',
        line_number: 1,
        description: 'Electric Motor (5HP)',
        quantity: '4',
        unit_price: '800.00',
        extended_amount: '3200.00',
        quantity_received: '0',
        unit_of_measure: 'EA',
      },
    ],
    created_at: '2024-01-08T13:00:00Z',
    updated_at: '2024-01-10T09:00:00Z',
  },
];

// Filters type
export interface POFilters {
  search?: string;
  status?: POStatus | 'ALL';
  supplier?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Payload types
export interface POLinePayload {
  id?: string;
  description: string;
  quantity: string;
  unit_price: string;
  unit_of_measure: string;
}

export interface POPayload {
  supplier: string;
  expected_delivery_date?: string | null;
  payment_terms?: string;
  shipping_address?: string | null;
  notes?: string | null;
  lines: POLinePayload[];
}

import apiClient from './client';

const MOCK_MODE = import.meta.env.VITE_MOCK_API === 'true';

// Simulated API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// API Functions
export async function fetchPurchaseOrders(filters: POFilters = {}): Promise<PurchaseOrder[]> {
  if (!MOCK_MODE) {
    // Clean up filters - remove 'ALL' values which the backend doesn't understand
    const cleanFilters: Record<string, string | undefined> = {};
    if (filters.search) cleanFilters.search = filters.search;
    if (filters.status && filters.status !== 'ALL') cleanFilters.status = filters.status;
    if (filters.supplier) cleanFilters.supplier = filters.supplier;
    if (filters.dateFrom) cleanFilters.date_from = filters.dateFrom;
    if (filters.dateTo) cleanFilters.date_to = filters.dateTo;

    const response = await apiClient.get('/purchase-orders/', { params: cleanFilters });
    return response.data.results || response.data;
  }

  await delay(500);

  let result = [...mockPurchaseOrders];

  // Apply search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(
      po =>
        po.number.toLowerCase().includes(searchLower) ||
        po.supplier_name?.toLowerCase().includes(searchLower) ||
        po.lines?.some(line => line.description.toLowerCase().includes(searchLower))
    );
  }

  // Apply status filter
  if (filters.status && filters.status !== 'ALL') {
    result = result.filter(po => po.status === filters.status);
  }

  // Apply supplier filter
  if (filters.supplier) {
    result = result.filter(po => po.supplier === filters.supplier);
  }

  // Apply date range filter
  if (filters.dateFrom) {
    result = result.filter(po => po.order_date >= filters.dateFrom!);
  }
  if (filters.dateTo) {
    result = result.filter(po => po.order_date <= filters.dateTo!);
  }

  // Sort by created_at descending
  result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return result;
}

export async function fetchPurchaseOrder(id: string): Promise<PurchaseOrder> {
  if (!MOCK_MODE) {
    const response = await apiClient.get(`/purchase-orders/${id}/`);
    return response.data;
  }

  await delay(300);

  const po = mockPurchaseOrders.find(p => p.id === id);
  if (!po) {
    throw new Error('Purchase Order not found');
  }
  return po;
}

export async function createPurchaseOrder(data: POPayload): Promise<PurchaseOrder> {
  if (!MOCK_MODE) {
    const response = await apiClient.post('/purchase-orders/', data);
    return response.data;
  }

  await delay(500);

  const supplier = mockSuppliers.find(s => s.id === data.supplier);
  const newPO: PurchaseOrder = {
    id: `po-${Date.now()}`,
    number: `PO-2024-${String(mockPurchaseOrders.length + 1).padStart(3, '0')}`,
    organization: 'org-001',
    supplier: data.supplier,
    supplier_name: supplier?.name || 'Unknown Supplier',
    status: 'DRAFT',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: data.expected_delivery_date || null,
    total_amount: calculateTotal(data.lines),
    currency: 'USD',
    payment_terms: data.payment_terms || 'Net 30',
    shipping_address: data.shipping_address || null,
    notes: data.notes || null,
    lines: data.lines.map((line, index) => ({
      id: `pol-${Date.now()}-${index}`,
      purchase_order: `po-${Date.now()}`,
      line_number: index + 1,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      extended_amount: (parseFloat(line.quantity) * parseFloat(line.unit_price)).toFixed(2),
      quantity_received: '0',
      unit_of_measure: line.unit_of_measure,
    })),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mockPurchaseOrders.unshift(newPO);
  return newPO;
}

export async function updatePurchaseOrder(id: string, data: Partial<POPayload>): Promise<PurchaseOrder> {
  if (!MOCK_MODE) {
    const response = await apiClient.patch(`/purchase-orders/${id}/`, data);
    return response.data;
  }

  await delay(500);

  const index = mockPurchaseOrders.findIndex(po => po.id === id);
  if (index === -1) {
    throw new Error('Purchase Order not found');
  }

  const existing = mockPurchaseOrders[index];

  // Only allow updates on DRAFT status
  if (existing.status !== 'DRAFT') {
    throw new Error('Can only edit Purchase Orders in DRAFT status');
  }

  const supplier = data.supplier ? mockSuppliers.find(s => s.id === data.supplier) : null;

  const updated: PurchaseOrder = {
    ...existing,
    supplier: data.supplier || existing.supplier,
    supplier_name: supplier?.name || existing.supplier_name,
    expected_delivery_date: data.expected_delivery_date !== undefined ? data.expected_delivery_date : existing.expected_delivery_date,
    payment_terms: data.payment_terms || existing.payment_terms,
    shipping_address: data.shipping_address !== undefined ? data.shipping_address : existing.shipping_address,
    notes: data.notes !== undefined ? data.notes : existing.notes,
    lines: data.lines
      ? data.lines.map((line, idx) => ({
          id: line.id || `pol-${Date.now()}-${idx}`,
          purchase_order: id,
          line_number: idx + 1,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          extended_amount: (parseFloat(line.quantity) * parseFloat(line.unit_price)).toFixed(2),
          quantity_received: '0',
          unit_of_measure: line.unit_of_measure,
        }))
      : existing.lines,
    total_amount: data.lines ? calculateTotal(data.lines) : existing.total_amount,
    updated_at: new Date().toISOString(),
  };

  mockPurchaseOrders[index] = updated;
  return updated;
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  if (!MOCK_MODE) {
    await apiClient.delete(`/purchase-orders/${id}/`);
    return;
  }

  await delay(300);

  const index = mockPurchaseOrders.findIndex(po => po.id === id);
  if (index === -1) {
    throw new Error('Purchase Order not found');
  }

  const po = mockPurchaseOrders[index];
  if (po.status !== 'DRAFT') {
    throw new Error('Can only delete Purchase Orders in DRAFT status');
  }

  mockPurchaseOrders.splice(index, 1);
}

// Status action functions
export async function submitPurchaseOrder(id: string): Promise<PurchaseOrder> {
  if (!MOCK_MODE) {
    const response = await apiClient.post(`/purchase-orders/${id}/submit/`);
    return response.data;
  }

  await delay(400);

  const index = mockPurchaseOrders.findIndex(po => po.id === id);
  if (index === -1) {
    throw new Error('Purchase Order not found');
  }

  const po = mockPurchaseOrders[index];
  if (po.status !== 'DRAFT') {
    throw new Error('Can only submit Purchase Orders in DRAFT status');
  }

  mockPurchaseOrders[index] = {
    ...po,
    status: 'PENDING_APPROVAL',
    updated_at: new Date().toISOString(),
  };

  return mockPurchaseOrders[index];
}

export async function approvePurchaseOrder(id: string): Promise<PurchaseOrder> {
  if (!MOCK_MODE) {
    const response = await apiClient.post(`/purchase-orders/${id}/approve/`);
    return response.data;
  }

  await delay(400);

  const index = mockPurchaseOrders.findIndex(po => po.id === id);
  if (index === -1) {
    throw new Error('Purchase Order not found');
  }

  const po = mockPurchaseOrders[index];
  if (po.status !== 'PENDING_APPROVAL') {
    throw new Error('Can only approve Purchase Orders in PENDING_APPROVAL status');
  }

  mockPurchaseOrders[index] = {
    ...po,
    status: 'APPROVED',
    updated_at: new Date().toISOString(),
  };

  return mockPurchaseOrders[index];
}

export async function rejectPurchaseOrder(id: string): Promise<PurchaseOrder> {
  if (!MOCK_MODE) {
    const response = await apiClient.post(`/purchase-orders/${id}/reject/`);
    return response.data;
  }

  await delay(400);

  const index = mockPurchaseOrders.findIndex(po => po.id === id);
  if (index === -1) {
    throw new Error('Purchase Order not found');
  }

  const po = mockPurchaseOrders[index];
  if (po.status !== 'PENDING_APPROVAL') {
    throw new Error('Can only reject Purchase Orders in PENDING_APPROVAL status');
  }

  mockPurchaseOrders[index] = {
    ...po,
    status: 'DRAFT',
    updated_at: new Date().toISOString(),
  };

  return mockPurchaseOrders[index];
}

export async function sendPurchaseOrder(id: string): Promise<PurchaseOrder> {
  if (!MOCK_MODE) {
    const response = await apiClient.post(`/purchase-orders/${id}/send/`);
    return response.data;
  }

  await delay(400);

  const index = mockPurchaseOrders.findIndex(po => po.id === id);
  if (index === -1) {
    throw new Error('Purchase Order not found');
  }

  const po = mockPurchaseOrders[index];
  if (po.status !== 'APPROVED') {
    throw new Error('Can only send Purchase Orders in APPROVED status');
  }

  mockPurchaseOrders[index] = {
    ...po,
    status: 'SENT',
    updated_at: new Date().toISOString(),
  };

  return mockPurchaseOrders[index];
}

export async function receivePurchaseOrder(id: string, lineId: string, quantityReceived: string): Promise<PurchaseOrder> {
  if (!MOCK_MODE) {
    const response = await apiClient.post(`/purchase-orders/${id}/receive/`, { line_id: lineId, quantity: quantityReceived });
    return response.data;
  }

  await delay(400);

  const index = mockPurchaseOrders.findIndex(po => po.id === id);
  if (index === -1) {
    throw new Error('Purchase Order not found');
  }

  const po = mockPurchaseOrders[index];
  if (po.status !== 'SENT' && po.status !== 'PARTIALLY_RECEIVED') {
    throw new Error('Can only receive items for Purchase Orders in SENT or PARTIALLY_RECEIVED status');
  }

  const lines = po.lines?.map(line => {
    if (line.id === lineId) {
      return {
        ...line,
        quantity_received: (parseFloat(line.quantity_received) + parseFloat(quantityReceived)).toString(),
      };
    }
    return line;
  });

  // Check if all lines are fully received
  const allReceived = lines?.every(line => parseFloat(line.quantity_received) >= parseFloat(line.quantity));
  const someReceived = lines?.some(line => parseFloat(line.quantity_received) > 0);

  mockPurchaseOrders[index] = {
    ...po,
    lines,
    status: allReceived ? 'RECEIVED' : someReceived ? 'PARTIALLY_RECEIVED' : po.status,
    updated_at: new Date().toISOString(),
  };

  return mockPurchaseOrders[index];
}

export async function cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
  if (!MOCK_MODE) {
    const response = await apiClient.post(`/purchase-orders/${id}/cancel/`);
    return response.data;
  }

  await delay(400);

  const index = mockPurchaseOrders.findIndex(po => po.id === id);
  if (index === -1) {
    throw new Error('Purchase Order not found');
  }

  const po = mockPurchaseOrders[index];
  if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
    throw new Error('Cannot cancel a received or already cancelled Purchase Order');
  }

  mockPurchaseOrders[index] = {
    ...po,
    status: 'CANCELLED',
    updated_at: new Date().toISOString(),
  };

  return mockPurchaseOrders[index];
}

// Helper functions
function calculateTotal(lines: POLinePayload[]): string {
  const total = lines.reduce((sum, line) => {
    return sum + parseFloat(line.quantity) * parseFloat(line.unit_price);
  }, 0);
  return total.toFixed(2);
}

// Get approved suppliers for dropdown
export async function fetchApprovedSuppliers(): Promise<typeof mockSuppliers> {
  await delay(200);
  return mockSuppliers;
}

// React Query Hooks
export function usePurchaseOrders(filters: POFilters = {}) {
  return useQuery({
    queryKey: ['purchaseOrders', filters],
    queryFn: () => fetchPurchaseOrders(filters),
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: ['purchaseOrder', id],
    queryFn: () => fetchPurchaseOrder(id),
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
    },
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<POPayload> }) => updatePurchaseOrder(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', variables.id] });
    },
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
    },
  });
}

export function useSubmitPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitPurchaseOrder,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', id] });
    },
  });
}

export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approvePurchaseOrder,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', id] });
    },
  });
}

export function useRejectPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rejectPurchaseOrder,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', id] });
    },
  });
}

export function useSendPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendPurchaseOrder,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', id] });
    },
  });
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, lineId, quantityReceived }: { id: string; lineId: string; quantityReceived: string }) =>
      receivePurchaseOrder(id, lineId, quantityReceived),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', variables.id] });
    },
  });
}

export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelPurchaseOrder,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', id] });
    },
  });
}

export function useApprovedSuppliers() {
  return useQuery({
    queryKey: ['approvedSuppliers'],
    queryFn: fetchApprovedSuppliers,
  });
}
