import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  Building2,
  DollarSign,
  Printer,
  Send,
  RefreshCw,
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
import { Textarea } from '@/components/ui/textarea';

import { ContractForm } from '@/components/contracts';
import { CommentsSection } from '@/components/ui/comments-section';
import { AttachmentsSection } from '@/components/ui/attachments-section';
import {
  useContract,
  useUpdateContract,
  useDeleteContract,
  useSubmitContract,
  useApproveContract,
  useRejectContract,
  useTerminateContract,
  useRenewContract,
  useCancelContract,
  CONTRACT_STATUS_CONFIG,
  CONTRACT_TYPE_CONFIG,
  type ContractPayload,
} from '@/lib/api/contracts';

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatCurrency = (amount: string | number, currency = 'USD') => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(num);
};

const calculateDaysRemaining = (endDate: string) => {
  const end = new Date(endDate);
  const today = new Date();
  const diff = end.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = location.pathname.endsWith('/edit');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [terminateReason, setTerminateReason] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  const { data: contract, isLoading, error } = useContract(id!);
  const updateMutation = useUpdateContract();
  const deleteMutation = useDeleteContract();
  const submitMutation = useSubmitContract();
  const approveMutation = useApproveContract();
  const rejectMutation = useRejectContract();
  const terminateMutation = useTerminateContract();
  const renewMutation = useRenewContract();
  const cancelMutation = useCancelContract();

  const handleUpdate = async (data: ContractPayload) => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({ id, data });
      navigate(`/contracts/${id}`);
    } catch (error) {
      console.error('Failed to update contract:', error);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      navigate('/contracts');
    } catch (error) {
      console.error('Failed to delete contract:', error);
    }
  };

  const handleSubmit = async () => {
    if (!id) return;
    try {
      await submitMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to submit contract:', error);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
      await approveMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to approve contract:', error);
    }
  };

  const handleReject = async () => {
    if (!id || !rejectReason) return;
    try {
      await rejectMutation.mutateAsync({ id, reason: rejectReason });
      setRejectDialogOpen(false);
      setRejectReason('');
    } catch (error) {
      console.error('Failed to reject contract:', error);
    }
  };

  const handleTerminate = async () => {
    if (!id || !terminateReason) return;
    try {
      await terminateMutation.mutateAsync({ id, reason: terminateReason });
      setTerminateDialogOpen(false);
      setTerminateReason('');
    } catch (error) {
      console.error('Failed to terminate contract:', error);
    }
  };

  const handleRenew = async () => {
    if (!id || !newEndDate) return;
    try {
      await renewMutation.mutateAsync({ id, newEndDate });
      setRenewDialogOpen(false);
      setNewEndDate('');
    } catch (error) {
      console.error('Failed to renew contract:', error);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    try {
      await cancelMutation.mutateAsync(id);
      setCancelDialogOpen(false);
    } catch (error) {
      console.error('Failed to cancel contract:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sahel-green"></div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-neutral-900">Contract not found</h2>
        <p className="text-neutral-500 mt-2">
          The contract you're looking for doesn't exist.
        </p>
        <Button onClick={() => navigate('/contracts')} className="mt-4">
          Back to Contracts
        </Button>
      </div>
    );
  }

  const statusConfig = CONTRACT_STATUS_CONFIG[contract.status] || { label: contract.status || 'Unknown', color: 'text-neutral-700', bgColor: 'bg-neutral-100' };
  const typeConfig = CONTRACT_TYPE_CONFIG[contract.contract_type] || { label: contract.contract_type || 'Unknown', description: '' };
  const canEdit = ['DRAFT', 'PENDING_APPROVAL'].includes(contract.status);
  const canSubmit = contract.status === 'DRAFT';
  const canApprove = contract.status === 'PENDING_APPROVAL';
  const canTerminate = contract.status === 'ACTIVE';
  const canRenew = ['ACTIVE', 'EXPIRED'].includes(contract.status);
  const canCancel = !['CANCELLED', 'TERMINATED'].includes(contract.status);

  const daysRemaining = contract.status === 'ACTIVE' ? calculateDaysRemaining(contract.end_date) : null;
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 30 && daysRemaining >= 0;
  const isExpired = daysRemaining !== null && daysRemaining < 0;

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
            onClick={() => navigate(`/contracts/${id}`)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Contract
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
            <Edit className="h-6 w-6 text-indigo-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Edit Contract
            </h1>
            <p className="text-neutral-500">{contract.number}</p>
          </div>
        </div>

        <div className="max-w-4xl">
          <ContractForm
            contract={contract}
            onSubmit={handleUpdate}
            onCancel={() => navigate(`/contracts/${id}`)}
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
          onClick={() => navigate('/contracts')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Contracts
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
            <FileText className="h-6 w-6 text-indigo-700" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-900">
                {contract.number}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <p className="text-neutral-500">{contract.title}</p>
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
                onClick={() => navigate(`/contracts/${id}/edit`)}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            </>
          )}

          {contract.status === 'DRAFT' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="gap-2 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}

          {canSubmit && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
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
                onClick={() => setRejectDialogOpen(true)}
                className="gap-2 text-red-600 hover:text-red-700"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </>
          )}

          {canRenew && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRenewDialogOpen(true)}
              className="gap-2 text-blue-600 hover:text-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Renew
            </Button>
          )}

          {canTerminate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTerminateDialogOpen(true)}
              className="gap-2 text-red-600 hover:text-red-700"
            >
              <XCircle className="h-4 w-4" />
              Terminate
            </Button>
          )}

          {canCancel && contract.status !== 'DRAFT' && (
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

      {/* Expiry Warning */}
      {isExpiringSoon && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">Contract Expiring Soon</p>
            <p className="text-sm text-amber-600">
              This contract will expire in {daysRemaining} days on {formatDate(contract.end_date)}
            </p>
          </div>
        </div>
      )}

      {isExpired && contract.status === 'ACTIVE' && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-red-600" />
          <div>
            <p className="font-medium text-red-800">Contract Expired</p>
            <p className="text-sm text-red-600">
              This contract expired on {formatDate(contract.end_date)}
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contract Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-700 whitespace-pre-wrap">{contract.description}</p>
            </CardContent>
          </Card>

          {/* Contract Terms */}
          <Card>
            <CardHeader>
              <CardTitle>Contract Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-neutral-500">Start Date</p>
                  <p className="font-medium text-neutral-900">{formatDate(contract.start_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">End Date</p>
                  <p className={`font-medium ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : 'text-neutral-900'}`}>
                    {formatDate(contract.end_date)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Duration</p>
                  <p className="font-medium text-neutral-900">
                    {Math.ceil((new Date(contract.end_date).getTime() - new Date(contract.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30))} months
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Auto-Renew</p>
                  <p className="font-medium text-neutral-900">
                    {contract.auto_renew ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <RefreshCw className="h-4 w-4" /> Yes
                      </span>
                    ) : (
                      'No'
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentsSection objectType="contract" objectId={contract.id} />
            </CardContent>
          </Card>

          {/* Attachments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentsSection
                objectType="contract"
                objectId={contract.id}
                acceptedTypes={['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg']}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Value */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Contract Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-neutral-900">
                {formatCurrency(contract.total_value, contract.currency)}
              </div>
              <div className="text-sm text-neutral-500 mt-1">{contract.currency}</div>
            </CardContent>
          </Card>

          {/* Type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Contract Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-neutral-900">{typeConfig.label}</p>
              <p className="text-sm text-neutral-500 mt-1">{typeConfig.description}</p>
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
              <p className="font-medium text-neutral-900">{contract.supplier_name}</p>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-neutral-500">Created</p>
                <p className="font-medium text-neutral-900">{formatDate(contract.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Last Updated</p>
                <p className="font-medium text-neutral-900">{formatDate(contract.updated_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete contract "{contract.number}"? This action
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
            <AlertDialogTitle>Cancel Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel contract "{contract.number}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Contract</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Contract
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting contract "{contract.number}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!rejectReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terminate Dialog */}
      <AlertDialog open={terminateDialogOpen} onOpenChange={setTerminateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for terminating contract "{contract.number}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter termination reason..."
              value={terminateReason}
              onChange={e => setTerminateReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTerminateReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTerminate}
              disabled={!terminateReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renew Dialog */}
      <AlertDialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renew Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Set a new end date for contract "{contract.number}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-neutral-700">New End Date</label>
            <Input
              type="date"
              value={newEndDate}
              onChange={e => setNewEndDate(e.target.value)}
              min={contract.end_date}
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewEndDate('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRenew}
              disabled={!newEndDate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Renew Contract
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
