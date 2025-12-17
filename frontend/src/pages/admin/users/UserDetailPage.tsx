import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  UserCog,
  Shield,
  Activity,
  User,
  Mail,
  Building2,
  Calendar,
  Clock,
  MoreHorizontal,
  Plus,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useUser,
  useUserRoles,
  useRoles,
  useAssignRole,
  useRemoveRole,
  useActivateUser,
  useDeactivateUser,
  useSuspendUser,
} from '@/lib/api/admin';
import type { UserRole } from '@/lib/api/admin';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield },
  { id: 'activity', label: 'Activity', icon: Activity },
];

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [assignRoleDialogOpen, setAssignRoleDialogOpen] = useState(false);
  const [removeRoleDialogOpen, setRemoveRoleDialogOpen] = useState(false);
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState<string>('');
  const [selectedRoleToRemove, setSelectedRoleToRemove] = useState<UserRole | null>(null);

  const { data: user, isLoading } = useUser(id);
  const { data: userRoles, isLoading: rolesLoading } = useUserRoles(id);
  const { data: allRoles } = useRoles();

  const assignRoleMutation = useAssignRole();
  const removeRoleMutation = useRemoveRole();
  const activateMutation = useActivateUser();
  const deactivateMutation = useDeactivateUser();
  const suspendMutation = useSuspendUser();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const handleAssignRole = async () => {
    if (!id || !selectedRoleToAssign) return;
    try {
      await assignRoleMutation.mutateAsync({
        userId: id,
        role_id: selectedRoleToAssign,
      });
      setAssignRoleDialogOpen(false);
      setSelectedRoleToAssign('');
    } catch (error) {
      console.error('Failed to assign role:', error);
    }
  };

  const handleRemoveRole = async () => {
    if (!id || !selectedRoleToRemove) return;
    try {
      await removeRoleMutation.mutateAsync({
        userId: id,
        roleId: selectedRoleToRemove.role,
      });
      setRemoveRoleDialogOpen(false);
      setSelectedRoleToRemove(null);
    } catch (error) {
      console.error('Failed to remove role:', error);
    }
  };

  const handleStatusChange = async (action: 'activate' | 'deactivate' | 'suspend') => {
    if (!id) return;
    try {
      switch (action) {
        case 'activate':
          await activateMutation.mutateAsync(id);
          break;
        case 'deactivate':
          await deactivateMutation.mutateAsync(id);
          break;
        case 'suspend':
          await suspendMutation.mutateAsync(id);
          break;
      }
    } catch (error) {
      console.error('Failed to change status:', error);
    }
  };

  // Available roles to assign (not already assigned)
  const assignedRoleIds = new Set(userRoles?.map((ur) => ur.role) || []);
  const availableRoles = allRoles?.results?.filter((role) => !assignedRoleIds.has(role.id)) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500">User not found</p>
        <Button variant="outline" onClick={() => navigate('/admin/users')} className="mt-4">
          Back to Users
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/admin/users')} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Button>

      {/* User Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xl font-semibold">
            {user.first_name?.[0]?.toUpperCase() || '?'}
            {user.last_name?.[0]?.toUpperCase() || ''}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-900">{user.full_name}</h1>
              <StatusBadge status={user.status?.toLowerCase() || 'draft'} />
            </div>
            <p className="text-neutral-500">{user.email}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Actions
              <MoreHorizontal className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {user.status !== 'ACTIVE' && (
              <DropdownMenuItem onClick={() => handleStatusChange('activate')}>
                <Check className="mr-2 h-4 w-4 text-emerald-600" />
                Activate User
              </DropdownMenuItem>
            )}
            {user.status === 'ACTIVE' && (
              <DropdownMenuItem onClick={() => handleStatusChange('deactivate')}>
                <X className="mr-2 h-4 w-4 text-amber-600" />
                Deactivate User
              </DropdownMenuItem>
            )}
            {user.status !== 'SUSPENDED' && (
              <DropdownMenuItem onClick={() => handleStatusChange('suspend')} className="text-red-600">
                <X className="mr-2 h-4 w-4" />
                Suspend User
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-neutral-400" />
                <div>
                  <p className="text-sm text-neutral-500">Full Name</p>
                  <p className="font-medium">{user.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-neutral-400" />
                <div>
                  <p className="text-sm text-neutral-500">Email Address</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>
              {user.employee_id && (
                <div className="flex items-center gap-3">
                  <UserCog className="h-5 w-5 text-neutral-400" />
                  <div>
                    <p className="text-sm text-neutral-500">Employee ID</p>
                    <p className="font-medium">{user.employee_id}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organization & Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-neutral-400" />
                <div>
                  <p className="text-sm text-neutral-500">Organization</p>
                  <p className="font-medium">{user.organization_name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-neutral-400" />
                <div>
                  <p className="text-sm text-neutral-500">Created</p>
                  <p className="font-medium">{formatDate(user.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-neutral-400" />
                <div>
                  <p className="text-sm text-neutral-500">Last Updated</p>
                  <p className="font-medium">{formatDateTime(user.updated_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="space-y-6">
          {/* Assigned Roles */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Assigned Roles</CardTitle>
                <CardDescription>Roles currently assigned to this user</CardDescription>
              </div>
              <Button onClick={() => setAssignRoleDialogOpen(true)} disabled={availableRoles.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Assign Role
              </Button>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : userRoles?.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No roles assigned</p>
                  <p className="text-sm">Assign a role to grant permissions</p>
                </div>
              ) : (
                <div className="divide-y">
                  {userRoles?.map((userRole) => (
                    <div key={userRole.id} className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                          <Shield className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium">{userRole.role_name}</p>
                          <p className="text-sm text-neutral-500">
                            Assigned {formatDate(userRole.created_at)}
                            {userRole.valid_to && ` · Expires ${formatDate(userRole.valid_to)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {userRole.is_delegated && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                            Delegated
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRoleToRemove(userRole);
                            setRemoveRoleDialogOpen(true);
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Effective Permissions */}
          <Card>
            <CardHeader>
              <CardTitle>Effective Permissions</CardTitle>
              <CardDescription>All permissions granted through assigned roles</CardDescription>
            </CardHeader>
            <CardContent>
              {user.permissions?.length === 0 ? (
                <p className="text-neutral-500 text-center py-4">No permissions</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {user.permissions?.map((permission) => (
                    <span
                      key={permission}
                      className="inline-flex items-center px-2 py-1 rounded-md bg-neutral-100 text-neutral-700 text-xs font-mono"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>User's recent actions in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-neutral-500">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Activity log coming soon</p>
              <p className="text-sm">Track user actions and audit history</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assign Role Dialog */}
      <Dialog open={assignRoleDialogOpen} onOpenChange={setAssignRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Select a role to assign to {user.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRoleToAssign} onValueChange={setSelectedRoleToAssign}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-indigo-500" />
                      <span>{role.name}</span>
                      {role.is_system_role && (
                        <span className="text-xs bg-neutral-100 px-1.5 rounded">System</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignRole}
              disabled={!selectedRoleToAssign || assignRoleMutation.isPending}
            >
              {assignRoleMutation.isPending ? 'Assigning...' : 'Assign Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Role Dialog */}
      <Dialog open={removeRoleDialogOpen} onOpenChange={setRemoveRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the <strong>{selectedRoleToRemove?.role_name}</strong> role
              from {user.full_name}? This will revoke all associated permissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRemoveRole}
              disabled={removeRoleMutation.isPending}
            >
              {removeRoleMutation.isPending ? 'Removing...' : 'Remove Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
