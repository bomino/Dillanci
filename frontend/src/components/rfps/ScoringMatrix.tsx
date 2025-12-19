import { useState, useMemo, useCallback } from 'react';
import {
  BarChart3,
  Save,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Star,
  User,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// Types for export
export interface ScoringCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  max_score: number;
  section_id?: string;
}

export interface ProposalForScoring {
  id: string;
  supplier_id: string;
  supplier_name: string;
  proposed_amount: string;
  executive_summary: string | null;
}

export interface Score {
  proposal_id: string;
  criterion_id: string;
  score: number;
  comments: string;
  scored_by: string;
  scored_at: string;
}

interface ScoringMatrixProps {
  criteria: ScoringCriterion[];
  proposals: ProposalForScoring[];
  scores: Score[];
  currentUserId?: string;
  currentUserName?: string;
  onScoreChange?: (proposalId: string, criterionId: string, score: number, comments: string) => void;
  onSaveScores?: () => Promise<void>;
  isEditable?: boolean;
  showConsensusView?: boolean;
}

// Calculate weighted score for a proposal
function calculateWeightedScore(
  proposalId: string,
  criteria: ScoringCriterion[],
  scores: Score[]
): number {
  const proposalScores = scores.filter((s) => s.proposal_id === proposalId);
  if (proposalScores.length === 0) return 0;

  let totalWeightedScore = 0;
  let totalWeight = 0;

  criteria.forEach((criterion) => {
    const score = proposalScores.find((s) => s.criterion_id === criterion.id);
    if (score) {
      const normalizedScore = (score.score / criterion.max_score) * 100;
      totalWeightedScore += normalizedScore * (criterion.weight / 100);
      totalWeight += criterion.weight;
    }
  });

  return totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
}

export function ScoringMatrix({
  criteria,
  proposals,
  scores,
  currentUserId = 'current-user',
  currentUserName = 'You',
  onScoreChange,
  onSaveScores,
  isEditable = true,
}: ScoringMatrixProps) {
  const [localScores, setLocalScores] = useState<Map<string, { score: number; comments: string }>>(
    new Map()
  );
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set(criteria.map((c) => c.id)));
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Calculate completion percentage
  const completionStats = useMemo(() => {
    const totalCells = criteria.length * proposals.length;
    const scoredCells = scores.length + localScores.size;
    return {
      total: totalCells,
      scored: Math.min(scoredCells, totalCells),
      percentage: totalCells > 0 ? (Math.min(scoredCells, totalCells) / totalCells) * 100 : 0,
    };
  }, [criteria.length, proposals.length, scores.length, localScores.size]);

  // Get score for a specific cell
  const getScore = useCallback(
    (proposalId: string, criterionId: string): { score: number | null; comments: string; isLocal: boolean } => {
      const key = `${proposalId}-${criterionId}`;
      const localScore = localScores.get(key);
      if (localScore) {
        return { score: localScore.score, comments: localScore.comments, isLocal: true };
      }

      const existingScore = scores.find(
        (s) => s.proposal_id === proposalId && s.criterion_id === criterionId
      );
      if (existingScore) {
        return { score: existingScore.score, comments: existingScore.comments, isLocal: false };
      }

      return { score: null, comments: '', isLocal: false };
    },
    [scores, localScores]
  );

  // Handle score change
  const handleScoreChange = (proposalId: string, criterionId: string, score: number, comments: string) => {
    const key = `${proposalId}-${criterionId}`;
    setLocalScores((prev) => {
      const newMap = new Map(prev);
      newMap.set(key, { score, comments });
      return newMap;
    });
    setHasUnsavedChanges(true);

    if (onScoreChange) {
      onScoreChange(proposalId, criterionId, score, comments);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!onSaveScores) return;

    setIsSaving(true);
    try {
      await onSaveScores();
      setLocalScores(new Map());
      setHasUnsavedChanges(false);
      toast.success('Scores saved successfully');
    } catch {
      toast.error('Failed to save scores');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle criterion expansion
  const toggleCriterion = (criterionId: string) => {
    setExpandedCriteria((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(criterionId)) {
        newSet.delete(criterionId);
      } else {
        newSet.add(criterionId);
      }
      return newSet;
    });
  };

  // Get score color based on percentage
  const getScoreColor = (score: number, maxScore: number): string => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  // Score input cell component
  const ScoreCell = ({
    proposalId,
    criterion,
  }: {
    proposalId: string;
    criterion: ScoringCriterion;
  }) => {
    const { score, comments, isLocal } = getScore(proposalId, criterion.id);
    const [localValue, setLocalValue] = useState(score?.toString() || '');
    const [localComments, setLocalComments] = useState(comments);
    const [isOpen, setIsOpen] = useState(false);

    const handleBlur = () => {
      const numScore = parseFloat(localValue);
      if (!isNaN(numScore) && numScore >= 0 && numScore <= criterion.max_score) {
        handleScoreChange(proposalId, criterion.id, numScore, localComments);
      }
    };

    const handleCommentsChange = (newComments: string) => {
      setLocalComments(newComments);
      const numScore = parseFloat(localValue);
      if (!isNaN(numScore)) {
        handleScoreChange(proposalId, criterion.id, numScore, newComments);
      }
    };

    return (
      <TableCell className="text-center p-1">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              className={`
                w-full h-10 px-2 rounded border text-center font-mono text-sm
                transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500
                ${
                  score !== null
                    ? `${getScoreColor(score, criterion.max_score)} bg-white border-neutral-300`
                    : 'bg-neutral-50 border-neutral-200 text-neutral-400'
                }
                ${isLocal ? 'border-primary-300 bg-primary-50' : ''}
                ${!isEditable ? 'cursor-default' : 'hover:border-primary-400'}
              `}
              disabled={!isEditable}
            >
              {score !== null ? (
                <span className="flex items-center justify-center gap-1">
                  {score}
                  {comments && <MessageSquare className="h-3 w-3 text-neutral-400" />}
                </span>
              ) : (
                '-'
              )}
            </button>
          </PopoverTrigger>
          {isEditable && (
            <PopoverContent className="w-72 p-3" align="center">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Score</span>
                  <span className="text-xs text-neutral-500">Max: {criterion.max_score}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max={criterion.max_score}
                    step="0.5"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={handleBlur}
                    className="w-20 text-center font-mono"
                    autoFocus
                  />
                  <span className="text-sm text-neutral-500">/ {criterion.max_score}</span>
                  {localValue && (
                    <Badge
                      variant="outline"
                      className={getScoreColor(
                        parseFloat(localValue) || 0,
                        criterion.max_score
                      )}
                    >
                      {(((parseFloat(localValue) || 0) / criterion.max_score) * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Comments</label>
                  <Textarea
                    placeholder="Add evaluation notes..."
                    value={localComments}
                    onChange={(e) => handleCommentsChange(e.target.value)}
                    className="mt-1 min-h-[80px] text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    handleBlur();
                    setIsOpen(false);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Apply
                </Button>
              </div>
            </PopoverContent>
          )}
        </Popover>
      </TableCell>
    );
  };

  if (proposals.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <BarChart3 className="h-12 w-12 text-neutral-300 mb-3" />
            <p className="text-neutral-500 font-medium">No proposals to score</p>
            <p className="text-sm text-neutral-400 mt-1">
              Proposals will appear here once submitted
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (criteria.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <BarChart3 className="h-12 w-12 text-neutral-300 mb-3" />
            <p className="text-neutral-500 font-medium">No scoring criteria defined</p>
            <p className="text-sm text-neutral-400 mt-1">
              Define criteria in the RFP to enable scoring
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
              <BarChart3 className="h-5 w-5 text-primary-600" />
              Scoring Matrix
            </CardTitle>
            <CardDescription>
              Score each proposal against evaluation criteria
            </CardDescription>
          </div>

          <div className="flex items-center gap-4">
            {/* Progress indicator */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {completionStats.scored} / {completionStats.total}
                      </p>
                      <Progress
                        value={completionStats.percentage}
                        className={`w-24 h-2 ${
                          completionStats.percentage === 100
                            ? '[&>div]:bg-green-500'
                            : '[&>div]:bg-primary-500'
                        }`}
                      />
                    </div>
                    {completionStats.percentage === 100 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {completionStats.percentage === 100
                    ? 'All scores entered'
                    : `${(100 - completionStats.percentage).toFixed(0)}% remaining`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Current evaluator */}
            <Badge variant="outline" className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {currentUserName}
            </Badge>

            {/* Save button */}
            {isEditable && onSaveScores && (
              <Button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || isSaving}
                className={hasUnsavedChanges ? '' : 'opacity-50'}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Scores'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="w-full">
          <div className="min-w-[800px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-50">
                  <TableHead className="w-[250px] sticky left-0 bg-neutral-50 z-10">
                    <div className="flex items-center gap-2">
                      Criteria
                      <Badge variant="outline" className="text-xs">
                        {criteria.length}
                      </Badge>
                    </div>
                  </TableHead>
                  <TableHead className="w-[80px] text-center">Weight</TableHead>
                  <TableHead className="w-[80px] text-center">Max</TableHead>
                  {proposals.map((proposal) => (
                    <TableHead key={proposal.id} className="text-center min-w-[100px]">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-center">
                              <p className="font-medium truncate max-w-[100px]">
                                {proposal.supplier_name}
                              </p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{proposal.supplier_name}</p>
                            <p className="text-xs text-neutral-400">
                              Amount: ${parseFloat(proposal.proposed_amount).toLocaleString()}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {criteria.map((criterion) => {
                  const isExpanded = expandedCriteria.has(criterion.id);

                  return (
                    <TableRow key={criterion.id} className="hover:bg-neutral-50">
                      <TableCell className="sticky left-0 bg-white z-10 border-r">
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => toggleCriterion(criterion.id)}
                            className="pt-0.5 text-neutral-400 hover:text-neutral-600"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <div className="flex-1">
                            <p className="font-medium text-neutral-900">{criterion.name}</p>
                            {isExpanded && criterion.description && (
                              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                                {criterion.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs font-mono">
                          {criterion.weight}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-neutral-600 font-mono text-sm">
                        {criterion.max_score}
                      </TableCell>
                      {proposals.map((proposal) => (
                        <ScoreCell
                          key={`${proposal.id}-${criterion.id}`}
                          proposalId={proposal.id}
                          criterion={criterion}
                        />
                      ))}
                    </TableRow>
                  );
                })}

                {/* Weighted score row */}
                <TableRow className="bg-primary-50 font-semibold border-t-2">
                  <TableCell className="sticky left-0 bg-primary-50 z-10 border-r">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary-600" />
                      <span className="text-primary-700">Weighted Score</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-primary-100 text-primary-700">
                      {criteria.reduce((sum, c) => sum + c.weight, 0)}%
                    </Badge>
                  </TableCell>
                  <TableCell></TableCell>
                  {proposals.map((proposal) => {
                    const weightedScore = calculateWeightedScore(
                      proposal.id,
                      criteria,
                      [...scores, ...Array.from(localScores.entries()).map(([key, val]) => {
                        const [propId, critId] = key.split('-');
                        return {
                          proposal_id: propId,
                          criterion_id: critId,
                          score: val.score,
                          comments: val.comments,
                          scored_by: currentUserId,
                          scored_at: new Date().toISOString(),
                        };
                      })]
                    );

                    return (
                      <TableCell key={proposal.id} className="text-center">
                        <span
                          className={`text-lg font-bold ${
                            weightedScore >= 80
                              ? 'text-green-600'
                              : weightedScore >= 60
                                ? 'text-amber-600'
                                : weightedScore > 0
                                  ? 'text-red-600'
                                  : 'text-neutral-400'
                          }`}
                        >
                          {weightedScore > 0 ? weightedScore.toFixed(1) : '-'}
                        </span>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="flex items-center gap-6 text-xs text-neutral-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
              <span>80-100% (Excellent)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
              <span>60-79% (Good)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />
              <span>&lt;60% (Needs Improvement)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-500">
            {isEditable ? (
              <>
                <Unlock className="h-3 w-3" />
                <span>Editing enabled</span>
              </>
            ) : (
              <>
                <Lock className="h-3 w-3" />
                <span>View only</span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ScoringMatrix;
