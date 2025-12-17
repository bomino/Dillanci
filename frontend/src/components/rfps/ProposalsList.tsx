import * as React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  FileText,
  Building2,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Star,
  Trophy,
  Eye,
  Download,
  MoreHorizontal,
  Filter,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

export type ProposalStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'SHORTLISTED' | 'AWARDED' | 'NOT_AWARDED' | 'WITHDRAWN';

export interface Proposal {
  id: string;
  rfp_id: string;
  supplier_id: string;
  supplier_name: string;
  proposed_amount: string;
  executive_summary: string | null;
  technical_score: number | null;
  financial_score: number | null;
  weighted_score: number | null;
  status: ProposalStatus;
  submitted_at: string | null;
  created_at: string;
  documents_count: number;
}

interface ProposalsListProps {
  proposals: Proposal[];
  onViewProposal: (proposalId: string) => void;
  onShortlistProposal: (proposalId: string) => Promise<void>;
  onRejectProposal: (proposalId: string) => Promise<void>;
  onDownloadDocuments: (proposalId: string) => void;
  isOwner?: boolean;
  className?: string;
}

const statusConfig: Record<ProposalStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  DRAFT: { label: 'Draft', color: 'text-neutral-600', bgColor: 'bg-neutral-100', icon: Clock },
  SUBMITTED: { label: 'Submitted', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: FileText },
  UNDER_REVIEW: { label: 'Under Review', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: Eye },
  SHORTLISTED: { label: 'Shortlisted', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: Star },
  AWARDED: { label: 'Awarded', color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: Trophy },
  NOT_AWARDED: { label: 'Not Awarded', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
  WITHDRAWN: { label: 'Withdrawn', color: 'text-neutral-500', bgColor: 'bg-neutral-100', icon: XCircle },
};

export function ProposalsList({
  proposals,
  onViewProposal,
  onShortlistProposal,
  onRejectProposal,
  onDownloadDocuments,
  isOwner = false,
  className,
}: ProposalsListProps) {
  const [filter, setFilter] = React.useState<'all' | ProposalStatus>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'date' | 'amount' | 'score'>('date');

  // Filter and search proposals
  const filteredProposals = React.useMemo(() => {
    let result = [...proposals];

    // Apply status filter
    if (filter !== 'all') {
      result = result.filter(p => p.status === filter);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.supplier_name.toLowerCase().includes(query) ||
        p.executive_summary?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return parseFloat(a.proposed_amount) - parseFloat(b.proposed_amount);
        case 'score':
          return (b.weighted_score || 0) - (a.weighted_score || 0);
        case 'date':
        default:
          const dateA = a.submitted_at ? new Date(a.submitted_at) : new Date(a.created_at);
          const dateB = b.submitted_at ? new Date(b.submitted_at) : new Date(b.created_at);
          return dateB.getTime() - dateA.getTime();
      }
    });

    return result;
  }, [proposals, filter, searchQuery, sortBy]);

  // Count by status
  const counts = React.useMemo(() => {
    const result: Record<string, number> = { all: proposals.length };
    for (const status of Object.keys(statusConfig)) {
      result[status] = proposals.filter(p => p.status === status).length;
    }
    return result;
  }, [proposals]);

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  // Summary stats
  const stats = React.useMemo(() => {
    const submitted = proposals.filter(p => p.status !== 'DRAFT' && p.status !== 'WITHDRAWN');
    const amounts = submitted.map(p => parseFloat(p.proposed_amount));
    return {
      total: proposals.length,
      submitted: submitted.length,
      shortlisted: proposals.filter(p => p.status === 'SHORTLISTED' || p.status === 'AWARDED').length,
      avgAmount: amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0,
      minAmount: amounts.length > 0 ? Math.min(...amounts) : 0,
      maxAmount: amounts.length > 0 ? Math.max(...amounts) : 0,
    };
  }, [proposals]);

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Proposals
            <Badge variant="secondary" className="ml-2">
              {proposals.length} received
            </Badge>
          </CardTitle>
        </div>

        {/* Stats Row */}
        {proposals.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 p-4 bg-neutral-50 rounded-lg">
            <div>
              <p className="text-xs text-neutral-500">Submitted</p>
              <p className="text-lg font-bold text-neutral-900">{stats.submitted}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Shortlisted</p>
              <p className="text-lg font-bold text-amber-600">{stats.shortlisted}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Lowest Bid</p>
              <p className="text-lg font-bold text-emerald-600">
                {stats.minAmount > 0 ? formatCurrency(stats.minAmount.toString()) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Highest Bid</p>
              <p className="text-lg font-bold text-neutral-900">
                {stats.maxAmount > 0 ? formatCurrency(stats.maxAmount.toString()) : '-'}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search by supplier name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({counts.all})</SelectItem>
              <SelectItem value="SUBMITTED">Submitted ({counts.SUBMITTED})</SelectItem>
              <SelectItem value="UNDER_REVIEW">Under Review ({counts.UNDER_REVIEW})</SelectItem>
              <SelectItem value="SHORTLISTED">Shortlisted ({counts.SHORTLISTED})</SelectItem>
              <SelectItem value="AWARDED">Awarded ({counts.AWARDED})</SelectItem>
              <SelectItem value="NOT_AWARDED">Not Awarded ({counts.NOT_AWARDED})</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Newest First</SelectItem>
              <SelectItem value="amount">Lowest Price</SelectItem>
              <SelectItem value="score">Highest Score</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {filteredProposals.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-10 w-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-neutral-500 text-sm">
              {proposals.length === 0
                ? 'No proposals have been submitted yet'
                : 'No proposals match your filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Submitted</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProposals.map((proposal, index) => {
                  const config = statusConfig[proposal.status];
                  const StatusIcon = config.icon;
                  const isLowestBid = proposal.proposed_amount === stats.minAmount.toString();

                  return (
                    <TableRow
                      key={proposal.id}
                      className={cn(
                        'cursor-pointer hover:bg-neutral-50',
                        proposal.status === 'AWARDED' && 'bg-emerald-50/50',
                        proposal.status === 'SHORTLISTED' && 'bg-amber-50/50'
                      )}
                      onClick={() => onViewProposal(proposal.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                            <Building2 className="h-5 w-5 text-primary-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-neutral-900">
                                {proposal.supplier_name}
                              </p>
                              {proposal.status === 'AWARDED' && (
                                <Trophy className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                            {proposal.executive_summary && (
                              <p className="text-xs text-neutral-500 line-clamp-1 max-w-[300px]">
                                {proposal.executive_summary}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={cn(
                            'font-bold',
                            isLowestBid ? 'text-emerald-600' : 'text-neutral-900'
                          )}>
                            {formatCurrency(proposal.proposed_amount)}
                          </span>
                          {isLowestBid && (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-xs">
                              Lowest
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {proposal.weighted_score !== null ? (
                          <div className="inline-flex items-center gap-1">
                            <span className={cn(
                              'font-bold',
                              proposal.weighted_score >= 80 ? 'text-emerald-600' :
                                proposal.weighted_score >= 60 ? 'text-amber-600' :
                                  'text-red-600'
                            )}>
                              {proposal.weighted_score}
                            </span>
                            <span className="text-xs text-neutral-400">/100</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full',
                          config.bgColor,
                          config.color
                        )}>
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {proposal.submitted_at ? (
                          <span className="text-sm text-neutral-500">
                            {format(new Date(proposal.submitted_at), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewProposal(proposal.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {proposal.documents_count > 0 && (
                              <DropdownMenuItem onClick={() => onDownloadDocuments(proposal.id)}>
                                <Download className="mr-2 h-4 w-4" />
                                Download Documents ({proposal.documents_count})
                              </DropdownMenuItem>
                            )}

                            {isOwner && ['SUBMITTED', 'UNDER_REVIEW'].includes(proposal.status) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onShortlistProposal(proposal.id)}
                                  className="text-amber-600"
                                >
                                  <Star className="mr-2 h-4 w-4" />
                                  Shortlist
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onRejectProposal(proposal.id)}
                                  className="text-red-600"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject
                                </DropdownMenuItem>
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
