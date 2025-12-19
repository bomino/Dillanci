import { useState } from 'react';
import {
  Users,
  Plus,
  X,
  Eye,
  FileCheck,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

import { AddSupplierDialog } from './AddSupplierDialog';
import { useRemoveInvitation } from '@/lib/api/rfqs';
import { formatDate } from '@/lib/utils';
import type { SupplierInvitation, RFQStatus, Supplier } from '@/types';

interface InvitedSuppliersCardProps {
  rfqId: string;
  rfqStatus: RFQStatus;
  invitations: SupplierInvitation[];
  availableSuppliers: Supplier[];
}

const invitationStatusConfig: Record<
  string,
  { label: string; variant: 'default' | 'info' | 'success' | 'error'; icon: React.ElementType }
> = {
  PENDING: { label: 'Pending', variant: 'default', icon: Clock },
  INVITED: { label: 'Invited', variant: 'default', icon: Clock },
  VIEWED: { label: 'Viewed', variant: 'info', icon: Eye },
  BID_SUBMITTED: { label: 'Bid Submitted', variant: 'success', icon: FileCheck },
  DECLINED: { label: 'Declined', variant: 'error', icon: XCircle },
};

const defaultStatusConfig = { label: 'Unknown', variant: 'default' as const, icon: Clock };

export function InvitedSuppliersCard({
  rfqId,
  rfqStatus,
  invitations,
  availableSuppliers,
}: InvitedSuppliersCardProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [invitationToRemove, setInvitationToRemove] = useState<SupplierInvitation | null>(null);

  const removeInvitationMutation = useRemoveInvitation();

  const canEdit = rfqStatus === 'DRAFT';

  // Filter out already invited suppliers
  const invitedSupplierIds = new Set(invitations.map((inv) => inv.supplier));
  const uninvitedSuppliers = availableSuppliers.filter(
    (supplier) => !invitedSupplierIds.has(supplier.id)
  );

  const handleRemoveClick = (invitation: SupplierInvitation) => {
    setInvitationToRemove(invitation);
    setRemoveDialogOpen(true);
  };

  const handleRemoveConfirm = async () => {
    if (!invitationToRemove) return;

    try {
      await removeInvitationMutation.mutateAsync(invitationToRemove.id);
      toast.success('Invitation removed', {
        description: `${invitationToRemove.supplier_name} has been removed from this RFQ`,
      });
      setRemoveDialogOpen(false);
      setInvitationToRemove(null);
    } catch (error) {
      console.error('Failed to remove invitation:', error);
      toast.error('Failed to remove invitation', {
        description: 'Please try again',
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-neutral-400" />
              <CardTitle>
                Invited Suppliers
                {invitations.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-neutral-500">
                    ({invitations.length})
                  </span>
                )}
              </CardTitle>
            </div>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddDialogOpen(true)}
                disabled={uninvitedSuppliers.length === 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Supplier
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500 mb-4">No suppliers invited yet</p>
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={() => setAddDialogOpen(true)}
                  disabled={uninvitedSuppliers.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Invite Suppliers
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => {
                const statusConfig = invitationStatusConfig[invitation.status] || defaultStatusConfig;
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-100"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-neutral-900 truncate">
                          {invitation.supplier_name}
                        </h4>
                        <Badge variant={statusConfig.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        Invited {formatDate(invitation.invited_at)}
                        {invitation.invited_by_name && (
                          <span> by {invitation.invited_by_name}</span>
                        )}
                      </p>
                      {invitation.status === 'DECLINED' && invitation.decline_reason && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-red-600 mt-1 truncate cursor-help">
                                Reason: {invitation.decline_reason}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{invitation.decline_reason}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                        onClick={() => handleRemoveClick(invitation)}
                        disabled={removeInvitationMutation.isPending}
                      >
                        {removeInvitationMutation.isPending &&
                        invitationToRemove?.id === invitation.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Supplier Dialog */}
      <AddSupplierDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        rfqId={rfqId}
        availableSuppliers={uninvitedSuppliers}
      />

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-medium text-neutral-900">
                {invitationToRemove?.supplier_name}
              </span>{' '}
              from this RFQ? They will no longer receive notifications about this RFQ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              {removeInvitationMutation.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default InvitedSuppliersCard;
