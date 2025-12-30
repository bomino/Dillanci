import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileQuestion,
  Pencil,
  Trash2,
  Send,
  Clock,
  Award,
  XCircle,
  CheckCircle,
  Calendar,
  Package,
  Users,
  Copy,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RFQForm, InvitedSuppliersCard } from '@/components/rfqs';
import { CommentsSection } from '@/components/ui/comments-section';
import { AttachmentsSection } from '@/components/ui/attachments-section';

import {
  useRFQ,
  useUpdateRFQ,
  useDeleteRFQ,
  usePublishRFQ,
  useCloseRFQ,
  useAwardRFQ,
  useCancelRFQ,
  useDuplicateRFQ,
  useVendorQuotes,
  useApprovedSuppliers,
  mockSuppliers,
} from '@/lib/api/rfqs';
import type { RFQPayload } from '@/lib/api/rfqs';
import { formatDate, formatCurrency, formatDateTime } from '@/lib/utils';

export default function RFQDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');

  const { data: rfq, isLoading, isError } = useRFQ(id);
  const { data: vendorQuotes } = useVendorQuotes(id);
  const { data: approvedSuppliers } = useApprovedSuppliers();

  const updateMutation = useUpdateRFQ();
  const deleteMutation = useDeleteRFQ();
  const publishMutation = usePublishRFQ();
  const closeMutation = useCloseRFQ();
  const awardMutation = useAwardRFQ();
  const cancelMutation = useCancelRFQ();
  const duplicateMutation = useDuplicateRFQ();

  // Check for success message from create page
  const successMessage = location.state?.message;

  const handleUpdate = async (data: RFQPayload) => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({ id, payload: data });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update RFQ:', error);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      navigate('/rfqs', {
        state: { message: 'RFQ deleted successfully' },
      });
    } catch (error) {
      console.error('Failed to delete RFQ:', error);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    try {
      await publishMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to publish RFQ:', error);
    }
  };

  const handleClose = async () => {
    if (!id) return;
    try {
      await closeMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to close RFQ:', error);
    }
  };

  const handleAward = async () => {
    if (!id || !selectedSupplier) return;
    try {
      await awardMutation.mutateAsync({ id, supplierId: selectedSupplier });
      setAwardDialogOpen(false);
      setSelectedSupplier('');
    } catch (error) {
      console.error('Failed to award RFQ:', error);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    try {
      await cancelMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to cancel RFQ:', error);
    }
  };

  const handleDuplicate = async () => {
    if (!id) return;
    try {
      const newRFQ = await duplicateMutation.mutateAsync(id);
      navigate(`/rfqs/${newRFQ.id}`, {
        state: { message: 'RFQ duplicated successfully' },
      });
    } catch (error) {
      console.error('Failed to duplicate RFQ:', error);
    }
  };

  // Format amount helper
  const formatAmount = (amount: string | number | null | undefined) => {
    if (!amount) return '-';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return formatCurrency(num);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !rfq) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <XCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-neutral-900">
          RFQ Not Found
        </h2>
        <p className="text-neutral-500 mt-1">
          The RFQ you're looking for doesn't exist or has been deleted.
        </p>
        <Button
          variant="outline"
          onClick={() => navigate('/rfqs')}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to RFQs
        </Button>
      </div>
    );
  }

  // Edit mode
  if (isEditing) {
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
            onClick={() => setIsEditing(false)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel Edit
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
            <FileQuestion className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Edit RFQ
            </h1>
            <p className="text-neutral-500">{rfq.number}</p>
          </div>
        </div>

        <div className="max-w-4xl">
          <RFQForm
            initialData={rfq}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
            isSubmitting={updateMutation.isPending}
            mode="edit"
          />
        </div>
      </motion.div>
    );
  }

  // Get awarded supplier name
  const awardedSupplierName = rfq.awarded_supplier
    ? mockSuppliers.find(s => s.id === rfq.awarded_supplier)?.name
    : null;

  // View mode
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Success Message */}
      {successMessage && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {successMessage}
          </p>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/rfqs')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {rfq.status === 'DRAFT' && (
            <>
              <Button
                variant="outline"
                onClick={handlePublish}
                disabled={publishMutation.isPending}
                className="text-blue-700 border-blue-200 hover:bg-blue-50"
              >
                <Send className="h-4 w-4 mr-2" />
                Publish
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </>
          )}
          {rfq.status === 'OPEN' && (
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={closeMutation.isPending}
              className="text-amber-700 border-amber-200 hover:bg-amber-50"
            >
              <Clock className="h-4 w-4 mr-2" />
              Close RFQ
            </Button>
          )}
          {rfq.status === 'CLOSED' && (
            <Button
              variant="outline"
              onClick={() => setAwardDialogOpen(true)}
              className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              <Award className="h-4 w-4 mr-2" />
              Award RFQ
            </Button>
          )}
          {['DRAFT', 'OPEN'].includes(rfq.status) && (
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          {rfq.status === 'DRAFT' && (
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          {rfq.status !== 'CANCELLED' && (
            <Button
              variant="outline"
              onClick={handleDuplicate}
              disabled={duplicateMutation.isPending}
            >
              <Copy className="h-4 w-4 mr-2" />
              {duplicateMutation.isPending ? 'Duplicating...' : 'Duplicate'}
            </Button>
          )}
        </div>
      </div>

      {/* RFQ Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-100">
          <FileQuestion className="h-8 w-8 text-blue-700" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-neutral-900">
              {rfq.title}
            </h1>
            <StatusBadge status={rfq.status} />
          </div>
          <p className="text-neutral-500 mt-1">
            {rfq.number}
            {awardedSupplierName && (
              <span className="ml-2 text-emerald-600">
                • Awarded to {awardedSupplierName}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-700 whitespace-pre-wrap">
                {rfq.description}
              </p>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-neutral-400" />
                <CardTitle>Line Items</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {rfq.lines && rfq.lines.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-neutral-500">
                        <th className="pb-3 font-medium">#</th>
                        <th className="pb-3 font-medium">Description</th>
                        <th className="pb-3 font-medium text-right">Qty</th>
                        <th className="pb-3 font-medium">UoM</th>
                        <th className="pb-3 font-medium text-right">Target Price</th>
                        <th className="pb-3 font-medium text-right">Target Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfq.lines.map((line) => {
                        const qty = parseFloat(line.quantity) || 0;
                        const price = parseFloat(line.target_unit_price || '0') || 0;
                        const total = qty * price;
                        return (
                          <tr key={line.id} className="border-b last:border-0">
                            <td className="py-3 text-neutral-500">{line.line_number}</td>
                            <td className="py-3 text-neutral-900">{line.description}</td>
                            <td className="py-3 text-right text-neutral-700">{line.quantity}</td>
                            <td className="py-3 text-neutral-500">{line.unit_of_measure}</td>
                            <td className="py-3 text-right text-neutral-700">
                              {line.target_unit_price ? formatAmount(line.target_unit_price) : '-'}
                            </td>
                            <td className="py-3 text-right font-medium text-neutral-900">
                              {total > 0 ? formatAmount(total) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2">
                        <td colSpan={5} className="py-3 text-right font-medium text-neutral-700">
                          Target Total:
                        </td>
                        <td className="py-3 text-right text-lg font-semibold text-neutral-900">
                          {formatAmount(rfq.total_amount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-neutral-400">No line items</p>
              )}
            </CardContent>
          </Card>

          {/* Invited Suppliers */}
          <InvitedSuppliersCard
            rfqId={rfq.id}
            rfqStatus={rfq.status}
            invitations={rfq.invitations || []}
            availableSuppliers={approvedSuppliers || []}
          />

          {/* Vendor Quotes */}
          {vendorQuotes && vendorQuotes.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-neutral-400" />
                  <CardTitle>Vendor Quotes ({vendorQuotes.length})</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vendorQuotes.map((quote) => (
                    <div
                      key={quote.id}
                      className={`border rounded-lg p-4 ${quote.is_selected ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-200'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-neutral-900">
                              {quote.supplier_name}
                            </h4>
                            {quote.is_selected && (
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-neutral-500 mt-1">
                            Submitted: {formatDate(quote.submitted_date)}
                            {quote.validity_date && ` • Valid until: ${formatDate(quote.validity_date)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-neutral-900">
                            {formatAmount(quote.total_amount)}
                          </p>
                        </div>
                      </div>
                      {quote.notes && (
                        <p className="text-sm text-neutral-600 mt-2 bg-neutral-50 p-2 rounded">
                          {quote.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentsSection objectType="rfq" objectId={rfq.id} />
            </CardContent>
          </Card>

          {/* Attachments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentsSection
                objectType="rfq"
                objectId={rfq.id}
                acceptedTypes={['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg']}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-neutral-400" />
                <CardTitle>Timeline</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-neutral-500">Created</dt>
                  <dd className="text-sm text-neutral-900 mt-0.5">
                    {formatDateTime(rfq.created_at)}
                  </dd>
                </div>
                {rfq.open_date && (
                  <div>
                    <dt className="text-sm text-neutral-500">Opened</dt>
                    <dd className="text-sm text-neutral-900 mt-0.5">
                      {formatDate(rfq.open_date)}
                    </dd>
                  </div>
                )}
                {rfq.close_date && (
                  <div>
                    <dt className="text-sm text-neutral-500">Close Date</dt>
                    <dd className="text-sm text-neutral-900 mt-0.5">
                      {formatDate(rfq.close_date)}
                    </dd>
                  </div>
                )}
                {rfq.awarded_date && (
                  <div>
                    <dt className="text-sm text-neutral-500">Awarded</dt>
                    <dd className="text-sm text-emerald-600 mt-0.5">
                      {formatDate(rfq.awarded_date)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-neutral-500">Last Updated</dt>
                  <dd className="text-sm text-neutral-900 mt-0.5">
                    {formatDateTime(rfq.updated_at)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-neutral-500">Line Items</dt>
                  <dd className="text-sm font-medium text-neutral-900 mt-0.5">
                    {rfq.lines?.length || 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Target Value</dt>
                  <dd className="text-lg font-semibold text-neutral-900 mt-0.5">
                    {formatAmount(rfq.total_amount)}
                  </dd>
                </div>
                {vendorQuotes && vendorQuotes.length > 0 && (
                  <div>
                    <dt className="text-sm text-neutral-500">Quotes Received</dt>
                    <dd className="text-sm font-medium text-neutral-900 mt-0.5">
                      {vendorQuotes.length}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete RFQ</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-neutral-900">
                {rfq.number}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete RFQ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award Dialog */}
      <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Award RFQ</DialogTitle>
            <DialogDescription>
              Select the supplier to award this RFQ to. This will create a purchase order.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              Select Supplier
            </label>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a supplier..." />
              </SelectTrigger>
              <SelectContent>
                {approvedSuppliers?.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAwardDialogOpen(false);
                setSelectedSupplier('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAward}
              disabled={!selectedSupplier || awardMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {awardMutation.isPending ? 'Awarding...' : 'Award RFQ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
