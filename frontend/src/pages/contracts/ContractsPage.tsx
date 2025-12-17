import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format as dateFnsFormat } from 'date-fns';
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
  RefreshCw,
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

import type { Contract, ContractStatus } from '@/types';
import {
  useContracts,
  useDeleteContract,
  useSubmitContract,
  useApproveContract,
  useCancelContract,
  CONTRACT_STATUS_CONFIG,
  CONTRACT_TYPE_CONFIG,
  type ContractApiFilters,
} from '@/lib/api/contracts';

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

const isExpiringSoon = (endDate: string, status: ContractStatus) => {
  if (status !== 'ACTIVE') return false;
  const today = new Date();
  const end = new Date(endDate);
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  return end <= thirtyDaysFromNow && end >= today;
};

const isExpired = (endDate: string, status: ContractStatus) => {
  if (status !== 'ACTIVE') return false;
  return new Date(endDate) < new Date();
};

export default function ContractsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<Contract['contract_type'] | 'ALL'>('ALL');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);

  const filters: ContractApiFilters = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter,
      contract_type: typeFilter,
    }),
    [search, statusFilter, typeFilter]
  );

  const { data: contracts = [], isLoading } = useContracts(filters);
  const deleteMutation = useDeleteContract();
  const submitMutation = useSubmitContract();
  const approveMutation = useApproveContract();
  const cancelMutation = useCancelContract();

  const handleDelete = async () => {
    if (!contractToDelete) return;
    try {
      await deleteMutation.mutateAsync(contractToDelete.id);
      setDeleteDialogOpen(false);
      setContractToDelete(null);
    } catch (error) {
      console.error('Failed to delete contract:', error);
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await submitMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to submit contract:', error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to approve contract:', error);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to cancel contract:', error);
    }
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const all = contracts;
    const active = all.filter(c => c.status === 'ACTIVE');
    const expiringSoon = all.filter(c => isExpiringSoon(c.end_date, c.status));
    const totalValue = active.reduce((sum, c) => sum + parseFloat(c.total_value), 0);
    const pendingApproval = all.filter(c => c.status === 'PENDING_APPROVAL').length;

    return {
      total: all.length,
      active: active.length,
      expiringSoon: expiringSoon.length,
      totalValue,
      pendingApproval,
    };
  }, [contracts]);

  const columns: ColumnDef<Contract>[] = [
    {
      accessorKey: 'number',
      header: 'Contract #',
      cell: ({ row }) => (
        <button
          onClick={() => navigate(`/contracts/${row.original.id}`)}
          className="font-medium text-sahel-blue hover:text-sahel-blue/80 hover:underline"
        >
          {row.getValue('number')}
        </button>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          <span className="text-neutral-900 truncate block">{row.getValue('title')}</span>
        </div>
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
      accessorKey: 'contract_type',
      header: 'Type',
      cell: ({ row }) => {
        const type = row.getValue('contract_type') as Contract['contract_type'];
        const config = CONTRACT_TYPE_CONFIG[type];
        return (
          <span className="text-neutral-600">{config.label}</span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as ContractStatus;
        const config = CONTRACT_STATUS_CONFIG[status];
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
      accessorKey: 'total_value',
      header: 'Value',
      cell: ({ row }) => (
        <span className="font-medium text-neutral-900">
          {formatCurrency(row.getValue('total_value'), row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: 'end_date',
      header: 'End Date',
      cell: ({ row }) => {
        const endDate = row.getValue('end_date') as string;
        const expiring = isExpiringSoon(endDate, row.original.status);
        const expired = isExpired(endDate, row.original.status);
        return (
          <span className={expired ? 'text-red-600 font-medium' : expiring ? 'text-amber-600 font-medium' : 'text-neutral-600'}>
            {formatDate(endDate)}
            {expiring && <AlertTriangle className="inline ml-1 h-3 w-3" />}
          </span>
        );
      },
    },
    {
      accessorKey: 'auto_renew',
      header: 'Auto-Renew',
      cell: ({ row }) => (
        <span className="text-neutral-600">
          {row.getValue('auto_renew') ? (
            <RefreshCw className="h-4 w-4 text-green-600" />
          ) : (
            '-'
          )}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const contract = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/contracts/${contract.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>

              {contract.status === 'DRAFT' && (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/contracts/${contract.id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleSubmit(contract.id)}>
                    <Send className="mr-2 h-4 w-4 text-blue-600" />
                    Submit for Approval
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setContractToDelete(contract);
                      setDeleteDialogOpen(true);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}

              {contract.status === 'PENDING_APPROVAL' && (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/contracts/${contract.id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleApprove(contract.id)}>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Approve
                  </DropdownMenuItem>
                </>
              )}

              {contract.status === 'ACTIVE' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`/contracts/${contract.id}?action=renew`)}>
                    <RefreshCw className="mr-2 h-4 w-4 text-blue-600" />
                    Renew
                  </DropdownMenuItem>
                </>
              )}

              {!['CANCELLED', 'TERMINATED', 'EXPIRED'].includes(contract.status) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleCancel(contract.id)}
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
    data: contracts,
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
          <h1 className="text-2xl font-semibold text-neutral-900">Contracts</h1>
          <p className="text-neutral-500 mt-1">
            Manage supplier contracts and agreements
          </p>
        </div>
        <Button onClick={() => navigate('/contracts/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Contract
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Total Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
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
            <CardTitle className="text-sm font-medium text-neutral-500 flex items-center gap-1">
              Expiring Soon
              <AlertTriangle className="h-3 w-3" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.expiringSoon}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Active Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sahel-green">
              {formatCurrency(stats.totalValue)}
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
                placeholder="Search by contract #, title, supplier..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={value => setStatusFilter(value as ContractStatus | 'ALL')}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {Object.entries(CONTRACT_STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={value => setTypeFilter(value as Contract['contract_type'] | 'ALL')}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {Object.entries(CONTRACT_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportButton
              data={contracts}
              filename={`contracts-${dateFnsFormat(new Date(), 'yyyy-MM-dd')}`}
              columns={[
                { key: 'number', header: 'Contract #' },
                { key: 'title', header: 'Title' },
                { key: 'supplier_name', header: 'Supplier' },
                { key: 'contract_type', header: 'Type' },
                { key: 'status', header: 'Status' },
                { key: 'total_value', header: 'Value', formatter: (v) => formatCurrency(v || 0) },
                { key: 'start_date', header: 'Start Date', formatter: (v) => v ? formatDate(String(v)) : '-' },
                { key: 'end_date', header: 'End Date', formatter: (v) => v ? formatDate(String(v)) : '-' },
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
          ) : contracts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-neutral-300" />
              <h3 className="mt-4 text-lg font-medium text-neutral-900">No contracts</h3>
              <p className="mt-2 text-neutral-500">
                {search || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                  ? 'No contracts match your filters.'
                  : 'Get started by creating a new contract.'}
              </p>
              {!search && statusFilter === 'ALL' && typeFilter === 'ALL' && (
                <Button onClick={() => navigate('/contracts/new')} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  New Contract
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
            <AlertDialogTitle>Delete Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete contract "{contractToDelete?.number}"? This action
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
