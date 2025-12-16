import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { ColumnDef, Row } from '@tanstack/react-table';
import {
  Plus,
  Building2,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  Globe,
  Filter,
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

import { useSuppliers, useDeleteSupplier, supplierTypeConfig } from '@/lib/api/suppliers';
import { formatDate } from '@/lib/utils';
import type { Supplier, SupplierStatus, SupplierFilters } from '@/types';

export default function SuppliersPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<SupplierFilters>({
    page: 1,
    page_size: 10,
  });
  const [searchValue, setSearchValue] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const { data, isLoading, isError } = useSuppliers(filters);
  const deleteMutation = useDeleteSupplier();

  // Handle search with debounce effect
  const handleSearch = (value: string) => {
    setSearchValue(value);
    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: value || undefined, page: 1 }));
    }, 300);
    return () => clearTimeout(timeoutId);
  };

  // Handle status filter
  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: status === 'all' ? undefined : (status as SupplierStatus),
      page: 1,
    }));
  };

  // Handle row click to view details
  const handleRowClick = (row: Row<Supplier>) => {
    navigate(`/suppliers/${row.original.id}`);
  };

  // Handle delete confirmation
  const handleDeleteClick = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
    setActionMenuOpen(null);
  };

  const handleDeleteConfirm = async () => {
    if (supplierToDelete) {
      await deleteMutation.mutateAsync(supplierToDelete.id);
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    }
  };

  // Column definitions
  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: 'number',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Supplier #" />
      ),
      cell: ({ row }) => (
        <span className="font-medium text-primary-700">{row.original.number}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-neutral-900">{row.original.name}</div>
            {row.original.legal_name && row.original.legal_name !== row.original.name && (
              <div className="text-xs text-neutral-500">{row.original.legal_name}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'supplier_type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => (
        <span className="text-neutral-600">
          {supplierTypeConfig[row.original.supplier_type]?.label || row.original.supplier_type}
        </span>
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
      accessorKey: 'city',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Location" />
      ),
      cell: ({ row }) => {
        const { city, state, country } = row.original;
        if (!city && !state) return <span className="text-neutral-400">-</span>;
        return (
          <span className="text-neutral-600">
            {[city, state].filter(Boolean).join(', ')}
            {country && country !== 'USA' && `, ${country}`}
          </span>
        );
      },
    },
    {
      id: 'contact',
      header: 'Contact',
      cell: ({ row }) => {
        const { email, phone, website } = row.original;
        return (
          <div className="flex items-center gap-2">
            {email && (
              <a
                href={`mailto:${email}`}
                onClick={(e) => e.stopPropagation()}
                className="text-neutral-400 hover:text-primary-600 transition-colors"
                title={email}
              >
                <Mail className="h-4 w-4" />
              </a>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                onClick={(e) => e.stopPropagation()}
                className="text-neutral-400 hover:text-primary-600 transition-colors"
                title={phone}
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-neutral-400 hover:text-primary-600 transition-colors"
                title={website}
              >
                <Globe className="h-4 w-4" />
              </a>
            )}
            {!email && !phone && !website && (
              <span className="text-neutral-400">-</span>
            )}
          </div>
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
              <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/suppliers/${row.original.id}`);
                    setActionMenuOpen(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/suppliers/${row.original.id}/edit`);
                    setActionMenuOpen(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Supplier
                </button>
                {row.original.status === 'PENDING_REVIEW' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Implement approve action
                      setActionMenuOpen(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </button>
                )}
                {row.original.status === 'APPROVED' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Implement suspend action
                      setActionMenuOpen(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-orange-700 hover:bg-orange-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Suspend
                  </button>
                )}
                <div className="my-1 border-t border-neutral-100" />
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
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

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
          <h1 className="text-2xl font-semibold text-neutral-900">Suppliers</h1>
          <p className="text-neutral-500 mt-1">
            Manage your supplier database and relationships
          </p>
        </div>
        <Button onClick={() => navigate('/suppliers/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total Suppliers</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {data?.count || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary-700" />
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
                  {data?.results.filter(s => s.status === 'APPROVED').length || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Pending Review</p>
                <p className="text-2xl font-semibold text-amber-600">
                  {data?.results.filter(s => s.status === 'PENDING_REVIEW').length || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Suspended</p>
                <p className="text-2xl font-semibold text-orange-600">
                  {data?.results.filter(s => s.status === 'SUSPENDED').length || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Suppliers</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="Search suppliers..."
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
                <SelectItem value="PROSPECT">Prospect</SelectItem>
                <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error State */}
          {isError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
              <p className="text-sm text-red-600">
                Failed to load suppliers. Please try again later.
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
              title: 'No suppliers found',
              description: filters.search || filters.status
                ? 'Try adjusting your search or filters.'
                : 'Get started by adding your first supplier.',
              action: !filters.search && !filters.status ? (
                <Button onClick={() => navigate('/suppliers/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Supplier
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
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-neutral-900">
                {supplierToDelete?.name}
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
              variant="destructive"
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
