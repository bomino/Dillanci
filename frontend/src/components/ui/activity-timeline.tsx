import * as React from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Button } from './button';
import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';
import { useObjectHistory, type AuditLog } from '@/lib/api/admin';

// Action type configuration for visual styling
const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  CREATE: {
    icon: Plus,
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    label: 'Created',
  },
  UPDATE: {
    icon: Pencil,
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    label: 'Updated',
  },
  DELETE: {
    icon: Trash2,
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    label: 'Deleted',
  },
  STATE_TRANSITION: {
    icon: ArrowRight,
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    label: 'Status Changed',
  },
  SOFT_DELETE: {
    icon: Trash2,
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    label: 'Archived',
  },
  RESTORE: {
    icon: RefreshCw,
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    label: 'Restored',
  },
};

// Status badge styling (reusable across document types)
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-neutral-100 text-neutral-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-red-100 text-red-700',
  SENT: 'bg-purple-100 text-purple-700',
  RECEIVED: 'bg-emerald-100 text-emerald-700',
  PARTIALLY_RECEIVED: 'bg-cyan-100 text-cyan-700',
  VALIDATED: 'bg-blue-100 text-blue-700',
  MATCHED: 'bg-cyan-100 text-cyan-700',
  PARTIALLY_MATCHED: 'bg-orange-100 text-orange-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  DISPUTED: 'bg-purple-100 text-purple-700',
};

export interface ActivityTimelineProps {
  contentType: string;
  objectId: string;
  className?: string;
  maxItems?: number;
  showHeader?: boolean;
  compact?: boolean;
}

interface ActivityItemProps {
  activity: AuditLog;
  isFirst: boolean;
  isLast: boolean;
  compact?: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] || 'bg-neutral-100 text-neutral-700';
  const displayStatus = status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', colorClass)}>
      {displayStatus}
    </span>
  );
}

function ChangesDiff({ changes }: { changes: Record<string, { old: unknown; new: unknown }> }) {
  const [expanded, setExpanded] = React.useState(false);
  const entries = Object.entries(changes);

  if (entries.length === 0) return null;

  // Filter out internal fields and status (shown separately)
  const visibleChanges = entries.filter(([key]) =>
    !['id', 'updated_at', 'created_at', 'organization', 'status'].includes(key)
  );

  if (visibleChanges.length === 0) return null;

  const displayCount = expanded ? visibleChanges.length : Math.min(2, visibleChanges.length);
  const hasMore = visibleChanges.length > 2;

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'empty';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const formatFieldName = (field: string): string => {
    return field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="mt-2 space-y-1">
      {visibleChanges.slice(0, displayCount).map(([field, { old: oldVal, new: newVal }]) => (
        <div key={field} className="text-xs">
          <span className="text-neutral-500">{formatFieldName(field)}:</span>
          {oldVal !== null && oldVal !== undefined && (
            <span className="ml-1 line-through text-red-600/70">{formatValue(oldVal)}</span>
          )}
          <span className="mx-1 text-neutral-400">→</span>
          <span className="text-green-600">{formatValue(newVal)}</span>
        </div>
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              +{visibleChanges.length - 2} more changes
            </>
          )}
        </button>
      )}
    </div>
  );
}

function ActivityItem({ activity, isFirst, isLast, compact }: ActivityItemProps) {
  const config = ACTION_CONFIG[activity.action] || ACTION_CONFIG.UPDATE;
  const Icon = config.icon;
  const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true });
  const fullTime = format(new Date(activity.timestamp), 'PPpp');

  // Extract user display info
  const userEmail = activity.user_email || 'System';
  const userName = userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative flex gap-3"
    >
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-8 bottom-0 w-px bg-neutral-200" />
      )}

      {/* Icon */}
      <div className={cn(
        'relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        config.bgColor
      )}>
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0', compact ? 'pb-3' : 'pb-4')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Action and user */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-sm font-medium', config.color)}>
                {activity.action_display || config.label}
              </span>
              <span className="text-sm text-neutral-500">by</span>
              <span className="text-sm font-medium text-neutral-700 truncate">
                {userName}
              </span>
            </div>

            {/* State transition */}
            {activity.from_state && activity.to_state && (
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={activity.from_state} />
                <ArrowRight className="h-3 w-3 text-neutral-400" />
                <StatusBadge status={activity.to_state} />
              </div>
            )}

            {/* Changes diff (for UPDATE actions) */}
            {activity.changes && Object.keys(activity.changes).length > 0 &&
             activity.action !== 'STATE_TRANSITION' && (
              <ChangesDiff changes={activity.changes} />
            )}

            {/* Extra data */}
            {activity.extra_data && Object.keys(activity.extra_data).length > 0 && (
              <div className="mt-1 text-xs text-neutral-500 italic">
                {Object.entries(activity.extra_data).map(([key, value]) => (
                  <span key={key}>
                    {key.replace(/_/g, ' ')}: {String(value)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Timestamp */}
          <div className="flex-shrink-0 text-right">
            <span
              className="text-xs text-neutral-400 cursor-help"
              title={fullTime}
            >
              {timeAgo}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex gap-3 pb-4">
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function ActivityTimeline({
  contentType,
  objectId,
  className,
  maxItems = 10,
  showHeader = true,
  compact = false,
}: ActivityTimelineProps) {
  const [showAll, setShowAll] = React.useState(false);
  const { data: activities, isLoading, error, refetch } = useObjectHistory(contentType, objectId);

  // Sort activities by timestamp (newest first)
  const sortedActivities = React.useMemo(() => {
    if (!activities) return [];
    return [...activities].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [activities]);

  const displayedActivities = showAll
    ? sortedActivities
    : sortedActivities.slice(0, maxItems);

  const hasMore = sortedActivities.length > maxItems;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-neutral-500">
            <History className="h-4 w-4" />
            <span className="text-sm font-medium">
              Activity ({sortedActivities.length})
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-7 px-2"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {isLoading ? (
          <>
            <ActivitySkeleton />
            <ActivitySkeleton />
            <ActivitySkeleton />
          </>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-red-600">Failed to load activity history</p>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="mt-2">
              Try again
            </Button>
          </div>
        ) : sortedActivities.length === 0 ? (
          <div className="py-8 text-center">
            <Clock className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm text-neutral-500">No activity yet</p>
            <p className="text-xs text-neutral-400">Actions will appear here as they happen</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {displayedActivities.map((activity, index) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                isFirst={index === 0}
                isLast={index === displayedActivities.length - 1}
                compact={compact}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Show more/less button */}
      {hasMore && !isLoading && sortedActivities.length > 0 && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-primary-600 hover:text-primary-700"
          >
            {showAll ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show all {sortedActivities.length} activities
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ActivityTimeline;
