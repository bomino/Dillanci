import * as React from 'react';
import { format, formatDistanceToNow, isPast, isFuture } from 'date-fns';
import {
  Repeat,
  Play,
  Square,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Users,
  DollarSign,
  FileText,
  AlertCircle,
  Loader2,
  Calendar,
  Building2,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';

export type BAFORoundStatus = 'NOT_STARTED' | 'ACTIVE' | 'CLOSED' | 'AWARDED';

export interface BAFOInvitation {
  id: string;
  supplier_id: string;
  supplier_name: string;
  proposal_id: string;
  original_amount: string;
  bafo_amount: string | null;
  submitted_at: string | null;
  notes: string | null;
}

export interface BAFORound {
  id: string;
  rfp_id: string;
  round_number: number;
  status: BAFORoundStatus;
  started_at: string | null;
  deadline: string | null;
  closed_at: string | null;
  instructions: string | null;
  invitations: BAFOInvitation[];
}

interface BAFOPanelProps {
  rfpId: string;
  currentRound: BAFORound | null;
  previousRounds: BAFORound[];
  shortlistedProposals: Array<{
    id: string;
    supplier_id: string;
    supplier_name: string;
    proposed_amount: string;
    weighted_score: number;
  }>;
  onStartBAFO: (deadline: string, instructions: string, invitedSupplierIds: string[]) => Promise<void>;
  onCloseBAFO: () => Promise<void>;
  onAwardFromBAFO: (proposalId: string) => Promise<void>;
  isOwner?: boolean;
  className?: string;
}

const statusConfig: Record<BAFORoundStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  NOT_STARTED: { label: 'Not Started', color: 'text-neutral-600', bgColor: 'bg-neutral-100', icon: Clock },
  ACTIVE: { label: 'Active', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Play },
  CLOSED: { label: 'Closed', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: Square },
  AWARDED: { label: 'Awarded', color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: Trophy },
};

export function BAFOPanel({
  currentRound,
  previousRounds,
  shortlistedProposals,
  onStartBAFO,
  onCloseBAFO,
  onAwardFromBAFO,
  isOwner = false,
  className,
}: BAFOPanelProps) {
  const [startDialogOpen, setStartDialogOpen] = React.useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = React.useState(false);
  const [awardDialogOpen, setAwardDialogOpen] = React.useState(false);
  const [selectedProposalId, setSelectedProposalId] = React.useState<string | null>(null);

  const [deadline, setDeadline] = React.useState('');
  const [instructions, setInstructions] = React.useState('');
  const [selectedSuppliers, setSelectedSuppliers] = React.useState<Set<string>>(new Set());

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Initialize selected suppliers from shortlisted proposals
  React.useEffect(() => {
    if (shortlistedProposals.length > 0 && selectedSuppliers.size === 0) {
      setSelectedSuppliers(new Set(shortlistedProposals.map(p => p.supplier_id)));
    }
  }, [shortlistedProposals, selectedSuppliers.size]);

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev => {
      const next = new Set(prev);
      if (next.has(supplierId)) {
        next.delete(supplierId);
      } else {
        next.add(supplierId);
      }
      return next;
    });
  };

  const handleStartBAFO = async () => {
    if (!deadline || selectedSuppliers.size === 0) return;

    setIsSubmitting(true);
    try {
      await onStartBAFO(deadline, instructions, Array.from(selectedSuppliers));
      setStartDialogOpen(false);
      setDeadline('');
      setInstructions('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseBAFO = async () => {
    setIsSubmitting(true);
    try {
      await onCloseBAFO();
      setCloseDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAward = async () => {
    if (!selectedProposalId) return;

    setIsSubmitting(true);
    try {
      await onAwardFromBAFO(selectedProposalId);
      setAwardDialogOpen(false);
      setSelectedProposalId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  // Calculate submission progress
  const submissionCount = currentRound?.invitations.filter(i => i.bafo_amount !== null).length || 0;
  const totalInvitations = currentRound?.invitations.length || 0;
  const submissionProgress = totalInvitations > 0 ? (submissionCount / totalInvitations) * 100 : 0;

  // Check deadline status
  const deadlineDate = currentRound?.deadline ? new Date(currentRound.deadline) : null;
  const isDeadlinePast = deadlineDate ? isPast(deadlineDate) : false;
  const isDeadlineSoon = deadlineDate && isFuture(deadlineDate) &&
    (deadlineDate.getTime() - Date.now()) < 24 * 60 * 60 * 1000; // within 24 hours

  const roundNumber = currentRound?.round_number || previousRounds.length + 1;

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            BAFO Round
            {currentRound && (
              <Badge variant="outline" className="ml-2">
                Round {currentRound.round_number}
              </Badge>
            )}
          </CardTitle>

          {currentRound && (
            <div className="flex items-center gap-2">
              {(() => {
                const config = statusConfig[currentRound.status];
                const StatusIcon = config.icon;
                return (
                  <span className={cn(
                    'px-3 py-1 text-sm font-medium rounded-full flex items-center gap-1',
                    config.bgColor,
                    config.color
                  )}>
                    <StatusIcon className="h-4 w-4" />
                    {config.label}
                  </span>
                );
              })()}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {!currentRound || currentRound.status === 'NOT_STARTED' ? (
          // No active BAFO - show start option
          <div className="text-center py-8">
            <Repeat className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="font-medium text-neutral-900 mb-1">
              {previousRounds.length > 0 ? 'Start Another BAFO Round' : 'No BAFO Round Started'}
            </h3>
            <p className="text-sm text-neutral-500 mb-4 max-w-md mx-auto">
              Best and Final Offer (BAFO) allows shortlisted suppliers to submit their final, competitive pricing.
            </p>

            {isOwner && shortlistedProposals.length >= 2 && (
              <Button onClick={() => setStartDialogOpen(true)}>
                <Play className="h-4 w-4 mr-2" />
                Start BAFO Round {roundNumber}
              </Button>
            )}

            {shortlistedProposals.length < 2 && (
              <div className="flex items-center justify-center gap-2 text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                Need at least 2 shortlisted proposals to start BAFO
              </div>
            )}
          </div>
        ) : (
          // Active or Closed BAFO
          <div className="space-y-6">
            {/* Deadline & Progress */}
            {currentRound.status === 'ACTIVE' && (
              <div className="p-4 bg-neutral-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-neutral-500" />
                    <span className="text-sm font-medium">Deadline</span>
                  </div>
                  {deadlineDate && (
                    <span className={cn(
                      'text-sm font-medium',
                      isDeadlinePast ? 'text-red-600' :
                        isDeadlineSoon ? 'text-amber-600' : 'text-neutral-600'
                    )}>
                      {format(deadlineDate, 'MMM d, yyyy h:mm a')}
                      {isDeadlinePast ? ' (Passed)' :
                        isDeadlineSoon ? ' (Due soon)' : ''}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Submissions received</span>
                    <span className="font-medium">{submissionCount} / {totalInvitations}</span>
                  </div>
                  <Progress value={submissionProgress} className="h-2" />
                </div>
              </div>
            )}

            {/* Instructions */}
            {currentRound.instructions && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Instructions
                </h4>
                <p className="text-sm text-blue-700 whitespace-pre-wrap">
                  {currentRound.instructions}
                </p>
              </div>
            )}

            {/* Invitations List */}
            <div>
              <h4 className="text-sm font-medium text-neutral-700 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Invited Suppliers ({currentRound.invitations.length})
              </h4>

              <div className="space-y-2">
                {currentRound.invitations
                  .sort((a, b) => {
                    // Sort by BAFO amount (lowest first), nulls last
                    if (!a.bafo_amount && !b.bafo_amount) return 0;
                    if (!a.bafo_amount) return 1;
                    if (!b.bafo_amount) return -1;
                    return parseFloat(a.bafo_amount) - parseFloat(b.bafo_amount);
                  })
                  .map((invitation, index) => (
                    <div
                      key={invitation.id}
                      className={cn(
                        'p-4 rounded-lg border',
                        invitation.bafo_amount ? 'bg-white' : 'bg-neutral-50',
                        index === 0 && invitation.bafo_amount && currentRound.status === 'CLOSED' &&
                          'border-emerald-300 bg-emerald-50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full',
                            invitation.bafo_amount
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-neutral-200 text-neutral-500'
                          )}>
                            {invitation.bafo_amount ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-neutral-900 flex items-center gap-2">
                              {invitation.supplier_name}
                              {index === 0 && invitation.bafo_amount && currentRound.status === 'CLOSED' && (
                                <Trophy className="h-4 w-4 text-amber-500" />
                              )}
                            </p>
                            <p className="text-xs text-neutral-500">
                              Original: {formatCurrency(invitation.original_amount)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          {invitation.bafo_amount ? (
                            <>
                              <p className="font-bold text-lg text-emerald-600">
                                {formatCurrency(invitation.bafo_amount)}
                              </p>
                              {invitation.submitted_at && (
                                <p className="text-xs text-neutral-500">
                                  Submitted {formatDistanceToNow(new Date(invitation.submitted_at), { addSuffix: true })}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-amber-600 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {invitation.notes && (
                        <p className="mt-2 text-sm text-neutral-600 border-t pt-2">
                          {invitation.notes}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            {/* Actions */}
            {isOwner && (
              <div className="flex items-center gap-2 pt-4 border-t">
                {currentRound.status === 'ACTIVE' && (
                  <Button
                    variant="outline"
                    onClick={() => setCloseDialogOpen(true)}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Close BAFO Round
                  </Button>
                )}

                {currentRound.status === 'CLOSED' && (
                  <Button
                    onClick={() => {
                      const bestOffer = currentRound.invitations
                        .filter(i => i.bafo_amount)
                        .sort((a, b) => parseFloat(a.bafo_amount!) - parseFloat(b.bafo_amount!))[0];
                      if (bestOffer) {
                        setSelectedProposalId(bestOffer.proposal_id);
                        setAwardDialogOpen(true);
                      }
                    }}
                    disabled={currentRound.invitations.filter(i => i.bafo_amount).length === 0}
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    Award Contract
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Previous Rounds Summary */}
        {previousRounds.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-medium text-neutral-700 mb-3">Previous Rounds</h4>
            <div className="space-y-2">
              {previousRounds.map((round) => {
                const config = statusConfig[round.status];
                return (
                  <div
                    key={round.id}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900">Round {round.round_number}</span>
                      <span className={cn(
                        'px-2 py-0.5 text-xs font-medium rounded-full',
                        config.bgColor,
                        config.color
                      )}>
                        {config.label}
                      </span>
                    </div>
                    <span className="text-sm text-neutral-500">
                      {round.closed_at && format(new Date(round.closed_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      {/* Start BAFO Dialog */}
      <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Start BAFO Round {roundNumber}</DialogTitle>
            <DialogDescription>
              Invite shortlisted suppliers to submit their best and final offer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Deadline */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Submission Deadline
              </label>
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              />
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Instructions for Suppliers
              </label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Provide any specific instructions or requirements for the BAFO submission..."
                rows={3}
              />
            </div>

            {/* Supplier Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">
                Invite Suppliers ({selectedSuppliers.size} selected)
              </label>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                {shortlistedProposals.map((proposal) => (
                  <label
                    key={proposal.id}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-neutral-50',
                      selectedSuppliers.has(proposal.supplier_id) && 'bg-primary-50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSuppliers.has(proposal.supplier_id)}
                      onChange={() => toggleSupplier(proposal.supplier_id)}
                      className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-900">
                        {proposal.supplier_name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Current: {formatCurrency(proposal.proposed_amount)} | Score: {proposal.weighted_score}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStartDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStartBAFO}
              disabled={!deadline || selectedSuppliers.size < 2 || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start BAFO
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close BAFO Confirmation */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close BAFO Round?</AlertDialogTitle>
            <AlertDialogDescription>
              This will end the BAFO round. Suppliers will no longer be able to submit offers.
              You can then proceed to award the contract based on the submissions received.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseBAFO} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Close Round'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Award Confirmation */}
      <AlertDialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Award Contract?</AlertDialogTitle>
            <AlertDialogDescription>
              This will award the contract based on the BAFO submissions.
              This action will notify all suppliers of the outcome.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAward} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trophy className="h-4 w-4 mr-2" />
                  Confirm Award
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default BAFOPanel;
