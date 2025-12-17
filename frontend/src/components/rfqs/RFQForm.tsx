import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, FormActions } from '@/components/ui/form-field';
import RFQLineItemsTable, { type RFQLineItem } from './RFQLineItemsTable';

import type { RFQ } from '@/types';
import type { RFQPayload } from '@/lib/api/rfqs';

// Form validation schema
const rfqFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().min(1, 'Description is required'),
  close_date: z.string().nullable(),
});

type RFQFormData = z.infer<typeof rfqFormSchema>;

interface RFQFormProps {
  initialData?: RFQ;
  onSubmit: (data: RFQPayload) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
}

export default function RFQForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = 'create',
}: RFQFormProps) {
  // Initialize line items from initial data
  const [lineItems, setLineItems] = useState<RFQLineItem[]>(() => {
    if (initialData?.lines) {
      return initialData.lines.map(line => ({
        id: line.id,
        description: line.description,
        quantity: line.quantity,
        unit_of_measure: line.unit_of_measure,
        target_unit_price: line.target_unit_price || '',
      }));
    }
    return [];
  });

  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});

  const {
    control,
    handleSubmit,
  } = useForm<RFQFormData>({
    resolver: zodResolver(rfqFormSchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      close_date: initialData?.close_date || '',
    },
  });

  // Validate line items
  const validateLineItems = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (lineItems.length === 0) {
      isValid = false;
    }

    lineItems.forEach((item, index) => {
      if (!item.description.trim()) {
        newErrors[`lines.${index}`] = 'Description is required';
        isValid = false;
      } else if (!item.quantity || parseFloat(item.quantity) <= 0) {
        newErrors[`lines.${index}`] = 'Valid quantity is required';
        isValid = false;
      }
    });

    setLineErrors(newErrors);
    return isValid;
  };

  // Handle form submission
  const handleFormSubmit = async (formData: RFQFormData) => {
    // Validate line items
    if (!validateLineItems()) {
      return;
    }

    // Build payload
    const payload: RFQPayload = {
      title: formData.title,
      description: formData.description,
      close_date: formData.close_date || null,
      lines: lineItems.map(item => ({
        id: item.id.startsWith('temp-') ? undefined : item.id,
        description: item.description,
        quantity: item.quantity,
        unit_of_measure: item.unit_of_measure,
        target_unit_price: item.target_unit_price || null,
      })),
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>RFQ Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={control}
            name="title"
            label="Title"
            required
          >
            {({ field, error }) => (
              <Input
                {...field}
                placeholder="Enter a descriptive title for this RFQ"
                error={error?.message}
                disabled={isSubmitting}
              />
            )}
          </FormField>

          <FormField
            control={control}
            name="description"
            label="Description"
            description="Provide details about what you're looking for"
            required
          >
            {({ field, error }) => (
              <Textarea
                {...field}
                placeholder="Describe the items or services you need quotes for..."
                rows={4}
                className={error ? 'border-red-300' : ''}
                disabled={isSubmitting}
              />
            )}
          </FormField>

          <FormField
            control={control}
            name="close_date"
            label="Close Date"
            description="When should suppliers submit their quotes by?"
          >
            {({ field, error }) => (
              <Input
                {...field}
                type="date"
                value={field.value || ''}
                error={error?.message}
                disabled={isSubmitting}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      {/* Line Items */}
      <RFQLineItemsTable
        items={lineItems}
        onChange={setLineItems}
        disabled={isSubmitting}
        errors={lineErrors}
      />

      {/* Validation error for empty line items */}
      {lineItems.length === 0 && Object.keys(lineErrors).length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-600">
            Please add at least one line item to your RFQ.
          </p>
        </div>
      )}

      {/* Form Actions */}
      <FormActions align="right">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === 'create'
              ? 'Creating...'
              : 'Saving...'
            : mode === 'create'
              ? 'Create RFQ'
              : 'Save Changes'}
        </Button>
      </FormActions>
    </form>
  );
}
