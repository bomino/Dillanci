import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  FileText,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  Clock,
} from 'lucide-react';
import type { ColumnDef, SortingState, RowSelectionState } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
} from '@tanstack/react-table';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportButton } from '@/components/ui/export-button';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkActionToolbar } from '@/components/ui/bulk-action-toolbar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import type { Invoice, InvoiceStatus, MatchStatus } from '@/types';
import {
  useInvoices,
  useDeleteInvoice,
  useSubmitInvoice,
  useApproveInvoice,
  usePayInvoice,
  useCancelInvoice,
  useBulkApproveInvoices,
  useBulkRejectInvoices,
  useBulkDeleteInvoices,
  INVOICE_STATUS_CONFIG,
  MATCH_STATUS_CONFIG,
  type InvoiceApiFilters,
} from '@/lib/api/invoices';

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
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

const isOverdue = (dueDate: string, status: InvoiceStatus) => {
  if (status === 'PAID' || status === 'CANCELLED') return false;
  return new Date(dueDate) < new Date();
};

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [matchStatusFilter, setMatchStatusFilter] = useState<MatchStatus | 'ALL'>('ALL');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  // Row selection state for bulk actions
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkRejectDialogOpen, setBulkRejectDialogOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const filters: InvoiceApiFilters = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter,
      match_status: matchStatusFilter,
    }),
    [search, statusFilter, matchStatusFilter]
  );

  const { data: invoices = [], isLoading } = useInvoices(filters);
  const deleteMutation = useDeleteInvoice();
  const submitMutation = useSubmitInvoice();
  const approveMutation = useApproveInvoice();
  const payMutation = usePayInvoice();
  const cancelMutation = useCancelInvoice();

  // Bulk action mutations
  const bulkApproveMutation = useBulkApproveInvoices();
  const bulkRejectMutation = useBulkRejectInvoices();
  const bulkDeleteMutation = useBulkDeleteInvoices();

  // Get selected IDs from row selection state
  const selectedIds = useMemo(() => Object.keys(rowSelection).filter(id => rowSelection[id]), [rowSelection]);
  const selectedCount = selectedIds.length;

  // Get selected invoices for status-aware actions
  const selectedInvoices = useMemo(() => {
    return invoices.filter(inv => selectedIds.includes(inv.id));
  }, [invoices, selectedIds]);

  // Check what actions are available for selection
  const approvableStatuses: InvoiceStatus[] = ['MATCHED', 'PARTIALLY_MATCHED', 'VALIDATED'];
  const canBulkApprove = selectedInvoices.some(inv => approvableStatuses.includes(inv.status));
  const canBulkReject = selectedInvoices.some(inv => inv.status === 'VALIDATED');
  const canBulkDelete = selectedInvoices.some(inv => inv.status === 'DRAFT');

  const handleDelete = async () => {
    if (!invoiceToDelete) return;
    try {
      await deleteMutation.mutateAsync(invoiceToDelete.id);
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    } catch (error) {
      console.error('Failed to delete invoice:', error);
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await submitMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to submit invoice:', error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to approve invoice:', error);
    }
  };

  const handlePay = async (id: string) => {
    try {
      await payMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to cancel invoice:', error);
    }
  };

  // Clear selection helper
  const clearSelection = () => setRowSelection({});

  // Handle bulk approve
  const handleBulkApprove = async () => {
    const approvableIds = selectedInvoices
      .filter(inv => approvableStatuses.includes(inv.status))
      .map(inv => inv.id);

    if (approvableIds.length === 0) {
      toast.error('No invoices can be approved. Select MATCHED, PARTIALLY_MATCHED, or VALIDATED invoices.');
      return;
    }

    const result = await bulkApproveMutation.mutateAsync(approvableIds);

    if (result.total_success > 0) {
      toast.success(`Successfully approved ${result.total_success} invoice(s)`);
    }
    if (result.total_failed > 0) {
      toast.error(`Failed to approve ${result.total_failed} invoice(s)`);
    }

    clearSelection();
    return result;
  };

  // Handle bulk reject - opens dialog for reason
  const handleBulkRejectClick = () => {
    const rejectableIds = selectedInvoices
      .filter(inv => inv.status === 'VALIDATED')
      .map(inv => inv.id);

    if (rejectableIds.length === 0) {
      toast.error('No invoices can be rejected. Select VALIDATED invoices.');
      return;
    }

    setBulkRejectDialogOpen(true);
  };

  const handleBulkRejectConfirm = async () => {
    const rejectableIds = selectedInvoices
      .filter(inv => inv.status === 'VALIDATED')
      .map(inv => inv.id);

    const result = await bulkRejectMutation.mutateAsync({
      ids: rejectableIds,
      reason: bulkRejectReason
    });

    if (result.total_success > 0) {
      toast.success(`Successfully rejected ${result.total_success} invoice(s)`);
    }
    if (result.total_failed > 0) {
      toast.error(`Failed to reject ${result.total_failed} invoice(s)`);
    }

    setBulkRejectDialogOpen(false);
    setBulkRejectReason('');
    clearSelection();
    return result;
  };

  // Handle bulk delete - opens confirmation dialog
  const handleBulkDeleteClick = () => {
    const deletableIds = selectedInvoices
      .filter(inv => inv.status === 'DRAFT')
      .map(inv => inv.id);

    if (deletableIds.length === 0) {
      toast.error('No invoices can be deleted. Select DRAFT invoices.');
      return;
    }

    setBulkDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    const deletableIds = selectedInvoices
      .filter(inv => inv.status === 'DRAFT')
      .map(inv => inv.id);

    const result = await bulkDeleteMutation.mutateAsync(deletableIds);

    if (result.total_success > 0) {
      toast.success(`Successfully deleted ${result.total_success} invoice(s)`);
    }
    if (result.total_failed > 0) {
      toast.error(`Failed to delete ${result.total_failed} invoice(s)`);
    }

    setBulkDeleteDialogOpen(false);
    clearSelection();
    return result;
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const all = invoices;
    const pending = all.filter(inv =>
      ['DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'MATCHED', 'PARTIALLY_MATCHED'].includes(inv.status)
    );
    const overdue = all.filter(inv => isOverdue(inv.due_date, inv.status));
    const totalAmount = pending.reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);
    const disputed = all.filter(inv => inv.status === 'DISPUTED').length;

    return {
      total: all.length,
      pending: pending.length,
      overdue: overdue.length,
      totalPending: totalAmount,
      disputed,
    };
  }, [invoices]);

  const columns: ColumnDef<Invoice>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: 'number',
      header: 'Invoice #',
      cell: ({ row }) => (
        <button
          onClick={() => navigate(`/invoices/${row.original.id}`)}
          className="font-medium text-sahel-blue hover:text-sahel-blue/80 hover:underline"
        >
          {row.getValue('number')}
        </button>
      ),
    },
    {
      accessorKey: 'supplier_invoice_number',
      header: 'Supplier Invoice #',
      cell: ({ row }) => (
        <span className="text-neutral-700">{row.getValue('supplier_invoice_number')}</span>
      ),
    },
    {
      accessorKey: 'supplier_name',
      header: 'Supplier',
      cell: ({ row }) => (
        <span className="text-neutral-700">{row.getValue('supplier_name')}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as InvoiceStatus;
        const config = INVOICE_STATUS_CONFIG[status] || { label: status || 'Unknown', color: 'text-neutral-700', bgColor: 'bg-neutral-100' };
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
          >
            {config.label}
          </span>
        );
      },
    },
    {
      accessorKey: 'match_status',
      header: 'Match',
      cell: ({ row }) => {
        const matchStatus = row.getValue('match_status') as MatchStatus;
        const config = MATCH_STATUS_CONFIG[matchStatus] || { label: matchStatus || 'Unknown', color: 'text-neutral-700', bgColor: 'bg-neutral-100' };
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
          >
            {config.label}
          </span>
        );
      },
    },
    {
      accessorKey: 'total_amount',
      header: 'Amount',
      cell: ({ row }) => (
        <span className="font-medium text-neutral-900">
          {formatCurrency(row.getValue('total_amount'), row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: 'due_date',
      header: 'Due Date',
      cell: ({ row }) => {
        const dueDate = row.getValue('due_date') as string;
        const overdue = isOverdue(dueDate, row.original.status);
        return (
          <span className={overdue ? 'text-red-600 font-medium' : 'text-neutral-600'}>
            {formatDate(dueDate)}
            {overdue && <Clock className="inline ml-1 h-3 w-3" />}
          </span>
        );
      },
    },
    {
      accessorKey: 'po_number',
      header: 'PO #',
      cell: ({ row }) => (
        <span className="text-neutral-600">{row.getValue('po_number') || '-'}</span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>

              {invoice.status === 'DRAFT' && (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleSubmit(invoice.id)}>
                    <Send className="mr-2 h-4 w-4 text-blue-600" />
                    Submit for Validation
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setInvoiceToDelete(invoice);
                      setDeleteDialogOpen(true);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}

              {['MATCHED', 'PARTIALLY_MATCHED', 'VALIDATED'].includes(invoice.status) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleApprove(invoice.id)}>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Approve
                  </DropdownMenuItem>
                </>
              )}

              {invoice.status === 'APPROVED' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handlePay(invoice.id)}>
                    <DollarSign className="mr-2 h-4 w-4 text-emerald-600" />
                    Mark as Paid
                  </DropdownMenuItem>
                </>
              )}

              {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleCancel(invoice.id)}
                    className="text-red-600"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    state: {
      sorting,
      rowSelection,
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Invoices</h1>
          <p className="text-neutral-500 mt-1">
            Manage supplier invoices and 3-way matching
          </p>
        </div>
        <Button onClick={() => navigate('/invoices/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500 flex items-center gap-1">
              Overdue
              <Clock className="h-3 w-3" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500 flex items-center gap-1">
              Disputed
              <AlertTriangle className="h-3 w-3" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.disputed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Pending Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sahel-green">
              {formatCurrency(stats.totalPending)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Search by invoice #, supplier, PO..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={value => setStatusFilter(value as InvoiceStatus | 'ALL')}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Invoice Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {Object.entries(INVOICE_STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={matchStatusFilter}
              onValueChange={value => setMatchStatusFilter(value as MatchStatus | 'ALL')}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Match Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Match Statuses</SelectItem>
                {Object.entries(MATCH_STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportButton
              data={invoices}
              filename={`invoices-${format(new Date(), 'yyyy-MM-dd')}`}
              columns={[
                { key: 'number', header: 'Invoice #' },
                { key: 'supplier_name', header: 'Supplier' },
                { key: 'po_number', header: 'PO #' },
                { key: 'status', header: 'Status' },
                { key: 'match_status', header: 'Match Status' },
                { key: 'total_amount', header: 'Amount', formatter: (v) => formatCurrency(v || 0) },
                { key: 'invoice_date', header: 'Invoice Date', formatter: (v) => v ? formatDate(String(v)) : '-' },
                { key: 'due_date', header: 'Due Date', formatter: (v) => v ? formatDate(String(v)) : '-' },
              ]}
              serverExportUrl="/invoices/export/"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sahel-green"></div>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-neutral-300" />
              <h3 className="mt-4 text-lg font-medium text-neutral-900">No invoices</h3>
              <p className="mt-2 text-neutral-500">
                {search || statusFilter !== 'ALL' || matchStatusFilter !== 'ALL'
                  ? 'No invoices match your filters.'
                  : 'Get started by creating a new invoice.'}
              </p>
              {!search && statusFilter === 'ALL' && matchStatusFilter === 'ALL' && (
                <Button onClick={() => navigate('/invoices/new')} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  New Invoice
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map(headerGroup => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map(row => (
                    <TableRow key={row.id} className="cursor-pointer hover:bg-neutral-50">
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice "{invoiceToDelete?.number}"? This action
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

      {/* Bulk Reject Dialog */}
      <Dialog open={bulkRejectDialogOpen} onOpenChange={setBulkRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Invoices</DialogTitle>
            <DialogDescription>
              You are about to reject {selectedInvoices.filter(inv => inv.status === 'VALIDATED').length} invoice(s).
              Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="bulk-reject-reason">Reason for Rejection</Label>
            <Textarea
              id="bulk-reject-reason"
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
              placeholder="Enter reason for rejecting these invoices..."
              className="mt-2"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkRejectDialogOpen(false);
                setBulkRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleBulkRejectConfirm}
              disabled={bulkRejectMutation.isPending || !bulkRejectReason.trim()}
            >
              {bulkRejectMutation.isPending ? 'Rejecting...' : 'Reject All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoices</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedInvoices.filter(inv => inv.status === 'DRAFT').length} draft invoice(s)?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleBulkDeleteConfirm}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        onApprove={canBulkApprove ? handleBulkApprove : undefined}
        onReject={canBulkReject ? handleBulkRejectClick : undefined}
        onDelete={canBulkDelete ? handleBulkDeleteClick : undefined}
        approveLabel="Approve"
        rejectLabel="Reject"
        deleteLabel="Delete"
      />
    </motion.div>
  );
}
