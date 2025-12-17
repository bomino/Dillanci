import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FieldWrapper as FormField } from '@/components/ui/form-field';

import LineItemsTable, { type LineItem } from './LineItemsTable';
import {
  departmentOptions,
  requisitionPriorityConfig,
  type RequisitionPayload,
  type RequisitionLinePayload,
} from '@/lib/api/requisitions';
import type { Requisition, RequisitionPriority } from '@/types';

// Validation schema
const requisitionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).nullable().optional(),
  department: z.string().min(1, 'Department is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  required_date: z.string().nullable().optional(),
  currency: z.string().min(1),
});

type RequisitionFormData = z.infer<typeof requisitionSchema>;

interface RequisitionFormProps {
  initialData?: Requisition;
  onSubmit: (data: RequisitionPayload) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
}

export default function RequisitionForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = 'create',
}: RequisitionFormProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RequisitionFormData>({
    resolver: zodResolver(requisitionSchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      department: initialData?.department || '',
      priority: initialData?.priority || 'MEDIUM',
      required_date: initialData?.required_date || '',
      currency: initialData?.currency || 'USD',
    },
  });

  // Initialize line items from initialData
  useEffect(() => {
    if (initialData?.lines && initialData.lines.length > 0) {
      setLineItems(
        initialData.lines.map(line => ({
          id: line.id,
          description: line.description,
          quantity: line.quantity,
          unit_of_measure: line.unit_of_measure,
          estimated_unit_price: line.estimated_unit_price || '',
          notes: line.notes || '',
        }))
      );
    } else if (mode === 'create') {
      // Add one empty line item for new requisitions
      setLineItems([
        {
          id: `temp-${Date.now()}`,
          description: '',
          quantity: '1',
          unit_of_measure: 'EA',
          estimated_unit_price: '',
          notes: '',
        },
      ]);
    }
  }, [initialData, mode]);

  const priority = watch('priority');
  const department = watch('department');

  // Validate line items
  const validateLineItems = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (lineItems.length === 0) {
      newErrors['lines'] = 'At least one line item is required';
      isValid = false;
    }

    lineItems.forEach((item, index) => {
      if (!item.description.trim()) {
        newErrors[`lines.${index}`] = 'Description is required';
        isValid = false;
      }
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        newErrors[`lines.${index}`] = 'Quantity must be greater than 0';
        isValid = false;
      }
    });

    setLineErrors(newErrors);
    return isValid;
  };

  const handleFormSubmit = (data: RequisitionFormData) => {
    // Validate line items
    if (!validateLineItems()) {
      return;
    }

    // Transform line items to payload format
    const lines: RequisitionLinePayload[] = lineItems.map(item => ({
      id: item.id.startsWith('temp-') ? undefined : item.id,
      description: item.description,
      quantity: item.quantity,
      unit_of_measure: item.unit_of_measure,
      estimated_unit_price: item.estimated_unit_price || null,
      notes: item.notes || null,
    }));

    const payload: RequisitionPayload = {
      title: data.title,
      description: data.description || null,
      department: data.department,
      priority: data.priority as RequisitionPriority,
      required_date: data.required_date || null,
      currency: data.currency,
      lines,
    };

    onSubmit(payload);
  };

  // Calculate total
  const calculateTotal = (): number => {
    return lineItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.estimated_unit_price) || 0;
      return sum + qty * price;
    }, 0);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <FileText className="h-5 w-5 text-primary-700" />
            </div>
            <div>
              <CardTitle>Requisition Details</CardTitle>
              <CardDescription>Basic information about this request</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Title" error={errors.title?.message} required>
            <Input
              {...register('title')}
              placeholder="Brief description of what you need"
              error={errors.title?.message}
            />
          </FormField>

          <FormField label="Description" error={errors.description?.message}>
            <Textarea
              {...register('description')}
              placeholder="Provide additional details about this request..."
              rows={3}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Department" error={errors.department?.message} required>
              <Select
                value={department}
                onValueChange={(value) => setValue('department', value)}
              >
                <SelectTrigger error={!!errors.department}>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departmentOptions.map(dept => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Priority" error={errors.priority?.message} required>
              <Select
                value={priority}
                onValueChange={(value) => setValue('priority', value as RequisitionPriority)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(requisitionPriorityConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Required By" error={errors.required_date?.message}>
              <Input
                type="date"
                {...register('required_date')}
                min={new Date().toISOString().split('T')[0]}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Currency" error={errors.currency?.message}>
              <Select
                value={watch('currency')}
                onValueChange={(value) => setValue('currency', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <LineItemsTable
        items={lineItems}
        onChange={setLineItems}
        disabled={isSubmitting}
        errors={lineErrors}
      />

      {/* Line items validation error */}
      {lineErrors['lines'] && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-600">{lineErrors['lines']}</p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-neutral-500">
          Estimated Total:{' '}
          <span className="text-lg font-semibold text-neutral-900">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: watch('currency') || 'USD',
            }).format(calculateTotal())}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'create'
                ? 'Creating...'
                : 'Saving...'
              : mode === 'create'
              ? 'Create Requisition'
              : 'Save Changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}
