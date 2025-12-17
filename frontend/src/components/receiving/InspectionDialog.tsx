import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { ClipboardCheck, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { GoodsReceiptLine } from '@/types';

export type InspectionStatus = 'PENDING' | 'PASSED' | 'FAILED';

export interface LineInspection {
  line_id: string;
  inspection_status: InspectionStatus;
  quantity_accepted: number;
  quantity_rejected: number;
  inspection_notes: string;
}

export interface InspectionFormData {
  inspector_name: string;
  inspection_date: string;
  overall_notes: string;
  lines: LineInspection[];
}

interface InspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: GoodsReceiptLine[];
  grNumber: string;
  onSubmit: (data: InspectionFormData) => Promise<void>;
  isSubmitting?: boolean;
}

const inspectionStatusConfig: Record<InspectionStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  PENDING: { label: 'Pending', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: AlertCircle },
  PASSED: { label: 'Passed', color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: CheckCircle },
  FAILED: { label: 'Failed', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
};

export function InspectionDialog({
  open,
  onOpenChange,
  lines,
  grNumber,
  onSubmit,
  isSubmitting = false,
}: InspectionDialogProps) {
  const today = new Date().toISOString().split('T')[0];

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<InspectionFormData>({
    defaultValues: {
      inspector_name: '',
      inspection_date: today,
      overall_notes: '',
      lines: lines.map(line => ({
        line_id: line.id,
        inspection_status: 'PENDING' as InspectionStatus,
        quantity_accepted: parseFloat(line.quantity_received) || 0,
        quantity_rejected: 0,
        inspection_notes: '',
      })),
    },
  });

  const { fields } = useFieldArray({
    control,
    name: 'lines',
  });

  // Reset form when dialog opens with new lines
  React.useEffect(() => {
    if (open) {
      reset({
        inspector_name: '',
        inspection_date: today,
        overall_notes: '',
        lines: lines.map(line => ({
          line_id: line.id,
          inspection_status: 'PENDING' as InspectionStatus,
          quantity_accepted: parseFloat(line.quantity_received) || 0,
          quantity_rejected: 0,
          inspection_notes: '',
        })),
      });
    }
  }, [open, lines, reset, today]);

  const watchedLines = watch('lines');

  const handleQuantityChange = (index: number, field: 'accepted' | 'rejected', value: number) => {
    const line = lines[index];
    const totalReceived = parseFloat(line.quantity_received) || 0;

    if (field === 'accepted') {
      const accepted = Math.min(Math.max(0, value), totalReceived);
      setValue(`lines.${index}.quantity_accepted`, accepted);
      setValue(`lines.${index}.quantity_rejected`, totalReceived - accepted);
    } else {
      const rejected = Math.min(Math.max(0, value), totalReceived);
      setValue(`lines.${index}.quantity_rejected`, rejected);
      setValue(`lines.${index}.quantity_accepted`, totalReceived - rejected);
    }

    // Auto-update status based on quantities
    const accepted = watch(`lines.${index}.quantity_accepted`);
    const rejected = watch(`lines.${index}.quantity_rejected`);

    if (rejected === 0) {
      setValue(`lines.${index}.inspection_status`, 'PASSED');
    } else if (accepted === 0) {
      setValue(`lines.${index}.inspection_status`, 'FAILED');
    }
  };

  const handleStatusChange = (index: number, status: InspectionStatus) => {
    const line = lines[index];
    const totalReceived = parseFloat(line.quantity_received) || 0;

    setValue(`lines.${index}.inspection_status`, status);

    // Auto-update quantities based on status
    if (status === 'PASSED') {
      setValue(`lines.${index}.quantity_accepted`, totalReceived);
      setValue(`lines.${index}.quantity_rejected`, 0);
    } else if (status === 'FAILED') {
      setValue(`lines.${index}.quantity_accepted`, 0);
      setValue(`lines.${index}.quantity_rejected`, totalReceived);
    }
  };

  const onFormSubmit = async (data: InspectionFormData) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  const totalItems = lines.length;
  const passedItems = watchedLines.filter(l => l.inspection_status === 'PASSED').length;
  const failedItems = watchedLines.filter(l => l.inspection_status === 'FAILED').length;
  const pendingItems = watchedLines.filter(l => l.inspection_status === 'PENDING').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-cyan-600" />
            Quality Inspection
          </DialogTitle>
          <DialogDescription>
            Perform quality inspection for goods receipt {grNumber}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          {/* Inspection Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-neutral-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-semibold text-neutral-900">{totalItems}</p>
              <p className="text-xs text-neutral-500">Total Items</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-semibold text-emerald-600">{passedItems}</p>
              <p className="text-xs text-emerald-600">Passed</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-semibold text-red-600">{failedItems}</p>
              <p className="text-xs text-red-600">Failed</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-semibold text-amber-600">{pendingItems}</p>
              <p className="text-xs text-amber-600">Pending</p>
            </div>
          </div>

          {/* Inspector Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Inspector Name <span className="text-red-500">*</span>
              </label>
              <Input
                {...register('inspector_name', { required: 'Inspector name is required' })}
                placeholder="Enter inspector name"
              />
              {errors.inspector_name && (
                <p className="text-xs text-red-500">{errors.inspector_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Inspection Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                {...register('inspection_date', { required: 'Inspection date is required' })}
              />
              {errors.inspection_date && (
                <p className="text-xs text-red-500">{errors.inspection_date.message}</p>
              )}
            </div>
          </div>

          {/* Line Items Inspection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">Line Item Inspection</label>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[80px] text-right">Received</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[100px] text-right">Accepted</TableHead>
                    <TableHead className="w-[100px] text-right">Rejected</TableHead>
                    <TableHead className="w-[180px]">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const line = lines[index];
                    const status = watchedLines[index]?.inspection_status || 'PENDING';
                    const StatusIcon = inspectionStatusConfig[status].icon;
                    const totalReceived = parseFloat(line.quantity_received) || 0;

                    return (
                      <TableRow key={field.id}>
                        <TableCell className="font-medium text-neutral-500">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="font-medium text-neutral-900 truncate">
                              {line.po_line_description}
                            </p>
                            <p className="text-xs text-neutral-500">{line.unit_of_measure}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {line.quantity_received}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={status}
                            onValueChange={(value) => handleStatusChange(index, value as InspectionStatus)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue>
                                <span className={cn(
                                  'flex items-center gap-1.5 text-xs',
                                  inspectionStatusConfig[status].color
                                )}>
                                  <StatusIcon className="h-3.5 w-3.5" />
                                  {inspectionStatusConfig[status].label}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(inspectionStatusConfig).map(([key, config]) => {
                                const Icon = config.icon;
                                return (
                                  <SelectItem key={key} value={key}>
                                    <span className={cn('flex items-center gap-1.5', config.color)}>
                                      <Icon className="h-3.5 w-3.5" />
                                      {config.label}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={totalReceived}
                            className="h-8 w-20 text-right text-emerald-600"
                            value={watchedLines[index]?.quantity_accepted || 0}
                            onChange={(e) => handleQuantityChange(index, 'accepted', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={totalReceived}
                            className="h-8 w-20 text-right text-red-600"
                            value={watchedLines[index]?.quantity_rejected || 0}
                            onChange={(e) => handleQuantityChange(index, 'rejected', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            {...register(`lines.${index}.inspection_notes`)}
                            className="h-8 text-xs"
                            placeholder="Add notes..."
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Overall Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">Overall Inspection Notes</label>
            <Textarea
              {...register('overall_notes')}
              placeholder="Add any overall inspection observations or comments..."
              className="min-h-[80px]"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || pendingItems > 0}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Complete Inspection
                </>
              )}
            </Button>
          </DialogFooter>

          {pendingItems > 0 && (
            <p className="text-xs text-amber-600 text-center">
              Please inspect all {pendingItems} pending item(s) before completing the inspection.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default InspectionDialog;
