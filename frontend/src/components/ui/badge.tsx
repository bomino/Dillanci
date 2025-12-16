import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantStyles = {
      default: 'bg-neutral-100 text-neutral-700',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-amber-100 text-amber-800',
      error: 'bg-red-100 text-red-800',
      info: 'bg-blue-100 text-blue-800',
      outline: 'border border-neutral-300 text-neutral-700 bg-transparent',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

// Status-specific badge component
export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
}

const statusVariants: Record<string, BadgeProps['variant']> = {
  // General
  draft: 'default',
  pending: 'warning',
  active: 'success',
  approved: 'success',
  completed: 'info',
  cancelled: 'error',
  rejected: 'error',

  // Supplier specific
  prospect: 'default',
  pending_review: 'warning',
  suspended: 'warning',
  blocked: 'error',

  // RFQ specific
  open: 'info',
  closed: 'default',
  awarded: 'success',

  // PO specific
  pending_approval: 'warning',
  sent: 'info',
  partially_received: 'warning',
  received: 'success',

  // Invoice specific
  validated: 'info',
  matched: 'info',
  paid: 'success',
  disputed: 'error',

  // Contract specific
  expired: 'warning',
  terminated: 'error',
};

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, className, ...props }, ref) => {
    const normalizedStatus = status.toLowerCase().replace(/-/g, '_');
    const variant = statusVariants[normalizedStatus] || 'default';
    const displayText = status.replace(/_/g, ' ').replace(/-/g, ' ');

    return (
      <Badge
        ref={ref}
        variant={variant}
        className={cn('capitalize', className)}
        {...props}
      >
        {displayText}
      </Badge>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export { Badge, StatusBadge };
