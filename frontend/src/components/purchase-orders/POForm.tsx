import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import POLineItemsTable, { type POLineItem } from './POLineItemsTable';
import { useApprovedSuppliers, type POPayload } from '@/lib/api/purchase-orders';
import type { PurchaseOrder } from '@/types';

const poFormSchema = z.object({
  supplier: z.string().min(1, 'Supplier is required'),
  expected_delivery_date: z.string().nullable(),
  payment_terms: z.string().min(1, 'Payment terms are required'),
  shipping_address: z.string().nullable(),
  notes: z.string().nullable(),
});

type POFormValues = z.infer<typeof poFormSchema>;

interface POFormProps {
  purchaseOrder?: PurchaseOrder;
  onSubmit: (data: POPayload) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode: 'create' | 'edit';
}

const PAYMENT_TERMS = [
  { value: 'Net 15', label: 'Net 15' },
  { value: 'Net 30', label: 'Net 30' },
  { value: 'Net 45', label: 'Net 45' },
  { value: 'Net 60', label: 'Net 60' },
  { value: 'Due on Receipt', label: 'Due on Receipt' },
  { value: '2/10 Net 30', label: '2/10 Net 30' },
];

export default function POForm({
  purchaseOrder,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode,
}: POFormProps) {
  const { data: suppliers = [] } = useApprovedSuppliers();

  const [lineItems, setLineItems] = useState<POLineItem[]>(() => {
    if (purchaseOrder?.lines && purchaseOrder.lines.length > 0) {
      return purchaseOrder.lines.map(line => ({
        id: line.id,
        description: line.description,
        quantity: line.quantity,
        unit_of_measure: line.unit_of_measure,
        unit_price: line.unit_price,
      }));
    }
    return [
      {
        id: `new-${Date.now()}`,
        description: '',
        quantity: '1',
        unit_of_measure: 'EA',
        unit_price: '0.00',
      },
    ];
  });

  const form = useForm<POFormValues>({
    resolver: zodResolver(poFormSchema),
    defaultValues: {
      supplier: purchaseOrder?.supplier || '',
      expected_delivery_date: purchaseOrder?.expected_delivery_date || null,
      payment_terms: purchaseOrder?.payment_terms || 'Net 30',
      shipping_address: purchaseOrder?.shipping_address || '',
      notes: purchaseOrder?.notes || '',
    },
  });

  // Update form when purchaseOrder changes (for edit mode)
  useEffect(() => {
    if (purchaseOrder) {
      form.reset({
        supplier: purchaseOrder.supplier,
        expected_delivery_date: purchaseOrder.expected_delivery_date,
        payment_terms: purchaseOrder.payment_terms,
        shipping_address: purchaseOrder.shipping_address || '',
        notes: purchaseOrder.notes || '',
      });

      if (purchaseOrder.lines && purchaseOrder.lines.length > 0) {
        setLineItems(
          purchaseOrder.lines.map(line => ({
            id: line.id,
            description: line.description,
            quantity: line.quantity,
            unit_of_measure: line.unit_of_measure,
            unit_price: line.unit_price,
          }))
        );
      }
    }
  }, [purchaseOrder, form]);

  const handleFormSubmit = async (data: POFormValues) => {
    // Validate line items
    const validItems = lineItems.filter(item => item.description.trim() !== '');
    if (validItems.length === 0) {
      form.setError('root', {
        message: 'At least one line item with a description is required',
      });
      return;
    }

    const payload: POPayload = {
      supplier: data.supplier,
      expected_delivery_date: data.expected_delivery_date || null,
      payment_terms: data.payment_terms,
      shipping_address: data.shipping_address || null,
      notes: data.notes || null,
      lines: validItems.map(item => ({
        id: item.id.startsWith('new-') ? undefined : item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_of_measure: item.unit_of_measure,
      })),
    };

    await onSubmit(payload);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        {form.formState.errors.root && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
          </div>
        )}

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Order Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map(supplier => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name} ({supplier.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment terms" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_TERMS.map(term => (
                          <SelectItem key={term.value} value={term.value}>
                            {term.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="expected_delivery_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Delivery Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value || ''}
                      onChange={e => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shipping_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shipping Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter shipping address"
                      className="resize-none"
                      rows={3}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <POLineItemsTable items={lineItems} onChange={setLineItems} />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Add any notes or special instructions..."
                      className="resize-none"
                      rows={4}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'create'
                ? 'Creating...'
                : 'Saving...'
              : mode === 'create'
              ? 'Create Purchase Order'
              : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
