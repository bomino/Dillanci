import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Package,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Calendar,
  Building2,
  FileText,
  User,
  Printer,
  ShoppingCart,
  ClipboardCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CommentsSection } from '@/components/ui/comments-section';
import { AttachmentsSection } from '@/components/ui/attachments-section';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

import { ReceivingForm, InspectionDialog, type InspectionFormData } from '@/components/receiving';
import {
  useGoodsReceipt,
  useUpdateGoodsReceipt,
  useDeleteGoodsReceipt,
  useConfirmGoodsReceipt,
  useCancelGoodsReceipt,
  GR_STATUS_CONFIG,
  type GoodsReceiptPayload,
} from '@/lib/api/receiving';

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export default function ReceivingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = location.pathname.endsWith('/edit');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [isInspectionSubmitting, setIsInspectionSubmitting] = useState(false);

  const { data: goodsReceipt, isLoading, error } = useGoodsReceipt(id!);
  const updateMutation = useUpdateGoodsReceipt();
  const deleteMutation = useDeleteGoodsReceipt();
  const confirmMutation = useConfirmGoodsReceipt();
  const cancelMutation = useCancelGoodsReceipt();

  const handleUpdate = async (data: GoodsReceiptPayload) => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({ id, data });
      navigate(`/receiving/${id}`);
    } catch (error) {
      console.error('Failed to update GR:', error);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      navigate('/receiving');
    } catch (error) {
      console.error('Failed to delete GR:', error);
    }
  };

  const handleConfirm = async () => {
    if (!id) return;
    try {
      await confirmMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to confirm GR:', error);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    try {
      await cancelMutation.mutateAsync(id);
      setCancelDialogOpen(false);
    } catch (error) {
      console.error('Failed to cancel GR:', error);
    }
  };

  const handleInspectionSubmit = async (data: InspectionFormData) => {
    setIsInspectionSubmitting(true);
    try {
      // In a real implementation, this would call an API to save inspection data
      // For now, we'll log it and show a success message
      console.log('Inspection data:', data);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Close dialog - in production this would update the GR with inspection info
      setInspectionDialogOpen(false);
    } catch (error) {
      console.error('Failed to save inspection:', error);
    } finally {
      setIsInspectionSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sahel-green"></div>
      </div>
    );
  }

  if (error || !goodsReceipt) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-neutral-900">Goods Receipt not found</h2>
        <p className="text-neutral-500 mt-2">
          The goods receipt you're looking for doesn't exist.
        </p>
        <Button onClick={() => navigate('/receiving')} className="mt-4">
          Back to Receiving
        </Button>
      </div>
    );
  }

  const statusConfig = GR_STATUS_CONFIG[goodsReceipt.status] || { label: goodsReceipt.status || 'Unknown', color: 'text-neutral-700', bgColor: 'bg-neutral-100' };
  const canEdit = goodsReceipt.status === 'DRAFT';
  const canConfirm = goodsReceipt.status === 'DRAFT';
  const canCancel = goodsReceipt.status !== 'CANCELLED';
  const canInspect = goodsReceipt.status === 'DRAFT' && goodsReceipt.lines && goodsReceipt.lines.length > 0;

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
            onClick={() => navigate(`/receiving/${id}`)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Goods Receipt
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100">
            <Edit className="h-6 w-6 text-cyan-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Edit Goods Receipt
            </h1>
            <p className="text-neutral-500">{goodsReceipt.number}</p>
          </div>
        </div>

        <div className="max-w-4xl">
          <ReceivingForm
            goodsReceipt={goodsReceipt}
            onSubmit={handleUpdate}
            onCancel={() => navigate(`/receiving/${id}`)}
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
          onClick={() => navigate('/receiving')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Receiving
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100">
            <Package className="h-6 w-6 text-cyan-700" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-900">
                {goodsReceipt.number}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <p className="text-neutral-500">
              Created on {formatDate(goodsReceipt.created_at)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>

          {canInspect && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInspectionDialogOpen(true)}
              className="gap-2 text-cyan-600 hover:text-cyan-700 border-cyan-200 hover:border-cyan-300"
            >
              <ClipboardCheck className="h-4 w-4" />
              Inspect
            </Button>
          )}

          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/receiving/${id}/edit`)}
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

          {canConfirm && (
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={confirmMutation.isPending}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              Confirm Receipt
            </Button>
          )}

          {canCancel && goodsReceipt.status !== 'DRAFT' && (
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

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Items */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Received Items</CardTitle>
            </CardHeader>
            <CardContent>
              {goodsReceipt.lines && goodsReceipt.lines.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Ordered</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead>UoM</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {goodsReceipt.lines.map((line, index) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium text-neutral-500">
                            {index + 1}
                          </TableCell>
                          <TableCell>{line.po_line_description}</TableCell>
                          <TableCell className="text-right">{line.quantity_ordered}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {line.quantity_received}
                          </TableCell>
                          <TableCell>{line.unit_of_measure}</TableCell>
                          <TableCell className="text-neutral-500">
                            {line.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-neutral-500">No line items</p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {goodsReceipt.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-700 whitespace-pre-wrap">{goodsReceipt.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentsSection objectType="goods_receipt" objectId={goodsReceipt.id} />
            </CardContent>
          </Card>

          {/* Attachments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentsSection
                objectType="goods_receipt"
                objectId={goodsReceipt.id}
                acceptedTypes={['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg']}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Purchase Order */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Purchase Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              <button
                onClick={() => navigate(`/purchase-orders/${goodsReceipt.purchase_order}`)}
                className="font-medium text-sahel-blue hover:text-sahel-blue/80 hover:underline"
              >
                {goodsReceipt.po_number}
              </button>
            </CardContent>
          </Card>

          {/* Supplier */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Supplier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-neutral-900">{goodsReceipt.supplier_name}</p>
            </CardContent>
          </Card>

          {/* Receipt Date */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Receipt Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-neutral-900">{formatDate(goodsReceipt.receipt_date)}</p>
            </CardContent>
          </Card>

          {/* Delivery Note */}
          {goodsReceipt.delivery_note_number && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Delivery Note
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium text-neutral-900">{goodsReceipt.delivery_note_number}</p>
              </CardContent>
            </Card>
          )}

          {/* Received By */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Received By
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-neutral-900">{goodsReceipt.received_by_name}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goods Receipt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete goods receipt "{goodsReceipt.number}"? This action
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
            <AlertDialogTitle>Cancel Goods Receipt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel goods receipt "{goodsReceipt.number}"? This will
              reverse the received quantities on the Purchase Order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Receipt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Receipt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quality Inspection Dialog */}
      {goodsReceipt.lines && (
        <InspectionDialog
          open={inspectionDialogOpen}
          onOpenChange={setInspectionDialogOpen}
          lines={goodsReceipt.lines}
          grNumber={goodsReceipt.number}
          onSubmit={handleInspectionSubmit}
          isSubmitting={isInspectionSubmitting}
        />
      )}
    </motion.div>
  );
}
