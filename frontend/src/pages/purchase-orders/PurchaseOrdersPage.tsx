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
  Package,
  Truck,
  ClipboardList,
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

import type { PurchaseOrder, POStatus } from '@/types';
import {
  usePurchaseOrders,
  useDeletePurchaseOrder,
  useSubmitPurchaseOrder,
  useApprovePurchaseOrder,
  useRejectPurchaseOrder,
  useSendPurchaseOrder,
  useCancelPurchaseOrder,
  useBulkApprovePurchaseOrders,
  useBulkRejectPurchaseOrders,
  useBulkDeletePurchaseOrders,
  PO_STATUS_CONFIG,
  type POFilters,
} from '@/lib/api/purchase-orders';

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
    month: 'short',
    day: 'numeric',
  });
};

const getDaysUntilDelivery = (deliveryDate: string | null) => {
  if (!deliveryDate) return null;
  const delivery = new Date(deliveryDate);
  const today = new Date();
  const diffTime = delivery.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<POStatus | 'ALL'>('ALL');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [poToDelete, setPOToDelete] = useState<PurchaseOrder | null>(null);

  // Row selection state for bulk actions
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkRejectDialogOpen, setBulkRejectDialogOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const filters: POFilters = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter,
    }),
    [search, statusFilter]
  );

  const { data: purchaseOrders = [], isLoading } = usePurchaseOrders(filters);
  const deleteMutation = useDeletePurchaseOrder();
  const submitMutation = useSubmitPurchaseOrder();
  const approveMutation = useApprovePurchaseOrder();
  const rejectMutation = useRejectPurchaseOrder();
  const sendMutation = useSendPurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();

  // Bulk action mutations
  const bulkApproveMutation = useBulkApprovePurchaseOrders();
  const bulkRejectMutation = useBulkRejectPurchaseOrders();
  const bulkDeleteMutation = useBulkDeletePurchaseOrders();

  // Get selected IDs from row selection state
  const selectedIds = useMemo(() => Object.keys(rowSelection).filter(id => rowSelection[id]), [rowSelection]);
  const selectedCount = selectedIds.length;

  // Get selected POs for status-aware actions
  const selectedPOs = useMemo(() => {
    return purchaseOrders.filter(po => selectedIds.includes(po.id));
  }, [purchaseOrders, selectedIds]);

  // Check what actions are available for selection
  const canBulkApprove = selectedPOs.some(po => po.status === 'PENDING_APPROVAL');
  const canBulkReject = selectedPOs.some(po => po.status === 'PENDING_APPROVAL');
  const canBulkDelete = selectedPOs.some(po => po.status === 'DRAFT');

  const handleDelete = async () => {
    if (!poToDelete) return;
    try {
      await deleteMutation.mutateAsync(poToDelete.id);
      setDeleteDialogOpen(false);
      setPOToDelete(null);
    } catch (error) {
      console.error('Failed to delete PO:', error);
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await submitMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to submit PO:', error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to approve PO:', error);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to reject PO:', error);
    }
  };

  const handleSend = async (id: string) => {
    try {
      await sendMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to send PO:', error);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to cancel PO:', error);
    }
  };

  // Clear selection helper
  const clearSelection = () => setRowSelection({});

  // Handle bulk approve
  const handleBulkApprove = async () => {
    const approvableIds = selectedPOs
      .filter(po => po.status === 'PENDING_APPROVAL')
      .map(po => po.id);

    if (approvableIds.length === 0) {
      toast.error('No POs can be approved. Select PENDING_APPROVAL POs.');
      return;
    }

    const result = await bulkApproveMutation.mutateAsync(approvableIds);

    if (result.total_success > 0) {
      toast.success(`Successfully approved ${result.total_success} purchase order(s)`);
    }
    if (result.total_failed > 0) {
      toast.error(`Failed to approve ${result.total_failed} purchase order(s)`);
    }

    clearSelection();
    return result;
  };

  // Handle bulk reject - opens dialog for reason
  const handleBulkRejectClick = () => {
    const rejectableIds = selectedPOs
      .filter(po => po.status === 'PENDING_APPROVAL')
      .map(po => po.id);

    if (rejectableIds.length === 0) {
      toast.error('No POs can be rejected. Select PENDING_APPROVAL POs.');
      return;
    }

    setBulkRejectDialogOpen(true);
  };

  const handleBulkRejectConfirm = async () => {
    const rejectableIds = selectedPOs
      .filter(po => po.status === 'PENDING_APPROVAL')
      .map(po => po.id);

    const result = await bulkRejectMutation.mutateAsync({
      ids: rejectableIds,
      reason: bulkRejectReason
    });

    if (result.total_success > 0) {
      toast.success(`Successfully rejected ${result.total_success} purchase order(s)`);
    }
    if (result.total_failed > 0) {
      toast.error(`Failed to reject ${result.total_failed} purchase order(s)`);
    }

    setBulkRejectDialogOpen(false);
    setBulkRejectReason('');
    clearSelection();
    return result;
  };

  // Handle bulk delete - opens confirmation dialog
  const handleBulkDeleteClick = () => {
    const deletableIds = selectedPOs
      .filter(po => po.status === 'DRAFT')
      .map(po => po.id);

    if (deletableIds.length === 0) {
      toast.error('No POs can be deleted. Select DRAFT POs.');
      return;
    }

    setBulkDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    const deletableIds = selectedPOs
      .filter(po => po.status === 'DRAFT')
      .map(po => po.id);

    const result = await bulkDeleteMutation.mutateAsync(deletableIds);

    if (result.total_success > 0) {
      toast.success(`Successfully deleted ${result.total_success} purchase order(s)`);
    }
    if (result.total_failed > 0) {
      toast.error(`Failed to delete ${result.total_failed} purchase order(s)`);
    }

    setBulkDeleteDialogOpen(false);
    clearSelection();
    return result;
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const all = purchaseOrders;
    return {
      total: all.length,
      draft: all.filter(po => po.status === 'DRAFT').length,
      pendingApproval: all.filter(po => po.status === 'PENDING_APPROVAL').length,
      approved: all.filter(po => po.status === 'APPROVED').length,
      sent: all.filter(po => po.status === 'SENT').length,
      totalValue: all.reduce((sum, po) => sum + parseFloat(po.total_amount), 0),
    };
  }, [purchaseOrders]);

  const columns: ColumnDef<PurchaseOrder>[] = [
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
      header: 'PO Number',
      cell: ({ row }) => (
        <button
          onClick={() => navigate(`/purchase-orders/${row.original.id}`)}
          className="font-medium text-sahel-blue hover:text-sahel-blue/80 hover:underline"
        >
          {row.getValue('number')}
        </button>
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
      id: 'source_requisition',
      header: 'Source Req',
      cell: ({ row }) => {
        const po = row.original;
        if (!po.requisition_number) {
          return <span className="text-neutral-400">-</span>;
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/requisitions/${po.requisition_id}`);
            }}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            {po.requisition_number}
          </button>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as POStatus;
        const config = PO_STATUS_CONFIG[status] || { label: status || 'Unknown', color: 'text-neutral-700', bgColor: 'bg-neutral-100' };
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
          {formatCurrency(row.getValue('total_amount'))}
        </span>
      ),
    },
    {
      accessorKey: 'order_date',
      header: 'Order Date',
      cell: ({ row }) => (
        <span className="text-neutral-600">{formatDate(row.getValue('order_date'))}</span>
      ),
    },
    {
      accessorKey: 'expected_delivery_date',
      header: 'Expected Delivery',
      cell: ({ row }) => {
        const deliveryDate = row.getValue('expected_delivery_date') as string | null;
        const daysUntil = getDaysUntilDelivery(deliveryDate);
        const status = row.original.status;

        if (!deliveryDate) {
          return <span className="text-neutral-400">-</span>;
        }

        // Only show indicator for active POs
        const showIndicator = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(status);

        return (
          <div className="flex items-center gap-2">
            <span className="text-neutral-600">{formatDate(deliveryDate)}</span>
            {showIndicator && daysUntil !== null && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  daysUntil < 0
                    ? 'bg-red-100 text-red-700'
                    : daysUntil <= 3
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {daysUntil < 0
                  ? `${Math.abs(daysUntil)}d overdue`
                  : daysUntil === 0
                  ? 'Today'
                  : `${daysUntil}d`}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const po = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>

              {po.status === 'DRAFT' && (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/purchase-orders/${po.id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleSubmit(po.id)}>
                    <Send className="mr-2 h-4 w-4" />
                    Submit for Approval
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setPOToDelete(po);
                      setDeleteDialogOpen(true);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}

              {po.status === 'PENDING_APPROVAL' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleApprove(po.id)}>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleReject(po.id)}>
                    <XCircle className="mr-2 h-4 w-4 text-red-600" />
                    Reject
                  </DropdownMenuItem>
                </>
              )}

              {po.status === 'APPROVED' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleSend(po.id)}>
                    <Truck className="mr-2 h-4 w-4" />
                    Send to Supplier
                  </DropdownMenuItem>
                </>
              )}

              {po.status === 'SENT' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                    <Package className="mr-2 h-4 w-4" />
                    Record Receipt
                  </DropdownMenuItem>
                </>
              )}

              {!['RECEIVED', 'CANCELLED'].includes(po.status) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleCancel(po.id)} className="text-red-600">
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
    data: purchaseOrders,
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
          <h1 className="text-2xl font-semibold text-neutral-900">Purchase Orders</h1>
          <p className="text-neutral-500 mt-1">
            Manage and track purchase orders to suppliers
          </p>
        </div>
        <Button onClick={() => navigate('/purchase-orders/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Purchase Order
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Total POs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-600">{stats.draft}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.pendingApproval}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sahel-green">
              {formatCurrency(stats.totalValue.toString())}
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
                placeholder="Search by PO number, supplier, or item..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={value => setStatusFilter(value as POStatus | 'ALL')}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {Object.entries(PO_STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportButton
              data={purchaseOrders}
              filename={`purchase-orders-${format(new Date(), 'yyyy-MM-dd')}`}
              columns={[
                { key: 'number', header: 'PO #' },
                { key: 'supplier_name', header: 'Supplier' },
                { key: 'status', header: 'Status' },
                { key: 'total_amount', header: 'Amount', formatter: (v) => formatCurrency(String(v || 0)) },
                { key: 'order_date', header: 'Order Date', formatter: (v) => v ? formatDate(String(v)) : '-' },
                { key: 'expected_delivery', header: 'Expected Delivery', formatter: (v) => v ? formatDate(String(v)) : '-' },
                { key: 'created_at', header: 'Created', formatter: (v) => v ? formatDate(String(v)) : '-' },
              ]}
              serverExportUrl="/purchase-orders/export/"
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
          ) : purchaseOrders.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-neutral-300" />
              <h3 className="mt-4 text-lg font-medium text-neutral-900">No purchase orders</h3>
              <p className="mt-2 text-neutral-500">
                {search || statusFilter !== 'ALL'
                  ? 'No purchase orders match your filters.'
                  : 'Get started by creating a new purchase order.'}
              </p>
              {!search && statusFilter === 'ALL' && (
                <Button onClick={() => navigate('/purchase-orders/new')} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Purchase Order
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
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete purchase order "{poToDelete?.number}"? This action
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
            <DialogTitle>Reject Purchase Orders</DialogTitle>
            <DialogDescription>
              You are about to reject {selectedPOs.filter(po => po.status === 'PENDING_APPROVAL').length} purchase order(s).
              Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="bulk-reject-reason">Reason for Rejection</Label>
            <Textarea
              id="bulk-reject-reason"
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
              placeholder="Enter reason for rejecting these purchase orders..."
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
            <DialogTitle>Delete Purchase Orders</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedPOs.filter(po => po.status === 'DRAFT').length} draft purchase order(s)?
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
