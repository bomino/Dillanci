import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  FileText,
  ShoppingCart,
  Package,
  UserPlus,
  FileCheck,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  FileSignature,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Activity } from '@/types';

interface ActivityFeedProps {
  activities: Activity[];
  loading?: boolean;
  onActivityClick?: (activity: Activity) => void;
  className?: string;
}

// Map action types to icons and colors
const actionConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  'Created RFQ': {
    icon: <FileText className="h-4 w-4" />,
    color: 'text-primary-700',
    bgColor: 'bg-primary-100',
  },
  'Approved PO': {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  'Rejected PO': {
    icon: <XCircle className="h-4 w-4" />,
    color: 'text-error',
    bgColor: 'bg-error/10',
  },
  'Received Goods': {
    icon: <Package className="h-4 w-4" />,
    color: 'text-accent-500',
    bgColor: 'bg-accent-300/20',
  },
  'Added Supplier': {
    icon: <UserPlus className="h-4 w-4" />,
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  'Invoice Matched': {
    icon: <FileCheck className="h-4 w-4" />,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  'Created PO': {
    icon: <ShoppingCart className="h-4 w-4" />,
    color: 'text-primary-700',
    bgColor: 'bg-primary-100',
  },
  'Updated Contract': {
    icon: <Edit className="h-4 w-4" />,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  'Deleted': {
    icon: <Trash2 className="h-4 w-4" />,
    color: 'text-error',
    bgColor: 'bg-error/10',
  },
  'Signed Contract': {
    icon: <FileSignature className="h-4 w-4" />,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
};

const getActionConfig = (action: string) => {
  // Check for exact match first
  if (actionConfig[action]) {
    return actionConfig[action];
  }

  // Check for partial matches
  const lowerAction = action.toLowerCase();
  if (lowerAction.includes('created')) {
    return { icon: <FileText className="h-4 w-4" />, color: 'text-primary-700', bgColor: 'bg-primary-100' };
  }
  if (lowerAction.includes('approved')) {
    return { icon: <CheckCircle className="h-4 w-4" />, color: 'text-success', bgColor: 'bg-success/10' };
  }
  if (lowerAction.includes('rejected')) {
    return { icon: <XCircle className="h-4 w-4" />, color: 'text-error', bgColor: 'bg-error/10' };
  }
  if (lowerAction.includes('updated') || lowerAction.includes('modified')) {
    return { icon: <Edit className="h-4 w-4" />, color: 'text-warning', bgColor: 'bg-warning/10' };
  }
  if (lowerAction.includes('deleted')) {
    return { icon: <Trash2 className="h-4 w-4" />, color: 'text-error', bgColor: 'bg-error/10' };
  }

  // Default
  return { icon: <Clock className="h-4 w-4" />, color: 'text-neutral-600', bgColor: 'bg-neutral-100' };
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ActivityFeed({
  activities,
  loading = false,
  onActivityClick,
  className,
}: ActivityFeedProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-accent-500" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 pb-4 border-b border-neutral-100 last:border-0 last:pb-0">
                <Skeleton variant="circular" className="w-8 h-8" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-accent-500" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-3">
              <Clock className="h-6 w-6 text-neutral-400" />
            </div>
            <p className="text-neutral-600 font-medium">No recent activity</p>
            <p className="text-sm text-neutral-500 mt-1">Activity will appear here as you work.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const config = getActionConfig(activity.action);
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'flex items-start gap-3 pb-4 border-b border-neutral-100 last:border-0 last:pb-0',
                    onActivityClick && 'cursor-pointer hover:bg-neutral-50 -mx-2 px-2 py-2 rounded-lg transition-colors'
                  )}
                  onClick={() => onActivityClick?.(activity)}
                >
                  {/* Avatar or Action Icon */}
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-primary-700">
                        {getInitials(activity.user)}
                      </span>
                    </div>
                    {/* Action type indicator */}
                    <div className={cn(
                      'absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center',
                      config.bgColor,
                      config.color
                    )}>
                      {React.cloneElement(config.icon as React.ReactElement<{ className?: string }>, { className: 'h-2.5 w-2.5' })}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">
                      {activity.action}
                    </p>
                    <p className="text-sm text-neutral-500 truncate">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-neutral-400">
                        {formatRelativeTime(activity.timestamp)}
                      </span>
                      <span className="text-xs text-neutral-300">•</span>
                      <span className="text-xs text-neutral-500">
                        {activity.user}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActivityFeed;
