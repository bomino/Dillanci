import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Shield,
  Plus,
  Users,
  Lock,
  Building2,
  Sparkles,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useRoles,
  useRoleStats,
  useDeleteRole,
  useRolePresets,
  useCreateRoleFromPreset,
} from '@/lib/api/admin';
import type { Role } from '@/lib/api/admin';
import { cn } from '@/lib/utils';
import CreateRoleDialog from './CreateRoleDialog';

const roleTypeConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  SYSTEM: { label: 'System', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: <Lock className="h-3 w-3" /> },
  ORGANIZATION: { label: 'Organization', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: <Building2 className="h-3 w-3" /> },
  CUSTOM: { label: 'Custom', color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: <Sparkles className="h-3 w-3" /> },
};

export default function RolesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const params: Record<string, string> = {};
  if (typeFilter && typeFilter !== 'all') params.role_type = typeFilter;
  if (search) params.search = search;

  const { data: rolesData, isLoading } = useRoles(params);
  const { data: stats, isLoading: statsLoading } = useRoleStats();
  const { data: presets } = useRolePresets();

  const deleteMutation = useDeleteRole();
  const createFromPresetMutation = useCreateRoleFromPreset();

  const handleDelete = async () => {
    if (!selectedRole) return;
    try {
      await deleteMutation.mutateAsync(selectedRole.id);
      setDeleteDialogOpen(false);
      setSelectedRole(null);
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  };

  const handleCreateFromPreset = async (presetName: string) => {
    try {
      await createFromPresetMutation.mutateAsync({ presetName });
      setPresetDialogOpen(false);
    } catch (error) {
      console.error('Failed to create role from preset:', error);
    }
  };

  const columns: ColumnDef<Role>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-medium text-neutral-900">{row.original.name}</div>
            <div className="text-sm text-neutral-500 font-mono">{row.original.code}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'role_type',
      header: 'Type',
      cell: ({ row }) => {
        const config = roleTypeConfig[row.original.role_type] || roleTypeConfig.CUSTOM;
        return (
          <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium', config.bgColor, config.color)}>
            {config.icon}
            {config.label}
          </span>
        );
      },
    },
    {
      accessorKey: 'user_count',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Users" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-neutral-400" />
          <span className="text-neutral-600">{row.original.user_count}</span>
        </div>
      ),
    },
    {
      accessorKey: 'permission_count',
      header: 'Permissions',
      cell: ({ row }) => (
        <span className="text-neutral-600">{row.original.permission_count} permissions</span>
      ),
    },
    {
      accessorKey: 'approval_limit',
      header: 'Approval Limit',
      cell: ({ row }) => {
        const limit = row.original.approval_limit;
        if (!limit) return <span className="text-neutral-400">-</span>;
        return (
          <span className="text-neutral-600">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: row.original.currency || 'USD',
            }).format(parseFloat(limit))}
          </span>
        );
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.is_active ? 'active' : 'draft'} />
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const role = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/admin/roles/${role.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              {!role.is_system_role && (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/admin/roles/${role.id}/edit`)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Role
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedRole(role);
                      setDeleteDialogOpen(true);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Role
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Role Management</h1>
            <p className="text-neutral-500">Configure roles and permissions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPresetDialogOpen(true)}>
            <Copy className="mr-2 h-4 w-4" />
            From Preset
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Role
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">System Roles</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold text-purple-600">{stats?.system_roles || 0}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-50 flex items-center justify-center">
                <Lock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Org Roles</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold text-blue-600">{stats?.organization_roles || 0}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Custom Roles</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold text-emerald-600">{stats?.custom_roles || 0}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total Assignments</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold text-neutral-900">{stats?.total_assignments || 0}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-neutral-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-neutral-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="SYSTEM">System</SelectItem>
                <SelectItem value="ORGANIZATION">Organization</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <DataTable
            columns={columns}
            data={rolesData?.results || []}
            loading={isLoading}
            onRowClick={(row) => navigate(`/admin/roles/${row.original.id}`)}
            emptyState={{
              title: 'No roles found',
              description: search || typeFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first custom role',
              action: (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Role
                </Button>
              ),
            }}
          />
        </CardContent>
      </Card>

      {/* Create Role Dialog */}
      <CreateRoleDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      {/* Create from Preset Dialog */}
      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Role from Preset</DialogTitle>
            <DialogDescription>
              Choose a pre-configured role template to quickly set up common permissions
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {presets?.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handleCreateFromPreset(preset.name)}
                  disabled={createFromPresetMutation.isPending}
                  className="w-full text-left p-4 rounded-lg border hover:bg-neutral-50 transition-colors"
                >
                  <div className="font-medium">{preset.name}</div>
                  <p className="text-sm text-neutral-500 mt-1">{preset.description}</p>
                  <p className="text-xs text-neutral-400 mt-2">
                    {preset.permissions.length} permissions
                  </p>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPresetDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the <strong>{selectedRole?.name}</strong> role?
              This action cannot be undone.
              {selectedRole?.user_count && selectedRole.user_count > 0 && (
                <span className="block mt-2 text-amber-600">
                  Warning: This role has {selectedRole.user_count} user(s) assigned to it.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
