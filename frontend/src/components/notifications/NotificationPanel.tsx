import { Bell, Check, Loader2 } from 'lucide-react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/lib/api/notifications';
import { NotificationItem } from './NotificationItem';
import { cn } from '@/lib/utils';

interface NotificationPanelProps {
  onClose?: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { data: notifications, isLoading, error } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const unreadCount = notifications?.filter(n => n.status === 'UNREAD').length ?? 0;

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const handleNotificationClick = (id: string) => {
    handleMarkAsRead(id);
    onClose?.();
  };

  return (
    <div className="w-[380px] bg-white rounded-lg shadow-lg border border-neutral-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium text-white bg-primary-500 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markAllAsRead.isPending}
            className={cn(
              'flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {markAllAsRead.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            Mark all read
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[400px] overflow-y-auto">
        {isLoading ? (
          // Loading skeleton
          <div className="p-4 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-neutral-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-200 rounded w-3/4" />
                  <div className="h-3 bg-neutral-200 rounded w-full" />
                  <div className="h-3 bg-neutral-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          // Error state
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-error">Failed to load notifications</p>
            <p className="mt-1 text-xs text-neutral-500">Please try again later</p>
          </div>
        ) : notifications && notifications.length > 0 ? (
          // Notifications list
          <div className="divide-y divide-neutral-100">
            {notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleNotificationClick}
              />
            ))}
          </div>
        ) : (
          // Empty state
          <div className="px-4 py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-neutral-100 flex items-center justify-center">
              <Bell className="w-6 h-6 text-neutral-400" />
            </div>
            <p className="text-sm font-medium text-neutral-600">No notifications</p>
            <p className="mt-1 text-xs text-neutral-400">
              You're all caught up!
            </p>
          </div>
        )}
      </div>

      {/* Footer - optional link to full notifications page */}
      {notifications && notifications.length > 0 && (
        <div className="px-4 py-2 border-t border-neutral-200 bg-neutral-50">
          <p className="text-xs text-center text-neutral-400">
            Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

export default NotificationPanel;
