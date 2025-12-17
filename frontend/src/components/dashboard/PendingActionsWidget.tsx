import * as React from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  FileCheck,
  FileText,
  ShoppingCart,
  FileSignature,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, StatusBadge, Skeleton } from '@/components/ui';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import type { PendingAction } from '@/lib/api/dashboard';

interface PendingActionsWidgetProps {
  actions: PendingAction[];
  loading?: boolean;
  onActionClick?: (action: PendingAction) => void;
  className?: string;
}

const actionTypeIcons: Record<string, React.ReactNode> = {
  PO_APPROVAL: <ShoppingCart className="h-4 w-4" />,
  INVOICE_MATCH: <FileCheck className="h-4 w-4" />,
  RFQ_RESPONSE: <FileText className="h-4 w-4" />,
  CONTRACT_RENEWAL: <FileSignature className="h-4 w-4" />,
};

const actionTypeLabels: Record<string, string> = {
  PO_APPROVAL: 'PO Approval',
  INVOICE_MATCH: 'Invoice Match',
  RFQ_RESPONSE: 'RFQ Response',
  CONTRACT_RENEWAL: 'Contract Renewal',
};

export function PendingActionsWidget({
  actions,
  loading = false,
  onActionClick,
  className,
}: PendingActionsWidgetProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Pending Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="space-y-2 text-right">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16" />
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
          <AlertCircle className="h-5 w-5 text-warning" />
          Pending Actions
        </CardTitle>
        <span className="text-sm text-neutral-500">
          {actions.length} {actions.length === 1 ? 'item' : 'items'}
        </span>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <FileCheck className="h-6 w-6 text-success" />
            </div>
            <p className="text-neutral-600 font-medium">All caught up!</p>
            <p className="text-sm text-neutral-500 mt-1">No pending actions at the moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {actions.map((action, index) => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                onClick={() => onActionClick?.(action)}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg text-primary-700 shadow-sm">
                    {actionTypeIcons[action.type] || <FileText className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 flex items-center gap-2">
                      {actionTypeLabels[action.type] || action.type}
                      <ChevronRight className="h-4 w-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                    <p className="text-sm text-neutral-500">
                      {action.item_number} - {action.supplier_name}
                    </p>
                    {action.due_date && (
                      <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due {formatRelativeTime(action.due_date)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-neutral-900">
                    {formatCurrency(action.amount)}
                  </p>
                  <StatusBadge status={action.status} className="text-xs" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PendingActionsWidget;
