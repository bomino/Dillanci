import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { ColumnDef } from '@tanstack/react-table';
import {
  UserCog,
  Plus,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Shield,
  UserMinus,
  UserPlus,
  Mail,
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
  useUsers,
  useUserStats,
  useActivateUser,
  useDeactivateUser,
  useSuspendUser,
} from '@/lib/api/admin';
import type { UserWithRoles } from '@/lib/api/admin';
import InviteUserDialog from './InviteUserDialog';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function UsersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [pendingAction, setPendingAction] = useState<'activate' | 'deactivate' | 'suspend' | null>(null);

  const params: Record<string, string> = {};
  if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
  if (search) params.search = search;

  const { data: usersData, isLoading } = useUsers(params);
  const { data: stats, isLoading: statsLoading } = useUserStats();

  const activateMutation = useActivateUser();
  const deactivateMutation = useDeactivateUser();
  const suspendMutation = useSuspendUser();

  const handleAction = async () => {
    if (!selectedUser || !pendingAction) return;

    try {
      switch (pendingAction) {
        case 'activate':
          await activateMutation.mutateAsync(selectedUser.id);
          break;
        case 'deactivate':
          await deactivateMutation.mutateAsync(selectedUser.id);
          break;
        case 'suspend':
          await suspendMutation.mutateAsync(selectedUser.id);
          break;
      }
    } finally {
      setActionDialogOpen(false);
      setSelectedUser(null);
      setPendingAction(null);
    }
  };

  const openActionDialog = (user: UserWithRoles, action: 'activate' | 'deactivate' | 'suspend') => {
    setSelectedUser(user);
    setPendingAction(action);
    setActionDialogOpen(true);
  };

  const columns: ColumnDef<UserWithRoles>[] = [
    {
      accessorKey: 'full_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium">
            {row.original.first_name?.[0]?.toUpperCase() || '?'}
            {row.original.last_name?.[0]?.toUpperCase() || ''}
          </div>
          <div>
            <div className="font-medium text-neutral-900">{row.original.full_name}</div>
            <div className="text-sm text-neutral-500">{row.original.email}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'roles',
      header: 'Roles',
      cell: ({ row }) => {
        const roles = row.original.roles || [];
        if (roles.length === 0) {
          return <span className="text-neutral-400 text-sm">No roles</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {roles.slice(0, 2).map((role) => (
              <span
                key={role.id}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium"
              >
                <Shield className="h-3 w-3 mr-1" />
                {role.role_name}
              </span>
            ))}
            {roles.length > 2 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-xs">
                +{roles.length - 2} more
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        return <StatusBadge status={row.original.status?.toLowerCase() || 'inactive'} />;
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => (
        <span className="text-neutral-600 text-sm">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/admin/users/${user.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/admin/users/${user.id}?tab=roles`)}>
                <Shield className="mr-2 h-4 w-4" />
                Manage Roles
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {user.status !== 'ACTIVE' && (
                <DropdownMenuItem
                  onClick={() => openActionDialog(user, 'activate')}
                  className="text-emerald-600"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Activate
                </DropdownMenuItem>
              )}
              {user.status === 'ACTIVE' && (
                <DropdownMenuItem
                  onClick={() => openActionDialog(user, 'deactivate')}
                  className="text-amber-600"
                >
                  <UserMinus className="mr-2 h-4 w-4" />
                  Deactivate
                </DropdownMenuItem>
              )}
              {user.status !== 'SUSPENDED' && (
                <DropdownMenuItem
                  onClick={() => openActionDialog(user, 'suspend')}
                  className="text-red-600"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Suspend
                </DropdownMenuItem>
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
            <UserCog className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">User Management</h1>
            <p className="text-neutral-500">Manage users, roles, and permissions</p>
          </div>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <Mail className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total Users</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold text-neutral-900">{stats?.total || 0}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Active</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold text-emerald-600">{stats?.active || 0}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Inactive</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold text-neutral-600">{stats?.inactive || 0}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-neutral-100 flex items-center justify-center">
                <UserX className="h-6 w-6 text-neutral-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Suspended</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-semibold text-red-600">{stats?.suspended || 0}</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search users by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <DataTable
            columns={columns}
            data={usersData?.results || []}
            loading={isLoading}
            onRowClick={(row) => navigate(`/admin/users/${row.original.id}`)}
            emptyState={{
              title: 'No users found',
              description: search || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Invite your first user to get started',
              action: (
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Invite User
                </Button>
              ),
            }}
          />
        </CardContent>
      </Card>

      {/* Invite User Dialog */}
      <InviteUserDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} />

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction === 'activate' && 'Activate User'}
              {pendingAction === 'deactivate' && 'Deactivate User'}
              {pendingAction === 'suspend' && 'Suspend User'}
            </DialogTitle>
            <DialogDescription>
              {pendingAction === 'activate' && (
                <>Are you sure you want to activate <strong>{selectedUser?.full_name}</strong>? They will be able to log in and access the system.</>
              )}
              {pendingAction === 'deactivate' && (
                <>Are you sure you want to deactivate <strong>{selectedUser?.full_name}</strong>? They will not be able to log in until reactivated.</>
              )}
              {pendingAction === 'suspend' && (
                <>Are you sure you want to suspend <strong>{selectedUser?.full_name}</strong>? This action is typically used for policy violations.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={pendingAction === 'suspend' ? 'danger' : 'primary'}
              onClick={handleAction}
              disabled={activateMutation.isPending || deactivateMutation.isPending || suspendMutation.isPending}
            >
              {activateMutation.isPending || deactivateMutation.isPending || suspendMutation.isPending
                ? 'Processing...'
                : pendingAction === 'activate'
                ? 'Activate'
                : pendingAction === 'deactivate'
                ? 'Deactivate'
                : 'Suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
