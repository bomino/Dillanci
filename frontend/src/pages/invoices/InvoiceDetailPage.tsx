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
  User,
  Printer,
  ShoppingCart,
  Send,
  DollarSign,
  Clock,
  Package,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';

import { InvoiceForm, ThreeWayMatch } from '@/components/invoices';
import { CommentsSection } from '@/components/ui/comments-section';
import { AttachmentsSection } from '@/components/ui/attachments-section';
import {
  useInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useSubmitInvoice,
  useValidateInvoice,
  useMatchInvoice,
  useApproveInvoice,
  usePayInvoice,
  useRejectInvoice,
  useDisputeInvoice,
  useCancelInvoice,
  INVOICE_STATUS_CONFIG,
  MATCH_STATUS_CONFIG,
  type InvoicePayload,
} from '@/lib/api/invoices';

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

const isOverdue = (dueDate: string, status: string) => {
  if (status === 'PAID' || status === 'CANCELLED') return false;
  return new Date(dueDate) < new Date();
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = location.pathname.endsWith('/edit');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [disputeReason, setDisputeReason] = useState('');

  const { data: invoice, isLoading, error } = useInvoice(id!);
  const updateMutation = useUpdateInvoice();
  const deleteMutation = useDeleteInvoice();
  const submitMutation = useSubmitInvoice();
  const validateMutation = useValidateInvoice();
  const matchMutation = useMatchInvoice();
  const approveMutation = useApproveInvoice();
  const payMutation = usePayInvoice();
  const rejectMutation = useRejectInvoice();
  const disputeMutation = useDisputeInvoice();
  const cancelMutation = useCancelInvoice();

  const handleUpdate = async (data: InvoicePayload) => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({ id, data });
      navigate(`/invoices/${id}`);
    } catch (error) {
      console.error('Failed to update invoice:', error);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      navigate('/invoices');
    } catch (error) {
      console.error('Failed to delete invoice:', error);
    }
  };

  const handleSubmit = async () => {
    if (!id) return;
    try {
      await submitMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to submit invoice:', error);
    }
  };

  const handleValidate = async () => {
    if (!id) return;
    try {
      await validateMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to validate invoice:', error);
    }
  };

  const handleMatch = async () => {
    if (!id) return;
    try {
      await matchMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to match invoice:', error);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
      await approveMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to approve invoice:', error);
    }
  };

  const handlePay = async () => {
    if (!id) return;
    try {
      await payMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error);
    }
  };

  const handleReject = async () => {
    if (!id || !rejectReason) return;
    try {
      await rejectMutation.mutateAsync({ id, reason: rejectReason });
      setRejectDialogOpen(false);
      setRejectReason('');
    } catch (error) {
      console.error('Failed to reject invoice:', error);
    }
  };

  const handleDispute = async () => {
    if (!id || !disputeReason) return;
    try {
      await disputeMutation.mutateAsync({ id, reason: disputeReason });
      setDisputeDialogOpen(false);
      setDisputeReason('');
    } catch (error) {
      console.error('Failed to dispute invoice:', error);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    try {
      await cancelMutation.mutateAsync(id);
      setCancelDialogOpen(false);
    } catch (error) {
      console.error('Failed to cancel invoice:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sahel-green"></div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-neutral-900">Invoice not found</h2>
        <p className="text-neutral-500 mt-2">
          The invoice you're looking for doesn't exist.
        </p>
        <Button onClick={() => navigate('/invoices')} className="mt-4">
          Back to Invoices
        </Button>
      </div>
    );
  }

  const statusConfig = INVOICE_STATUS_CONFIG[invoice.status];
  const matchConfig = MATCH_STATUS_CONFIG[invoice.match_status];
  const canEdit = invoice.status === 'DRAFT';
  const canSubmit = invoice.status === 'DRAFT';
  const canValidate = invoice.status === 'PENDING_VALIDATION';
  const canMatch = ['VALIDATED', 'PENDING_VALIDATION'].includes(invoice.status);
  const canApprove = ['MATCHED', 'PARTIALLY_MATCHED', 'VALIDATED'].includes(invoice.status);
  const canPay = invoice.status === 'APPROVED';
  const canCancel = !['PAID', 'CANCELLED'].includes(invoice.status);
  const overdue = isOverdue(invoice.due_date, invoice.status);

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
            onClick={() => navigate(`/invoices/${id}`)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoice
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
            <Edit className="h-6 w-6 text-purple-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Edit Invoice
            </h1>
            <p className="text-neutral-500">{invoice.number}</p>
          </div>
        </div>

        <div className="max-w-4xl">
          <InvoiceForm
            invoice={invoice}
            onSubmit={handleUpdate}
            onCancel={() => navigate(`/invoices/${id}`)}
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
          onClick={() => navigate('/invoices')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
            <FileText className="h-6 w-6 text-purple-700" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-900">
                {invoice.number}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${matchConfig.bgColor} ${matchConfig.color}`}
              >
                {matchConfig.label}
              </span>
            </div>
            <p className="text-neutral-500">
              Supplier Invoice: {invoice.supplier_invoice_number}
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
                onClick={() => navigate(`/invoices/${id}/edit`)}
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
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
              Submit
            </Button>
          )}

          {canValidate && (
            <Button
              size="sm"
              onClick={handleValidate}
              disabled={validateMutation.isPending}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="h-4 w-4" />
              Validate
            </Button>
          )}

          {canMatch && (
            <Button
              size="sm"
              onClick={handleMatch}
              disabled={matchMutation.isPending}
              className="gap-2 bg-cyan-600 hover:bg-cyan-700"
            >
              <Package className="h-4 w-4" />
              Run 3-Way Match
            </Button>
          )}

          {canApprove && (
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </Button>
          )}

          {canPay && (
            <Button
              size="sm"
              onClick={handlePay}
              disabled={payMutation.isPending}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <DollarSign className="h-4 w-4" />
              Mark as Paid
            </Button>
          )}

          {canApprove && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectDialogOpen(true)}
              className="gap-2 text-red-600 hover:text-red-700"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          )}

          {['MATCHED', 'PARTIALLY_MATCHED', 'VARIANCE'].includes(invoice.match_status) &&
           invoice.status !== 'DISPUTED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisputeDialogOpen(true)}
              className="gap-2 text-purple-600 hover:text-purple-700"
            >
              <AlertTriangle className="h-4 w-4" />
              Dispute
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

      {/* Overdue Warning */}
      {overdue && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-red-600" />
          <div>
            <p className="font-medium text-red-800">Invoice Overdue</p>
            <p className="text-sm text-red-600">
              This invoice was due on {formatDate(invoice.due_date)}
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Items & 3-Way Match */}
        <div className="lg:col-span-2 space-y-6">
          {/* 3-Way Match */}
          {invoice.match_data && invoice.match_data.length > 0 && (
            <ThreeWayMatch matchData={invoice.match_data} lines={invoice.lines} />
          )}

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Lines</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.lines && invoice.lines.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Match</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.lines.map((line, index) => {
                        const lineMatchConfig = MATCH_STATUS_CONFIG[line.match_status];
                        return (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium text-neutral-500">
                              {index + 1}
                            </TableCell>
                            <TableCell>{line.description}</TableCell>
                            <TableCell className="text-right">{line.quantity}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(line.unit_price)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(line.extended_amount)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${lineMatchConfig.bgColor} ${lineMatchConfig.color}`}
                              >
                                {lineMatchConfig.label}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Totals */}
                      <TableRow className="bg-neutral-50">
                        <TableCell colSpan={4} className="text-right font-medium">
                          Subtotal:
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(invoice.subtotal)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      <TableRow className="bg-neutral-50">
                        <TableCell colSpan={4} className="text-right font-medium">
                          Tax:
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(invoice.tax_amount)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      <TableRow className="bg-neutral-100">
                        <TableCell colSpan={4} className="text-right font-semibold">
                          Total:
                        </TableCell>
                        <TableCell className="text-right font-semibold text-lg">
                          {formatCurrency(invoice.total_amount)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-neutral-500">No line items</p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-700 whitespace-pre-wrap">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Amount Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-neutral-900">
                {formatCurrency(invoice.total_amount, invoice.currency)}
              </div>
              <div className="text-sm text-neutral-500 mt-1">{invoice.currency}</div>
            </CardContent>
          </Card>

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
                onClick={() => navigate(`/purchase-orders/${invoice.purchase_order}`)}
                className="font-medium text-sahel-blue hover:text-sahel-blue/80 hover:underline"
              >
                {invoice.po_number}
              </button>
            </CardContent>
          </Card>

          {/* Goods Receipt */}
          {invoice.goods_receipt && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Goods Receipt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <button
                  onClick={() => navigate(`/receiving/${invoice.goods_receipt}`)}
                  className="font-medium text-sahel-blue hover:text-sahel-blue/80 hover:underline"
                >
                  {invoice.gr_number}
                </button>
              </CardContent>
            </Card>
          )}

          {/* Supplier */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Supplier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-neutral-900">{invoice.supplier_name}</p>
            </CardContent>
          </Card>

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
                <p className="text-sm text-neutral-500">Invoice Date</p>
                <p className="font-medium text-neutral-900">{formatDate(invoice.invoice_date)}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Due Date</p>
                <p className={`font-medium ${overdue ? 'text-red-600' : 'text-neutral-900'}`}>
                  {formatDate(invoice.due_date)}
                  {overdue && ' (Overdue)'}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Payment Terms</p>
                <p className="font-medium text-neutral-900">{invoice.payment_terms}</p>
              </div>
            </CardContent>
          </Card>

          {/* Created */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-neutral-500">Created</p>
                <p className="font-medium text-neutral-900">{formatDate(invoice.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Last Updated</p>
                <p className="font-medium text-neutral-900">{formatDate(invoice.updated_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Comments Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <CommentsSection objectType="invoice" objectId={invoice.id} />
        </CardContent>
      </Card>

      {/* Attachments Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentsSection
            objectType="invoice"
            objectId={invoice.id}
            acceptedTypes={['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg']}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice "{invoice.number}"? This action
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
            <AlertDialogTitle>Cancel Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel invoice "{invoice.number}"? This will
              stop the invoice from being processed for payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Invoice</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting invoice "{invoice.number}".
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

      {/* Dispute Dialog */}
      <AlertDialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dispute Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Please describe the dispute for invoice "{invoice.number}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Describe the dispute (e.g., price variance, quantity mismatch)..."
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDisputeReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDispute}
              disabled={!disputeReason.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Submit Dispute
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
