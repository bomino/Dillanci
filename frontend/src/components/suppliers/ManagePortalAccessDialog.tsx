/**
 * Dialog for managing portal users and invitations for a supplier.
 */

import { useState } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  RefreshCw,
  UserMinus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Loader2,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  usePortalUsers,
  usePortalInvitations,
  useSuspendPortalUser,
  useReactivatePortalUser,
  useChangePortalUserRole,
  useRemovePortalUser,
  useResendInvitation,
  useRevokeInvitation,
} from '@/lib/api/suppliers';
import type { PortalUser, PortalInvitation } from '@/lib/api/suppliers';
import { formatDateTime } from '@/lib/utils';

interface ManagePortalAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
  onInviteNew: () => void;
}

export function ManagePortalAccessDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  onInviteNew,
}: ManagePortalAccessDialogProps) {
  const [confirmAction, setConfirmAction] = useState<{
    type: 'suspend' | 'remove' | 'revoke';
    id: string;
    name: string;
  } | null>(null);

  const { data: portalUsers, isLoading: usersLoading } = usePortalUsers(open ? supplierId : undefined);
  const { data: portalInvitations, isLoading: invitationsLoading } = usePortalInvitations(open ? supplierId : undefined);

  const suspendMutation = useSuspendPortalUser();
  const reactivateMutation = useReactivatePortalUser();
  const changeRoleMutation = useChangePortalUserRole();
  const removeMutation = useRemovePortalUser();
  const resendMutation = useResendInvitation();
  const revokeMutation = useRevokeInvitation();

  const handleSuspendUser = async (userId: string) => {
    try {
      await suspendMutation.mutateAsync({ supplierId, userId });
      toast.success('User Suspended', { description: 'Portal access has been suspended.' });
      setConfirmAction(null);
    } catch (error) {
      toast.error('Error', { description: 'Failed to suspend user.' });
    }
  };

  const handleReactivateUser = async (userId: string) => {
    try {
      await reactivateMutation.mutateAsync({ supplierId, userId });
      toast.success('User Reactivated', { description: 'Portal access has been restored.' });
    } catch (error) {
      toast.error('Error', { description: 'Failed to reactivate user.' });
    }
  };

  const handleChangeRole = async (userId: string, role: PortalUser['role']) => {
    try {
      await changeRoleMutation.mutateAsync({ supplierId, userId, role });
      toast.success('Role Updated', { description: `Role changed to ${role}.` });
    } catch (error) {
      toast.error('Error', { description: 'Failed to change role.' });
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      await removeMutation.mutateAsync({ supplierId, userId });
      toast.success('User Removed', { description: 'Portal access has been revoked.' });
      setConfirmAction(null);
    } catch (error) {
      toast.error('Error', { description: 'Failed to remove user.' });
    }
  };

  const handleResendInvitation = async (invitationId: string, email: string) => {
    try {
      await resendMutation.mutateAsync({ supplierId, invitationId });
      toast.success('Invitation Resent', { description: `New invitation sent to ${email}.` });
    } catch (error) {
      toast.error('Error', { description: 'Failed to resend invitation.' });
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      await revokeMutation.mutateAsync({ supplierId, invitationId });
      toast.success('Invitation Revoked', { description: 'The invitation has been cancelled.' });
      setConfirmAction(null);
    } catch (error) {
      toast.error('Error', { description: 'Failed to revoke invitation.' });
    }
  };

  const copyRegistrationLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Copied', { description: 'Registration link copied to clipboard.' });
  };

  const getStatusBadgeVariant = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'SUSPENDED': return 'warning';
      case 'REVOKED': return 'error';
      case 'PENDING': return 'warning';
      case 'ACCEPTED': return 'success';
      case 'EXPIRED': return 'default';
      default: return 'default';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER': return <ShieldCheck className="h-4 w-4 text-primary-600" />;
      case 'ADMIN': return <Shield className="h-4 w-4 text-blue-600" />;
      default: return <Users className="h-4 w-4 text-neutral-400" />;
    }
  };

  const pendingInvitations = portalInvitations?.filter((inv) => inv.status === 'PENDING') || [];
  const otherInvitations = portalInvitations?.filter((inv) => inv.status !== 'PENDING') || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary-600" />
            Manage Portal Access
          </DialogTitle>
          <DialogDescription>
            Manage portal users and invitations for <span className="font-medium">{supplierName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Portal Users Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-900">Portal Users</h3>
              <Button variant="outline" size="sm" onClick={onInviteNew}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite New
              </Button>
            </div>

            {usersLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : portalUsers && portalUsers.length > 0 ? (
              <div className="space-y-2">
                {portalUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary-700">
                          {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-neutral-900">
                            {user.full_name || user.email}
                          </p>
                          <Badge variant={getStatusBadgeVariant(user.access_status)}>
                            {user.access_status}
                          </Badge>
                        </div>
                        <p className="text-sm text-neutral-500">{user.email}</p>
                        {user.last_login_at && (
                          <p className="text-xs text-neutral-400">
                            Last login: {formatDateTime(user.last_login_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Role Selector */}
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleChangeRole(user.id, value as PortalUser['role'])}
                        disabled={changeRoleMutation.isPending}
                      >
                        <SelectTrigger className="w-28 h-8">
                          <div className="flex items-center gap-1">
                            {getRoleIcon(user.role)}
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OWNER">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4" />
                              Owner
                            </div>
                          </SelectItem>
                          <SelectItem value="ADMIN">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Admin
                            </div>
                          </SelectItem>
                          <SelectItem value="MEMBER">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Member
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Action Buttons */}
                      {user.access_status === 'ACTIVE' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmAction({ type: 'suspend', id: user.id, name: user.full_name || user.email })}
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        >
                          <ShieldAlert className="h-4 w-4" />
                        </Button>
                      ) : user.access_status === 'SUSPENDED' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReactivateUser(user.id)}
                          disabled={reactivateMutation.isPending}
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        >
                          {reactivateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </Button>
                      ) : null}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmAction({ type: 'remove', id: user.id, name: user.full_name || user.email })}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
                <Users className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">No portal users yet</p>
                <Button variant="outline" size="sm" onClick={onInviteNew} className="mt-2">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Send First Invitation
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Pending Invitations Section */}
          {(pendingInvitations.length > 0 || invitationsLoading) && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Pending Invitations</h3>

              {invitationsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">{invitation.email}</p>
                          <p className="text-xs text-neutral-500">
                            Expires: {formatDateTime(invitation.expires_at)}
                          </p>
                          {invitation.created_by_name && (
                            <p className="text-xs text-neutral-400">
                              Invited by: {invitation.created_by_name}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {invitation.registration_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyRegistrationLink(invitation.registration_url!)}
                            title="Copy registration link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendInvitation(invitation.id, invitation.email)}
                          disabled={resendMutation.isPending}
                          title="Resend invitation"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          {resendMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmAction({ type: 'revoke', id: invitation.id, name: invitation.email })}
                          title="Revoke invitation"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Past Invitations (collapsed) */}
          {otherInvitations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-500 mb-3">Past Invitations</h3>
              <div className="space-y-2">
                {otherInvitations.slice(0, 5).map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-neutral-400" />
                      <span className="text-neutral-600">{invitation.email}</span>
                    </div>
                    <Badge variant={getStatusBadgeVariant(invitation.status)}>
                      {invitation.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Dialog Overlay */}
        {confirmAction && (
          <div className="absolute inset-0 bg-white/95 flex items-center justify-center rounded-lg">
            <div className="text-center p-6 max-w-sm">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                {confirmAction.type === 'suspend' && 'Suspend User?'}
                {confirmAction.type === 'remove' && 'Remove User?'}
                {confirmAction.type === 'revoke' && 'Revoke Invitation?'}
              </h3>
              <p className="text-sm text-neutral-600 mb-4">
                {confirmAction.type === 'suspend' && (
                  <>This will temporarily disable portal access for <strong>{confirmAction.name}</strong>. They can be reactivated later.</>
                )}
                {confirmAction.type === 'remove' && (
                  <>This will permanently remove <strong>{confirmAction.name}</strong> from the portal. This action cannot be undone.</>
                )}
                {confirmAction.type === 'revoke' && (
                  <>This will cancel the invitation to <strong>{confirmAction.name}</strong>. They will no longer be able to register.</>
                )}
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" onClick={() => setConfirmAction(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirmAction.type === 'suspend') handleSuspendUser(confirmAction.id);
                    if (confirmAction.type === 'remove') handleRemoveUser(confirmAction.id);
                    if (confirmAction.type === 'revoke') handleRevokeInvitation(confirmAction.id);
                  }}
                  disabled={suspendMutation.isPending || removeMutation.isPending || revokeMutation.isPending}
                >
                  {(suspendMutation.isPending || removeMutation.isPending || revokeMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {confirmAction.type === 'suspend' && 'Suspend'}
                  {confirmAction.type === 'remove' && 'Remove'}
                  {confirmAction.type === 'revoke' && 'Revoke'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ManagePortalAccessDialog;
