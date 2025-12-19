import { useState, useMemo } from 'react';
import {
  Repeat,
  Plus,
  Calendar,
  Clock,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  FileText,
  ChevronDown,
  ChevronUp,
  Trophy,
  Building2,
  MoreVertical,
  Play,
  Square,
  Edit2,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Timer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, formatCurrency, formatDateTime, formatRelativeTime } from '@/lib/utils';

// Types for export
export type BAFORoundStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type BAFOResponseStatus = 'PENDING' | 'DRAFT' | 'SUBMITTED';

export interface BAFOResponse {
  id: string;
  bafo_round_id: string;
  proposal_id: string;
  supplier_id: string;
  supplier_name: string;
  status: BAFOResponseStatus;
  original_amount: string | null;
  revised_amount: string | null;
  response_data: Record<string, unknown> | null;
  notes: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface BAFOInvitation {
  id: string;
  proposal_id: string;
  supplier_id: string;
  supplier_name: string;
  original_amount: string | null;
  bafo_amount: string | null;
  submitted_at: string | null;
  notes: string | null;
}

export interface BAFORound {
  id: string;
  rfp_id: string;
  round_number: number;
  status: BAFORoundStatus;
  opened_at: string | null;
  deadline: string | null;
  closed_at: string | null;
  instructions: string;
  focus_areas: string[] | null;
  responses: BAFOResponse[];
  created_at: string;
  created_by_name?: string;
}

export interface ShortlistedProposal {
  id: string;
  supplier_id: string;
  supplier_name: string;
  proposed_amount: string | null;
  weighted_score: number;
  technical_score?: number;
  pricing_score?: number;
}

interface BAFOPanelProps {
  rfpId: string;
  currentRound: BAFORound | null;
  previousRounds: BAFORound[];
  shortlistedProposals: ShortlistedProposal[];
  onStartBAFO?: (deadline: string, instructions: string, focusAreas: string[], invitedProposalIds: string[]) => Promise<void>;
  onOpenBAFO?: (roundId: string) => Promise<void>;
  onCloseBAFO?: (roundId: string) => Promise<void>;
  onUpdateBAFO?: (roundId: string, deadline: string, instructions: string, focusAreas: string[]) => Promise<void>;
  onAwardFromBAFO?: (proposalId: string) => Promise<void>;
  onViewResponse?: (response: BAFOResponse) => void;
  isOwner?: boolean;
  isLoading?: boolean;
  rfpStatus?: string;
}

const FOCUS_AREA_OPTIONS = [
  { value: 'pricing', label: 'Pricing', description: 'Request final pricing adjustments' },
  { value: 'delivery', label: 'Delivery Timeline', description: 'Negotiate delivery schedules' },
  { value: 'payment', label: 'Payment Terms', description: 'Discuss payment arrangements' },
  { value: 'warranty', label: 'Warranty/Support', description: 'Clarify warranty terms' },
  { value: 'scope', label: 'Scope Modifications', description: 'Adjust scope of work' },
  { value: 'technical', label: 'Technical Clarifications', description: 'Address technical concerns' },
];

export function BAFOPanel({
  rfpId: _rfpId,
  currentRound,
  previousRounds,
  shortlistedProposals,
  onStartBAFO,
  onOpenBAFO,
  onCloseBAFO,
  onUpdateBAFO,
  onAwardFromBAFO,
  onViewResponse,
  isOwner = false,
  isLoading = false,
  rfpStatus = 'EVALUATION',
}: BAFOPanelProps) {
  // State
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set([currentRound?.id || '']));
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(
    new Set(shortlistedProposals.map(p => p.id))
  );

  // Create BAFO dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);

  // Edit BAFO dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRound, setEditingRound] = useState<BAFORound | null>(null);

  // Close confirmation
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [roundToClose, setRoundToClose] = useState<string | null>(null);

  // Award confirmation
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [proposalToAward, setProposalToAward] = useState<{ id: string; supplierName: string } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Computed values
  const totalRounds = (currentRound ? 1 : 0) + previousRounds.length;
  const allRounds = currentRound ? [currentRound, ...previousRounds] : previousRounds;

  // Stats for current round
  const currentRoundStats = useMemo(() => {
    if (!currentRound) return null;

    const responses = currentRound.responses || [];
    const totalInvited = shortlistedProposals.length;
    const submitted = responses.filter(r => r.status === 'SUBMITTED').length;
    const pending = totalInvited - submitted;

    // Calculate price changes
    const priceChanges = responses
      .filter(r => r.original_amount && r.revised_amount)
      .map(r => {
        const original = parseFloat(r.original_amount!);
        const revised = parseFloat(r.revised_amount!);
        return ((revised - original) / original) * 100;
      });

    const avgPriceChange = priceChanges.length > 0
      ? priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length
      : 0;

    return {
      totalInvited,
      submitted,
      pending,
      responseRate: totalInvited > 0 ? (submitted / totalInvited) * 100 : 0,
      avgPriceChange,
    };
  }, [currentRound, shortlistedProposals]);

  // Time remaining for current round
  const timeRemaining = useMemo(() => {
    if (!currentRound?.deadline || currentRound.status !== 'OPEN') return null;
    const deadline = new Date(currentRound.deadline);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return 'Less than 1 hour';
  }, [currentRound]);

  // Toggle round expansion
  const toggleRoundExpanded = (roundId: string) => {
    const newExpanded = new Set(expandedRounds);
    if (newExpanded.has(roundId)) {
      newExpanded.delete(roundId);
    } else {
      newExpanded.add(roundId);
    }
    setExpandedRounds(newExpanded);
  };

  // Toggle proposal selection
  const toggleProposalSelection = (proposalId: string) => {
    const newSelected = new Set(selectedProposals);
    if (newSelected.has(proposalId)) {
      newSelected.delete(proposalId);
    } else {
      newSelected.add(proposalId);
    }
    setSelectedProposals(newSelected);
  };

  // Toggle focus area
  const toggleFocusArea = (area: string) => {
    setFocusAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  // Open create dialog
  const openCreateDialog = () => {
    // Set default deadline to 7 days from now
    const defaultDeadline = new Date();
    defaultDeadline.setDate(defaultDeadline.getDate() + 7);
    setDeadline(defaultDeadline.toISOString().slice(0, 16));
    setInstructions('');
    setFocusAreas([]);
    setSelectedProposals(new Set(shortlistedProposals.map(p => p.id)));
    setCreateDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (round: BAFORound) => {
    setEditingRound(round);
    setDeadline(round.deadline ? new Date(round.deadline).toISOString().slice(0, 16) : '');
    setInstructions(round.instructions || '');
    setFocusAreas(round.focus_areas || []);
    setEditDialogOpen(true);
  };

  // Create BAFO round
  const handleCreateBAFO = async () => {
    if (!onStartBAFO || !deadline || selectedProposals.size === 0) return;

    setIsSubmitting(true);
    try {
      await onStartBAFO(deadline, instructions, focusAreas, Array.from(selectedProposals));
      setCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create BAFO round:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update BAFO round
  const handleUpdateBAFO = async () => {
    if (!onUpdateBAFO || !editingRound || !deadline) return;

    setIsSubmitting(true);
    try {
      await onUpdateBAFO(editingRound.id, deadline, instructions, focusAreas);
      setEditDialogOpen(false);
      setEditingRound(null);
    } catch (error) {
      console.error('Failed to update BAFO round:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open BAFO round
  const handleOpenBAFO = async (roundId: string) => {
    if (!onOpenBAFO) return;

    setIsSubmitting(true);
    try {
      await onOpenBAFO(roundId);
    } catch (error) {
      console.error('Failed to open BAFO round:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close BAFO round
  const handleCloseBAFO = async () => {
    if (!onCloseBAFO || !roundToClose) return;

    setIsSubmitting(true);
    try {
      await onCloseBAFO(roundToClose);
      setCloseDialogOpen(false);
      setRoundToClose(null);
    } catch (error) {
      console.error('Failed to close BAFO round:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Award from BAFO
  const handleAward = async () => {
    if (!onAwardFromBAFO || !proposalToAward) return;

    setIsSubmitting(true);
    try {
      await onAwardFromBAFO(proposalToAward.id);
      setAwardDialogOpen(false);
      setProposalToAward(null);
    } catch (error) {
      console.error('Failed to award from BAFO:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: BAFORoundStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <Badge variant="outline" className="bg-neutral-50 text-neutral-700">
            <FileText className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case 'OPEN':
        return (
          <Badge variant="default" className="bg-green-100 text-green-700">
            <Play className="h-3 w-3 mr-1" />
            Open
          </Badge>
        );
      case 'CLOSED':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            <Square className="h-3 w-3 mr-1" />
            Closed
          </Badge>
        );
    }
  };

  // Get response status badge
  const getResponseStatusBadge = (status: BAFOResponseStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'DRAFT':
        return (
          <Badge variant="outline" className="bg-neutral-50 text-neutral-700">
            <Edit2 className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case 'SUBMITTED':
        return (
          <Badge variant="default" className="bg-green-100 text-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Submitted
          </Badge>
        );
    }
  };

  // Can manage BAFO based on RFP status
  const canManageBAFO = isOwner && ['EVALUATION', 'BAFO'].includes(rfpStatus);
  const canCreateBAFO = canManageBAFO && shortlistedProposals.length > 0 && (!currentRound || currentRound.status === 'CLOSED');
  const canAward = canManageBAFO && currentRound?.status === 'CLOSED';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
            <p className="mt-4 text-neutral-500">Loading BAFO data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-primary-600" />
                BAFO Management
              </CardTitle>
              <CardDescription>
                Best and Final Offer round management
              </CardDescription>
            </div>
            {canCreateBAFO && (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                New BAFO Round
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Stats for current round */}
        {currentRound && currentRoundStats && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border bg-neutral-50">
                <div className="flex items-center gap-2 text-neutral-500 mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Invited</span>
                </div>
                <p className="text-2xl font-bold text-neutral-900">{currentRoundStats.totalInvited}</p>
              </div>
              <div className="p-3 rounded-lg border bg-green-50">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs">Submitted</span>
                </div>
                <p className="text-2xl font-bold text-green-700">{currentRoundStats.submitted}</p>
              </div>
              <div className="p-3 rounded-lg border bg-amber-50">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Pending</span>
                </div>
                <p className="text-2xl font-bold text-amber-700">{currentRoundStats.pending}</p>
              </div>
              <div className="p-3 rounded-lg border bg-blue-50">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs">Avg. Change</span>
                </div>
                <p className={cn(
                  'text-2xl font-bold',
                  currentRoundStats.avgPriceChange < 0 ? 'text-green-700' : currentRoundStats.avgPriceChange > 0 ? 'text-red-700' : 'text-neutral-700'
                )}>
                  {currentRoundStats.avgPriceChange < 0 ? '-' : currentRoundStats.avgPriceChange > 0 ? '+' : ''}
                  {Math.abs(currentRoundStats.avgPriceChange).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Response progress */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-neutral-600">Response Progress</span>
                <span className="font-medium">{currentRoundStats.responseRate.toFixed(0)}%</span>
              </div>
              <Progress value={currentRoundStats.responseRate} className="h-2" />
            </div>

            {/* Time remaining */}
            {timeRemaining && currentRound.status === 'OPEN' && (
              <div className={cn(
                'mt-4 p-3 rounded-lg flex items-center gap-2',
                timeRemaining === 'Expired' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
              )}>
                <Timer className="h-4 w-4" />
                <span className="text-sm font-medium">{timeRemaining}</span>
                {currentRound.deadline && (
                  <span className="text-xs ml-auto">
                    Deadline: {formatDateTime(currentRound.deadline)}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* No BAFO rounds yet */}
      {allRounds.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Repeat className="h-12 w-12 text-neutral-300 mb-3" />
              <p className="text-neutral-500 font-medium">No BAFO Rounds</p>
              <p className="text-sm text-neutral-400 mt-1">
                {shortlistedProposals.length > 0
                  ? 'Start a BAFO round to request final offers from shortlisted vendors.'
                  : 'Shortlist proposals first to start a BAFO round.'}
              </p>
              {canCreateBAFO && (
                <Button onClick={openCreateDialog} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Start BAFO Round
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BAFO Rounds List */}
      {allRounds.map((round) => {
        const isExpanded = expandedRounds.has(round.id);
        const responses = round.responses || [];

        return (
          <Card key={round.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleRoundExpanded(round.id)}
                    className="p-1 hover:bg-neutral-100 rounded"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-neutral-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-neutral-400" />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        Round {round.round_number}
                      </CardTitle>
                      {getStatusBadge(round.status)}
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                      {round.opened_at && `Opened ${formatRelativeTime(round.opened_at)}`}
                      {round.closed_at && ` • Closed ${formatRelativeTime(round.closed_at)}`}
                    </CardDescription>
                  </div>
                </div>

                {/* Round Actions */}
                {canManageBAFO && (
                  <div className="flex items-center gap-2">
                    {round.status === 'DRAFT' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(round)}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOpenBAFO(round.id)}
                          disabled={isSubmitting}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Open Round
                        </Button>
                      </>
                    )}
                    {round.status === 'OPEN' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRoundToClose(round.id);
                          setCloseDialogOpen(true);
                        }}
                      >
                        <Square className="h-4 w-4 mr-1" />
                        Close Round
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                {/* Instructions */}
                {round.instructions && (
                  <div className="mb-4 p-3 bg-neutral-50 rounded-lg">
                    <p className="text-xs font-medium text-neutral-500 mb-1">Instructions</p>
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">{round.instructions}</p>
                  </div>
                )}

                {/* Focus Areas */}
                {round.focus_areas && round.focus_areas.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-neutral-500 mb-2">Focus Areas</p>
                    <div className="flex flex-wrap gap-2">
                      {round.focus_areas.map((area) => {
                        const option = FOCUS_AREA_OPTIONS.find(o => o.value === area);
                        return (
                          <Badge key={area} variant="outline">
                            {option?.label || area}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Responses Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-neutral-50">
                        <TableHead className="font-medium">Supplier</TableHead>
                        <TableHead className="font-medium">Original Amount</TableHead>
                        <TableHead className="font-medium">BAFO Amount</TableHead>
                        <TableHead className="font-medium">Change</TableHead>
                        <TableHead className="font-medium">Status</TableHead>
                        <TableHead className="font-medium text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {responses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-neutral-500">
                            No responses yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        responses.map((response) => {
                          const originalAmount = response.original_amount ? parseFloat(response.original_amount) : null;
                          const revisedAmount = response.revised_amount ? parseFloat(response.revised_amount) : null;
                          const change = originalAmount && revisedAmount
                            ? ((revisedAmount - originalAmount) / originalAmount) * 100
                            : null;

                          return (
                            <TableRow key={response.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-neutral-400" />
                                  <span className="font-medium">{response.supplier_name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {originalAmount ? formatCurrency(originalAmount) : '-'}
                              </TableCell>
                              <TableCell>
                                {revisedAmount ? (
                                  <span className="font-medium">{formatCurrency(revisedAmount)}</span>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                {change !== null ? (
                                  <div className={cn(
                                    'flex items-center gap-1',
                                    change < 0 ? 'text-green-600' : change > 0 ? 'text-red-600' : 'text-neutral-600'
                                  )}>
                                    {change < 0 ? (
                                      <ArrowDownRight className="h-4 w-4" />
                                    ) : change > 0 ? (
                                      <ArrowUpRight className="h-4 w-4" />
                                    ) : null}
                                    <span className="font-medium">
                                      {change < 0 ? '' : '+'}
                                      {change.toFixed(1)}%
                                    </span>
                                  </div>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                {getResponseStatusBadge(response.status)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {response.status === 'SUBMITTED' && onViewResponse && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onViewResponse(response)}
                                          >
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>View Response</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {canAward && round.status === 'CLOSED' && response.status === 'SUBMITTED' && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              setProposalToAward({
                                                id: response.proposal_id,
                                                supplierName: response.supplier_name,
                                              });
                                              setAwardDialogOpen(true);
                                            }}
                                          >
                                            <Trophy className="h-4 w-4 text-amber-500" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Award to this Supplier</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Create BAFO Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start New BAFO Round</DialogTitle>
            <DialogDescription>
              Request final offers from shortlisted vendors. Round {totalRounds + 1}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Deadline */}
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                Deadline
              </label>
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            {/* Instructions */}
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                Instructions for Vendors
              </label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Provide specific instructions for vendors regarding their final offers..."
                rows={4}
              />
            </div>

            {/* Focus Areas */}
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                Focus Areas
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FOCUS_AREA_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex items-start gap-2 p-3 border rounded-lg cursor-pointer transition-colors',
                      focusAreas.includes(option.value)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-neutral-200 hover:bg-neutral-50'
                    )}
                  >
                    <Checkbox
                      checked={focusAreas.includes(option.value)}
                      onCheckedChange={() => toggleFocusArea(option.value)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900">{option.label}</p>
                      <p className="text-xs text-neutral-500">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Select Proposals */}
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                Invite Shortlisted Vendors ({selectedProposals.size} of {shortlistedProposals.length} selected)
              </label>
              <div className="border rounded-lg max-h-[200px] overflow-auto">
                {shortlistedProposals.map((proposal) => (
                  <label
                    key={proposal.id}
                    className={cn(
                      'flex items-center gap-3 p-3 cursor-pointer border-b last:border-b-0 transition-colors',
                      selectedProposals.has(proposal.id)
                        ? 'bg-primary-50'
                        : 'hover:bg-neutral-50'
                    )}
                  >
                    <Checkbox
                      checked={selectedProposals.has(proposal.id)}
                      onCheckedChange={() => toggleProposalSelection(proposal.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900">{proposal.supplier_name}</p>
                      <p className="text-xs text-neutral-500">
                        Score: {proposal.weighted_score.toFixed(1)} • Amount: {proposal.proposed_amount ? formatCurrency(parseFloat(proposal.proposed_amount)) : '-'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateBAFO}
              disabled={!deadline || selectedProposals.size === 0 || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create BAFO Round'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit BAFO Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit BAFO Round</DialogTitle>
            <DialogDescription>
              Update round {editingRound?.round_number} settings before opening.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Deadline */}
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                Deadline
              </label>
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            {/* Instructions */}
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                Instructions for Vendors
              </label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Provide specific instructions for vendors..."
                rows={4}
              />
            </div>

            {/* Focus Areas */}
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                Focus Areas
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FOCUS_AREA_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex items-start gap-2 p-3 border rounded-lg cursor-pointer transition-colors',
                      focusAreas.includes(option.value)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-neutral-200 hover:bg-neutral-50'
                    )}
                  >
                    <Checkbox
                      checked={focusAreas.includes(option.value)}
                      onCheckedChange={() => toggleFocusArea(option.value)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900">{option.label}</p>
                      <p className="text-xs text-neutral-500">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateBAFO} disabled={!deadline || isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Confirmation Dialog */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close BAFO Round</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close this BAFO round? Vendors will no longer be able to submit responses.
              You can still view all submitted responses and proceed to award.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseBAFO} disabled={isSubmitting}>
              {isSubmitting ? 'Closing...' : 'Close Round'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Award Confirmation Dialog */}
      <AlertDialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Award to Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to award this RFP to <strong>{proposalToAward?.supplierName}</strong>?
              This action will close the RFP and notify all participating vendors.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAward}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              <Trophy className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Awarding...' : 'Confirm Award'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default BAFOPanel;
