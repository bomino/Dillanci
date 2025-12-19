import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Award,
  DollarSign,
  Star,
  TrendingUp,
  TrendingDown,
  Building2,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

import type { Proposal, ScoringCriteria, RFPSection } from '@/types';

interface ComparisonCriterion {
  id: string;
  name: string;
  type: 'section' | 'criteria' | 'pricing' | 'overall';
  weight?: string;
  maxScore?: string;
  parentId?: string | null;
}

interface ProposalComparisonTableProps {
  proposals: Proposal[];
  sections?: RFPSection[];
  criteria?: ScoringCriteria[];
  onViewProposal?: (proposal: Proposal) => void;
  onAwardProposal?: (proposalId: string) => Promise<void>;
}

export function ProposalComparisonTable({
  proposals,
  sections = [],
  criteria = [],
  onViewProposal,
  onAwardProposal,
}: ProposalComparisonTableProps) {
  const [sortBy, setSortBy] = useState<'rank' | 'score' | 'price'>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Sort proposals
  const sortedProposals = useMemo(() => {
    const sorted = [...proposals].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'rank':
          comparison = (a.rank ?? 999) - (b.rank ?? 999);
          break;
        case 'score':
          comparison = parseFloat(b.overall_score ?? '0') - parseFloat(a.overall_score ?? '0');
          break;
        case 'price':
          comparison = parseFloat(a.total_amount) - parseFloat(b.total_amount);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [proposals, sortBy, sortDirection]);

  // Build comparison rows from sections and criteria
  const comparisonRows = useMemo(() => {
    const rows: ComparisonCriterion[] = [];

    // Add overall scores first
    rows.push({
      id: 'overall',
      name: 'Overall Score',
      type: 'overall',
    });
    rows.push({
      id: 'technical',
      name: 'Technical Score',
      type: 'overall',
    });
    rows.push({
      id: 'management',
      name: 'Management Score',
      type: 'overall',
    });
    rows.push({
      id: 'pricing',
      name: 'Pricing Score',
      type: 'overall',
    });

    // Add sections
    sections.forEach((section) => {
      rows.push({
        id: `section-${section.id}`,
        name: section.title,
        type: 'section',
        weight: section.weight,
      });
    });

    // Add criteria
    criteria.forEach((criterion) => {
      rows.push({
        id: `criteria-${criterion.id}`,
        name: criterion.name,
        type: 'criteria',
        weight: criterion.weight,
        maxScore: criterion.max_score,
        parentId: criterion.parent,
      });
    });

    // Add pricing row
    rows.push({
      id: 'total-price',
      name: 'Total Price',
      type: 'pricing',
    });

    return rows;
  }, [sections, criteria]);

  const toggleSort = (field: 'rank' | 'score' | 'price') => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection(field === 'price' ? 'asc' : field === 'score' ? 'desc' : 'asc');
    }
  };

  const toggleProposalSelection = (proposalId: string) => {
    setSelectedProposals((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(proposalId)) {
        newSet.delete(proposalId);
      } else {
        newSet.add(proposalId);
      }
      return newSet;
    });
  };

  const toggleRowExpansion = (rowId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
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

  const getScoreValue = (proposal: Proposal, row: ComparisonCriterion): string | null => {
    switch (row.id) {
      case 'overall':
        return proposal.overall_score;
      case 'technical':
        return proposal.technical_score;
      case 'management':
        return proposal.management_score;
      case 'pricing':
        return proposal.pricing_score;
      case 'total-price':
        return proposal.total_amount;
      default:
        // Look up section scores from proposal.sections
        if (row.type === 'section') {
          const section = proposal.sections?.find(
            (s) => `section-${s.rfp_section}` === row.id || s.section_title === row.name
          );
          return section?.section_score ?? null;
        }
        return null;
    }
  };

  const getScoreColor = (score: number | null, isBest: boolean, isWorst: boolean): string => {
    if (score === null) return 'text-neutral-400';
    if (isBest) return 'text-green-600 font-semibold';
    if (isWorst) return 'text-red-600';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getPriceColor = (_price: number, isBest: boolean, isWorst: boolean): string => {
    if (isBest) return 'text-green-600 font-semibold';
    if (isWorst) return 'text-red-600';
    return 'text-neutral-700';
  };

  // Calculate best/worst for highlighting
  const getRowStats = (row: ComparisonCriterion) => {
    const values = sortedProposals
      .map((p) => {
        const val = getScoreValue(p, row);
        return val ? parseFloat(val) : null;
      })
      .filter((v): v is number => v !== null);

    if (values.length === 0) return { best: null, worst: null, avg: null };

    const isPricing = row.type === 'pricing';
    return {
      best: isPricing ? Math.min(...values) : Math.max(...values),
      worst: isPricing ? Math.max(...values) : Math.min(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    };
  };

  // Filter proposals if any are selected
  const visibleProposals = useMemo(() => {
    if (selectedProposals.size === 0) return sortedProposals;
    return sortedProposals.filter((p) => selectedProposals.has(p.id));
  }, [sortedProposals, selectedProposals]);

  if (proposals.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-neutral-500">
            <Building2 className="h-12 w-12 text-neutral-300 mb-3" />
            <p className="font-medium">No proposals to compare</p>
            <p className="text-sm text-neutral-400 mt-1">
              Shortlist proposals to see them in the comparison table
            </p>
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
              <TrendingUp className="h-5 w-5 text-primary-600" />
              Proposal Comparison
            </CardTitle>
            <CardDescription>
              Side-by-side comparison of {proposals.length} proposals
            </CardDescription>
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">Sort by:</span>
            <Button
              variant={sortBy === 'rank' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => toggleSort('rank')}
            >
              <Award className="h-4 w-4 mr-1" />
              Rank
              {sortBy === 'rank' &&
                (sortDirection === 'asc' ? (
                  <ChevronUp className="h-3 w-3 ml-1" />
                ) : (
                  <ChevronDown className="h-3 w-3 ml-1" />
                ))}
            </Button>
            <Button
              variant={sortBy === 'score' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => toggleSort('score')}
            >
              <Star className="h-4 w-4 mr-1" />
              Score
              {sortBy === 'score' &&
                (sortDirection === 'asc' ? (
                  <ChevronUp className="h-3 w-3 ml-1" />
                ) : (
                  <ChevronDown className="h-3 w-3 ml-1" />
                ))}
            </Button>
            <Button
              variant={sortBy === 'price' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => toggleSort('price')}
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Price
              {sortBy === 'price' &&
                (sortDirection === 'asc' ? (
                  <ChevronUp className="h-3 w-3 ml-1" />
                ) : (
                  <ChevronDown className="h-3 w-3 ml-1" />
                ))}
            </Button>
          </div>
        </div>

        {/* Selection controls */}
        {proposals.length > 2 && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-neutral-500">Compare:</span>
            <div className="flex flex-wrap gap-2">
              {sortedProposals.map((proposal) => (
                <label
                  key={proposal.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                    selectedProposals.size === 0 || selectedProposals.has(proposal.id)
                      ? 'bg-primary-50 border-primary-200'
                      : 'bg-neutral-50 border-neutral-200 opacity-60'
                  }`}
                >
                  <Checkbox
                    checked={selectedProposals.size === 0 || selectedProposals.has(proposal.id)}
                    onCheckedChange={() => toggleProposalSelection(proposal.id)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">{proposal.supplier_name}</span>
                </label>
              ))}
              {selectedProposals.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProposals(new Set())}
                  className="text-xs"
                >
                  Show All
                </Button>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <ScrollArea className="w-full">
          <div className="min-w-[800px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-50">
                  <TableHead className="w-[200px] sticky left-0 bg-neutral-50 z-10">
                    Criteria
                  </TableHead>
                  {visibleProposals.map((proposal) => (
                    <TableHead key={proposal.id} className="text-center min-w-[150px]">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{proposal.supplier_name}</span>
                          {proposal.rank === 1 && (
                            <Badge className="bg-amber-500 text-white text-xs">
                              <Award className="h-3 w-3 mr-1" />
                              #1
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {onViewProposal && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => onViewProposal(proposal)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          )}
                          {onAwardProposal &&
                            (proposal.status === 'SHORTLISTED' ||
                              proposal.status === 'BAFO_SUBMITTED') && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs text-green-600 border-green-200"
                                onClick={() => onAwardProposal(proposal.id)}
                              >
                                <Award className="h-3 w-3 mr-1" />
                                Award
                              </Button>
                            )}
                        </div>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonRows.map((row) => {
                  const stats = getRowStats(row);
                  const isPricing = row.type === 'pricing';
                  const isExpandable =
                    row.type === 'section' &&
                    comparisonRows.some((r) => r.parentId === row.id);

                  return (
                    <TableRow
                      key={row.id}
                      className={`
                        ${row.id === 'overall' ? 'bg-primary-50 font-semibold' : ''}
                        ${row.type === 'section' ? 'bg-neutral-50' : ''}
                      `}
                    >
                      <TableCell className="sticky left-0 bg-inherit z-10">
                        <div className="flex items-center gap-2">
                          {isExpandable && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleRowExpansion(row.id)}
                            >
                              {expandedRows.has(row.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <span
                            className={`
                              ${row.type === 'criteria' && row.parentId ? 'ml-6 text-sm' : ''}
                              ${row.id === 'overall' ? 'font-semibold' : ''}
                            `}
                          >
                            {row.name}
                          </span>
                          {row.weight && (
                            <Badge variant="outline" className="text-xs ml-auto">
                              {parseFloat(row.weight)}%
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {visibleProposals.map((proposal) => {
                        const value = getScoreValue(proposal, row);
                        const numValue = value ? parseFloat(value) : null;
                        const isBest = numValue !== null && numValue === stats.best;
                        const isWorst =
                          numValue !== null && numValue === stats.worst && stats.best !== stats.worst;

                        return (
                          <TableCell key={proposal.id} className="text-center">
                            {isPricing ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className={`font-mono ${getPriceColor(numValue ?? 0, isBest, isWorst)}`}
                                    >
                                      {formatCurrency(value)}
                                      {isBest && (
                                        <TrendingDown className="h-3.5 w-3.5 inline ml-1 text-green-500" />
                                      )}
                                      {isWorst && (
                                        <TrendingUp className="h-3.5 w-3.5 inline ml-1 text-red-500" />
                                      )}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {isBest
                                      ? 'Lowest price'
                                      : isWorst
                                        ? 'Highest price'
                                        : `Avg: ${formatCurrency(stats.avg?.toString())}`}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className={`${getScoreColor(numValue, isBest, isWorst)}`}
                                    >
                                      {numValue?.toFixed(1) ?? '-'}
                                      {isBest && numValue !== null && (
                                        <CheckCircle2 className="h-3.5 w-3.5 inline ml-1 text-green-500" />
                                      )}
                                      {isWorst && numValue !== null && (
                                        <XCircle className="h-3.5 w-3.5 inline ml-1 text-red-500" />
                                      )}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {isBest
                                      ? 'Highest score'
                                      : isWorst
                                        ? 'Lowest score'
                                        : `Avg: ${stats.avg?.toFixed(1)}`}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}

                {/* Summary row */}
                <TableRow className="bg-neutral-100 font-semibold border-t-2">
                  <TableCell className="sticky left-0 bg-neutral-100 z-10">
                    Final Ranking
                  </TableCell>
                  {visibleProposals.map((proposal) => (
                    <TableCell key={proposal.id} className="text-center">
                      <Badge
                        variant={proposal.rank === 1 ? 'default' : 'outline'}
                        className={`text-lg ${
                          proposal.rank === 1
                            ? 'bg-amber-500 text-white border-amber-500'
                            : proposal.rank === 2
                              ? 'border-neutral-300 text-neutral-600'
                              : proposal.rank === 3
                                ? 'border-amber-700 text-amber-700 bg-amber-50'
                                : ''
                        }`}
                      >
                        #{proposal.rank ?? '-'}
                      </Badge>
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t text-xs text-neutral-500">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span>Best in category</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-red-500" />
            <span>Lowest in category</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-green-500" />
            <span>Best price (lowest)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-red-500" />
            <span>Highest price</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProposalComparisonTable;
