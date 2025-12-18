import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Trash2, X, Loader2 } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import type { BulkActionResult } from '@/types';

// Re-export for backwards compatibility
export type { BulkActionResult } from '@/types';

export interface BulkActionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onApprove?: () => Promise<BulkActionResult | void> | void;
  onReject?: () => Promise<BulkActionResult | void> | void;
  onDelete?: () => Promise<BulkActionResult | void> | void;
  approveLabel?: string;
  rejectLabel?: string;
  deleteLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function BulkActionToolbar({
  selectedCount,
  onClearSelection,
  onApprove,
  onReject,
  onDelete,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
  deleteLabel = 'Delete',
  className,
  disabled = false,
}: BulkActionToolbarProps) {
  const [isApproving, setIsApproving] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsApproving(true);
    try {
      await onApprove();
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setIsRejecting(true);
    try {
      await onReject();
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const isProcessing = isApproving || isRejecting || isDeleting;

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
            'bg-white border border-neutral-200 rounded-xl shadow-xl',
            'px-4 py-3 flex items-center gap-4',
            className
          )}
        >
          {/* Selection count */}
          <div className="flex items-center gap-2 pr-4 border-r border-neutral-200">
            <span className="bg-primary-100 text-primary-700 px-2.5 py-1 rounded-full text-sm font-medium">
              {selectedCount}
            </span>
            <span className="text-sm text-neutral-600">
              {selectedCount === 1 ? 'item selected' : 'items selected'}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {onApprove && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleApprove}
                disabled={disabled || isProcessing}
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                )}
                {approveLabel}
              </Button>
            )}

            {onReject && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleReject}
                disabled={disabled || isProcessing}
                className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300"
              >
                {isRejecting ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-1.5" />
                )}
                {rejectLabel}
              </Button>
            )}

            {onDelete && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                disabled={disabled || isProcessing}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1.5" />
                )}
                {deleteLabel}
              </Button>
            )}
          </div>

          {/* Clear selection */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            disabled={isProcessing}
            className="text-neutral-500 hover:text-neutral-700 ml-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BulkActionToolbar;
