import * as React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './card';
import { Skeleton } from './skeleton';
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils/format';

type TrendDirection = 'up' | 'down' | 'neutral';
type FormatType = 'currency' | 'number' | 'percentage' | 'days' | 'custom';

interface MetricCardProps {
  title: string;
  value: number | string;
  format?: FormatType;
  customFormatter?: (value: number | string) => string;
  icon?: React.ReactNode;
  trend?: TrendDirection;
  change?: number;
  changeLabel?: string;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

function MetricCard({
  title,
  value,
  format = 'number',
  customFormatter,
  icon,
  trend,
  change,
  changeLabel,
  loading = false,
  className,
  onClick,
}: MetricCardProps) {
  const formattedValue = React.useMemo(() => {
    if (customFormatter) {
      return customFormatter(value);
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    switch (format) {
      case 'currency':
        return formatCurrency(numValue);
      case 'percentage':
        return formatPercentage(numValue);
      case 'days':
        return `${numValue} days`;
      case 'custom':
        return String(value);
      case 'number':
      default:
        return formatNumber(numValue);
    }
  }, [value, format, customFormatter]);

  // Determine if trend is positive based on context
  // For most metrics, "up" is good. For cycle time, "down" is good.
  const getTrendColor = () => {
    if (!trend) return 'text-neutral-500';
    if (trend === 'neutral') return 'text-neutral-500';
    return trend === 'up' ? 'text-success' : 'text-error';
  };

  if (loading) {
    return (
      <Card className={cn('hover:shadow-md transition-shadow', className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton variant="circular" className="h-10 w-10" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  const cardContent = (
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        {icon && (
          <div className="p-2 bg-primary-50 rounded-lg text-primary-700">
            {icon}
          </div>
        )}
        {change !== undefined && trend && (
          <div className={cn('flex items-center gap-1 text-sm font-medium', getTrendColor())}>
            {trend === 'up' ? (
              <TrendingUp className="h-4 w-4" />
            ) : trend === 'down' ? (
              <TrendingDown className="h-4 w-4" />
            ) : null}
            {formatPercentage(Math.abs(change))}
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm text-neutral-500">{title}</p>
        <p className="text-2xl font-bold text-neutral-900 mt-1">{formattedValue}</p>
        {changeLabel && (
          <p className="text-xs text-neutral-400 mt-1">{changeLabel}</p>
        )}
      </div>
    </CardContent>
  );

  return (
    <Card
      className={cn(
        'transition-shadow',
        onClick && 'cursor-pointer hover:shadow-md',
        className
      )}
      onClick={onClick}
    >
      {cardContent}
    </Card>
  );
}

// Animated version with entrance animation
interface AnimatedMetricCardProps extends MetricCardProps {
  delay?: number;
}

function AnimatedMetricCard({ delay = 0, ...props }: AnimatedMetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <MetricCard {...props} />
    </motion.div>
  );
}

// Grid container for metric cards
interface MetricCardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

function MetricCardGrid({ children, columns = 4, className }: MetricCardGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  );
}

// Compact metric card for smaller spaces
interface CompactMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

function CompactMetricCard({
  title,
  value,
  subtitle,
  icon,
  className,
}: CompactMetricCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg bg-neutral-50',
        className
      )}
    >
      {icon && (
        <div className="p-2 bg-white rounded-lg text-primary-600 shadow-sm">
          {icon}
        </div>
      )}
      <div>
        <p className="text-xs text-neutral-500">{title}</p>
        <p className="text-lg font-semibold text-neutral-900">{value}</p>
        {subtitle && <p className="text-xs text-neutral-400">{subtitle}</p>}
      </div>
    </div>
  );
}

export {
  MetricCard,
  AnimatedMetricCard,
  MetricCardGrid,
  CompactMetricCard,
};

export type { MetricCardProps, AnimatedMetricCardProps, CompactMetricCardProps };
