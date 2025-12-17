import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowLeft,
  Pencil,
  Trash2,
  Users,
  Lock,
  Building2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Save,
  MoreHorizontal,
  UserMinus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useRole,
  useUpdateRole,
  useDeleteRole,
  usePermissions,
  useRoleUsers,
  useRemoveRole,
} from '@/lib/api/admin';
import { cn } from '@/lib/utils';

const roleTypeConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  SYSTEM: { label: 'System', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: <Lock className="h-3 w-3" /> },
  ORGANIZATION: { label: 'Organization', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: <Building2 className="h-3 w-3" /> },
  CUSTOM: { label: 'Custom', color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: <Sparkles className="h-3 w-3" /> },
};

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [removeUserDialogOpen, setRemoveUserDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    approval_limit: '',
    currency: 'USD',
  });

  const { data: role, isLoading } = useRole(id!);
  const { data: permissionGroups } = usePermissions();
  const { data: roleUsers } = useRoleUsers(id!);
  const updateMutation = useUpdateRole();
  const deleteMutation = useDeleteRole();
  const removeUserMutation = useRemoveRole();

  const startEditing = () => {
    if (role) {
      setEditForm({
        name: role.name,
        description: role.description || '',
        approval_limit: role.approval_limit || '',
        currency: role.currency || 'USD',
      });
      setSelectedPermissions(new Set(role.permissions.map((p) => p.code)));
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setSelectedPermissions(new Set());
  };

  const handleSave = async () => {
    if (!role) return;
    try {
      await updateMutation.mutateAsync({
        id: role.id,
        name: editForm.name,
        description: editForm.description || undefined,
        approval_limit: editForm.approval_limit || null,
        currency: editForm.currency,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleDelete = async () => {
    if (!role) return;
    try {
      await deleteMutation.mutateAsync(role.id);
      navigate('/admin/roles');
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  };

  const handleRemoveUser = async () => {
    if (!selectedUserId || !role) return;
    try {
      await removeUserMutation.mutateAsync({ userId: selectedUserId, roleId: role.id });
      setRemoveUserDialogOpen(false);
      setSelectedUserId(null);
    } catch (error) {
      console.error('Failed to remove user from role:', error);
    }
  };

  const toggleModule = (module: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  };

  const togglePermission = (code: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleAllInModule = (_module: string, permissions: { code: string }[]) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      const moduleCodes = permissions.map((p) => p.code);
      const allSelected = moduleCodes.every((code) => prev.has(code));

      if (allSelected) {
        moduleCodes.forEach((code) => next.delete(code));
      } else {
        moduleCodes.forEach((code) => next.add(code));
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500">Role not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/roles')}>
          Back to Roles
        </Button>
      </div>
    );
  }

  const typeConfig = roleTypeConfig[role.role_type] || roleTypeConfig.CUSTOM;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/roles')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-900">{role.name}</h1>
              <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium', typeConfig.bgColor, typeConfig.color)}>
                {typeConfig.icon}
                {typeConfig.label}
              </span>
              <StatusBadge status={role.is_active ? 'active' : 'inactive'}>
                {role.is_active ? 'Active' : 'Inactive'}
              </StatusBadge>
            </div>
            <p className="text-neutral-500 font-mono text-sm">{role.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={cancelEditing}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <>
              {!role.is_system_role && (
                <>
                  <Button variant="outline" onClick={startEditing}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="permissions">
            Permissions ({role.permission_count})
          </TabsTrigger>
          <TabsTrigger value="users">
            Users ({role.user_count})
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Role Information</CardTitle>
                <CardDescription>Basic information about this role</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="text-sm font-medium text-neutral-700">Name</label>
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-700">Description</label>
                      <Textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-sm font-medium text-neutral-500">Name</label>
                      <p className="text-neutral-900">{role.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-500">Code</label>
                      <p className="text-neutral-900 font-mono">{role.code}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-500">Description</label>
                      <p className="text-neutral-900">{role.description || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-500">Type</label>
                      <p className="text-neutral-900">{typeConfig.label}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Approval Limits</CardTitle>
                <CardDescription>Financial approval thresholds for this role</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="text-sm font-medium text-neutral-700">Approval Limit</label>
                      <Input
                        type="number"
                        value={editForm.approval_limit}
                        onChange={(e) => setEditForm({ ...editForm, approval_limit: e.target.value })}
                        className="mt-1"
                        placeholder="Enter amount"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-700">Currency</label>
                      <Input
                        value={editForm.currency}
                        onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-sm font-medium text-neutral-500">Approval Limit</label>
                      <p className="text-neutral-900 text-2xl font-semibold">
                        {role.approval_limit ? (
                          new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: role.currency || 'USD',
                          }).format(parseFloat(role.approval_limit))
                        ) : (
                          <span className="text-neutral-400 text-base font-normal">No limit set</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-500">Currency</label>
                      <p className="text-neutral-900">{role.currency || 'USD'}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-neutral-500">Users Assigned</p>
                  <p className="text-2xl font-semibold text-neutral-900">{role.user_count}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Total Permissions</p>
                  <p className="text-2xl font-semibold text-neutral-900">{role.permission_count}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Created</p>
                  <p className="text-neutral-900">
                    {new Date(role.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Last Updated</p>
                  <p className="text-neutral-900">
                    {new Date(role.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Permissions</CardTitle>
              <CardDescription>
                {isEditing
                  ? 'Select the permissions for this role'
                  : 'View all permissions assigned to this role'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg divide-y max-h-[600px] overflow-y-auto">
                {(isEditing ? permissionGroups : role.permissions_grouped)?.map((group) => {
                  const permissions = 'permissions' in group ? group.permissions : [];
                  const isExpanded = expandedModules.has(group.module);

                  let selectedCount = 0;
                  let allSelected = false;
                  let someSelected = false;

                  if (isEditing && permissions.length > 0) {
                    selectedCount = permissions.filter((p) => selectedPermissions.has(p.code)).length;
                    allSelected = selectedCount === permissions.length;
                    someSelected = selectedCount > 0 && !allSelected;
                  } else {
                    selectedCount = permissions.length;
                  }

                  return (
                    <div key={group.module}>
                      <button
                        type="button"
                        onClick={() => toggleModule(group.module)}
                        className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isEditing && (
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => toggleAllInModule(group.module, permissions)}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(someSelected && 'data-[state=unchecked]:bg-indigo-200')}
                            />
                          )}
                          <span className="font-medium">{group.label}</span>
                          <span className="text-sm text-neutral-500">
                            {isEditing ? `${selectedCount}/${permissions.length}` : `${permissions.length} permissions`}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-neutral-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-neutral-400" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className={cn('px-4 pb-4 space-y-1', isEditing ? 'pl-12' : 'pl-8')}>
                          {permissions.map((permission) => (
                            <div
                              key={permission.code}
                              className="flex items-center gap-3 py-2 px-3 rounded hover:bg-neutral-50"
                            >
                              {isEditing ? (
                                <Checkbox
                                  checked={selectedPermissions.has(permission.code)}
                                  onCheckedChange={() => togglePermission(permission.code)}
                                />
                              ) : (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                              <span className="text-sm text-neutral-700">{permission.label}</span>
                              <span className="text-xs text-neutral-400 font-mono ml-auto">
                                {permission.code}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Users</CardTitle>
              <CardDescription>Users who have been assigned this role</CardDescription>
            </CardHeader>
            <CardContent>
              {roleUsers && roleUsers.length > 0 ? (
                <div className="divide-y">
                  {roleUsers.map((userRole) => (
                    <div key={userRole.id} className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium">
                          {userRole.user_name?.[0] || userRole.user_email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">
                            {userRole.user_name || userRole.user_email}
                          </p>
                          <p className="text-sm text-neutral-500">{userRole.user_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <StatusBadge status={userRole.is_active ? 'active' : 'inactive'}>
                          {userRole.is_active ? 'Active' : 'Inactive'}
                        </StatusBadge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/admin/users/${userRole.user}`)}>
                              View User
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUserId(userRole.user);
                                setRemoveUserDialogOpen(true);
                              }}
                              className="text-red-600"
                            >
                              <UserMinus className="mr-2 h-4 w-4" />
                              Remove from Role
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-500">No users assigned to this role</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Role Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the <strong>{role.name}</strong> role?
              This action cannot be undone.
              {role.user_count > 0 && (
                <span className="block mt-2 text-amber-600">
                  Warning: This role has {role.user_count} user(s) assigned to it.
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

      {/* Remove User from Role Dialog */}
      <Dialog open={removeUserDialogOpen} onOpenChange={setRemoveUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User from Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this user from the <strong>{role.name}</strong> role?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRemoveUser}
              disabled={removeUserMutation.isPending}
            >
              {removeUserMutation.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
