import { useState, useMemo } from 'react';
import {
  FileText,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Star,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Handshake,
  Send,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { Proposal, ProposalStatus } from '@/types';

// Re-export types for external use
export type { ProposalStatus, Proposal };

// Status configuration
const PROPOSAL_STATUS_CONFIG: Record<
  ProposalStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  SUBMITTED: {
    label: 'Submitted',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <Send className="h-3.5 w-3.5" />,
  },
  SHORTLISTED: {
    label: 'Shortlisted',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <Star className="h-3.5 w-3.5" />,
  },
  BAFO_REQUESTED: {
    label: 'BAFO Requested',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Handshake className="h-3.5 w-3.5" />,
  },
  BAFO_SUBMITTED: {
    label: 'BAFO Submitted',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  AWARDED: {
    label: 'Awarded',
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: <Award className="h-3.5 w-3.5" />,
  },
  NOT_AWARDED: {
    label: 'Not Awarded',
    color: 'bg-neutral-100 text-neutral-600 border-neutral-200',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  DISQUALIFIED: {
    label: 'Disqualified',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: <Ban className="h-3.5 w-3.5" />,
  },
};

// Compliance status for mandatory attachments
interface ComplianceInfo {
  required: number;
  submitted: number;
  isCompliant: boolean;
}

interface ProposalsListProps {
  rfpId: string;
  proposals: Proposal[];
  isLoading?: boolean;
  onViewProposal?: (proposal: Proposal) => void;
  onShortlistProposal?: (proposalId: string) => Promise<void>;
  onRequestBAFO?: (proposalId: string) => Promise<void>;
  onDisqualifyProposal?: (proposalId: string, reason: string) => Promise<void>;
  onAwardProposal?: (proposalId: string) => Promise<void>;
  // Compliance tracking
  mandatoryAttachmentCount?: number;
  getProposalAttachmentCount?: (proposalId: string) => number;
}

type SortField = 'supplier' | 'submitted_at' | 'overall_score' | 'rank' | 'total_amount';
type SortDirection = 'asc' | 'desc';

export function ProposalsList({
  rfpId: _rfpId,
  proposals,
  isLoading = false,
  onViewProposal,
  onShortlistProposal,
  onRequestBAFO,
  onDisqualifyProposal,
  onAwardProposal,
  mandatoryAttachmentCount = 0,
  getProposalAttachmentCount,
}: ProposalsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<SortField>('submitted_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Calculate compliance for each proposal
  const getComplianceInfo = (proposalId: string): ComplianceInfo => {
    const submitted = getProposalAttachmentCount?.(proposalId) ?? mandatoryAttachmentCount;
    return {
      required: mandatoryAttachmentCount,
      submitted,
      isCompliant: submitted >= mandatoryAttachmentCount,
    };
  };

  // Filter and sort proposals
  const filteredProposals = useMemo(() => {
    let result = [...proposals];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.supplier_name.toLowerCase().includes(query) ||
          p.proposal_number.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'supplier':
          comparison = a.supplier_name.localeCompare(b.supplier_name);
          break;
        case 'submitted_at':
          comparison = (a.submitted_at ?? '').localeCompare(b.submitted_at ?? '');
          break;
        case 'overall_score':
          comparison = parseFloat(a.overall_score ?? '0') - parseFloat(b.overall_score ?? '0');
          break;
        case 'rank':
          comparison = (a.rank ?? 999) - (b.rank ?? 999);
          break;
        case 'total_amount':
          comparison = parseFloat(a.total_amount) - parseFloat(b.total_amount);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [proposals, searchQuery, statusFilter, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-neutral-400" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5 text-primary-600" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-primary-600" />
    );
  };

  const formatCurrency = (amount: string | null | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAction = async (
    action: () => Promise<void>,
    successMessage: string,
    errorMessage: string
  ) => {
    try {
      await action();
      toast.success(successMessage);
    } catch (error) {
      console.error('Action failed:', error);
      toast.error(errorMessage);
    }
  };

  // Summary statistics
  const stats = useMemo(() => {
    const total = proposals.length;
    const submitted = proposals.filter((p) => p.status === 'SUBMITTED').length;
    const shortlisted = proposals.filter((p) => p.status === 'SHORTLISTED').length;
    const compliant = proposals.filter((p) => getComplianceInfo(p.id).isCompliant).length;

    return { total, submitted, shortlisted, compliant };
  }, [proposals]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-neutral-500">
            <Clock className="h-8 w-8 animate-spin mb-3" />
            <p>Loading proposals...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary-600" />
              Proposals
              {proposals.length > 0 && (
                <Badge variant="default" className="ml-2 text-xs">
                  {proposals.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Review and evaluate submitted proposals
            </CardDescription>
          </div>

          {/* Summary badges */}
          {proposals.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs">
                      {stats.submitted} submitted
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Proposals awaiting evaluation</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-xs border-purple-200 text-purple-700 bg-purple-50"
                    >
                      {stats.shortlisted} shortlisted
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Proposals moved to shortlist</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {mandatoryAttachmentCount > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          stats.compliant === stats.total
                            ? 'border-green-200 text-green-700 bg-green-50'
                            : 'border-amber-200 text-amber-700 bg-amber-50'
                        }`}
                      >
                        {stats.compliant}/{stats.total} compliant
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Proposals with all {mandatoryAttachmentCount} required attachments
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        {proposals.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <Input
              placeholder="Search by supplier or proposal number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as ProposalStatus | 'ALL')}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {Object.entries(PROPOSAL_STATUS_CONFIG).map(([status, config]) => (
                  <SelectItem key={status} value={status}>
                    <span className="flex items-center gap-2">
                      {config.icon}
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Empty state */}
        {filteredProposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-neutral-300 mb-3" />
            {proposals.length === 0 ? (
              <>
                <p className="text-neutral-500 font-medium">No proposals received yet</p>
                <p className="text-sm text-neutral-400 mt-1">
                  Proposals will appear here once suppliers submit them
                </p>
              </>
            ) : (
              <>
                <p className="text-neutral-500 font-medium">No matching proposals</p>
                <p className="text-sm text-neutral-400 mt-1">
                  Try adjusting your search or filter criteria
                </p>
              </>
            )}
          </div>
        ) : (
          /* Proposals table */
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-50">
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1.5 hover:text-primary-600 transition-colors"
                      onClick={() => toggleSort('supplier')}
                    >
                      Supplier
                      {getSortIcon('supplier')}
                    </button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1.5 hover:text-primary-600 transition-colors"
                      onClick={() => toggleSort('submitted_at')}
                    >
                      Submitted
                      {getSortIcon('submitted_at')}
                    </button>
                  </TableHead>
                  <TableHead className="text-center">
                    <button
                      className="flex items-center gap-1.5 hover:text-primary-600 transition-colors justify-center"
                      onClick={() => toggleSort('overall_score')}
                    >
                      Score
                      {getSortIcon('overall_score')}
                    </button>
                  </TableHead>
                  <TableHead className="text-center">
                    <button
                      className="flex items-center gap-1.5 hover:text-primary-600 transition-colors justify-center"
                      onClick={() => toggleSort('rank')}
                    >
                      Rank
                      {getSortIcon('rank')}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      className="flex items-center gap-1.5 hover:text-primary-600 transition-colors justify-end"
                      onClick={() => toggleSort('total_amount')}
                    >
                      Total Amount
                      {getSortIcon('total_amount')}
                    </button>
                  </TableHead>
                  {mandatoryAttachmentCount > 0 && (
                    <TableHead className="text-center">Compliance</TableHead>
                  )}
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProposals.map((proposal, index) => {
                  const statusConfig = PROPOSAL_STATUS_CONFIG[proposal.status];
                  const compliance = getComplianceInfo(proposal.id);

                  return (
                    <TableRow
                      key={proposal.id}
                      className={`hover:bg-neutral-50 ${
                        proposal.status === 'AWARDED' ? 'bg-green-50/50' : ''
                      }`}
                    >
                      <TableCell className="text-center font-medium text-neutral-500">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-neutral-900">{proposal.supplier_name}</p>
                          <p className="text-xs text-neutral-500">{proposal.proposal_number}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusConfig.color} border`}>
                          <span className="flex items-center gap-1.5">
                            {statusConfig.icon}
                            {statusConfig.label}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-neutral-600">
                          {formatDate(proposal.submitted_at)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {proposal.overall_score ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={`font-semibold ${
                                    parseFloat(proposal.overall_score) >= 80
                                      ? 'text-green-600'
                                      : parseFloat(proposal.overall_score) >= 60
                                        ? 'text-amber-600'
                                        : 'text-red-600'
                                  }`}
                                >
                                  {parseFloat(proposal.overall_score).toFixed(1)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  <p>Technical: {proposal.technical_score ?? '-'}</p>
                                  <p>Management: {proposal.management_score ?? '-'}</p>
                                  <p>Pricing: {proposal.pricing_score ?? '-'}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {proposal.rank ? (
                          <Badge
                            variant={proposal.rank === 1 ? 'default' : 'outline'}
                            className={
                              proposal.rank === 1
                                ? 'bg-amber-500 text-white border-amber-500'
                                : proposal.rank === 2
                                  ? 'border-neutral-300 text-neutral-600'
                                  : proposal.rank === 3
                                    ? 'border-amber-700 text-amber-700 bg-amber-50'
                                    : ''
                            }
                          >
                            #{proposal.rank}
                          </Badge>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">{formatCurrency(proposal.total_amount)}</span>
                      </TableCell>
                      {mandatoryAttachmentCount > 0 && (
                        <TableCell className="text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className={
                                    compliance.isCompliant
                                      ? 'border-green-200 text-green-700 bg-green-50'
                                      : 'border-red-200 text-red-700 bg-red-50'
                                  }
                                >
                                  {compliance.isCompliant ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5 mr-1" />
                                  )}
                                  {compliance.submitted}/{compliance.required}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {compliance.isCompliant
                                  ? 'All mandatory attachments submitted'
                                  : `Missing ${compliance.required - compliance.submitted} required attachment(s)`}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      )}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewProposal?.(proposal)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>

                            {proposal.status === 'SUBMITTED' && (
                              <>
                                <DropdownMenuSeparator />
                                {onShortlistProposal && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleAction(
                                        () => onShortlistProposal(proposal.id),
                                        'Proposal shortlisted',
                                        'Failed to shortlist proposal'
                                      )
                                    }
                                  >
                                    <Star className="h-4 w-4 mr-2" />
                                    Add to Shortlist
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}

                            {(proposal.status === 'SUBMITTED' ||
                              proposal.status === 'SHORTLISTED') && (
                              <>
                                {onRequestBAFO && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleAction(
                                        () => onRequestBAFO(proposal.id),
                                        'BAFO request sent',
                                        'Failed to request BAFO'
                                      )
                                    }
                                  >
                                    <Handshake className="h-4 w-4 mr-2" />
                                    Request BAFO
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}

                            {(proposal.status === 'SHORTLISTED' ||
                              proposal.status === 'BAFO_SUBMITTED') && (
                              <>
                                {onAwardProposal && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleAction(
                                        () => onAwardProposal(proposal.id),
                                        'Proposal awarded',
                                        'Failed to award proposal'
                                      )
                                    }
                                    className="text-green-600"
                                  >
                                    <Award className="h-4 w-4 mr-2" />
                                    Award Contract
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}

                            {proposal.status !== 'DISQUALIFIED' &&
                              proposal.status !== 'AWARDED' &&
                              proposal.status !== 'NOT_AWARDED' && (
                                <>
                                  <DropdownMenuSeparator />
                                  {onDisqualifyProposal && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        const reason = prompt('Enter disqualification reason:');
                                        if (reason) {
                                          handleAction(
                                            () => onDisqualifyProposal(proposal.id, reason),
                                            'Proposal disqualified',
                                            'Failed to disqualify proposal'
                                          );
                                        }
                                      }}
                                      className="text-red-600"
                                    >
                                      <Ban className="h-4 w-4 mr-2" />
                                      Disqualify
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProposalsList;
