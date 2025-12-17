import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  CheckSquare,
  Package,
  DollarSign,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}

// Icon and color mapping for notification types
const notificationConfig: Record<
  NotificationType,
  { icon: React.ElementType; colorClass: string; bgClass: string }
> = {
  APPROVAL_REQUIRED: {
    icon: AlertCircle,
    colorClass: 'text-warning',
    bgClass: 'bg-warning/10',
  },
  APPROVAL_COMPLETED: {
    icon: CheckCircle,
    colorClass: 'text-success',
    bgClass: 'bg-success/10',
  },
  APPROVAL_REJECTED: {
    icon: XCircle,
    colorClass: 'text-error',
    bgClass: 'bg-error/10',
  },
  DOCUMENT_SUBMITTED: {
    icon: FileText,
    colorClass: 'text-primary-600',
    bgClass: 'bg-primary-50',
  },
  BID_RECEIVED: {
    icon: FileText,
    colorClass: 'text-primary-600',
    bgClass: 'bg-primary-50',
  },
  CONTRACT_EXPIRING: {
    icon: Clock,
    colorClass: 'text-warning',
    bgClass: 'bg-warning/10',
  },
  INVOICE_MATCHED: {
    icon: CheckSquare,
    colorClass: 'text-success',
    bgClass: 'bg-success/10',
  },
  GOODS_RECEIVED: {
    icon: Package,
    colorClass: 'text-info',
    bgClass: 'bg-info/10',
  },
  BUDGET_ALERT: {
    icon: DollarSign,
    colorClass: 'text-warning',
    bgClass: 'bg-warning/10',
  },
  SYSTEM_ALERT: {
    icon: Bell,
    colorClass: 'text-neutral-500',
    bgClass: 'bg-neutral-100',
  },
};

// Priority border colors
const priorityBorderClass: Record<string, string> = {
  URGENT: 'border-l-4 border-l-error',
  HIGH: 'border-l-4 border-l-warning',
  NORMAL: '',
  LOW: '',
};

export function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const navigate = useNavigate();
  const config = notificationConfig[notification.type];
  const Icon = config.icon;
  const isUnread = notification.status === 'UNREAD';

  const handleClick = () => {
    // Mark as read
    if (isUnread) {
      onMarkAsRead(notification.id);
    }

    // Navigate if there's a link
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
        'hover:bg-neutral-50 focus:outline-none focus:bg-neutral-50',
        priorityBorderClass[notification.priority],
        isUnread && 'bg-primary-50/30'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
          config.bgClass
        )}
      >
        <Icon className={cn('w-5 h-5', config.colorClass)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm text-neutral-900 line-clamp-1',
              isUnread && 'font-semibold'
            )}
          >
            {notification.title}
          </p>

          {/* Unread indicator */}
          {isUnread && (
            <span className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-primary-500" />
          )}
        </div>

        <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">
          {notification.message}
        </p>

        <p className="mt-1 text-xs text-neutral-400">{timeAgo}</p>
      </div>
    </button>
  );
}

export default NotificationItem;
