import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ShoppingCart,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  Calendar,
  Building2,
  CreditCard,
  MapPin,
  FileText,
  Printer,
  Link2,
  ClipboardList,
  TrendingUp,
  ArrowRight,
  Clock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { POForm, POLineItemsTable } from '@/components/purchase-orders';
import { CommentsSection } from '@/components/ui/comments-section';
import { AttachmentsSection } from '@/components/ui/attachments-section';
import { ActivityTimeline } from '@/components/ui/activity-timeline';
import {
  usePurchaseOrder,
  useUpdatePurchaseOrder,
  useDeletePurchaseOrder,
  useSubmitPurchaseOrder,
  useApprovePurchaseOrder,
  useRejectPurchaseOrder,
  useSendPurchaseOrder,
  useReceivePurchaseOrder,
  useCancelPurchaseOrder,
  PO_STATUS_CONFIG,
  type POPayload,
} from '@/lib/api/purchase-orders';
import type { POLine } from '@/types';

const formatCurrency = (amount: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(parseFloat(amount));
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = location.pathname.endsWith('/edit');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedLineForReceive, setSelectedLineForReceive] = useState<POLine | null>(null);
  const [receiveQuantity, setReceiveQuantity] = useState('');

  const { data: purchaseOrder, isLoading, error } = usePurchaseOrder(id!);
  const updateMutation = useUpdatePurchaseOrder();
  const deleteMutation = useDeletePurchaseOrder();
  const submitMutation = useSubmitPurchaseOrder();
  const approveMutation = useApprovePurchaseOrder();
  const rejectMutation = useRejectPurchaseOrder();
  const sendMutation = useSendPurchaseOrder();
  const receiveMutation = useReceivePurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();

  // Calculate received quantities for display
  const receivedQuantities = useMemo(() => {
    if (!purchaseOrder?.lines) return {};
    return purchaseOrder.lines.reduce((acc, line) => {
      acc[line.id] = line.quantity_received;
      return acc;
    }, {} as Record<string, string>);
  }, [purchaseOrder?.lines]);

  // Calculate receiving progress stats
  const receivingStats = useMemo(() => {
    if (!purchaseOrder?.lines || purchaseOrder.lines.length === 0) return null;

    const totalLines = purchaseOrder.lines.length;
    const fullyReceivedLines = purchaseOrder.lines.filter(
      line => parseFloat(line.quantity_received) >= parseFloat(line.quantity)
    ).length;
    const partiallyReceivedLines = purchaseOrder.lines.filter(
      line => parseFloat(line.quantity_received) > 0 && parseFloat(line.quantity_received) < parseFloat(line.quantity)
    ).length;
    const pendingLines = totalLines - fullyReceivedLines - partiallyReceivedLines;

    const totalOrdered = purchaseOrder.lines.reduce(
      (sum, line) => sum + parseFloat(line.quantity), 0
    );
    const totalReceived = purchaseOrder.lines.reduce(
      (sum, line) => sum + parseFloat(line.quantity_received), 0
    );

    const receivingPercentage = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

    // Count lines from requisition
    const linesFromReq = purchaseOrder.lines.filter(line => line.requisition_line_id).length;

    return {
      totalLines,
      fullyReceivedLines,
      partiallyReceivedLines,
      pendingLines,
      totalOrdered,
      totalReceived,
      receivingPercentage,
      isFullyReceived: fullyReceivedLines === totalLines,
      linesFromReq,
    };
  }, [purchaseOrder?.lines]);

  const handleUpdate = async (data: POPayload) => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({ id, data });
      navigate(`/purchase-orders/${id}`);
    } catch (error) {
      console.error('Failed to update PO:', error);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      navigate('/purchase-orders');
    } catch (error) {
      console.error('Failed to delete PO:', error);
    }
  };

  const handleSubmit = async () => {
    if (!id) return;
    try {
      await submitMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to submit PO:', error);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
      await approveMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to approve PO:', error);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    try {
      await rejectMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to reject PO:', error);
    }
  };

  const handleSend = async () => {
    if (!id) return;
    try {
      await sendMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to send PO:', error);
    }
  };

  const handleReceive = async () => {
    if (!id || !selectedLineForReceive || !receiveQuantity) return;
    try {
      await receiveMutation.mutateAsync({
        id,
        lineId: selectedLineForReceive.id,
        quantityReceived: receiveQuantity,
      });
      setReceiveDialogOpen(false);
      setSelectedLineForReceive(null);
      setReceiveQuantity('');
    } catch (error) {
      console.error('Failed to receive items:', error);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    try {
      await cancelMutation.mutateAsync(id);
      setCancelDialogOpen(false);
    } catch (error) {
      console.error('Failed to cancel PO:', error);
    }
  };

  const openReceiveDialog = (line: POLine) => {
    const remaining = parseFloat(line.quantity) - parseFloat(line.quantity_received);
    setSelectedLineForReceive(line);
    setReceiveQuantity(remaining.toString());
    setReceiveDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sahel-green"></div>
      </div>
    );
  }

  if (error || !purchaseOrder) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-neutral-900">Purchase Order not found</h2>
        <p className="text-neutral-500 mt-2">
          The purchase order you're looking for doesn't exist.
        </p>
        <Button onClick={() => navigate('/purchase-orders')} className="mt-4">
          Back to Purchase Orders
        </Button>
      </div>
    );
  }

  const statusConfig = PO_STATUS_CONFIG[purchaseOrder.status] || { label: purchaseOrder.status || 'Unknown', color: 'text-neutral-700', bgColor: 'bg-neutral-100' };
  const canEdit = purchaseOrder.status === 'DRAFT';
  const canSubmit = purchaseOrder.status === 'DRAFT';
  const canApprove = purchaseOrder.status === 'PENDING_APPROVAL';
  const canSend = purchaseOrder.status === 'APPROVED';
  const canReceive = purchaseOrder.status === 'SENT' || purchaseOrder.status === 'PARTIALLY_RECEIVED';
  const canCancel = !['RECEIVED', 'CANCELLED'].includes(purchaseOrder.status);

  // Edit Mode
  if (isEditMode && canEdit) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/purchase-orders/${id}`)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Purchase Order
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
            <Edit className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Edit Purchase Order
            </h1>
            <p className="text-neutral-500">{purchaseOrder.number}</p>
          </div>
        </div>

        <div className="max-w-4xl">
          <POForm
            purchaseOrder={purchaseOrder}
            onSubmit={handleUpdate}
            onCancel={() => navigate(`/purchase-orders/${id}`)}
            isSubmitting={updateMutation.isPending}
            mode="edit"
          />
        </div>
      </motion.div>
    );
  }

  // View Mode
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/purchase-orders')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Purchase Orders
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
            <ShoppingCart className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-900">
                {purchaseOrder.number}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <p className="text-neutral-500">
              Created on {formatDate(purchaseOrder.created_at)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>

          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/purchase-orders/${id}/edit`)}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="gap-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </>
          )}

          {canSubmit && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Submit for Approval
            </Button>
          )}

          {canApprove && (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                disabled={rejectMutation.isPending}
                className="gap-2 text-red-600 hover:text-red-700"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </>
          )}

          {canSend && (
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="gap-2"
            >
              <Truck className="h-4 w-4" />
              Send to Supplier
            </Button>
          )}

          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelDialogOpen(true)}
              className="gap-2 text-red-600 hover:text-red-700"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Order Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              {purchaseOrder.lines && purchaseOrder.lines.length > 0 ? (
                <>
                  <POLineItemsTable
                    items={purchaseOrder.lines.map(line => ({
                      id: line.id,
                      description: line.description,
                      quantity: line.quantity,
                      unit_of_measure: line.unit_of_measure,
                      unit_price: line.unit_price,
                      requisition_line_id: line.requisition_line_id,
                    }))}
                    onChange={() => {}}
                    readOnly
                    showReceived={canReceive || purchaseOrder.status === 'RECEIVED'}
                    receivedQuantities={receivedQuantities}
                    showSourceBadges={!!purchaseOrder.requisition_id}
                  />

                  {/* Receive Items Button */}
                  {canReceive && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium text-neutral-700 mb-3">
                        Record Receipt
                      </h4>
                      <div className="space-y-2">
                        {purchaseOrder.lines
                          .filter(line => parseFloat(line.quantity_received) < parseFloat(line.quantity))
                          .map(line => {
                            const remaining = parseFloat(line.quantity) - parseFloat(line.quantity_received);
                            return (
                              <div
                                key={line.id}
                                className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                              >
                                <div>
                                  <p className="font-medium text-neutral-900">{line.description}</p>
                                  <p className="text-sm text-neutral-500">
                                    {remaining} {line.unit_of_measure} remaining
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openReceiveDialog(line)}
                                  className="gap-2"
                                >
                                  <Package className="h-4 w-4" />
                                  Receive
                                </Button>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-neutral-500">No line items</p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {purchaseOrder.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-700 whitespace-pre-wrap">{purchaseOrder.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentsSection objectType="purchase_order" objectId={purchaseOrder.id} />
            </CardContent>
          </Card>

          {/* Attachments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentsSection
                objectType="purchase_order"
                objectId={purchaseOrder.id}
                acceptedTypes={['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg']}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Total Amount</span>
                <span className="text-2xl font-bold text-neutral-900">
                  {formatCurrency(purchaseOrder.total_amount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">Currency</span>
                <span className="text-neutral-900">{purchaseOrder.currency}</span>
              </div>
            </CardContent>
          </Card>

          {/* Receiving Progress Card - Premium Style */}
          {receivingStats && purchaseOrder.lines && purchaseOrder.lines.length > 0 && (
            <Card className="overflow-hidden border-emerald-100">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 border-b border-emerald-100">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                    <Package className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-neutral-900">Receiving Progress</h3>
                </div>
              </div>
              <CardContent className="pt-4">
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-neutral-600">
                      {receivingStats.receivingPercentage}% Received
                    </span>
                    <span className="text-neutral-500">
                      {receivingStats.totalReceived.toFixed(0)} / {receivingStats.totalOrdered.toFixed(0)} units
                    </span>
                  </div>
                  <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        receivingStats.isFullyReceived
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                          : receivingStats.receivingPercentage > 0
                          ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                          : 'bg-neutral-300'
                      }`}
                      style={{ width: `${receivingStats.receivingPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-100">
                  <div className="text-center p-2 rounded-lg bg-emerald-50">
                    <div className="text-lg font-bold text-emerald-700">
                      {receivingStats.fullyReceivedLines}
                    </div>
                    <div className="text-xs text-emerald-600">Received</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-amber-50">
                    <div className="text-lg font-bold text-amber-700">
                      {receivingStats.partiallyReceivedLines}
                    </div>
                    <div className="text-xs text-amber-600">Partial</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-neutral-50">
                    <div className="text-lg font-bold text-neutral-700">
                      {receivingStats.pendingLines}
                    </div>
                    <div className="text-xs text-neutral-600">Pending</div>
                  </div>
                </div>

                {/* Full completion badge */}
                {receivingStats.isFullyReceived && (
                  <div className="mt-3 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-100 text-emerald-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Fully Received</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Supplier Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Supplier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-neutral-900">{purchaseOrder.supplier_name}</p>
            </CardContent>
          </Card>

          {/* Source Requisition - Enhanced Premium Card */}
          {purchaseOrder.requisition_number && (
            <Card className="overflow-hidden border-blue-100">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-blue-100">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
                    <ClipboardList className="h-4 w-4 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-neutral-900">Source Requisition</h3>
                </div>
              </div>
              <CardContent className="pt-4">
                <button
                  onClick={() => navigate(`/requisitions/${purchaseOrder.requisition_id}`)}
                  className="group w-full text-left p-3 -mx-1 rounded-xl border border-transparent hover:border-blue-200 hover:bg-blue-50/50 transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-blue-600 group-hover:text-blue-700">
                      {purchaseOrder.requisition_number}
                    </span>
                    <ArrowRight className="h-4 w-4 text-neutral-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  {purchaseOrder.requisition_title && (
                    <p className="text-sm text-neutral-600 mb-2 line-clamp-2">
                      {purchaseOrder.requisition_title}
                    </p>
                  )}
                  {receivingStats && receivingStats.linesFromReq > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        <Link2 className="h-3 w-3 mr-1" />
                        {receivingStats.linesFromReq} line{receivingStats.linesFromReq !== 1 ? 's' : ''} linked
                      </span>
                    </div>
                  )}
                </button>
              </CardContent>
            </Card>
          )}

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-neutral-500">Order Date</p>
                <p className="font-medium text-neutral-900">{formatDate(purchaseOrder.order_date)}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Expected Delivery</p>
                <p className="font-medium text-neutral-900">
                  {formatDate(purchaseOrder.expected_delivery_date)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Terms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment Terms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-neutral-900">{purchaseOrder.payment_terms}</p>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          {purchaseOrder.shipping_address && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-700 whitespace-pre-wrap">
                  {purchaseOrder.shipping_address}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Activity Timeline */}
          <Card>
            <CardContent className="pt-6">
              <ActivityTimeline
                contentType="purchase_orders.purchaseorder"
                objectId={purchaseOrder.id}
                maxItems={5}
                compact
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete purchase order "{purchaseOrder.number}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel purchase order "{purchaseOrder.number}"? This will
              mark the order as cancelled and it cannot be reopened.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receive Items Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Receipt</DialogTitle>
            <DialogDescription>
              Enter the quantity received for "{selectedLineForReceive?.description}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-neutral-700">Quantity Received</label>
              <Input
                type="number"
                min="0"
                max={
                  selectedLineForReceive
                    ? (
                        parseFloat(selectedLineForReceive.quantity) -
                        parseFloat(selectedLineForReceive.quantity_received)
                      ).toString()
                    : undefined
                }
                value={receiveQuantity}
                onChange={e => setReceiveQuantity(e.target.value)}
                className="mt-1"
              />
              {selectedLineForReceive && (
                <p className="text-sm text-neutral-500 mt-1">
                  Maximum:{' '}
                  {parseFloat(selectedLineForReceive.quantity) -
                    parseFloat(selectedLineForReceive.quantity_received)}{' '}
                  {selectedLineForReceive.unit_of_measure}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReceive}
              disabled={receiveMutation.isPending || !receiveQuantity || parseFloat(receiveQuantity) <= 0}
            >
              {receiveMutation.isPending ? 'Recording...' : 'Record Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
