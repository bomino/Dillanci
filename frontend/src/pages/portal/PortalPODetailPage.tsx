/**
 * Portal PO Detail Page - View PO details and acknowledge/reject.
 */

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ShoppingCart,
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Calendar,
  MapPin,
  CreditCard,
  Truck,
  Package,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';

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
  TableFooter,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import { usePortalPO, useAcknowledgePO, type POAcknowledgment } from '@/lib/api/portal';
import { toast } from 'sonner';

// Acknowledgment form schema
const acknowledgeSchema = z.object({
  action: z.enum(['acknowledge', 'reject']),
  comments: z.string().optional(),
  revised_delivery_date: z.string().optional(),
  delivery_date_reason: z.string().optional(),
  rejection_reason: z.string().optional(),
}).refine((data) => {
  if (data.action === 'reject' && !data.rejection_reason) {
    return false;
  }
  return true;
}, {
  message: 'Rejection reason is required',
  path: ['rejection_reason'],
}).refine((data) => {
  if (data.revised_delivery_date && !data.delivery_date_reason) {
    return false;
  }
  return true;
}, {
  message: 'Please provide a reason for the revised date',
  path: ['delivery_date_reason'],
});

type AcknowledgeFormData = z.infer<typeof acknowledgeSchema>;

export default function PortalPODetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showAckDialog, setShowAckDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { data: po, isLoading, error } = usePortalPO(id || '');
  const acknowledgeMutation = useAcknowledgePO();

  const ackStatus = po?.acknowledgment_status || po?.acknowledgment?.status || 'PENDING';
  const canAcknowledge = ackStatus === 'PENDING';

  const form = useForm<AcknowledgeFormData>({
    resolver: zodResolver(acknowledgeSchema),
    defaultValues: {
      action: 'acknowledge',
      comments: '',
      revised_delivery_date: '',
      delivery_date_reason: '',
      rejection_reason: '',
    },
  });

  const handleAcknowledge = async () => {
    if (!id) return;

    const data = form.getValues();
    try {
      await acknowledgeMutation.mutateAsync({
        poId: id,
        data: {
          action: 'acknowledge',
          comments: data.comments,
          revised_delivery_date: data.revised_delivery_date || undefined,
          delivery_date_reason: data.delivery_date_reason || undefined,
        },
      });
      toast.success('Purchase Order acknowledged successfully!');
      setShowAckDialog(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to acknowledge PO';
      toast.error(message);
    }
  };

  const handleReject = async () => {
    if (!id) return;

    const data = form.getValues();
    if (!data.rejection_reason) {
      form.setError('rejection_reason', { message: 'Rejection reason is required' });
      return;
    }

    try {
      await acknowledgeMutation.mutateAsync({
        poId: id,
        data: {
          action: 'reject',
          rejection_reason: data.rejection_reason,
        },
      });
      toast.success('Purchase Order has been rejected');
      setShowRejectDialog(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject PO';
      toast.error(message);
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error || !po) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-lg font-medium text-neutral-900">Purchase Order not found</h3>
        <p className="mt-2 text-sm text-neutral-500">
          This PO may have been removed or you don't have access.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/portal/purchase-orders')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Purchase Orders
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
        to="/portal/purchase-orders"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Purchase Orders
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4"
      >
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${
            ackStatus === 'ACKNOWLEDGED'
              ? 'bg-green-100'
              : ackStatus === 'REJECTED'
              ? 'bg-red-100'
              : 'bg-blue-100'
          }`}>
            <ShoppingCart className={`h-6 w-6 ${
              ackStatus === 'ACKNOWLEDGED'
                ? 'text-green-600'
                : ackStatus === 'REJECTED'
                ? 'text-red-600'
                : 'text-blue-600'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary-600">{po.number}</span>
              <POStatusBadge status={po.status} />
              <AckStatusBadge status={ackStatus} />
            </div>
            <h1 className="text-2xl font-semibold text-neutral-900 mt-1">{po.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500">
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {po.organization_name}
              </span>
              {po.sent_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Sent {format(new Date(po.sent_at), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Total Amount */}
        <div className="text-right">
          <p className="text-sm text-neutral-500">Total Amount</p>
          <p className="text-3xl font-bold text-neutral-900">
            ${po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </motion.div>

      {/* Action Required Banner */}
      {canAcknowledge && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-amber-900">Acknowledgment Required</p>
                    <p className="text-sm text-amber-700">
                      Please review and acknowledge this Purchase Order to confirm receipt.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => setShowRejectDialog(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => setShowAckDialog(true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Acknowledge
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Line Items ({po.lines?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {po.lines && po.lines.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>UoM</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Extended</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {po.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium">{line.line_number}</TableCell>
                            <TableCell>
                              <p className="font-medium text-neutral-900">{line.description}</p>
                            </TableCell>
                            <TableCell className="text-right">{line.quantity}</TableCell>
                            <TableCell>{line.unit_of_measure}</TableCell>
                            <TableCell className="text-right">
                              ${line.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${line.extended_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow className="bg-neutral-50">
                          <TableCell colSpan={5} className="text-right font-semibold">
                            Total
                          </TableCell>
                          <TableCell className="text-right text-lg font-bold text-primary-700">
                            ${po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-neutral-500 py-8">No line items.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Notes */}
          {po.notes && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600 whitespace-pre-wrap">{po.notes}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Acknowledgment Details (if acknowledged or rejected) */}
          {po.acknowledgment && ackStatus !== 'PENDING' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <AcknowledgmentDetails acknowledgment={po.acknowledgment} status={ackStatus} />
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* PO Details Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow icon={ShoppingCart} label="PO Number" value={po.number} />
                <InfoRow icon={Building2} label="Organization" value={po.organization_name} />
                {po.sent_at && (
                  <InfoRow
                    icon={Calendar}
                    label="Sent Date"
                    value={format(new Date(po.sent_at), 'MMMM d, yyyy')}
                  />
                )}
                {po.expected_delivery && (
                  <InfoRow
                    icon={Truck}
                    label="Expected Delivery"
                    value={format(new Date(po.expected_delivery), 'MMMM d, yyyy')}
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Shipping Address */}
          {po.ship_to_address && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Ship To
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-600 whitespace-pre-wrap">{po.ship_to_address}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Terms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {po.shipping_terms && (
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">Shipping Terms</p>
                    <p className="text-sm font-medium text-neutral-900">{po.shipping_terms}</p>
                  </div>
                )}
                {po.payment_terms && (
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">Payment Terms</p>
                    <p className="text-sm font-medium text-neutral-900">{po.payment_terms}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Acknowledge Dialog */}
      <Dialog open={showAckDialog} onOpenChange={setShowAckDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Acknowledge Purchase Order
            </DialogTitle>
            <DialogDescription>
              Confirm that you have received and accepted this purchase order.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAcknowledge(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="revised_date">Revised Delivery Date (optional)</Label>
              <Input
                id="revised_date"
                type="date"
                {...form.register('revised_delivery_date')}
              />
              <p className="text-xs text-neutral-500">
                Only if you need to propose a different delivery date than requested.
              </p>
            </div>
            {form.watch('revised_delivery_date') && (
              <div className="space-y-2">
                <Label htmlFor="date_reason" required>Reason for Revised Date</Label>
                <Textarea
                  id="date_reason"
                  placeholder="Explain why the delivery date needs to change..."
                  {...form.register('delivery_date_reason')}
                />
                {form.formState.errors.delivery_date_reason && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.delivery_date_reason.message}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="comments">Comments (optional)</Label>
              <Textarea
                id="comments"
                placeholder="Any additional comments..."
                rows={3}
                {...form.register('comments')}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAckDialog(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700"
                disabled={acknowledgeMutation.isPending}
              >
                {acknowledgeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Acknowledging...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Acknowledge PO
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Reject Purchase Order
            </DialogTitle>
            <DialogDescription>
              This will notify the buyer that you cannot fulfill this order. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleReject(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection_reason" required>Rejection Reason</Label>
              <Textarea
                id="rejection_reason"
                placeholder="Explain why you cannot fulfill this order..."
                rows={4}
                {...form.register('rejection_reason')}
              />
              {form.formState.errors.rejection_reason && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.rejection_reason.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowRejectDialog(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={acknowledgeMutation.isPending}
              >
                {acknowledgeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject PO
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// Acknowledgment Details Component
function AcknowledgmentDetails({ acknowledgment, status }: { acknowledgment: POAcknowledgment; status: string }) {
  const isRejected = status === 'REJECTED';

  return (
    <Card className={isRejected ? 'border-red-200 bg-red-50/30' : 'border-green-200 bg-green-50/30'}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${isRejected ? 'text-red-700' : 'text-green-700'}`}>
          {isRejected ? (
            <>
              <XCircle className="h-5 w-5" />
              Rejected
            </>
          ) : (
            <>
              <CheckCircle className="h-5 w-5" />
              Acknowledged
            </>
          )}
        </CardTitle>
        {acknowledgment.acknowledged_at && (
          <CardDescription>
            {format(new Date(acknowledgment.acknowledged_at), 'MMMM d, yyyy h:mm a')}
            {acknowledgment.acknowledged_by_name && ` by ${acknowledgment.acknowledged_by_name}`}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isRejected && acknowledgment.rejection_reason && (
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Rejection Reason</p>
            <p className="text-sm text-neutral-700">{acknowledgment.rejection_reason}</p>
          </div>
        )}
        {!isRejected && acknowledgment.revised_delivery_date && (
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Revised Delivery Date</p>
            <p className="text-sm font-medium text-neutral-900">
              {format(new Date(acknowledgment.revised_delivery_date), 'MMMM d, yyyy')}
            </p>
            {acknowledgment.delivery_date_reason && (
              <p className="text-sm text-neutral-600 mt-1">{acknowledgment.delivery_date_reason}</p>
            )}
          </div>
        )}
        {!isRejected && acknowledgment.comments && (
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Comments</p>
            <p className="text-sm text-neutral-700">{acknowledgment.comments}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper Components
function POStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'SENT':
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          Sent
        </Badge>
      );
    case 'RECEIVED':
      return (
        <Badge variant="default" className="bg-purple-100 text-purple-700 hover:bg-purple-100">
          Received
        </Badge>
      );
    case 'COMPLETED':
      return (
        <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
          Completed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function AckStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'PENDING':
      return (
        <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
          Needs Acknowledgment
        </Badge>
      );
    case 'ACKNOWLEDGED':
      return (
        <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="h-3 w-3 mr-1" />
          Acknowledged
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge variant="default" className="bg-red-100 text-red-700 hover:bg-red-100">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return null;
  }
}

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-neutral-400 mt-0.5" />
      <div className="flex-1">
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="text-sm font-medium text-neutral-900">{value}</p>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />
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
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
