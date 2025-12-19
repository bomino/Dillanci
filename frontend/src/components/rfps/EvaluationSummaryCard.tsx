import { useMemo } from 'react';
import {
  Trophy,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Users,
  Star,
  Award,
  Medal,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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

// Types for export
export interface ProposalScoreSummary {
  proposal_id: string;
  supplier_id: string;
  supplier_name: string;
  proposed_amount: string;
  technical_score: number;
  pricing_score: number;
  management_score: number;
  overall_score: number;
  rank: number;
  evaluators_completed: number;
  total_evaluators: number;
  is_shortlisted: boolean;
  score_trend?: 'up' | 'down' | 'stable';
}

export interface EvaluationStats {
  total_proposals: number;
  scored_proposals: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  score_spread: number;
  evaluators_completed: number;
  total_evaluators: number;
}

interface EvaluationSummaryCardProps {
  proposals: ProposalScoreSummary[];
  stats: EvaluationStats;
  onViewDetails?: (proposalId: string) => void;
  onShortlist?: (proposalId: string) => void;
  onFinalizeScores?: () => Promise<void>;
  isEvaluationComplete?: boolean;
  canFinalize?: boolean;
}

// Get rank icon based on position
function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Trophy className="h-5 w-5 text-amber-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-neutral-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-700" />;
    default:
      return <span className="text-sm font-medium text-neutral-500">#{rank}</span>;
  }
}

// Get score color based on percentage
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  if (score > 0) return 'text-red-600';
  return 'text-neutral-400';
}

// Get score background class
function getScoreBgClass(score: number): string {
  if (score >= 80) return 'bg-green-50 border-green-200';
  if (score >= 60) return 'bg-amber-50 border-amber-200';
  if (score > 0) return 'bg-red-50 border-red-200';
  return 'bg-neutral-50 border-neutral-200';
}

// Simple horizontal bar component
function ScoreBar({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-600">{label}</span>
        <span className={`font-medium ${getScoreColor(score)}`}>{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function EvaluationSummaryCard({
  proposals,
  stats,
  onViewDetails,
  onShortlist,
  onFinalizeScores,
  isEvaluationComplete = false,
  canFinalize = false,
}: EvaluationSummaryCardProps) {
  // Sort proposals by rank
  const rankedProposals = useMemo(() => {
    return [...proposals].sort((a, b) => a.rank - b.rank);
  }, [proposals]);

  // Top 3 proposals
  const topProposals = rankedProposals.slice(0, 3);

  // Completion percentage
  const completionPercentage = stats.total_evaluators > 0
    ? (stats.evaluators_completed / stats.total_evaluators) * 100
    : 0;

  if (proposals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-600" />
            Evaluation Summary
          </CardTitle>
          <CardDescription>
            Score overview and rankings will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="h-12 w-12 text-neutral-300 mb-3" />
            <p className="text-neutral-500 font-medium">No proposals to evaluate</p>
            <p className="text-sm text-neutral-400 mt-1">
              Proposals will appear here once submitted
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Proposals */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Proposals</p>
                <p className="text-2xl font-bold">{stats.total_proposals}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Score */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Avg Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(stats.average_score)}`}>
                  {stats.average_score.toFixed(1)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Spread */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Spread</p>
                <p className="text-2xl font-bold">
                  {stats.lowest_score.toFixed(0)} - {stats.highest_score.toFixed(0)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evaluator Progress */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Evaluators</p>
                <p className="text-2xl font-bold">
                  {stats.evaluators_completed}/{stats.total_evaluators}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <Progress
              value={completionPercentage}
              className={`mt-2 h-1.5 ${
                completionPercentage === 100
                  ? '[&>div]:bg-green-500'
                  : '[&>div]:bg-primary-500'
              }`}
            />
          </CardContent>
        </Card>
      </div>

      {/* Top 3 Podium */}
      {topProposals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5 text-amber-500" />
              Top Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topProposals.map((proposal, index) => (
                <div
                  key={proposal.proposal_id}
                  className={`
                    relative p-4 rounded-lg border-2 transition-shadow hover:shadow-md
                    ${index === 0 ? 'border-amber-300 bg-amber-50' : ''}
                    ${index === 1 ? 'border-neutral-300 bg-neutral-50' : ''}
                    ${index === 2 ? 'border-amber-200 bg-amber-50/50' : ''}
                  `}
                >
                  {/* Rank badge */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center shadow-sm
                        ${index === 0 ? 'bg-amber-400' : ''}
                        ${index === 1 ? 'bg-neutral-300' : ''}
                        ${index === 2 ? 'bg-amber-600' : ''}
                      `}
                    >
                      <span className="text-white font-bold text-sm">#{index + 1}</span>
                    </div>
                  </div>

                  <div className="mt-3 text-center">
                    <p className="font-semibold text-neutral-900 truncate">
                      {proposal.supplier_name}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      ${parseFloat(proposal.proposed_amount).toLocaleString()}
                    </p>
                  </div>

                  <div className="mt-4 space-y-2">
                    <ScoreBar
                      score={proposal.technical_score}
                      label="Technical"
                      color="bg-blue-500"
                    />
                    <ScoreBar
                      score={proposal.pricing_score}
                      label="Pricing"
                      color="bg-green-500"
                    />
                    <ScoreBar
                      score={proposal.management_score}
                      label="Management"
                      color="bg-purple-500"
                    />
                  </div>

                  <div className="mt-4 pt-3 border-t text-center">
                    <p className="text-xs text-neutral-500 uppercase tracking-wide">
                      Overall Score
                    </p>
                    <p className={`text-2xl font-bold ${getScoreColor(proposal.overall_score)}`}>
                      {proposal.overall_score.toFixed(1)}
                    </p>
                  </div>

                  {proposal.is_shortlisted && (
                    <Badge className="absolute top-2 right-2 bg-green-100 text-green-700">
                      Shortlisted
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Rankings Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-primary-600" />
                All Rankings
              </CardTitle>
              <CardDescription>
                Complete scoring breakdown for all proposals
              </CardDescription>
            </div>

            {canFinalize && onFinalizeScores && (
              <Button onClick={onFinalizeScores} disabled={!isEvaluationComplete}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Finalize Scores
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead className="w-[60px]">Rank</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Technical</TableHead>
                <TableHead className="text-right">Pricing</TableHead>
                <TableHead className="text-right">Management</TableHead>
                <TableHead className="text-center">Overall</TableHead>
                <TableHead className="text-center">Progress</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedProposals.map((proposal) => (
                <TableRow key={proposal.proposal_id} className="hover:bg-neutral-50">
                  <TableCell>
                    <div className="flex items-center justify-center">
                      {getRankIcon(proposal.rank)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{proposal.supplier_name}</p>
                      <p className="text-xs text-neutral-500">
                        ${parseFloat(proposal.proposed_amount).toLocaleString()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-mono ${getScoreColor(proposal.technical_score)}`}>
                      {proposal.technical_score.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-mono ${getScoreColor(proposal.pricing_score)}`}>
                      {proposal.pricing_score.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-mono ${getScoreColor(proposal.management_score)}`}>
                      {proposal.management_score.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`
                                px-3 py-1 rounded-full border font-semibold flex items-center gap-1
                                ${getScoreBgClass(proposal.overall_score)}
                                ${getScoreColor(proposal.overall_score)}
                              `}
                            >
                              {proposal.overall_score.toFixed(1)}
                              {proposal.score_trend === 'up' && (
                                <ArrowUp className="h-3 w-3 text-green-500" />
                              )}
                              {proposal.score_trend === 'down' && (
                                <ArrowDown className="h-3 w-3 text-red-500" />
                              )}
                              {proposal.score_trend === 'stable' && (
                                <Minus className="h-3 w-3 text-neutral-400" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            Weighted average of all criteria scores
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-sm text-neutral-600">
                              {proposal.evaluators_completed}/{proposal.total_evaluators}
                            </span>
                            {proposal.evaluators_completed === proposal.total_evaluators ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {proposal.evaluators_completed === proposal.total_evaluators
                            ? 'All evaluators have scored'
                            : `${proposal.total_evaluators - proposal.evaluators_completed} evaluators pending`}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-center">
                    {proposal.is_shortlisted ? (
                      <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                        Shortlisted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-neutral-500">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {onViewDetails && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDetails(proposal.proposal_id)}
                        >
                          View
                        </Button>
                      )}
                      {onShortlist && !proposal.is_shortlisted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onShortlist(proposal.proposal_id)}
                          className="text-primary-600"
                        >
                          Shortlist
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Evaluation Status */}
      {!isEvaluationComplete && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Evaluation In Progress</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {stats.total_evaluators - stats.evaluators_completed} evaluator(s) still need to submit their scores.
              Scores can be finalized once all evaluators have submitted.
            </p>
          </div>
        </div>
      )}

      {isEvaluationComplete && !canFinalize && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">Evaluation Complete</p>
            <p className="text-xs text-green-600 mt-0.5">
              All evaluators have submitted their scores. Ready for final review and shortlisting.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default EvaluationSummaryCard;
