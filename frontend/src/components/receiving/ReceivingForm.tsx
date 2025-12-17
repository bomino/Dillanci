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
  usePOsForReceiving,
  usePOForReceiving,
  type GoodsReceiptPayload,
} from '@/lib/api/receiving';
import type { GoodsReceipt, POLine } from '@/types';

const receivingFormSchema = z.object({
  purchase_order: z.string().min(1, 'Purchase Order is required'),
  receipt_date: z.string().min(1, 'Receipt date is required'),
  delivery_note_number: z.string().nullable(),
  notes: z.string().nullable(),
});

type ReceivingFormValues = z.infer<typeof receivingFormSchema>;

interface LineQuantity {
  po_line: string;
  quantity_received: string;
  notes: string;
}

interface ReceivingFormProps {
  goodsReceipt?: GoodsReceipt;
  onSubmit: (data: GoodsReceiptPayload) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode: 'create' | 'edit';
}

export default function ReceivingForm({
  goodsReceipt,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode,
}: ReceivingFormProps) {
  const { data: availablePOs = [] } = usePOsForReceiving();
  const [selectedPOId, setSelectedPOId] = useState<string>(goodsReceipt?.purchase_order || '');
  const { data: selectedPO } = usePOForReceiving(selectedPOId);
  const [lineQuantities, setLineQuantities] = useState<LineQuantity[]>([]);

  const form = useForm<ReceivingFormValues>({
    resolver: zodResolver(receivingFormSchema),
    defaultValues: {
      purchase_order: goodsReceipt?.purchase_order || '',
      receipt_date: goodsReceipt?.receipt_date || new Date().toISOString().split('T')[0],
      delivery_note_number: goodsReceipt?.delivery_note_number || '',
      notes: goodsReceipt?.notes || '',
    },
  });

  // Initialize line quantities when PO is selected or when editing
  useEffect(() => {
    if (goodsReceipt?.lines && mode === 'edit') {
      setLineQuantities(
        goodsReceipt.lines.map(line => ({
          po_line: line.po_line,
          quantity_received: line.quantity_received,
          notes: line.notes || '',
        }))
      );
    } else if (selectedPO?.lines) {
      setLineQuantities(
        selectedPO.lines
          .filter(line => {
            // Only show lines with remaining quantity
            const ordered = parseFloat(line.quantity);
            const received = parseFloat(line.quantity_received);
            return received < ordered;
          })
          .map(line => ({
            po_line: line.id,
            quantity_received: '',
            notes: '',
          }))
      );
    }
  }, [selectedPO, goodsReceipt, mode]);

  // Update form when goodsReceipt changes
  useEffect(() => {
    if (goodsReceipt) {
      form.reset({
        purchase_order: goodsReceipt.purchase_order,
        receipt_date: goodsReceipt.receipt_date,
        delivery_note_number: goodsReceipt.delivery_note_number || '',
        notes: goodsReceipt.notes || '',
      });
      setSelectedPOId(goodsReceipt.purchase_order);
    }
  }, [goodsReceipt, form]);

  const handlePOChange = (poId: string) => {
    setSelectedPOId(poId);
    form.setValue('purchase_order', poId);
  };

  const updateLineQuantity = (poLineId: string, field: keyof LineQuantity, value: string) => {
    setLineQuantities(prev =>
      prev.map(line =>
        line.po_line === poLineId ? { ...line, [field]: value } : line
      )
    );
  };

  const getRemainingQuantity = (line: POLine): number => {
    const ordered = parseFloat(line.quantity) || 0;
    const received = parseFloat(line.quantity_received) || 0;
    return ordered - received;
  };

  const handleFormSubmit = async (data: ReceivingFormValues) => {
    // Filter out lines with no quantity received
    const validLines = lineQuantities.filter(
      line => line.quantity_received && parseFloat(line.quantity_received) > 0
    );

    if (validLines.length === 0) {
      form.setError('root', {
        message: 'At least one line item must have a quantity received',
      });
      return;
    }

    const payload: GoodsReceiptPayload = {
      purchase_order: data.purchase_order,
      receipt_date: data.receipt_date,
      delivery_note_number: data.delivery_note_number || null,
      notes: data.notes || null,
      lines: validLines.map(line => ({
        po_line: line.po_line,
        quantity_received: line.quantity_received,
        notes: line.notes || null,
      })),
    };

    await onSubmit(payload);
  };

  const selectedPOData = availablePOs.find(po => po.id === selectedPOId);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        {form.formState.errors.root && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
          </div>
        )}

        {/* Receipt Information */}
        <Card>
          <CardHeader>
            <CardTitle>Receipt Information</CardTitle>
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
                name="receipt_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipt Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="delivery_note_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Note Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter supplier's delivery note number"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedPOData && (
              <div className="bg-neutral-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-neutral-700 mb-2">PO Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-neutral-500">Supplier:</span>
                    <p className="font-medium">{selectedPOData.supplier_name}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500">Order Date:</span>
                    <p className="font-medium">{selectedPOData.order_date}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500">Expected Delivery:</span>
                    <p className="font-medium">{selectedPOData.expected_delivery_date || '-'}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500">Status:</span>
                    <p className="font-medium">{selectedPOData.status}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items */}
        {selectedPO && selectedPO.lines && selectedPO.lines.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Items to Receive</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[100px] text-right">Ordered</TableHead>
                      <TableHead className="w-[100px] text-right">Received</TableHead>
                      <TableHead className="w-[100px] text-right">Remaining</TableHead>
                      <TableHead className="w-[120px]">Qty to Receive</TableHead>
                      <TableHead className="w-[200px]">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPO.lines
                      .filter(line => {
                        // Show all lines in edit mode, only pending in create mode
                        if (mode === 'edit') return true;
                        const remaining = getRemainingQuantity(line);
                        return remaining > 0;
                      })
                      .map(line => {
                        const remaining = getRemainingQuantity(line);
                        const lineQty = lineQuantities.find(lq => lq.po_line === line.id);
                        const isFullyReceived = remaining <= 0;

                        return (
                          <TableRow key={line.id} className={isFullyReceived ? 'opacity-50' : ''}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{line.description}</p>
                                <p className="text-sm text-neutral-500">{line.unit_of_measure}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{line.quantity}</TableCell>
                            <TableCell className="text-right">{line.quantity_received}</TableCell>
                            <TableCell className="text-right">
                              <span className={remaining > 0 ? 'text-amber-600 font-medium' : 'text-green-600'}>
                                {remaining}
                              </span>
                            </TableCell>
                            <TableCell>
                              {!isFullyReceived && (
                                <Input
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  placeholder="0"
                                  value={lineQty?.quantity_received || ''}
                                  onChange={e => updateLineQuantity(line.id, 'quantity_received', e.target.value)}
                                  className="w-full"
                                />
                              )}
                              {isFullyReceived && (
                                <span className="text-sm text-green-600">Fully received</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {!isFullyReceived && (
                                <Input
                                  placeholder="Notes..."
                                  value={lineQty?.notes || ''}
                                  onChange={e => updateLineQuantity(line.id, 'notes', e.target.value)}
                                  className="w-full"
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

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
                      placeholder="Add any notes about this delivery..."
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
              ? 'Create Receipt'
              : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
