import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import type { ColumnDef, Row } from '@tanstack/react-table';
import {
  Plus,
  FileText,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Send,
  Filter,
  Clock,
  ShoppingCart,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import {
  DataTable,
  DataTableColumnHeader,
  createSelectColumn,
  type RowSelectionState,
} from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportButton } from '@/components/ui/export-button';
import { BulkActionToolbar } from '@/components/ui/bulk-action-toolbar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

import {
  useRequisitions,
  useDeleteRequisition,
  useSubmitRequisition,
  useApproveRequisition,
  useCancelRequisition,
  useBulkApproveRequisitions,
  useBulkRejectRequisitions,
  useBulkDeleteRequisitions,
  requisitionPriorityConfig,
  departmentOptions,
} from '@/lib/api/requisitions';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Requisition, RequisitionStatus, RequisitionFilters } from '@/types';

export default function RequisitionsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<RequisitionFilters>({
    page: 1,
    page_size: 10,
  });
  const [searchValue, setSearchValue] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requisitionToDelete, setRequisitionToDelete] = useState<Requisition | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Row selection state for bulk actions
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkRejectDialogOpen, setBulkRejectDialogOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const { data, isLoading, isError } = useRequisitions(filters);
  const deleteMutation = useDeleteRequisition();
  const submitMutation = useSubmitRequisition();
  const approveMutation = useApproveRequisition();
  const cancelMutation = useCancelRequisition();

  // Bulk action mutations
  const bulkApproveMutation = useBulkApproveRequisitions();
  const bulkRejectMutation = useBulkRejectRequisitions();
  const bulkDeleteMutation = useBulkDeleteRequisitions();

  // Get selected IDs from row selection state
  const selectedIds = useMemo(() => Object.keys(rowSelection).filter(id => rowSelection[id]), [rowSelection]);
  const selectedCount = selectedIds.length;

  // Get selected requisitions for status-aware actions
  const selectedRequisitions = useMemo(() => {
    if (!data?.results) return [];
    return data.results.filter(r => selectedIds.includes(r.id));
  }, [data?.results, selectedIds]);

  // Check what actions are available for selection
  const canBulkApprove = selectedRequisitions.some(r => r.status === 'SUBMITTED');
  const canBulkReject = selectedRequisitions.some(r => r.status === 'SUBMITTED');
  const canBulkDelete = selectedRequisitions.some(r => r.status === 'DRAFT');

  // Handle search with debounce effect
  const handleSearch = (value: string) => {
    setSearchValue(value);
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: value || undefined, page: 1 }));
    }, 300);
    return () => clearTimeout(timeoutId);
  };

  // Handle status filter
  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: status === 'all' ? undefined : (status as RequisitionStatus),
      page: 1,
    }));
  };

  // Handle row click to view details
  const handleRowClick = (row: Row<Requisition>) => {
    navigate(`/requisitions/${row.original.id}`);
  };

  // Handle delete confirmation
  const handleDeleteClick = (requisition: Requisition) => {
    setRequisitionToDelete(requisition);
    setDeleteDialogOpen(true);
    setActionMenuOpen(null);
  };

  const handleDeleteConfirm = async () => {
    if (requisitionToDelete) {
      await deleteMutation.mutateAsync(requisitionToDelete.id);
      setDeleteDialogOpen(false);
      setRequisitionToDelete(null);
    }
  };

  // Handle submit action
  const handleSubmit = async (id: string) => {
    await submitMutation.mutateAsync(id);
    setActionMenuOpen(null);
  };

  // Handle approve action
  const handleApprove = async (id: string) => {
    await approveMutation.mutateAsync(id);
    setActionMenuOpen(null);
  };

  // Handle cancel action
  const handleCancel = async (id: string) => {
    await cancelMutation.mutateAsync(id);
    setActionMenuOpen(null);
  };

  // Clear selection helper
  const clearSelection = () => setRowSelection({});

  // Handle bulk approve
  const handleBulkApprove = async () => {
    const approvableIds = selectedRequisitions
      .filter(r => r.status === 'SUBMITTED')
      .map(r => r.id);

    if (approvableIds.length === 0) {
      toast.error('No requisitions can be approved. Select SUBMITTED requisitions.');
      return;
    }

    const result = await bulkApproveMutation.mutateAsync(approvableIds);

    if (result.total_success > 0) {
      toast.success(`Successfully approved ${result.total_success} requisition(s)`);
    }
    if (result.total_failed > 0) {
      toast.error(`Failed to approve ${result.total_failed} requisition(s)`);
    }

    clearSelection();
    return result;
  };

  // Handle bulk reject - opens dialog for reason
  const handleBulkRejectClick = () => {
    const rejectableIds = selectedRequisitions
      .filter(r => r.status === 'SUBMITTED')
      .map(r => r.id);

    if (rejectableIds.length === 0) {
      toast.error('No requisitions can be rejected. Select SUBMITTED requisitions.');
      return;
    }

    setBulkRejectDialogOpen(true);
  };

  const handleBulkRejectConfirm = async () => {
    const rejectableIds = selectedRequisitions
      .filter(r => r.status === 'SUBMITTED')
      .map(r => r.id);

    const result = await bulkRejectMutation.mutateAsync({
      ids: rejectableIds,
      reason: bulkRejectReason
    });

    if (result.total_success > 0) {
      toast.success(`Successfully rejected ${result.total_success} requisition(s)`);
    }
    if (result.total_failed > 0) {
      toast.error(`Failed to reject ${result.total_failed} requisition(s)`);
    }

    setBulkRejectDialogOpen(false);
    setBulkRejectReason('');
    clearSelection();
    return result;
  };

  // Handle bulk delete - opens confirmation dialog
  const handleBulkDeleteClick = () => {
    const deletableIds = selectedRequisitions
      .filter(r => r.status === 'DRAFT')
      .map(r => r.id);

    if (deletableIds.length === 0) {
      toast.error('No requisitions can be deleted. Select DRAFT requisitions.');
      return;
    }

    setBulkDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    const deletableIds = selectedRequisitions
      .filter(r => r.status === 'DRAFT')
      .map(r => r.id);

    const result = await bulkDeleteMutation.mutateAsync(deletableIds);

    if (result.total_success > 0) {
      toast.success(`Successfully deleted ${result.total_success} requisition(s)`);
    }
    if (result.total_failed > 0) {
      toast.error(`Failed to delete ${result.total_failed} requisition(s)`);
    }

    setBulkDeleteDialogOpen(false);
    clearSelection();
    return result;
  };

  // Get priority badge styling
  const getPriorityBadge = (priority: Requisition['priority'] | undefined | null) => {
    const defaultConfig = { label: 'Unknown', color: 'default' as const };
    if (!priority) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700">
          {defaultConfig.label}
        </span>
      );
    }
    const config = requisitionPriorityConfig[priority] || { label: priority, color: 'default' as const };
    const colorClasses = {
      default: 'bg-neutral-100 text-neutral-700',
      info: 'bg-blue-100 text-blue-700',
      warning: 'bg-amber-100 text-amber-700',
      error: 'bg-red-100 text-red-700',
      success: 'bg-emerald-100 text-emerald-700',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClasses[config.color] || colorClasses.default}`}>
        {config.label}
      </span>
    );
  };

  // Column definitions with selection column
  const columns: ColumnDef<Requisition>[] = [
    createSelectColumn<Requisition>(),
    {
      accessorKey: 'number',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Requisition #" />
      ),
      cell: ({ row }) => (
        <span className="font-medium text-primary-700">{row.original.number}</span>
      ),
    },
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <FileText className="h-4 w-4" />
          </div>
          <div className="max-w-[200px]">
            <div className="font-medium text-neutral-900 truncate">{row.original.title}</div>
            <div className="text-xs text-neutral-500">
              {departmentOptions.find(d => d.value === row.original.department)?.label || row.original.department}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'requester_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Requester" />
      ),
      cell: ({ row }) => (
        <span className="text-neutral-600">{row.original.requester_name}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'priority',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Priority" />
      ),
      cell: ({ row }) => getPriorityBadge(row.original.priority),
    },
    {
      accessorKey: 'total_amount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row }) => (
        <span className="font-medium text-neutral-900">
          {formatCurrency(parseFloat(row.original.total_amount), row.original.currency)}
        </span>
      ),
    },
    {
      id: 'po_count',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="POs" />
      ),
      cell: ({ row }) => {
        const poCount = row.original.purchase_orders?.length || 0;
        if (poCount === 0) {
          return <span className="text-neutral-400">-</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">{poCount}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'required_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Required By" />
      ),
      cell: ({ row }) => {
        if (!row.original.required_date) {
          return <span className="text-neutral-400">-</span>;
        }
        const requiredDate = new Date(row.original.required_date);
        const isOverdue = requiredDate < new Date() && !['APPROVED', 'CONVERTED', 'CANCELLED'].includes(row.original.status);
        return (
          <span className={isOverdue ? 'text-red-600 font-medium' : 'text-neutral-500'}>
            {formatDate(row.original.required_date)}
          </span>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => (
        <span className="text-neutral-500 text-sm">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setActionMenuOpen(actionMenuOpen === row.original.id ? null : row.original.id);
            }}
            className="h-8 w-8 p-0"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {actionMenuOpen === row.original.id && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setActionMenuOpen(null)}
              />
              <div
                className="fixed z-50 w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto"
                ref={(el) => {
                  if (el) {
                    // Get the button's position
                    const button = el.parentElement?.querySelector('button');
                    if (button) {
                      const buttonRect = button.getBoundingClientRect();
                      const viewportHeight = window.innerHeight;
                      const dropdownHeight = el.offsetHeight;

                      // Position to the left of button, aligned with button
                      el.style.right = `${window.innerWidth - buttonRect.right}px`;

                      // Check if dropdown would overflow below viewport
                      if (buttonRect.bottom + dropdownHeight + 8 > viewportHeight) {
                        // Position above the button
                        el.style.bottom = `${viewportHeight - buttonRect.top + 4}px`;
                        el.style.top = 'auto';
                      } else {
                        // Position below the button
                        el.style.top = `${buttonRect.bottom + 4}px`;
                        el.style.bottom = 'auto';
                      }
                    }
                  }
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/requisitions/${row.original.id}`);
                    setActionMenuOpen(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </button>
                {row.original.status === 'DRAFT' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/requisitions/${row.original.id}/edit`);
                        setActionMenuOpen(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubmit(row.original.id);
                      }}
                      disabled={submitMutation.isPending}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
                    >
                      <Send className="h-4 w-4" />
                      Submit for Approval
                    </button>
                  </>
                )}
                {row.original.status === 'SUBMITTED' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(row.original.id);
                      }}
                      disabled={approveMutation.isPending}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/requisitions/${row.original.id}?action=reject`);
                        setActionMenuOpen(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </>
                )}
                {['DRAFT', 'SUBMITTED'].includes(row.original.status) && (
                  <>
                    <div className="my-1 border-t border-neutral-100" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancel(row.original.id);
                      }}
                      disabled={cancelMutation.isPending}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
                    </button>
                  </>
                )}
                {row.original.status === 'DRAFT' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(row.original);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  // Calculate summary stats
  const stats = {
    total: data?.count || 0,
    draft: data?.results.filter(r => r.status === 'DRAFT').length || 0,
    submitted: data?.results.filter(r => r.status === 'SUBMITTED').length || 0,
    approved: data?.results.filter(r => r.status === 'APPROVED').length || 0,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Requisitions</h1>
          <p className="text-neutral-500 mt-1">
            Create and manage purchase requisitions
          </p>
        </div>
        <Button onClick={() => navigate('/requisitions/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Requisition
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total Requisitions</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {stats.total}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Draft</p>
                <p className="text-2xl font-semibold text-neutral-600">
                  {stats.draft}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                <Pencil className="h-5 w-5 text-neutral-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Pending Approval</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {stats.submitted}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Approved</p>
                <p className="text-2xl font-semibold text-emerald-600">
                  {stats.approved}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requisitions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Requisitions</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="Search requisitions..."
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <Select
              value={filters.status || 'all'}
              onValueChange={handleStatusFilter}
            >
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2 text-neutral-400" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="CONVERTED">Converted</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <ExportButton
              data={data?.results || []}
              filename={`requisitions-${format(new Date(), 'yyyy-MM-dd')}`}
              columns={[
                { key: 'number', header: 'Requisition #' },
                { key: 'title', header: 'Title' },
                { key: 'requester_name', header: 'Requester' },
                { key: 'department', header: 'Department' },
                { key: 'status', header: 'Status' },
                { key: 'priority', header: 'Priority' },
                { key: 'total_amount', header: 'Amount', formatter: (v) => formatCurrency(parseFloat(String(v || 0)), 'USD') },
                { key: 'required_date', header: 'Required By', formatter: (v) => v ? formatDate(String(v)) : '-' },
                { key: 'created_at', header: 'Created', formatter: (v) => v ? formatDate(String(v)) : '-' },
              ]}
              serverExportUrl="/requisitions/export/"
            />
          </div>

          {/* Error State */}
          {isError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
              <p className="text-sm text-red-600">
                Failed to load requisitions. Please try again later.
              </p>
            </div>
          )}

          {/* Data Table */}
          <DataTable
            columns={columns}
            data={data?.results || []}
            loading={isLoading}
            showToolbar={false}
            showPagination={true}
            onRowClick={handleRowClick}
            getRowId={(row) => row.id}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            enableRowSelection={true}
            emptyState={{
              title: 'No requisitions found',
              description: filters.search || filters.status
                ? 'Try adjusting your search or filters.'
                : 'Get started by creating your first requisition.',
              action: !filters.search && !filters.status ? (
                <Button onClick={() => navigate('/requisitions/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Requisition
                </Button>
              ) : undefined,
            }}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Requisition</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete requisition{' '}
              <span className="font-medium text-neutral-900">
                {requisitionToDelete?.number}
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
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reject Dialog */}
      <Dialog open={bulkRejectDialogOpen} onOpenChange={setBulkRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Requisitions</DialogTitle>
            <DialogDescription>
              You are about to reject {selectedRequisitions.filter(r => r.status === 'SUBMITTED').length} requisition(s).
              Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="bulk-reject-reason">Reason for Rejection</Label>
            <Textarea
              id="bulk-reject-reason"
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
              placeholder="Enter reason for rejecting these requisitions..."
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
            <DialogTitle>Delete Requisitions</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedRequisitions.filter(r => r.status === 'DRAFT').length} draft requisition(s)?
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
