import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  Pencil,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  User,
  Building2,
  Clock,
  DollarSign,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { RequisitionForm } from '@/components/requisitions';

import {
  useRequisition,
  useUpdateRequisition,
  useDeleteRequisition,
  useSubmitRequisition,
  useApproveRequisition,
  useRejectRequisition,
  useCancelRequisition,
  requisitionPriorityConfig,
  departmentOptions,
} from '@/lib/api/requisitions';
import type { RequisitionPayload } from '@/lib/api/requisitions';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils';

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: requisition, isLoading, isError } = useRequisition(id);
  const updateMutation = useUpdateRequisition();
  const deleteMutation = useDeleteRequisition();
  const submitMutation = useSubmitRequisition();
  const approveMutation = useApproveRequisition();
  const rejectMutation = useRejectRequisition();
  const cancelMutation = useCancelRequisition();

  // Check for success message from create page
  const successMessage = location.state?.message;

  // Check if reject action was triggered from URL
  useEffect(() => {
    if (searchParams.get('action') === 'reject' && requisition?.status === 'SUBMITTED') {
      setRejectDialogOpen(true);
    }
  }, [searchParams, requisition?.status]);

  const handleUpdate = async (data: RequisitionPayload) => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({ id, payload: data });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update requisition:', error);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      navigate('/requisitions', {
        state: { message: 'Requisition deleted successfully' },
      });
    } catch (error) {
      console.error('Failed to delete requisition:', error);
    }
  };

  const handleSubmit = async () => {
    if (!id) return;
    try {
      await submitMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to submit requisition:', error);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
      await approveMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to approve requisition:', error);
    }
  };

  const handleReject = async () => {
    if (!id || !rejectionReason.trim()) return;
    try {
      await rejectMutation.mutateAsync({ id, reason: rejectionReason });
      setRejectDialogOpen(false);
      setRejectionReason('');
    } catch (error) {
      console.error('Failed to reject requisition:', error);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    try {
      await cancelMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to cancel requisition:', error);
    }
  };

  // Get priority badge styling
  const getPriorityBadge = (priority: string) => {
    const config = requisitionPriorityConfig[priority as keyof typeof requisitionPriorityConfig];
    if (!config) return null;
    const colorClasses = {
      default: 'bg-neutral-100 text-neutral-700',
      info: 'bg-blue-100 text-blue-700',
      warning: 'bg-amber-100 text-amber-700',
      error: 'bg-red-100 text-red-700',
      success: 'bg-emerald-100 text-emerald-700',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[config.color]}`}>
        {config.label}
      </span>
    );
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
  if (isError || !requisition) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-neutral-900">
          Requisition Not Found
        </h2>
        <p className="text-neutral-500 mt-1">
          The requisition you're looking for doesn't exist or has been deleted.
        </p>
        <Button
          variant="outline"
          onClick={() => navigate('/requisitions')}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Requisitions
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
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
            <FileText className="h-6 w-6 text-primary-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Edit Requisition
            </h1>
            <p className="text-neutral-500">{requisition.number}</p>
          </div>
        </div>

        <div className="max-w-4xl">
          <RequisitionForm
            initialData={requisition}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
            isSubmitting={updateMutation.isPending}
            mode="edit"
          />
        </div>
      </motion.div>
    );
  }

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

      {/* Rejection Message */}
      {requisition.status === 'REJECTED' && requisition.rejection_reason && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason:</p>
          <p className="text-sm text-red-700">{requisition.rejection_reason}</p>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/requisitions')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {requisition.status === 'DRAFT' && (
            <>
              <Button
                variant="outline"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="text-blue-700 border-blue-200 hover:bg-blue-50"
              >
                <Send className="h-4 w-4 mr-2" />
                Submit for Approval
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
          {requisition.status === 'SUBMITTED' && (
            <>
              <Button
                variant="outline"
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setRejectDialogOpen(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Requisition Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-100">
          <FileText className="h-8 w-8 text-primary-700" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-neutral-900">
              {requisition.title}
            </h1>
            <StatusBadge status={requisition.status} />
            {getPriorityBadge(requisition.priority)}
          </div>
          <p className="text-neutral-500 mt-1">
            {requisition.number} &middot;{' '}
            {departmentOptions.find(d => d.value === requisition.department)?.label || requisition.department}
          </p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {requisition.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-700 whitespace-pre-wrap">
                  {requisition.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>
                {requisition.lines.length} item{requisition.lines.length !== 1 ? 's' : ''} requested
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 text-sm font-medium text-neutral-500">#</th>
                      <th className="pb-3 text-sm font-medium text-neutral-500">Description</th>
                      <th className="pb-3 text-sm font-medium text-neutral-500 text-right">Qty</th>
                      <th className="pb-3 text-sm font-medium text-neutral-500">UoM</th>
                      <th className="pb-3 text-sm font-medium text-neutral-500 text-right">Unit Price</th>
                      <th className="pb-3 text-sm font-medium text-neutral-500 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requisition.lines.map((line) => (
                      <tr key={line.id} className="border-b last:border-0">
                        <td className="py-3 text-sm text-neutral-500">{line.line_number}</td>
                        <td className="py-3">
                          <div className="text-sm font-medium text-neutral-900">
                            {line.description}
                          </div>
                          {line.notes && (
                            <div className="text-xs text-neutral-500 mt-0.5">
                              {line.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-sm text-neutral-900 text-right">
                          {line.quantity}
                        </td>
                        <td className="py-3 text-sm text-neutral-600">{line.unit_of_measure}</td>
                        <td className="py-3 text-sm text-neutral-900 text-right">
                          {line.estimated_unit_price
                            ? formatCurrency(parseFloat(line.estimated_unit_price), requisition.currency)
                            : '-'}
                        </td>
                        <td className="py-3 text-sm font-medium text-neutral-900 text-right">
                          {line.estimated_amount
                            ? formatCurrency(parseFloat(line.estimated_amount), requisition.currency)
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} className="pt-4 text-sm font-medium text-neutral-900 text-right">
                        Total:
                      </td>
                      <td className="pt-4 text-lg font-semibold text-neutral-900 text-right">
                        {formatCurrency(parseFloat(requisition.total_amount), requisition.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Request Info */}
          <Card>
            <CardHeader>
              <CardTitle>Request Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-neutral-400" />
                <div>
                  <p className="text-xs text-neutral-500">Requester</p>
                  <p className="text-sm font-medium text-neutral-900">
                    {requisition.requester_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-neutral-400" />
                <div>
                  <p className="text-xs text-neutral-500">Department</p>
                  <p className="text-sm font-medium text-neutral-900">
                    {departmentOptions.find(d => d.value === requisition.department)?.label || requisition.department}
                  </p>
                </div>
              </div>
              {requisition.required_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-neutral-400" />
                  <div>
                    <p className="text-xs text-neutral-500">Required By</p>
                    <p className="text-sm font-medium text-neutral-900">
                      {formatDate(requisition.required_date)}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-neutral-400" />
                <div>
                  <p className="text-xs text-neutral-500">Currency</p>
                  <p className="text-sm font-medium text-neutral-900">
                    {requisition.currency}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Approval Info */}
          {(requisition.approved_by || requisition.status === 'APPROVED') && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <CardTitle>Approval</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {requisition.approved_by_name && (
                  <div>
                    <p className="text-xs text-neutral-500">Approved By</p>
                    <p className="text-sm font-medium text-neutral-900">
                      {requisition.approved_by_name}
                    </p>
                  </div>
                )}
                {requisition.approved_date && (
                  <div>
                    <p className="text-xs text-neutral-500">Approved Date</p>
                    <p className="text-sm text-neutral-900">
                      {formatDateTime(requisition.approved_date)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-neutral-400" />
                <CardTitle>Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-neutral-500">Created</dt>
                  <dd className="text-sm text-neutral-900 mt-0.5">
                    {formatDateTime(requisition.created_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-neutral-500">Last Updated</dt>
                  <dd className="text-sm text-neutral-900 mt-0.5">
                    {formatDateTime(requisition.updated_at)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Requisition</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete requisition{' '}
              <span className="font-medium text-neutral-900">
                {requisition.number}
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
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Requisition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Requisition</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting requisition{' '}
              <span className="font-medium text-neutral-900">
                {requisition.number}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Requisition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
