import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  Clock,
  AlertTriangle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  useRFPs,
  useDeleteRFP,
  usePublishRFP,
  useCancelRFP,
  RFP_STATUS_CONFIG,
  RFP_CATEGORY_CONFIG,
} from '@/lib/api/rfps';
import type { RFP, RFPStatus, RFPCategory } from '@/types';

export default function RFPsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RFPStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<RFPCategory | 'all'>('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rfpToDelete, setRfpToDelete] = useState<RFP | null>(null);

  const { data, isLoading } = useRFPs({
    status: statusFilter === 'all' ? undefined : statusFilter,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    search: search || undefined,
  });

  const deleteMutation = useDeleteRFP();
  const publishMutation = usePublishRFP();
  const cancelMutation = useCancelRFP();

  const rfps = data?.results || [];

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = rfps.length;
    const published = rfps.filter(r => r.status === 'PUBLISHED').length;
    const underEvaluation = rfps.filter(r => r.status === 'UNDER_EVALUATION').length;
    const shortlisted = rfps.filter(r => r.status === 'SHORTLISTED').length;
    const closingSoon = rfps.filter(r => {
      if (!r.submission_deadline) return false;
      const deadline = new Date(r.submission_deadline);
      const today = new Date();
      const daysUntilDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDeadline <= 7 && daysUntilDeadline > 0 && r.status === 'PUBLISHED';
    }).length;
    return { total, published, underEvaluation, shortlisted, closingSoon };
  }, [rfps]);

  const handleDelete = (rfp: RFP) => {
    setRfpToDelete(rfp);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (rfpToDelete) {
      await deleteMutation.mutateAsync(rfpToDelete.id);
      setDeleteDialogOpen(false);
      setRfpToDelete(null);
    }
  };

  const handlePublish = async (rfp: RFP) => {
    await publishMutation.mutateAsync(rfp.id);
  };

  const handleCancel = async (rfp: RFP) => {
    await cancelMutation.mutateAsync(rfp.id);
  };

  const formatCurrency = (value: string | null, currency: string) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDeadlineStatus = (deadline: string | null, status: RFPStatus) => {
    if (!deadline || status !== 'PUBLISHED') return null;
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const daysUntil = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return { type: 'overdue', text: 'Deadline passed' };
    if (daysUntil <= 3) return { type: 'urgent', text: `${daysUntil} days left` };
    if (daysUntil <= 7) return { type: 'warning', text: `${daysUntil} days left` };
    return null;
  };

  const columns: ColumnDef<RFP>[] = [
    {
      accessorKey: 'number',
      header: 'RFP Number',
      cell: ({ row }) => (
        <span className="font-medium text-neutral-900">{row.original.number}</span>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div className="max-w-[300px]">
          <p className="font-medium text-neutral-900 truncate">{row.original.title}</p>
          <p className="text-sm text-neutral-500 truncate">{row.original.description}</p>
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => {
        const config = RFP_CATEGORY_CONFIG[row.original.category];
        return (
          <span className="text-sm text-neutral-700">{config?.label || row.original.category}</span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const config = RFP_STATUS_CONFIG[row.original.status];
        const colorClasses = {
          default: 'bg-neutral-100 text-neutral-700',
          info: 'bg-blue-100 text-blue-700',
          warning: 'bg-amber-100 text-amber-700',
          success: 'bg-green-100 text-green-700',
          error: 'bg-red-100 text-red-700',
        };
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses[config?.color || 'default']}`}>
            {config?.label || row.original.status}
          </span>
        );
      },
    },
    {
      accessorKey: 'budget_max',
      header: 'Budget Range',
      cell: ({ row }) => {
        const { budget_min, budget_max, currency } = row.original;
        if (!budget_min && !budget_max) return <span className="text-neutral-500">-</span>;
        return (
          <span className="text-sm">
            {formatCurrency(budget_min, currency)} - {formatCurrency(budget_max, currency)}
          </span>
        );
      },
    },
    {
      accessorKey: 'submission_deadline',
      header: 'Deadline',
      cell: ({ row }) => {
        const deadlineStatus = getDeadlineStatus(row.original.submission_deadline, row.original.status);
        return (
          <div>
            <span className="text-sm">{formatDate(row.original.submission_deadline)}</span>
            {deadlineStatus && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${
                deadlineStatus.type === 'overdue' ? 'text-red-600' :
                deadlineStatus.type === 'urgent' ? 'text-red-600' :
                'text-amber-600'
              }`}>
                <AlertTriangle className="h-3 w-3" />
                {deadlineStatus.text}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const rfp = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/rfps/${rfp.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              {rfp.status === 'DRAFT' && (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/rfps/${rfp.id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handlePublish(rfp)}>
                    <Send className="mr-2 h-4 w-4" />
                    Publish
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(rfp)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
              {rfp.status === 'PUBLISHED' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleCancel(rfp)}
                    className="text-red-600"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel RFP
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
    data: rfps,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
            <FileText className="h-6 w-6 text-purple-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Requests for Proposal
            </h1>
            <p className="text-neutral-500">
              Manage RFPs for complex procurement needs
            </p>
          </div>
        </div>
        <Button onClick={() => navigate('/rfps/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          Create RFP
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total RFPs</p>
                <p className="text-2xl font-semibold text-neutral-900">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-neutral-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Published</p>
                <p className="text-2xl font-semibold text-blue-600">{stats.published}</p>
              </div>
              <Send className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Under Evaluation</p>
                <p className="text-2xl font-semibold text-amber-600">{stats.underEvaluation}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Shortlisted</p>
                <p className="text-2xl font-semibold text-purple-600">{stats.shortlisted}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Closing Soon</p>
                <p className="text-2xl font-semibold text-red-600">{stats.closingSoon}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>RFP List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <Input
                placeholder="Search RFPs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as RFPStatus | 'all')}
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(RFP_STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value as RFPCategory | 'all')}
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(RFP_CATEGORY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-neutral-50"
                      onClick={() => navigate(`/rfps/${row.original.id}`)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          onClick={(e) => {
                            if (cell.column.id === 'actions') {
                              e.stopPropagation();
                            }
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-8 w-8 text-neutral-400" />
                        <p className="text-neutral-500">No RFPs found</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/rfps/new')}
                        >
                          Create your first RFP
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete RFP</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete RFP "{rfpToDelete?.number}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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
