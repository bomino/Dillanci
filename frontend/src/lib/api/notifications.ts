import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type { Notification, NotificationSummary, PaginatedResponse } from '@/types';

// Mock mode detection
const MOCK_MODE = import.meta.env.VITE_MOCK_API === 'true';

// =============================================================================
// Mock Data
// =============================================================================

const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    type: 'APPROVAL_REQUIRED',
    title: 'Requisition Awaiting Approval',
    message: 'REQ-2025-001 for Office Supplies ($2,500) requires your approval.',
    status: 'UNREAD',
    priority: 'HIGH',
    related_object_type: 'requisition',
    related_object_id: 'req-123',
    link: '/requisitions/req-123',
    read_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 min ago
  },
  {
    id: 'notif-2',
    type: 'BID_RECEIVED',
    title: 'New Bid Submitted',
    message: 'Acme Corp submitted a bid of $45,000 for RFQ-2025-042.',
    status: 'UNREAD',
    priority: 'NORMAL',
    related_object_type: 'rfq',
    related_object_id: 'rfq-042',
    link: '/rfqs/rfq-042',
    read_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 min ago
  },
  {
    id: 'notif-3',
    type: 'APPROVAL_COMPLETED',
    title: 'Purchase Order Approved',
    message: 'PO-2025-089 for IT Equipment has been approved by Finance Manager.',
    status: 'UNREAD',
    priority: 'NORMAL',
    related_object_type: 'purchase_order',
    related_object_id: 'po-089',
    link: '/purchase-orders/po-089',
    read_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
  },
  {
    id: 'notif-4',
    type: 'CONTRACT_EXPIRING',
    title: 'Contract Expiring Soon',
    message: 'Contract with TechSupply Inc expires in 30 days. Consider renewal.',
    status: 'READ',
    priority: 'HIGH',
    related_object_type: 'contract',
    related_object_id: 'con-015',
    link: '/contracts/con-015',
    read_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
  },
  {
    id: 'notif-5',
    type: 'GOODS_RECEIVED',
    title: 'Goods Receipt Posted',
    message: 'GR-2025-156 posted for PO-2025-078. Ready for invoice matching.',
    status: 'READ',
    priority: 'LOW',
    related_object_type: 'goods_receipt',
    related_object_id: 'gr-156',
    link: '/receiving/gr-156',
    read_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
  },
];

// =============================================================================
// API Functions
// =============================================================================

export async function fetchNotifications(): Promise<Notification[]> {
  if (MOCK_MODE) {
    await new Promise(resolve => setTimeout(resolve, 200));
    return [...mockNotifications];
  }

  try {
    const response = await apiClient.get<PaginatedResponse<Notification>>('/notifications/');
    return response.data.results;
  } catch {
    // Fallback to mock data if endpoint doesn't exist
    return [...mockNotifications];
  }
}

export async function fetchNotificationSummary(): Promise<NotificationSummary> {
  const getUnreadCount = (notifications: Notification[]) =>
    notifications.filter(n => n.status === 'UNREAD').length;
  const getUrgentCount = (notifications: Notification[]) =>
    notifications.filter(n => n.priority === 'URGENT' && n.status === 'UNREAD').length;

  if (MOCK_MODE) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      total: mockNotifications.length,
      unread: getUnreadCount(mockNotifications),
      urgent: getUrgentCount(mockNotifications),
    };
  }

  try {
    const response = await apiClient.get<NotificationSummary>('/notifications/summary/');
    return response.data;
  } catch {
    return {
      total: mockNotifications.length,
      unread: getUnreadCount(mockNotifications),
      urgent: getUrgentCount(mockNotifications),
    };
  }
}

export async function markAsRead(id: string): Promise<Notification> {
  if (MOCK_MODE) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const notif = mockNotifications.find(n => n.id === id);
    if (notif) {
      notif.status = 'READ';
      notif.read_at = new Date().toISOString();
    }
    return notif!;
  }

  const response = await apiClient.post<Notification>(`/notifications/${id}/mark-read/`);
  return response.data;
}

export async function markAllAsRead(): Promise<void> {
  if (MOCK_MODE) {
    await new Promise(resolve => setTimeout(resolve, 200));
    mockNotifications.forEach(n => {
      n.status = 'READ';
      n.read_at = new Date().toISOString();
    });
    return;
  }

  await apiClient.post('/notifications/mark-all-read/');
}

export async function deleteNotification(id: string): Promise<void> {
  if (MOCK_MODE) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const index = mockNotifications.findIndex(n => n.id === id);
    if (index > -1) mockNotifications.splice(index, 1);
    return;
  }

  await apiClient.delete(`/notifications/${id}/`);
}

// =============================================================================
// React Query Hooks
// =============================================================================

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 1000 * 30, // Poll every 30 seconds
    staleTime: 1000 * 15,       // Consider stale after 15 seconds
  });
}

export function useNotificationSummary() {
  return useQuery({
    queryKey: ['notifications', 'summary'],
    queryFn: fetchNotificationSummary,
    refetchInterval: 1000 * 30, // Poll every 30 seconds
    staleTime: 1000 * 15,       // Consider stale after 15 seconds
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
