import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileText, Save, Globe, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { FieldWrapper as FormField } from '@/components/ui/form-field';

import {
  useCreateRequisitionTemplate,
  type CreateTemplateData,
} from '@/lib/api/requisition-templates';
import type { LineItem } from './LineItemsTable';

// Form validation schema
const saveTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  is_public: z.boolean().default(false),
});

type SaveTemplateFormData = z.infer<typeof saveTemplateSchema>;

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  currency: string;
  lineItems: LineItem[];
  requisitionTitle?: string;
  onSuccess?: () => void;
}

export default function SaveAsTemplateDialog({
  open,
  onOpenChange,
  department,
  priority,
  currency,
  lineItems,
  requisitionTitle,
  onSuccess,
}: SaveAsTemplateDialogProps) {
  const createTemplate = useCreateRequisitionTemplate();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SaveTemplateFormData>({
    resolver: zodResolver(saveTemplateSchema),
    defaultValues: {
      name: requisitionTitle ? `${requisitionTitle} Template` : '',
      description: '',
      is_public: false,
    },
  });

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      reset({
        name: requisitionTitle ? `${requisitionTitle} Template` : '',
        description: '',
        is_public: false,
      });
    }
  }, [open, requisitionTitle, reset]);

  const isPublic = watch('is_public');

  const onSubmit = async (data: SaveTemplateFormData) => {
    const templateData: CreateTemplateData = {
      name: data.name,
      description: data.description || null,
      department,
      priority,
      currency,
      is_public: data.is_public,
      lines: lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_of_measure: item.unit_of_measure,
        estimated_unit_price: item.estimated_unit_price || null,
        notes: item.notes || null,
      })),
    };

    try {
      await createTemplate.mutateAsync(templateData);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const totalEstimate = lineItems.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.estimated_unit_price) || 0;
    return sum + qty * price;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 text-primary-600" />
            Save as Template
          </DialogTitle>
          <DialogDescription>
            Save this requisition as a reusable template for future use. You can quickly create new
            requisitions from this template.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <FormField label="Template Name" error={errors.name?.message} required>
            <Input
              {...register('name')}
              placeholder="e.g., Monthly Office Supplies"
              error={errors.name?.message}
            />
          </FormField>

          <FormField label="Description" error={errors.description?.message}>
            <Textarea
              {...register('description')}
              placeholder="Describe when to use this template..."
              rows={3}
            />
          </FormField>

          {/* Visibility toggle */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50 border border-neutral-200">
            <Checkbox
              id="is_public"
              checked={isPublic}
              onCheckedChange={(checked) => setValue('is_public', checked === true)}
            />
            <div className="flex-1">
              <Label
                htmlFor="is_public"
                className="flex items-center gap-2 cursor-pointer font-medium text-neutral-700"
              >
                {isPublic ? (
                  <>
                    <Globe className="h-4 w-4 text-green-600" />
                    Shared Template
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 text-neutral-500" />
                    Private Template
                  </>
                )}
              </Label>
              <p className="text-xs text-neutral-500 mt-1">
                {isPublic
                  ? 'Other team members can use this template'
                  : 'Only you can see and use this template'}
              </p>
            </div>
          </div>

          {/* Template preview summary */}
          <div className="p-3 rounded-lg bg-primary-50/50 border border-primary-100">
            <h4 className="text-sm font-medium text-primary-900 mb-2">Template will include:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-primary-700">
                <FileText className="h-4 w-4" />
                <span>{lineItems.length} line items</span>
              </div>
              <div className="text-primary-700">
                Est. Total:{' '}
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: currency,
                }).format(totalEstimate)}
              </div>
              <div className="text-primary-600 text-xs">Department: {department}</div>
              <div className="text-primary-600 text-xs">Priority: {priority}</div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createTemplate.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createTemplate.isPending}>
              {createTemplate.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
