/**
 * Portal RFQ Detail Page - View RFQ details and submit bids.
 */

import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  Clock,
  Building2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calendar,
  Package,
  Send,
  Edit3,
  DollarSign,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import {
  usePortalRFQ,
  useSubmitBid,
  type PortalRFQLine,
  type PortalBid,
} from '@/lib/api/portal';
import { toast } from 'sonner';

// Form schema for bid submission
const bidLineSchema = z.object({
  rfq_line: z.string(),
  unit_price: z.number().min(0.01, 'Price must be greater than 0'),
  lead_time_days: z.number().min(1, 'Lead time must be at least 1 day'),
  notes: z.string().optional(),
});

const bidFormSchema = z.object({
  validity_days: z.number().min(1, 'Validity must be at least 1 day').max(365),
  delivery_terms: z.string().min(1, 'Delivery terms are required'),
  payment_terms: z.string().min(1, 'Payment terms are required'),
  notes: z.string().optional(),
  lines: z.array(bidLineSchema),
});

type BidFormData = z.infer<typeof bidFormSchema>;

export default function PortalRFQDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showBidForm, setShowBidForm] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  const { data: rfq, isLoading, error } = usePortalRFQ(id || '');
  const submitBidMutation = useSubmitBid();

  // Check if RFQ is open and accepting bids
  const canSubmitBid = useMemo(() => {
    if (!rfq) return false;
    if (rfq.status !== 'OPEN') return false;
    if (rfq.my_bid) return false; // Already submitted
    if (rfq.due_date && isPast(new Date(rfq.due_date))) return false;
    return true;
  }, [rfq]);

  const dueDate = rfq?.due_date ? new Date(rfq.due_date) : null;
  const isOverdue = dueDate ? isPast(dueDate) : false;
  const isUrgent = dueDate && !isOverdue && (dueDate.getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000;

  // Form setup
  const form = useForm<BidFormData>({
    resolver: zodResolver(bidFormSchema),
    defaultValues: {
      validity_days: 30,
      delivery_terms: 'FOB Destination',
      payment_terms: 'Net 30',
      notes: '',
      lines: [],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  // Initialize form lines when RFQ loads
  useMemo(() => {
    if (rfq?.lines && form.getValues('lines').length === 0) {
      form.setValue(
        'lines',
        rfq.lines.map((line) => ({
          rfq_line: line.id,
          unit_price: line.target_price || 0,
          lead_time_days: 14,
          notes: '',
        }))
      );
    }
  }, [rfq?.lines, form]);

  // Calculate total bid amount
  const totalAmount = useMemo(() => {
    if (!rfq?.lines) return 0;
    const lineValues = form.watch('lines');
    return rfq.lines.reduce((sum, line, index) => {
      const unitPrice = lineValues[index]?.unit_price || 0;
      return sum + unitPrice * line.quantity;
    }, 0);
  }, [rfq?.lines, form.watch('lines')]);

  const handleSubmitBid = async (data: BidFormData) => {
    if (!id) return;

    try {
      await submitBidMutation.mutateAsync({
        rfqId: id,
        data: {
          validity_days: data.validity_days,
          delivery_terms: data.delivery_terms,
          payment_terms: data.payment_terms,
          notes: data.notes,
          lines: data.lines.map((line) => ({
            rfq_line: line.rfq_line,
            unit_price: line.unit_price,
            lead_time_days: line.lead_time_days,
            notes: line.notes,
          })),
        },
      });
      toast.success('Your bid has been submitted successfully!');
      setShowBidForm(false);
      setConfirmSubmitOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit bid';
      toast.error(message);
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error || !rfq) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-lg font-medium text-neutral-900">RFQ not found</h3>
        <p className="mt-2 text-sm text-neutral-500">
          This RFQ may have been removed or you don't have access.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/portal/rfqs')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to RFQs
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Back Button */}
      <Link
        to="/portal/rfqs"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to RFQs
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-100">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary-600">{rfq.number}</span>
              <RFQStatusBadge status={rfq.status} />
              {rfq.my_bid && (
                <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
                  Bid Submitted
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-semibold text-neutral-900 mt-1">{rfq.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500">
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {rfq.organization_name}
              </span>
              {dueDate && (
                <span
                  className={`flex items-center gap-1 ${
                    isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : ''
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  Due {format(dueDate, 'MMM d, yyyy')}
                  {!isOverdue && ` (${formatDistanceToNow(dueDate, { addSuffix: true })})`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        {canSubmitBid && !showBidForm && (
          <Button onClick={() => setShowBidForm(true)} size="lg" className="shrink-0">
            <Send className="h-4 w-4 mr-2" />
            Submit Bid
          </Button>
        )}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* RFQ Description */}
          {rfq.description && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 whitespace-pre-wrap">{rfq.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Line Items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Line Items ({rfq.lines?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rfq.lines && rfq.lines.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>UoM</TableHead>
                          <TableHead className="text-right">Target Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rfq.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium">{line.line_number}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-neutral-900">{line.description}</p>
                                {line.specifications && (
                                  <p className="text-xs text-neutral-500 mt-1">{line.specifications}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{line.quantity}</TableCell>
                            <TableCell>{line.unit_of_measure}</TableCell>
                            <TableCell className="text-right">
                              {line.target_price !== null ? (
                                <span className="font-medium">
                                  ${line.target_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-neutral-400">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-neutral-500 py-8">No line items specified.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Bid Form (when active) */}
          <AnimatePresence>
            {showBidForm && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <BidForm
                  rfq={rfq}
                  form={form}
                  fields={fields}
                  totalAmount={totalAmount}
                  isSubmitting={submitBidMutation.isPending}
                  onSubmit={() => setConfirmSubmitOpen(true)}
                  onCancel={() => setShowBidForm(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Existing Bid Summary */}
          {rfq.my_bid && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <BidSummary bid={rfq.my_bid} rfqLines={rfq.lines || []} />
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* RFQ Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">RFQ Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow label="RFQ Number" value={rfq.number} />
                <InfoRow label="Organization" value={rfq.organization_name} />
                <InfoRow
                  label="Due Date"
                  value={dueDate ? format(dueDate, 'MMMM d, yyyy') : 'No deadline'}
                />
                <InfoRow
                  label="Created"
                  value={format(new Date(rfq.created_at), 'MMM d, yyyy')}
                />
                <InfoRow label="Line Items" value={String(rfq.lines?.length || 0)} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Terms Card */}
          {rfq.terms_and_conditions && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Terms & Conditions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-600 whitespace-pre-wrap">
                    {rfq.terms_and_conditions}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Deadline Warning */}
          {dueDate && !isOverdue && canSubmitBid && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className={isUrgent ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Calendar className={`h-5 w-5 ${isUrgent ? 'text-amber-600' : 'text-blue-600'}`} />
                    <div>
                      <p className={`font-medium ${isUrgent ? 'text-amber-900' : 'text-blue-900'}`}>
                        {isUrgent ? 'Deadline Approaching!' : 'Submission Deadline'}
                      </p>
                      <p className={`text-sm mt-1 ${isUrgent ? 'text-amber-700' : 'text-blue-700'}`}>
                        {formatDistanceToNow(dueDate, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* Confirm Submit Dialog */}
      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bid Submission</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit this bid? Once submitted, you may not be able to
              modify it.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 rounded-lg bg-neutral-50 border">
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Total Bid Amount</span>
                <span className="text-xl font-semibold text-neutral-900">
                  ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={form.handleSubmit(handleSubmitBid)}
              disabled={submitBidMutation.isPending}
            >
              {submitBidMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Bid
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// Bid Form Component
interface BidFormProps {
  rfq: { lines?: PortalRFQLine[] };
  form: ReturnType<typeof useForm<BidFormData>>;
  fields: { id: string }[];
  totalAmount: number;
  isSubmitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

function BidForm({ rfq, form, fields, totalAmount, isSubmitting, onSubmit, onCancel }: BidFormProps) {
  return (
    <Card className="border-primary-200 bg-primary-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit3 className="h-5 w-5 text-primary-600" />
          Submit Your Bid
        </CardTitle>
        <CardDescription>
          Enter your pricing and terms for each line item. All fields are required.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-6">
          {/* Line Item Pricing */}
          <div className="space-y-4">
            <h4 className="font-medium text-neutral-900">Line Item Pricing</h4>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right w-32">Unit Price *</TableHead>
                    <TableHead className="text-right w-28">Lead Time *</TableHead>
                    <TableHead className="text-right w-32">Extended</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const line = rfq.lines?.[index];
                    if (!line) return null;
                    const unitPrice = form.watch(`lines.${index}.unit_price`) || 0;
                    const extended = unitPrice * line.quantity;

                    return (
                      <TableRow key={field.id}>
                        <TableCell className="font-medium">{line.line_number}</TableCell>
                        <TableCell>
                          <p className="font-medium text-neutral-900 text-sm">{line.description}</p>
                        </TableCell>
                        <TableCell className="text-center">{line.quantity}</TableCell>
                        <TableCell>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="pl-7 text-right"
                              {...form.register(`lines.${index}.unit_price`, { valueAsNumber: true })}
                            />
                          </div>
                          {form.formState.errors.lines?.[index]?.unit_price && (
                            <p className="text-xs text-red-500 mt-1">
                              {form.formState.errors.lines[index]?.unit_price?.message}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="1"
                              className="text-right w-16"
                              {...form.register(`lines.${index}.lead_time_days`, { valueAsNumber: true })}
                            />
                            <span className="text-xs text-neutral-500">days</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${extended.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-neutral-50">
                    <TableCell colSpan={5} className="text-right font-medium">
                      Total Bid Amount
                    </TableCell>
                    <TableCell className="text-right text-lg font-semibold text-primary-700">
                      ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Bid Terms */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="validity_days" required>
                Quote Validity (days)
              </Label>
              <Input
                id="validity_days"
                type="number"
                min="1"
                max="365"
                {...form.register('validity_days', { valueAsNumber: true })}
              />
              {form.formState.errors.validity_days && (
                <p className="text-xs text-red-500">{form.formState.errors.validity_days.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_terms" required>
                Delivery Terms
              </Label>
              <Input
                id="delivery_terms"
                placeholder="e.g., FOB Destination"
                {...form.register('delivery_terms')}
              />
              {form.formState.errors.delivery_terms && (
                <p className="text-xs text-red-500">{form.formState.errors.delivery_terms.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_terms" required>
                Payment Terms
              </Label>
              <Input
                id="payment_terms"
                placeholder="e.g., Net 30"
                {...form.register('payment_terms')}
              />
              {form.formState.errors.payment_terms && (
                <p className="text-xs text-red-500">{form.formState.errors.payment_terms.message}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional information about your bid..."
              rows={3}
              {...form.register('notes')}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Review & Submit
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Bid Summary Component (when already submitted)
function BidSummary({ bid, rfqLines }: { bid: PortalBid; rfqLines: PortalRFQLine[] }) {
  return (
    <Card className="border-green-200 bg-green-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700">
          <CheckCircle className="h-5 w-5" />
          Your Submitted Bid
        </CardTitle>
        <CardDescription>
          Submitted {bid.submitted_at ? format(new Date(bid.submitted_at), 'MMM d, yyyy h:mm a') : 'recently'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bid Lines */}
        <div className="rounded-lg border overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Lead Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bid.lines.map((line) => {
                const rfqLine = rfqLines.find((rl) => rl.id === line.rfq_line);
                return (
                  <TableRow key={line.id}>
                    <TableCell>
                      <p className="font-medium">{rfqLine?.description || line.rfq_line_description}</p>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${line.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">{line.lead_time_days} days</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <div className="grid sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Total Amount</p>
            <p className="text-lg font-semibold text-neutral-900">
              ${bid.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Validity</p>
            <p className="font-medium text-neutral-900">{bid.validity_days} days</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Delivery Terms</p>
            <p className="font-medium text-neutral-900">{bid.delivery_terms}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Payment Terms</p>
            <p className="font-medium text-neutral-900">{bid.payment_terms}</p>
          </div>
        </div>

        {bid.notes && (
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Notes</p>
            <p className="text-sm text-neutral-600">{bid.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper Components
function RFQStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'OPEN':
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          Open
        </Badge>
      );
    case 'CLOSED':
      return (
        <Badge variant="outline" className="text-neutral-600">
          Closed
        </Badge>
      );
    case 'AWARDED':
      return (
        <Badge variant="default" className="bg-purple-100 text-purple-700 hover:bg-purple-100">
          Awarded
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64 mt-2" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
