import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { ColumnDef, Row } from '@tanstack/react-table';
import {
  Plus,
  FileQuestion,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Send,
  Filter,
  Clock,
  Award,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import {
  DataTable,
  DataTableColumnHeader,
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

import {
  useRFQs,
  useDeleteRFQ,
  usePublishRFQ,
  useCloseRFQ,
  useCancelRFQ,
} from '@/lib/api/rfqs';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { RFQ, RFQStatus, RFQFilters } from '@/types';

export default function RFQsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<RFQFilters>({
    page: 1,
    page_size: 10,
  });
  const [searchValue, setSearchValue] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rfqToDelete, setRfqToDelete] = useState<RFQ | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const { data, isLoading, isError } = useRFQs(filters);
  const deleteMutation = useDeleteRFQ();
  const publishMutation = usePublishRFQ();
  const closeMutation = useCloseRFQ();
  const cancelMutation = useCancelRFQ();

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
      status: status === 'all' ? undefined : (status as RFQStatus),
      page: 1,
    }));
  };

  // Handle row click to view details
  const handleRowClick = (row: Row<RFQ>) => {
    navigate(`/rfqs/${row.original.id}`);
  };

  // Handle delete confirmation
  const handleDeleteClick = (rfq: RFQ) => {
    setRfqToDelete(rfq);
    setDeleteDialogOpen(true);
    setActionMenuOpen(null);
  };

  const handleDeleteConfirm = async () => {
    if (rfqToDelete) {
      await deleteMutation.mutateAsync(rfqToDelete.id);
      setDeleteDialogOpen(false);
      setRfqToDelete(null);
    }
  };

  // Handle publish action
  const handlePublish = async (id: string) => {
    await publishMutation.mutateAsync(id);
    setActionMenuOpen(null);
  };

  // Handle close action
  const handleClose = async (id: string) => {
    await closeMutation.mutateAsync(id);
    setActionMenuOpen(null);
  };

  // Handle cancel action
  const handleCancel = async (id: string) => {
    await cancelMutation.mutateAsync(id);
    setActionMenuOpen(null);
  };

  // Get days remaining until close date
  const getDaysRemaining = (closeDate: string | null) => {
    if (!closeDate) return null;
    const close = new Date(closeDate);
    const today = new Date();
    const diffTime = close.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Column definitions
  const columns: ColumnDef<RFQ>[] = [
    {
      accessorKey: 'number',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="RFQ #" />
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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <FileQuestion className="h-4 w-4" />
          </div>
          <div className="max-w-[250px]">
            <div className="font-medium text-neutral-900 truncate">{row.original.title}</div>
            <div className="text-xs text-neutral-500 truncate">
              {row.original.lines?.length || 0} line items
            </div>
          </div>
        </div>
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
      accessorKey: 'total_amount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Est. Value" />
      ),
      cell: ({ row }) => (
        <span className="font-medium text-neutral-900">
          {row.original.total_amount
            ? formatCurrency(parseFloat(row.original.total_amount))
            : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'close_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Close Date" />
      ),
      cell: ({ row }) => {
        if (!row.original.close_date) {
          return <span className="text-neutral-400">-</span>;
        }
        const daysRemaining = getDaysRemaining(row.original.close_date);
        const isOverdue = daysRemaining !== null && daysRemaining < 0;
        const isUrgent = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 3;

        return (
          <div>
            <span className={isOverdue ? 'text-red-600 font-medium' : 'text-neutral-700'}>
              {formatDate(row.original.close_date)}
            </span>
            {row.original.status === 'OPEN' && daysRemaining !== null && (
              <div className={`text-xs ${isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-600' : 'text-neutral-400'}`}>
                {isOverdue ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days left`}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'open_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Opened" />
      ),
      cell: ({ row }) => (
        <span className="text-neutral-500 text-sm">
          {row.original.open_date ? formatDate(row.original.open_date) : '-'}
        </span>
      ),
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
              <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/rfqs/${row.original.id}`);
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
                        navigate(`/rfqs/${row.original.id}/edit`);
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
                        handlePublish(row.original.id);
                      }}
                      disabled={publishMutation.isPending}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
                    >
                      <Send className="h-4 w-4" />
                      Publish RFQ
                    </button>
                  </>
                )}
                {row.original.status === 'OPEN' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClose(row.original.id);
                      }}
                      disabled={closeMutation.isPending}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"
                    >
                      <Clock className="h-4 w-4" />
                      Close RFQ
                    </button>
                  </>
                )}
                {row.original.status === 'CLOSED' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/rfqs/${row.original.id}?action=award`);
                        setActionMenuOpen(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
                    >
                      <Award className="h-4 w-4" />
                      Award RFQ
                    </button>
                  </>
                )}
                {['DRAFT', 'OPEN'].includes(row.original.status) && (
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
    open: data?.results.filter(r => r.status === 'OPEN').length || 0,
    awarded: data?.results.filter(r => r.status === 'AWARDED').length || 0,
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
          <h1 className="text-2xl font-semibold text-neutral-900">Requests for Quotation</h1>
          <p className="text-neutral-500 mt-1">
            Create and manage RFQs to get competitive quotes from suppliers
          </p>
        </div>
        <Button onClick={() => navigate('/rfqs/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New RFQ
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total RFQs</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {stats.total}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileQuestion className="h-5 w-5 text-blue-700" />
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
                <p className="text-sm text-neutral-500">Open</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {stats.open}
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
                <p className="text-sm text-neutral-500">Awarded</p>
                <p className="text-2xl font-semibold text-emerald-600">
                  {stats.awarded}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RFQs Table */}
      <Card>
        <CardHeader>
          <CardTitle>All RFQs</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="Search RFQs..."
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
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="AWARDED">Awarded</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error State */}
          {isError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
              <p className="text-sm text-red-600">
                Failed to load RFQs. Please try again later.
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
            emptyState={{
              title: 'No RFQs found',
              description: filters.search || filters.status
                ? 'Try adjusting your search or filters.'
                : 'Get started by creating your first Request for Quotation.',
              action: !filters.search && !filters.status ? (
                <Button onClick={() => navigate('/rfqs/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  New RFQ
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
            <DialogTitle>Delete RFQ</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete RFQ{' '}
              <span className="font-medium text-neutral-900">
                {rfqToDelete?.number}
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
    </motion.div>
  );
}
