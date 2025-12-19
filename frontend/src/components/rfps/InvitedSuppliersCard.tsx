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
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Ban,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';

import { AddSupplierDialog } from './AddSupplierDialog';
import { formatDate } from '@/lib/utils';
import type { RFPInvitation, RFPStatus, Supplier, IntentToBid, RFPInvitationStatus } from '@/types';

interface InvitedSuppliersCardProps {
  rfpId: string;
  rfpStatus: RFPStatus;
  invitations: RFPInvitation[];
  availableSuppliers: Supplier[];
  onRemoveInvitation?: (invitationId: string) => Promise<void>;
  onDisqualifySupplier?: (invitationId: string, reason: string) => Promise<void>;
}

const invitationStatusConfig: Record<
  RFPInvitationStatus,
  { label: string; variant: 'default' | 'info' | 'success' | 'error' | 'warning'; icon: React.ElementType }
> = {
  PENDING: { label: 'Pending', variant: 'default', icon: Clock },
  VIEWED: { label: 'Viewed', variant: 'info', icon: Eye },
  PROPOSAL_SUBMITTED: { label: 'Proposal Submitted', variant: 'success', icon: FileCheck },
  DECLINED: { label: 'Declined', variant: 'error', icon: XCircle },
  DISQUALIFIED: { label: 'Disqualified', variant: 'error', icon: Ban },
};

const intentToBidConfig: Record<
  IntentToBid,
  { label: string; variant: 'default' | 'success' | 'error' | 'warning'; icon: React.ElementType }
> = {
  YES: { label: 'Intends to Bid', variant: 'success', icon: ThumbsUp },
  NO: { label: 'Not Bidding', variant: 'error', icon: ThumbsDown },
  UNDECIDED: { label: 'Undecided', variant: 'warning', icon: HelpCircle },
};

export function InvitedSuppliersCard({
  rfpId,
  rfpStatus,
  invitations,
  availableSuppliers,
  onRemoveInvitation,
  onDisqualifySupplier,
}: InvitedSuppliersCardProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [disqualifyDialogOpen, setDisqualifyDialogOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<RFPInvitation | null>(null);
  const [disqualifyReason, setDisqualifyReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const canEdit = rfpStatus === 'DRAFT';
  const canDisqualify = ['PUBLISHED', 'EVALUATION', 'BAFO'].includes(rfpStatus);

  // Filter out already invited suppliers
  const invitedSupplierIds = new Set(invitations.map((inv) => inv.supplier));
  const uninvitedSuppliers = availableSuppliers.filter(
    (supplier) => !invitedSupplierIds.has(supplier.id)
  );

  // Separate active and disqualified invitations
  const activeInvitations = invitations.filter(inv => inv.status !== 'DISQUALIFIED');
  const disqualifiedInvitations = invitations.filter(inv => inv.status === 'DISQUALIFIED');

  const handleRemoveClick = (invitation: RFPInvitation) => {
    setSelectedInvitation(invitation);
    setRemoveDialogOpen(true);
  };

  const handleDisqualifyClick = (invitation: RFPInvitation) => {
    setSelectedInvitation(invitation);
    setDisqualifyReason('');
    setDisqualifyDialogOpen(true);
  };

  const handleRemoveConfirm = async () => {
    if (!selectedInvitation || !onRemoveInvitation) return;

    setIsProcessing(true);
    try {
      await onRemoveInvitation(selectedInvitation.id);
      toast.success('Invitation removed', {
        description: `${selectedInvitation.supplier_name} has been removed from this RFP`,
      });
      setRemoveDialogOpen(false);
      setSelectedInvitation(null);
    } catch (error) {
      console.error('Failed to remove invitation:', error);
      toast.error('Failed to remove invitation', {
        description: 'Please try again',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisqualifyConfirm = async () => {
    if (!selectedInvitation || !onDisqualifySupplier || !disqualifyReason.trim()) return;

    setIsProcessing(true);
    try {
      await onDisqualifySupplier(selectedInvitation.id, disqualifyReason);
      toast.success('Supplier disqualified', {
        description: `${selectedInvitation.supplier_name} has been disqualified from this RFP`,
      });
      setDisqualifyDialogOpen(false);
      setSelectedInvitation(null);
      setDisqualifyReason('');
    } catch (error) {
      console.error('Failed to disqualify supplier:', error);
      toast.error('Failed to disqualify supplier', {
        description: 'Please try again',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const renderInvitationCard = (invitation: RFPInvitation) => {
    const statusConfig = invitationStatusConfig[invitation.status];
    const StatusIcon = statusConfig.icon;
    const intentConfig = invitation.intent_to_bid ? intentToBidConfig[invitation.intent_to_bid] : null;
    const IntentIcon = intentConfig?.icon;

    return (
      <div
        key={invitation.id}
        className={`flex items-center justify-between p-3 rounded-lg border ${
          invitation.status === 'DISQUALIFIED'
            ? 'bg-red-50 border-red-100'
            : 'bg-neutral-50 border-neutral-100'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-neutral-900 truncate">
              {invitation.supplier_name}
            </h4>
            <Badge variant={statusConfig.variant} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </Badge>
            {intentConfig && IntentIcon && invitation.status !== 'DISQUALIFIED' && (
              <Badge variant={intentConfig.variant} className="gap-1">
                <IntentIcon className="h-3 w-3" />
                {intentConfig.label}
              </Badge>
            )}
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
          {invitation.status === 'DISQUALIFIED' && invitation.disqualification_reason && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-red-600 mt-1 truncate cursor-help flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Disqualified: {invitation.disqualification_reason}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{invitation.disqualification_reason}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {(canEdit || canDisqualify) && invitation.status !== 'DISQUALIFIED' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-400 hover:text-neutral-600 flex-shrink-0"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 9.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem
                  onClick={() => handleRemoveClick(invitation)}
                  className="text-red-600 focus:text-red-600"
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove Invitation
                </DropdownMenuItem>
              )}
              {canDisqualify && (
                <>
                  {canEdit && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={() => handleDisqualifyClick(invitation)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Disqualify Supplier
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
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
                    ({activeInvitations.length} active
                    {disqualifiedInvitations.length > 0 && `, ${disqualifiedInvitations.length} disqualified`})
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
              {/* Active invitations */}
              {activeInvitations.map(renderInvitationCard)}

              {/* Disqualified invitations (collapsed) */}
              {disqualifiedInvitations.length > 0 && (
                <details className="mt-4">
                  <summary className="text-sm text-neutral-500 cursor-pointer hover:text-neutral-700 py-2">
                    {disqualifiedInvitations.length} disqualified supplier{disqualifiedInvitations.length > 1 ? 's' : ''}
                  </summary>
                  <div className="space-y-2 mt-2">
                    {disqualifiedInvitations.map(renderInvitationCard)}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Supplier Dialog */}
      <AddSupplierDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        rfpId={rfpId}
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
                {selectedInvitation?.supplier_name}
              </span>{' '}
              from this RFP? They will no longer receive notifications about this RFP.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disqualify Confirmation Dialog */}
      <AlertDialog open={disqualifyDialogOpen} onOpenChange={setDisqualifyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="h-5 w-5" />
              Disqualify Supplier
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you sure you want to disqualify{' '}
                <span className="font-medium text-neutral-900">
                  {selectedInvitation?.supplier_name}
                </span>{' '}
                from this RFP? This action cannot be easily undone.
              </p>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">
                  Reason for disqualification *
                </label>
                <Textarea
                  value={disqualifyReason}
                  onChange={(e) => setDisqualifyReason(e.target.value)}
                  placeholder="Provide a reason for disqualification..."
                  rows={3}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisqualifyConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={isProcessing || !disqualifyReason.trim()}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disqualifying...
                </>
              ) : (
                'Disqualify'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default InvitedSuppliersCard;
