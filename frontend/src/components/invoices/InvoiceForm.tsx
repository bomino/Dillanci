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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  usePOsForInvoice,
  type InvoicePayload,
} from '@/lib/api/invoices';
import type { Invoice, PurchaseOrder } from '@/types';

const invoiceFormSchema = z.object({
  purchase_order: z.string().min(1, 'Purchase Order is required'),
  supplier_invoice_number: z.string().min(1, 'Supplier invoice number is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  tax_amount: z.string().optional(),
  notes: z.string().nullable(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

interface LineItem {
  po_line: string | null;
  description: string;
  quantity: string;
  unit_price: string;
}

interface InvoiceFormProps {
  invoice?: Invoice;
  onSubmit: (data: InvoicePayload) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode: 'create' | 'edit';
}

const formatCurrency = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

export default function InvoiceForm({
  invoice,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode,
}: InvoiceFormProps) {
  const { data: availablePOs = [] } = usePOsForInvoice();
  const [selectedPOId, setSelectedPOId] = useState<string>(invoice?.purchase_order || '');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      purchase_order: invoice?.purchase_order || '',
      supplier_invoice_number: invoice?.supplier_invoice_number || '',
      invoice_date: invoice?.invoice_date || new Date().toISOString().split('T')[0],
      due_date: invoice?.due_date || '',
      tax_amount: invoice?.tax_amount || '0',
      notes: invoice?.notes || '',
    },
  });

  // Find selected PO
  useEffect(() => {
    if (selectedPOId) {
      const po = availablePOs.find(p => p.id === selectedPOId);
      setSelectedPO(po || null);
    } else {
      setSelectedPO(null);
    }
  }, [selectedPOId, availablePOs]);

  // Initialize line items when PO is selected or when editing
  useEffect(() => {
    if (invoice?.lines && mode === 'edit') {
      setLineItems(
        invoice.lines.map(line => ({
          po_line: line.po_line,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
        }))
      );
    } else if (selectedPO?.lines) {
      setLineItems(
        selectedPO.lines.map(line => ({
          po_line: line.id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
        }))
      );
    }
  }, [selectedPO, invoice, mode]);

  // Update form when invoice changes
  useEffect(() => {
    if (invoice) {
      form.reset({
        purchase_order: invoice.purchase_order,
        supplier_invoice_number: invoice.supplier_invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        tax_amount: invoice.tax_amount,
        notes: invoice.notes || '',
      });
      setSelectedPOId(invoice.purchase_order);
    }
  }, [invoice, form]);

  const handlePOChange = (poId: string) => {
    setSelectedPOId(poId);
    form.setValue('purchase_order', poId);

    // Calculate default due date based on payment terms
    const po = availablePOs.find(p => p.id === poId);
    if (po) {
      const invoiceDate = form.getValues('invoice_date') || new Date().toISOString().split('T')[0];
      const dueDate = calculateDueDate(invoiceDate, po.payment_terms);
      form.setValue('due_date', dueDate);
    }
  };

  const calculateDueDate = (invoiceDate: string, paymentTerms: string): string => {
    const date = new Date(invoiceDate);
    // Parse payment terms like "Net 30", "Net 15", etc.
    const match = paymentTerms.match(/Net\s*(\d+)/i);
    const days = match ? parseInt(match[1], 10) : 30;
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    setLineItems(prev =>
      prev.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      )
    );
  };

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { po_line: null, description: '', quantity: '1', unit_price: '0' },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const calculateSubtotal = (): number => {
    return lineItems.reduce((sum, line) => {
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  };

  const calculateTotal = (): number => {
    const subtotal = calculateSubtotal();
    const tax = parseFloat(form.watch('tax_amount') || '0');
    return subtotal + tax;
  };

  const handleFormSubmit = async (data: InvoiceFormValues) => {
    if (lineItems.length === 0) {
      form.setError('root', {
        message: 'At least one line item is required',
      });
      return;
    }

    const validLines = lineItems.filter(
      line => line.description && parseFloat(line.quantity) > 0 && parseFloat(line.unit_price) >= 0
    );

    if (validLines.length === 0) {
      form.setError('root', {
        message: 'At least one line item with valid description, quantity, and price is required',
      });
      return;
    }

    const payload: InvoicePayload = {
      purchase_order: data.purchase_order,
      supplier_invoice_number: data.supplier_invoice_number,
      invoice_date: data.invoice_date,
      due_date: data.due_date,
      tax_amount: data.tax_amount || '0',
      notes: data.notes || null,
      lines: validLines.map(line => ({
        po_line: line.po_line,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
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

        {/* Invoice Information */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="purchase_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Order *</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        handlePOChange(value);
                      }}
                      value={field.value}
                      disabled={mode === 'edit'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a Purchase Order" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availablePOs.map(po => (
                          <SelectItem key={po.id} value={po.id}>
                            {po.number} - {po.supplier_name}
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
                name="supplier_invoice_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Invoice Number *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., INV-2024-001"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoice_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedPO && (
              <div className="bg-neutral-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-neutral-700 mb-2">PO Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-neutral-500">Supplier:</span>
                    <p className="font-medium">{selectedPO.supplier_name}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500">Order Date:</span>
                    <p className="font-medium">{selectedPO.order_date}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500">PO Amount:</span>
                    <p className="font-medium">{formatCurrency(selectedPO.total_amount)}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500">Payment Terms:</span>
                    <p className="font-medium">{selectedPO.payment_terms}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
              Add Line
            </Button>
          </CardHeader>
          <CardContent>
            {lineItems.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <p>No line items. Select a PO to auto-populate or add lines manually.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Description</TableHead>
                      <TableHead className="w-[15%] text-right">Quantity</TableHead>
                      <TableHead className="w-[20%] text-right">Unit Price</TableHead>
                      <TableHead className="w-[20%] text-right">Amount</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((line, index) => {
                      const amount = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0);
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              value={line.description}
                              onChange={e => updateLineItem(index, 'description', e.target.value)}
                              placeholder="Item description"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.quantity}
                              onChange={e => updateLineItem(index, 'quantity', e.target.value)}
                              className="text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unit_price}
                              onChange={e => updateLineItem(index, 'unit_price', e.target.value)}
                              className="text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(amount)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              &times;
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Totals */}
            {lineItems.length > 0 && (
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Tax:</span>
                    <FormField
                      control={form.control}
                      name="tax_amount"
                      render={({ field }) => (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          {...field}
                          className="w-24 text-right"
                        />
                      )}
                    />
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Total:</span>
                    <span className="font-semibold text-lg">{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              </div>
            )}
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
                      placeholder="Add any notes about this invoice..."
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
          <Button type="submit" disabled={isSubmitting || !selectedPOId}>
            {isSubmitting
              ? mode === 'create'
                ? 'Creating...'
                : 'Saving...'
              : mode === 'create'
              ? 'Create Invoice'
              : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
