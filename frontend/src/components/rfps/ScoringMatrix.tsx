import * as React from 'react';
import { BarChart3, Save, RefreshCw, Loader2, Trophy, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { cn } from '@/lib/utils';

export interface ScoringCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  max_score: number;
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
}

interface ScoringMatrixProps {
  criteria: ScoringCriterion[];
  proposals: ProposalForScoring[];
  scores: Score[];
  onScoreChange: (proposalId: string, criterionId: string, score: number, comments: string) => void;
  onSaveScores: () => Promise<void>;
  isEditable?: boolean;
  currentEvaluatorId?: string;
  className?: string;
}

export function ScoringMatrix({
  criteria,
  proposals,
  scores,
  onScoreChange,
  onSaveScores,
  isEditable = true,
  className,
}: ScoringMatrixProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const [editingCell, setEditingCell] = React.useState<{ proposalId: string; criterionId: string } | null>(null);
  const [localScores, setLocalScores] = React.useState<Score[]>(scores);

  // Sync local scores with props
  React.useEffect(() => {
    setLocalScores(scores);
  }, [scores]);

  const getScore = (proposalId: string, criterionId: string): Score | undefined => {
    return localScores.find(s => s.proposal_id === proposalId && s.criterion_id === criterionId);
  };

  const handleScoreInput = (proposalId: string, criterionId: string, value: string) => {
    const criterion = criteria.find(c => c.id === criterionId);
    if (!criterion) return;

    const numValue = Math.min(Math.max(0, parseInt(value) || 0), criterion.max_score);
    const existingScore = getScore(proposalId, criterionId);

    setLocalScores(prev => {
      const filtered = prev.filter(s => !(s.proposal_id === proposalId && s.criterion_id === criterionId));
      return [...filtered, {
        proposal_id: proposalId,
        criterion_id: criterionId,
        score: numValue,
        comments: existingScore?.comments || '',
      }];
    });

    onScoreChange(proposalId, criterionId, numValue, existingScore?.comments || '');
  };

  const handleCommentsChange = (proposalId: string, criterionId: string, comments: string) => {
    const existingScore = getScore(proposalId, criterionId);

    setLocalScores(prev => {
      const filtered = prev.filter(s => !(s.proposal_id === proposalId && s.criterion_id === criterionId));
      return [...filtered, {
        proposal_id: proposalId,
        criterion_id: criterionId,
        score: existingScore?.score || 0,
        comments,
      }];
    });

    onScoreChange(proposalId, criterionId, existingScore?.score || 0, comments);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveScores();
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate weighted scores for each proposal
  const calculateWeightedScore = (proposalId: string): number => {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const criterion of criteria) {
      const score = getScore(proposalId, criterion.id);
      if (score && score.score > 0) {
        const normalizedScore = (score.score / criterion.max_score) * 100;
        totalWeightedScore += normalizedScore * (criterion.weight / 100);
        totalWeight += criterion.weight;
      }
    }

    return totalWeight > 0 ? Math.round(totalWeightedScore) : 0;
  };

  // Rank proposals by weighted score
  const rankedProposals = [...proposals]
    .map(p => ({ ...p, weightedScore: calculateWeightedScore(p.id) }))
    .sort((a, b) => b.weightedScore - a.weightedScore);

  // Check if all criteria have been scored for a proposal
  const isProposalFullyScored = (proposalId: string): boolean => {
    return criteria.every(c => {
      const score = getScore(proposalId, c.id);
      return score && score.score > 0;
    });
  };

  const allProposalsScored = proposals.every(p => isProposalFullyScored(p.id));

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Scoring Matrix
        </CardTitle>
        {isEditable && (
          <div className="flex items-center gap-2">
            {!allProposalsScored && (
              <div className="flex items-center gap-1 text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Incomplete</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save Scores
                </>
              )}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {proposals.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 className="h-10 w-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-neutral-500 text-sm">No proposals to evaluate</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Scoring Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px] sticky left-0 bg-white z-10">Criteria</TableHead>
                    <TableHead className="w-[80px] text-center">Weight</TableHead>
                    <TableHead className="w-[60px] text-center">Max</TableHead>
                    {proposals.map(proposal => (
                      <TableHead key={proposal.id} className="min-w-[150px] text-center">
                        <div className="space-y-1">
                          <p className="font-medium">{proposal.supplier_name}</p>
                          <p className="text-xs text-neutral-500 font-normal">
                            {formatCurrency(proposal.proposed_amount)}
                          </p>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criteria.map(criterion => (
                    <TableRow key={criterion.id}>
                      <TableCell className="sticky left-0 bg-white z-10">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-help">
                                <p className="font-medium text-neutral-900">{criterion.name}</p>
                                <p className="text-xs text-neutral-500 line-clamp-1">
                                  {criterion.description}
                                </p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>{criterion.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="px-2 py-0.5 bg-neutral-100 rounded text-sm font-medium">
                          {criterion.weight}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-neutral-500">
                        {criterion.max_score}
                      </TableCell>
                      {proposals.map(proposal => {
                        const score = getScore(proposal.id, criterion.id);
                        const isEditing = editingCell?.proposalId === proposal.id &&
                          editingCell?.criterionId === criterion.id;

                        return (
                          <TableCell key={proposal.id} className="text-center">
                            {isEditable ? (
                              <div className="space-y-1">
                                <Input
                                  type="number"
                                  min={0}
                                  max={criterion.max_score}
                                  value={score?.score || ''}
                                  onChange={(e) => handleScoreInput(proposal.id, criterion.id, e.target.value)}
                                  onFocus={() => setEditingCell({ proposalId: proposal.id, criterionId: criterion.id })}
                                  onBlur={() => setEditingCell(null)}
                                  className={cn(
                                    'h-8 w-16 text-center mx-auto',
                                    score?.score === criterion.max_score && 'border-emerald-300 bg-emerald-50',
                                    score?.score === 0 && 'border-red-300 bg-red-50'
                                  )}
                                  placeholder="-"
                                />
                                {isEditing && (
                                  <Textarea
                                    placeholder="Add comments..."
                                    value={score?.comments || ''}
                                    onChange={(e) => handleCommentsChange(proposal.id, criterion.id, e.target.value)}
                                    className="text-xs min-h-[60px]"
                                  />
                                )}
                              </div>
                            ) : (
                              <div>
                                <span className={cn(
                                  'font-medium',
                                  score?.score === criterion.max_score ? 'text-emerald-600' :
                                    (score?.score || 0) < criterion.max_score * 0.5 ? 'text-red-600' :
                                      'text-neutral-900'
                                )}>
                                  {score?.score || '-'}
                                </span>
                                {score?.comments && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <span className="ml-1 text-neutral-400 text-xs">*</span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="max-w-xs">{score.comments}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}

                  {/* Weighted Total Row */}
                  <TableRow className="bg-neutral-50 font-medium">
                    <TableCell className="sticky left-0 bg-neutral-50 z-10">
                      Weighted Total
                    </TableCell>
                    <TableCell className="text-center">100%</TableCell>
                    <TableCell className="text-center">100</TableCell>
                    {proposals.map(proposal => {
                      const weightedScore = calculateWeightedScore(proposal.id);
                      return (
                        <TableCell key={proposal.id} className="text-center">
                          <span className={cn(
                            'text-lg font-bold',
                            weightedScore >= 80 ? 'text-emerald-600' :
                              weightedScore >= 60 ? 'text-amber-600' :
                                'text-red-600'
                          )}>
                            {weightedScore}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Rankings Summary */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-neutral-700 mb-3">Current Rankings</h4>
              <div className="space-y-2">
                {rankedProposals.map((proposal, index) => (
                  <div
                    key={proposal.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg',
                      index === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-neutral-50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm',
                        index === 0 ? 'bg-amber-500 text-white' :
                          index === 1 ? 'bg-neutral-400 text-white' :
                            index === 2 ? 'bg-amber-700 text-white' :
                              'bg-neutral-200 text-neutral-600'
                      )}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">{proposal.supplier_name}</p>
                        <p className="text-xs text-neutral-500">
                          {formatCurrency(proposal.proposed_amount)}
                        </p>
                      </div>
                      {index === 0 && (
                        <Trophy className="h-5 w-5 text-amber-500 ml-2" />
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32">
                        <Progress
                          value={proposal.weightedScore}
                          className={cn(
                            'h-2',
                            index === 0 && 'bg-amber-100 [&>[role=progressbar]]:bg-amber-500'
                          )}
                        />
                      </div>
                      <span className={cn(
                        'font-bold text-lg w-12 text-right',
                        index === 0 ? 'text-amber-600' : 'text-neutral-700'
                      )}>
                        {proposal.weightedScore}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ScoringMatrix;
