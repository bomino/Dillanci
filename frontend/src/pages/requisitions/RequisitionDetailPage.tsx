import { useState, useEffect, useMemo } from 'react';
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
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Package,
  Clock,
  ArrowRight,
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
import { CommentsSection } from '@/components/ui/comments-section';
import { AttachmentsSection } from '@/components/ui/attachments-section';
import { ActivityTimeline } from '@/components/ui/activity-timeline';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useCreatePOFromRequisition } from '@/lib/api/purchase-orders';
import { useSuppliers } from '@/lib/api/suppliers';

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
  const [convertToPODialogOpen, setConvertToPODialogOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  const { data: requisition, isLoading, isError } = useRequisition(id);
  const { data: suppliers } = useSuppliers({ status: 'APPROVED' });
  const updateMutation = useUpdateRequisition();
  const deleteMutation = useDeleteRequisition();
  const submitMutation = useSubmitRequisition();
  const approveMutation = useApproveRequisition();
  const rejectMutation = useRejectRequisition();
  const cancelMutation = useCancelRequisition();
  const createPOMutation = useCreatePOFromRequisition();

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

  const handleConvertToPO = async () => {
    if (!id || !selectedSupplierId) return;
    try {
      const newPO = await createPOMutation.mutateAsync({
        requisition_id: id,
        supplier_id: selectedSupplierId,
      });
      setConvertToPODialogOpen(false);
      setSelectedSupplierId('');
      // Navigate to the new PO
      navigate(`/purchase-orders/${newPO.id}`, {
        state: { message: 'Purchase Order created successfully from requisition' },
      });
    } catch (error) {
      console.error('Failed to create PO from requisition:', error);
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

  // Calculate fulfillment statistics
  const fulfillmentStats = useMemo(() => {
    if (!requisition) return null;

    const totalLines = requisition.lines.length;
    const convertedLines = requisition.lines.filter(line => line.is_converted).length;
    const fulfillmentPercentage = totalLines > 0 ? Math.round((convertedLines / totalLines) * 100) : 0;

    // Calculate total PO value
    const totalPOValue = requisition.purchase_orders?.reduce(
      (sum, po) => sum + parseFloat(po.total_amount || '0'),
      0
    ) || 0;

    // Calculate coverage percentage (PO value vs requisition value)
    const requisitionValue = parseFloat(requisition.total_amount || '0');
    const coveragePercentage = requisitionValue > 0
      ? Math.min(Math.round((totalPOValue / requisitionValue) * 100), 100)
      : 0;

    return {
      totalLines,
      convertedLines,
      unconvertedLines: totalLines - convertedLines,
      fulfillmentPercentage,
      poCount: requisition.purchase_orders?.length || 0,
      totalPOValue,
      coveragePercentage,
      isFullyConverted: convertedLines === totalLines && totalLines > 0,
    };
  }, [requisition]);

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
          {String(requisition.status).toUpperCase() === 'APPROVED' && (
            <Button
              onClick={() => setConvertToPODialogOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Convert to PO
            </Button>
          )}
        </div>
      </div>

      {/* Requisition Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-100">
          <FileText className="h-8 w-8 text-primary-700" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-neutral-900">
              {requisition.title}
            </h1>
            <StatusBadge status={requisition.status} />
            {getPriorityBadge(requisition.priority)}
            {/* Quick Stats Badges */}
            {fulfillmentStats && fulfillmentStats.poCount > 0 && (
              <>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  <ShoppingCart className="h-3 w-3" />
                  {fulfillmentStats.poCount} PO{fulfillmentStats.poCount !== 1 ? 's' : ''}
                </span>
                {fulfillmentStats.isFullyConverted && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    <CheckCircle className="h-3 w-3" />
                    Fully Ordered
                  </span>
                )}
              </>
            )}
          </div>
          <p className="text-neutral-500 mt-1">
            {requisition.number} &middot;{' '}
            {departmentOptions.find(d => d.value === requisition.department)?.label || requisition.department}
          </p>
        </div>
      </div>

      {/* Fulfillment Progress Card - Only show when POs exist */}
      {fulfillmentStats && fulfillmentStats.poCount > 0 && (
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-neutral-900">Order Fulfillment Progress</h3>
              </div>
              <span className="text-sm text-neutral-500">
                {fulfillmentStats.convertedLines} of {fulfillmentStats.totalLines} lines ordered
              </span>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 bg-neutral-200 rounded-full overflow-hidden mb-4">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${fulfillmentStats.fulfillmentPercentage}%` }}
              />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-white rounded-lg border border-neutral-100">
                <p className="text-2xl font-bold text-emerald-600">{fulfillmentStats.poCount}</p>
                <p className="text-xs text-neutral-500">Purchase Orders</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border border-neutral-100">
                <p className="text-2xl font-bold text-blue-600">{fulfillmentStats.fulfillmentPercentage}%</p>
                <p className="text-xs text-neutral-500">Lines Ordered</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border border-neutral-100">
                <p className="text-2xl font-bold text-neutral-900">
                  {formatCurrency(fulfillmentStats.totalPOValue, requisition.currency)}
                </p>
                <p className="text-xs text-neutral-500">Total PO Value</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border border-neutral-100">
                <p className="text-2xl font-bold text-amber-600">{fulfillmentStats.unconvertedLines}</p>
                <p className="text-xs text-neutral-500">Lines Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                      <th className="pb-3 pr-4 text-sm font-medium text-neutral-500 w-10">#</th>
                      <th className="pb-3 pr-4 text-sm font-medium text-neutral-500">Description</th>
                      <th className="pb-3 px-4 text-sm font-medium text-neutral-500 text-center w-20">Qty</th>
                      <th className="pb-3 px-4 text-sm font-medium text-neutral-500 text-center w-20">UoM</th>
                      <th className="pb-3 pl-4 text-sm font-medium text-neutral-500 text-right w-28">Unit Price</th>
                      <th className="pb-3 pl-4 text-sm font-medium text-neutral-500 text-right w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requisition.lines.map((line) => (
                      <tr key={line.id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-neutral-500">{line.line_number}</span>
                            {line.is_converted && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700" title="Converted to PO">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                PO
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="text-sm font-medium text-neutral-900">
                            {line.description}
                          </div>
                          {line.notes && (
                            <div className="text-xs text-neutral-500 mt-0.5">
                              {line.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-neutral-900 text-center font-medium">
                          {line.quantity}
                        </td>
                        <td className="py-3 px-4 text-sm text-neutral-600 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-xs font-medium">
                            {line.unit_of_measure}
                          </span>
                        </td>
                        <td className="py-3 pl-4 text-sm text-neutral-900 text-right">
                          {line.estimated_unit_price
                            ? formatCurrency(parseFloat(line.estimated_unit_price), requisition.currency)
                            : '-'}
                        </td>
                        <td className="py-3 pl-4 text-sm font-medium text-neutral-900 text-right">
                          {line.estimated_amount
                            ? formatCurrency(parseFloat(line.estimated_amount), requisition.currency)
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} className="pt-4 pr-4 text-sm font-medium text-neutral-900 text-right">
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

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentsSection objectType="requisition" objectId={requisition.id} />
            </CardContent>
          </Card>

          {/* Attachments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentsSection
                objectType="requisition"
                objectId={requisition.id}
                acceptedTypes={['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg']}
              />
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

          {/* Related Purchase Orders - Enhanced Timeline View */}
          {requisition.purchase_orders && requisition.purchase_orders.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-emerald-600" />
                    <CardTitle>Purchase Orders</CardTitle>
                  </div>
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                    {requisition.purchase_orders.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-0">
                {/* PO Timeline */}
                <div className="relative">
                  {requisition.purchase_orders.map((po, index) => (
                    <div key={po.id} className="relative pl-6 pb-4 last:pb-0">
                      {/* Timeline Line */}
                      {index < requisition.purchase_orders!.length - 1 && (
                        <div className="absolute left-[9px] top-6 bottom-0 w-0.5 bg-emerald-200" />
                      )}
                      {/* Timeline Dot */}
                      <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center">
                        <ShoppingCart className="h-2.5 w-2.5 text-emerald-600" />
                      </div>
                      {/* PO Card */}
                      <button
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        className="w-full text-left p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 hover:border-emerald-300 hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-emerald-600 group-hover:underline flex items-center gap-1">
                            {po.number}
                            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                          <StatusBadge status={po.status} />
                        </div>
                        <p className="text-sm text-neutral-600">{po.supplier_name}</p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-sm font-semibold text-neutral-900">
                            {formatCurrency(parseFloat(po.total_amount))}
                          </p>
                          <p className="text-xs text-neutral-400">
                            {formatDate(po.created_at)}
                          </p>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total PO Value Summary */}
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Total PO Value</span>
                    <span className="font-semibold text-neutral-900">
                      {formatCurrency(
                        requisition.purchase_orders.reduce((sum, po) => sum + parseFloat(po.total_amount), 0),
                        requisition.currency
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity Timeline */}
          <Card>
            <CardContent className="pt-6">
              <ActivityTimeline
                contentType="requisitions.requisition"
                objectId={requisition.id}
                maxItems={5}
                compact
              />
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

      {/* Convert to PO Dialog */}
      <Dialog open={convertToPODialogOpen} onOpenChange={setConvertToPODialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Purchase Order</DialogTitle>
            <DialogDescription>
              Create a Purchase Order from requisition{' '}
              <span className="font-medium text-neutral-900">
                {requisition.number}
              </span>
              . Select a supplier to proceed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Warning if POs already exist */}
            {requisition.purchase_orders && requisition.purchase_orders.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm text-amber-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {requisition.purchase_orders.length} PO{requisition.purchase_orders.length !== 1 ? 's' : ''} already created from this requisition.
                    Creating another will result in multiple POs for the same items.
                  </span>
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Select a supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.results?.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-neutral-50 p-4 space-y-2">
              <p className="text-sm font-medium text-neutral-700">Summary</p>
              <div className="text-sm text-neutral-600">
                <p>{requisition.lines.length} line item{requisition.lines.length !== 1 ? 's' : ''}</p>
                <p>Total: {formatCurrency(parseFloat(requisition.total_amount), requisition.currency)}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConvertToPODialogOpen(false);
                setSelectedSupplierId('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConvertToPO}
              disabled={createPOMutation.isPending || !selectedSupplierId}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {createPOMutation.isPending ? 'Creating...' : 'Create Purchase Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
