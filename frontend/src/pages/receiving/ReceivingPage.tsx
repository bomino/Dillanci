import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Package,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportButton } from '@/components/ui/export-button';
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

import type { GoodsReceipt, GoodsReceiptStatus } from '@/types';
import {
  useGoodsReceipts,
  useDeleteGoodsReceipt,
  useConfirmGoodsReceipt,
  useCancelGoodsReceipt,
  GR_STATUS_CONFIG,
  type ReceivingFilters,
} from '@/lib/api/receiving';

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function ReceivingPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GoodsReceiptStatus | 'ALL'>('ALL');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [grToDelete, setGRToDelete] = useState<GoodsReceipt | null>(null);

  const filters: ReceivingFilters = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter,
    }),
    [search, statusFilter]
  );

  const { data: goodsReceipts = [], isLoading } = useGoodsReceipts(filters);
  const deleteMutation = useDeleteGoodsReceipt();
  const confirmMutation = useConfirmGoodsReceipt();
  const cancelMutation = useCancelGoodsReceipt();

  const handleDelete = async () => {
    if (!grToDelete) return;
    try {
      await deleteMutation.mutateAsync(grToDelete.id);
      setDeleteDialogOpen(false);
      setGRToDelete(null);
    } catch (error) {
      console.error('Failed to delete GR:', error);
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await confirmMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to confirm GR:', error);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to cancel GR:', error);
    }
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const all = goodsReceipts;
    return {
      total: all.length,
      draft: all.filter(gr => gr.status === 'DRAFT').length,
      confirmed: all.filter(gr => gr.status === 'CONFIRMED').length,
      cancelled: all.filter(gr => gr.status === 'CANCELLED').length,
    };
  }, [goodsReceipts]);

  const columns: ColumnDef<GoodsReceipt>[] = [
    {
      accessorKey: 'number',
      header: 'GR Number',
      cell: ({ row }) => (
        <button
          onClick={() => navigate(`/receiving/${row.original.id}`)}
          className="font-medium text-sahel-blue hover:text-sahel-blue/80 hover:underline"
        >
          {row.getValue('number')}
        </button>
      ),
    },
    {
      accessorKey: 'po_number',
      header: 'PO Number',
      cell: ({ row }) => (
        <span className="text-neutral-700">{row.getValue('po_number')}</span>
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
        const status = row.getValue('status') as GoodsReceiptStatus;
        const config = GR_STATUS_CONFIG[status];
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
      accessorKey: 'receipt_date',
      header: 'Receipt Date',
      cell: ({ row }) => (
        <span className="text-neutral-600">{formatDate(row.getValue('receipt_date'))}</span>
      ),
    },
    {
      accessorKey: 'delivery_note_number',
      header: 'Delivery Note',
      cell: ({ row }) => (
        <span className="text-neutral-600">
          {row.getValue('delivery_note_number') || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'received_by_name',
      header: 'Received By',
      cell: ({ row }) => (
        <span className="text-neutral-600">{row.getValue('received_by_name')}</span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const gr = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/receiving/${gr.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>

              {gr.status === 'DRAFT' && (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/receiving/${gr.id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleConfirm(gr.id)}>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Confirm Receipt
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setGRToDelete(gr);
                      setDeleteDialogOpen(true);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}

              {gr.status === 'CONFIRMED' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleCancel(gr.id)}
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
    data: goodsReceipts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
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
          <h1 className="text-2xl font-semibold text-neutral-900">Goods Receipts</h1>
          <p className="text-neutral-500 mt-1">
            Record and manage deliveries from suppliers
          </p>
        </div>
        <Button onClick={() => navigate('/receiving/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Receipt
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Total Receipts</CardTitle>
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
            <CardTitle className="text-sm font-medium text-neutral-500">Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
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
                placeholder="Search by GR number, PO, supplier..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={value => setStatusFilter(value as GoodsReceiptStatus | 'ALL')}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {Object.entries(GR_STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportButton
              data={goodsReceipts}
              filename={`goods-receipts-${format(new Date(), 'yyyy-MM-dd')}`}
              columns={[
                { key: 'number', header: 'GR #' },
                { key: 'po_number', header: 'PO #' },
                { key: 'supplier_name', header: 'Supplier' },
                { key: 'status', header: 'Status' },
                { key: 'receipt_date', header: 'Receipt Date', formatter: (v) => v ? formatDate(String(v)) : '-' },
                { key: 'received_by_name', header: 'Received By' },
                { key: 'created_at', header: 'Created', formatter: (v) => v ? formatDate(String(v)) : '-' },
              ]}
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
          ) : goodsReceipts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-neutral-300" />
              <h3 className="mt-4 text-lg font-medium text-neutral-900">No goods receipts</h3>
              <p className="mt-2 text-neutral-500">
                {search || statusFilter !== 'ALL'
                  ? 'No goods receipts match your filters.'
                  : 'Get started by recording a new goods receipt.'}
              </p>
              {!search && statusFilter === 'ALL' && (
                <Button onClick={() => navigate('/receiving/new')} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  New Receipt
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
            <AlertDialogTitle>Delete Goods Receipt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete goods receipt "{grToDelete?.number}"? This action
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
    </motion.div>
  );
}
