import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  Edit,
  Send,
  XCircle,
  Clock,
  CheckCircle,
  Award,
  AlertTriangle,
  Calendar,
  DollarSign,
  Users,
  ClipboardCheck,
  BarChart3,
  MessageCircleQuestion,
  Repeat,
  Paperclip,
  MessageSquare,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

import {
  RFPForm,
  EvaluationTeamPanel,
  EvaluationSummaryCard,
  ScoringMatrix,
  QASection,
  BAFOPanel,
  BAFOResponseView,
  ProposalsList,
  type EvaluationTeamMember,
  type EvaluatorRole,
  type ScoringCriterion,
  type ProposalForScoring,
  type Score,
  type RFPQuestion,
  type QAVisibility,
  type BAFORound,
  type BAFOResponse,
  type ShortlistedProposal,
  type Proposal,
  type ProposalScoreSummary,
  type EvaluationStats,
} from '@/components/rfps';
import { CommentsSection } from '@/components/ui/comments-section';
import { AttachmentsSection } from '@/components/ui/attachments-section';

import {
  useRFP,
  useUpdateRFP,
  usePublishRFP,
  useStartEvaluation,
  useShortlistRFP,
  useAwardRFP,
  useCancelRFP,
  useVendorProposals,
  useSuppliersForRFP,
  useRFPQA,
  useAnswerQuestion,
  usePublishAnswer,
  useUnpublishAnswer,
  useEditAnswer,
  useDeleteQuestion,
  useBAFOData,
  useCreateBAFORound,
  useOpenBAFORound,
  useCloseBAFORound,
  useUpdateBAFORound,
  useAwardFromBAFO,
  RFP_STATUS_CONFIG,
  RFP_CATEGORY_CONFIG,
  type RFPPayload,
  type QAVisibility as QAVisibilityAPI,
} from '@/lib/api/rfps';

export default function RFPDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = location.pathname.endsWith('/edit');

  const [activeTab, setActiveTab] = useState('overview');
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');

  // BAFO response view state
  const [selectedBAFOResponse, setSelectedBAFOResponse] = useState<BAFOResponse | null>(null);
  const [bafoResponseDialogOpen, setBAFOResponseDialogOpen] = useState(false);

  // Mock state for evaluation components (would come from API in real app)
  const [evaluationTeam, setEvaluationTeam] = useState<EvaluationTeamMember[]>([
    {
      id: '1',
      user_id: 'u1',
      user_name: 'John Smith',
      user_email: 'john.smith@company.com',
      role: 'LEAD',
      has_submitted_scores: true,
      scores_submitted_at: '2024-12-15T10:00:00Z',
    },
    {
      id: '2',
      user_id: 'u2',
      user_name: 'Sarah Johnson',
      user_email: 'sarah.johnson@company.com',
      role: 'TECHNICAL',
      has_submitted_scores: true,
      scores_submitted_at: '2024-12-14T15:30:00Z',
    },
    {
      id: '3',
      user_id: 'u3',
      user_name: 'Michael Brown',
      user_email: 'michael.brown@company.com',
      role: 'FINANCIAL',
      has_submitted_scores: false,
      scores_submitted_at: null,
    },
  ]);

  const [scores, setScores] = useState<Score[]>([]);

  const { data: rfp, isLoading, error } = useRFP(id);
  const { data: proposals = [] } = useVendorProposals(id);
  const { data: suppliers = [] } = useSuppliersForRFP();

  // Q&A data and mutations
  const { data: qaData = [], isLoading: qaLoading } = useRFPQA(id);
  const answerQuestionMutation = useAnswerQuestion();
  const publishAnswerMutation = usePublishAnswer();
  const unpublishAnswerMutation = useUnpublishAnswer();
  const editAnswerMutation = useEditAnswer();
  const deleteQuestionMutation = useDeleteQuestion();

  // BAFO data and mutations
  const {
    currentRound: bafoCurrentRound,
    previousRounds: bafoPreviousRounds,
    shortlistedProposals: bafoShortlistedProposals,
    isLoading: bafoLoading,
  } = useBAFOData(id);
  const createBAFORoundMutation = useCreateBAFORound();
  const openBAFORoundMutation = useOpenBAFORound();
  const closeBAFORoundMutation = useCloseBAFORound();
  const updateBAFORoundMutation = useUpdateBAFORound();
  const awardFromBAFOMutation = useAwardFromBAFO();

  const updateMutation = useUpdateRFP();
  const publishMutation = usePublishRFP();
  const startEvaluationMutation = useStartEvaluation();
  const shortlistMutation = useShortlistRFP();
  const awardMutation = useAwardRFP();
  const cancelMutation = useCancelRFP();

  // Mock available users for team management
  const availableUsers = [
    { id: 'u4', name: 'Emily Davis', email: 'emily.davis@company.com' },
    { id: 'u5', name: 'Robert Wilson', email: 'robert.wilson@company.com' },
    { id: 'u6', name: 'Jennifer Lee', email: 'jennifer.lee@company.com' },
  ];

  // Convert evaluation criteria for scoring matrix
  const scoringCriteria: ScoringCriterion[] = useMemo(() => {
    if (!rfp?.evaluation_criteria) return [];
    return rfp.evaluation_criteria.map(ec => ({
      id: ec.id,
      name: ec.name,
      description: ec.description || '',
      weight: ec.weight,
      max_score: ec.max_score,
    }));
  }, [rfp?.evaluation_criteria]);

  // Convert proposals for scoring matrix
  const proposalsForScoring: ProposalForScoring[] = useMemo(() => {
    return proposals.map(p => ({
      id: p.id,
      supplier_id: p.supplier_id || '',
      supplier_name: p.supplier_name,
      proposed_amount: p.proposed_amount,
      executive_summary: p.executive_summary,
    }));
  }, [proposals]);

  // Convert proposals for proposals list
  const proposalsForList: Proposal[] = useMemo(() => {
    return proposals.map(p => ({
      id: p.id,
      rfp_id: id || '',
      supplier_id: p.supplier_id || '',
      supplier_name: p.supplier_name,
      proposed_amount: p.proposed_amount,
      executive_summary: p.executive_summary,
      technical_score: p.technical_score,
      financial_score: p.financial_score,
      weighted_score: p.total_score,
      status: (p.status === 'SELECTED' ? 'AWARDED' : p.status) as Proposal['status'],
      submitted_at: p.submitted_date,
      created_at: p.submitted_date || new Date().toISOString(),
      documents_count: 3,
    }));
  }, [proposals, id]);

  // Shortlisted proposals for BAFO (from local proposals data, fallback)
  const shortlistedProposals: ShortlistedProposal[] = useMemo(() => {
    return proposals
      .filter(p => p.status === 'SHORTLISTED')
      .map(p => ({
        id: p.id,
        supplier_id: p.supplier_id || '',
        supplier_name: p.supplier_name,
        proposed_amount: p.proposed_amount,
        weighted_score: p.total_score || 0,
      }));
  }, [proposals]);

  // Convert Q&A data for the component
  const questions: RFPQuestion[] = useMemo(() => {
    return qaData.map(qa => ({
      id: qa.id,
      rfp_id: qa.rfp_id,
      supplier_id: qa.supplier_id,
      supplier_name: qa.supplier_name,
      asked_by_id: qa.asked_by_id,
      asked_by_name: qa.asked_by_name,
      question: qa.question,
      answer: qa.answer,
      answered_by_id: qa.answered_by_id,
      answered_by_name: qa.answered_by_name,
      answered_at: qa.answered_at,
      visibility: qa.visibility,
      visibility_display: qa.visibility_display,
      is_published: qa.is_published,
      published_at: qa.published_at,
      created_at: qa.created_at,
      updated_at: qa.updated_at,
      requires_amendment: qa.requires_amendment,
      amendment_note: qa.amendment_note,
      amendment_version: qa.amendment_version,
      previous_answers: qa.previous_answers,
    }));
  }, [qaData]);

  // Convert BAFO round data for the component
  const currentBAFORound: BAFORound | null = useMemo(() => {
    if (!bafoCurrentRound) return null;
    return {
      id: bafoCurrentRound.id,
      rfp_id: bafoCurrentRound.rfp_id,
      round_number: bafoCurrentRound.round_number,
      status: bafoCurrentRound.status,
      opened_at: bafoCurrentRound.opened_at,
      deadline: bafoCurrentRound.deadline,
      closed_at: bafoCurrentRound.closed_at,
      instructions: bafoCurrentRound.instructions,
      focus_areas: bafoCurrentRound.focus_areas,
      responses: bafoCurrentRound.responses.map(r => ({
        id: r.id,
        bafo_round_id: r.bafo_round_id,
        proposal_id: r.proposal_id,
        supplier_id: r.supplier_id,
        supplier_name: r.supplier_name,
        status: r.status,
        original_amount: r.original_amount,
        revised_amount: r.revised_amount,
        response_data: r.response_data,
        notes: r.notes,
        submitted_at: r.submitted_at,
        created_at: r.created_at,
      })),
      created_at: bafoCurrentRound.created_at,
      created_by_name: bafoCurrentRound.created_by_name,
    };
  }, [bafoCurrentRound]);

  const previousBAFORounds: BAFORound[] = useMemo(() => {
    return bafoPreviousRounds.map(round => ({
      id: round.id,
      rfp_id: round.rfp_id,
      round_number: round.round_number,
      status: round.status,
      opened_at: round.opened_at,
      deadline: round.deadline,
      closed_at: round.closed_at,
      instructions: round.instructions,
      focus_areas: round.focus_areas,
      responses: round.responses.map(r => ({
        id: r.id,
        bafo_round_id: r.bafo_round_id,
        proposal_id: r.proposal_id,
        supplier_id: r.supplier_id,
        supplier_name: r.supplier_name,
        status: r.status,
        original_amount: r.original_amount,
        revised_amount: r.revised_amount,
        response_data: r.response_data,
        notes: r.notes,
        submitted_at: r.submitted_at,
        created_at: r.created_at,
      })),
      created_at: round.created_at,
      created_by_name: round.created_by_name,
    }));
  }, [bafoPreviousRounds]);

  // Evaluation summary data for EvaluationSummaryCard
  const evaluationSummaryProposals: ProposalScoreSummary[] = useMemo(() => {
    return proposals
      .filter(p => p.status !== 'REJECTED')
      .map((p, index) => ({
        proposal_id: p.id,
        supplier_id: p.supplier_id || '',
        supplier_name: p.supplier_name,
        proposed_amount: p.proposed_amount,
        technical_score: p.technical_score || 0,
        pricing_score: p.financial_score || 0,
        management_score: 75, // Mock value - would come from API
        overall_score: p.total_score || 0,
        rank: index + 1,
        evaluators_completed: evaluationTeam.filter(m => m.has_submitted_scores).length,
        total_evaluators: evaluationTeam.length,
        is_shortlisted: p.status === 'SHORTLISTED',
      }))
      .sort((a, b) => b.overall_score - a.overall_score)
      .map((p, index) => ({ ...p, rank: index + 1 }));
  }, [proposals, evaluationTeam]);

  const evaluationStats: EvaluationStats = useMemo(() => {
    const scoredProposals = evaluationSummaryProposals.filter(p => p.overall_score > 0);
    const scores = scoredProposals.map(p => p.overall_score);

    return {
      total_proposals: proposals.length,
      scored_proposals: scoredProposals.length,
      average_score: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      highest_score: scores.length > 0 ? Math.max(...scores) : 0,
      lowest_score: scores.length > 0 ? Math.min(...scores) : 0,
      score_spread: scores.length > 0 ? Math.max(...scores) - Math.min(...scores) : 0,
      evaluators_completed: evaluationTeam.filter(m => m.has_submitted_scores).length,
      total_evaluators: evaluationTeam.length,
    };
  }, [proposals.length, evaluationSummaryProposals, evaluationTeam]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-500">Loading RFP details...</div>
      </div>
    );
  }

  if (error || !rfp) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-500">RFP not found</div>
        <Button onClick={() => navigate('/rfps')}>Back to RFPs</Button>
      </div>
    );
  }

  const handleUpdate = async (data: RFPPayload) => {
    try {
      await updateMutation.mutateAsync({ id: rfp.id, payload: data });
      navigate(`/rfps/${rfp.id}`);
    } catch (error) {
      console.error('Failed to update RFP:', error);
    }
  };

  const handlePublish = async () => {
    await publishMutation.mutateAsync(rfp.id);
  };

  const handleStartEvaluation = async () => {
    await startEvaluationMutation.mutateAsync(rfp.id);
  };

  const handleShortlist = async () => {
    await shortlistMutation.mutateAsync(rfp.id);
  };

  const handleAward = async () => {
    if (!selectedSupplier) return;
    await awardMutation.mutateAsync({ id: rfp.id, supplierId: selectedSupplier });
    setAwardDialogOpen(false);
    setSelectedSupplier('');
  };

  const handleCancel = async () => {
    await cancelMutation.mutateAsync(rfp.id);
  };

  // Team management handlers
  const handleAddTeamMember = async (userId: string, role: EvaluatorRole) => {
    const user = availableUsers.find(u => u.id === userId);
    if (!user) return;
    const newMember: EvaluationTeamMember = {
      id: `team-${Date.now()}`,
      user_id: userId,
      user_name: user.name,
      user_email: user.email,
      role,
      has_submitted_scores: false,
      scores_submitted_at: null,
    };
    setEvaluationTeam(prev => [...prev, newMember]);
  };

  const handleRemoveTeamMember = async (memberId: string) => {
    setEvaluationTeam(prev => prev.filter(m => m.id !== memberId));
  };

  const handleUpdateTeamRole = async (memberId: string, role: EvaluatorRole) => {
    setEvaluationTeam(prev =>
      prev.map(m => m.id === memberId ? { ...m, role } : m)
    );
  };

  // Score handlers
  const handleScoreChange = (proposalId: string, criterionId: string, score: number, comments: string) => {
    setScores(prev => {
      const filtered = prev.filter(s => !(s.proposal_id === proposalId && s.criterion_id === criterionId));
      return [...filtered, { proposal_id: proposalId, criterion_id: criterionId, score, comments }];
    });
  };

  const handleSaveScores = async () => {
    // Would save to API
    console.log('Saving scores:', scores);
  };

  // Q&A handlers
  const handleAnswerQuestion = async (
    questionId: string,
    answer: string,
    visibility: QAVisibility,
    requiresAmendment?: boolean,
    amendmentNote?: string
  ) => {
    if (!id) return;
    await answerQuestionMutation.mutateAsync({
      rfpId: id,
      questionId,
      answer,
      visibility: visibility as QAVisibilityAPI,
      requiresAmendment,
      amendmentNote,
    });
  };

  const handlePublishAnswer = async (questionId: string, visibility: QAVisibility) => {
    if (!id) return;
    await publishAnswerMutation.mutateAsync({
      rfpId: id,
      questionId,
      visibility: visibility as QAVisibilityAPI,
    });
  };

  const handleUnpublishAnswer = async (questionId: string) => {
    if (!id) return;
    await unpublishAnswerMutation.mutateAsync({
      rfpId: id,
      questionId,
    });
  };

  const handleEditAnswer = async (
    questionId: string,
    answer: string,
    visibility: QAVisibility,
    amendmentNote?: string
  ) => {
    if (!id) return;
    await editAnswerMutation.mutateAsync({
      rfpId: id,
      questionId,
      answer,
      visibility: visibility as QAVisibilityAPI,
      amendmentNote,
    });
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!id) return;
    await deleteQuestionMutation.mutateAsync({
      rfpId: id,
      questionId,
    });
  };

  // BAFO handlers
  const handleStartBAFO = async (
    deadline: string,
    instructions: string,
    focusAreas: string[],
    invitedProposalIds: string[]
  ) => {
    if (!id) return;
    await createBAFORoundMutation.mutateAsync({
      rfpId: id,
      deadline,
      instructions,
      focusAreas,
      proposalIds: invitedProposalIds,
    });
  };

  const handleOpenBAFO = async (roundId: string) => {
    await openBAFORoundMutation.mutateAsync(roundId);
  };

  const handleCloseBAFO = async (roundId: string) => {
    await closeBAFORoundMutation.mutateAsync(roundId);
  };

  const handleUpdateBAFO = async (
    roundId: string,
    deadline: string,
    instructions: string,
    focusAreas: string[]
  ) => {
    await updateBAFORoundMutation.mutateAsync({
      roundId,
      deadline,
      instructions,
      focusAreas,
    });
  };

  const handleAwardFromBAFO = async (proposalId: string) => {
    await awardFromBAFOMutation.mutateAsync(proposalId);
  };

  const handleViewBAFOResponse = (response: BAFOResponse) => {
    setSelectedBAFOResponse(response);
    setBAFOResponseDialogOpen(true);
  };

  // Proposal handlers
  const handleViewProposal = (proposal: Proposal) => {
    console.log('View proposal:', proposal.id);
    // Navigate to proposal detail or open modal
  };

  const handleShortlistProposal = async (proposalId: string) => {
    console.log('Shortlist proposal:', proposalId);
  };

  const handleRejectProposal = async (proposalId: string, reason: string) => {
    console.log('Reject proposal:', proposalId, reason);
  };

  const handleAwardProposal = async (proposalId: string) => {
    console.log('Award proposal:', proposalId);
  };

  const handleRequestBAFO = async (proposalId: string) => {
    console.log('Request BAFO:', proposalId);
  };

  const formatCurrency = (value: string | null, currency: string) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const statusConfig = RFP_STATUS_CONFIG[rfp.status];
  const categoryConfig = RFP_CATEGORY_CONFIG[rfp.category];
  const colorClasses = {
    default: 'bg-neutral-100 text-neutral-700',
    info: 'bg-blue-100 text-blue-700',
    warning: 'bg-amber-100 text-amber-700',
    success: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };

  const getDeadlineStatus = () => {
    if (!rfp.submission_deadline || rfp.status !== 'PUBLISHED') return null;
    const deadline = new Date(rfp.submission_deadline);
    const today = new Date();
    const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return { type: 'overdue', text: 'Deadline has passed', color: 'text-red-600' };
    if (daysUntil <= 3) return { type: 'urgent', text: `${daysUntil} days remaining`, color: 'text-red-600' };
    if (daysUntil <= 7) return { type: 'warning', text: `${daysUntil} days remaining`, color: 'text-amber-600' };
    return { type: 'normal', text: `${daysUntil} days remaining`, color: 'text-green-600' };
  };

  const deadlineStatus = getDeadlineStatus();

  // Determine which tabs to show based on status
  const showEvaluationTabs = ['UNDER_EVALUATION', 'SHORTLISTED', 'AWARDED', 'CLOSED'].includes(rfp.status);
  const showProposals = rfp.status !== 'DRAFT';

  // Edit mode
  if (isEditMode && rfp.status === 'DRAFT') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/rfps/${rfp.id}`)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to RFP
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
            <Edit className="h-6 w-6 text-purple-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Edit RFP
            </h1>
            <p className="text-neutral-500">{rfp.number}</p>
          </div>
        </div>

        <div className="max-w-4xl">
          <RFPForm
            rfp={rfp}
            onSubmit={handleUpdate}
            onCancel={() => navigate(`/rfps/${rfp.id}`)}
            isSubmitting={updateMutation.isPending}
            mode="edit"
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/rfps')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to RFPs
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
            <FileText className="h-6 w-6 text-purple-700" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-900">
                {rfp.number}
              </h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses[statusConfig?.color || 'default']}`}>
                {statusConfig?.label || rfp.status}
              </span>
            </div>
            <p className="text-neutral-500">{rfp.title}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {rfp.status === 'DRAFT' && (
            <>
              <Button variant="outline" onClick={() => navigate(`/rfps/${rfp.id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button onClick={handlePublish} disabled={publishMutation.isPending}>
                <Send className="h-4 w-4 mr-2" />
                Publish
              </Button>
            </>
          )}
          {rfp.status === 'PUBLISHED' && (
            <>
              <Button variant="outline" onClick={handleStartEvaluation} disabled={startEvaluationMutation.isPending}>
                <Clock className="h-4 w-4 mr-2" />
                Start Evaluation
              </Button>
              <Button variant="outline" onClick={handleCancel} className="text-red-600" disabled={cancelMutation.isPending}>
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
          {rfp.status === 'UNDER_EVALUATION' && (
            <>
              <Button variant="outline" onClick={handleShortlist} disabled={shortlistMutation.isPending}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Shortlist
              </Button>
              <Button onClick={() => setAwardDialogOpen(true)}>
                <Award className="h-4 w-4 mr-2" />
                Award
              </Button>
            </>
          )}
          {rfp.status === 'SHORTLISTED' && (
            <Button onClick={() => setAwardDialogOpen(true)}>
              <Award className="h-4 w-4 mr-2" />
              Award
            </Button>
          )}
        </div>
      </div>

      {/* Deadline Warning */}
      {deadlineStatus && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          deadlineStatus.type === 'overdue' || deadlineStatus.type === 'urgent'
            ? 'bg-red-50'
            : deadlineStatus.type === 'warning'
            ? 'bg-amber-50'
            : 'bg-green-50'
        }`}>
          <AlertTriangle className={`h-5 w-5 ${deadlineStatus.color}`} />
          <span className={`text-sm font-medium ${deadlineStatus.color}`}>
            Submission Deadline: {deadlineStatus.text}
          </span>
        </div>
      )}

      {/* Award Info */}
      {rfp.status === 'AWARDED' && rfp.awarded_supplier_name && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Award className="h-6 w-6 text-green-600" />
              <div>
                <p className="text-sm text-green-800">Awarded to</p>
                <p className="font-semibold text-green-900">{rfp.awarded_supplier_name}</p>
                <p className="text-sm text-green-700">on {formatDate(rfp.awarded_date)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content with Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-7 h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          {showProposals && (
            <TabsTrigger value="proposals" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Proposals</span>
              {proposals.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {proposals.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {showEvaluationTabs && (
            <>
              <TabsTrigger value="evaluation" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Scoring</span>
              </TabsTrigger>
              <TabsTrigger value="team" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Team</span>
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="qa" className="gap-2">
            <MessageCircleQuestion className="h-4 w-4" />
            <span className="hidden sm:inline">Q&A</span>
            {questions.filter(q => !q.answer).length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-amber-100 text-amber-700">
                {questions.filter(q => !q.answer).length}
              </Badge>
            )}
          </TabsTrigger>
          {rfp.status === 'SHORTLISTED' && (
            <TabsTrigger value="bafo" className="gap-2">
              <Repeat className="h-4 w-4" />
              <span className="hidden sm:inline">BAFO</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="activity" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-700 whitespace-pre-wrap">{rfp.description}</p>
                </CardContent>
              </Card>

              {/* Requirements */}
              {rfp.requirements && rfp.requirements.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5" />
                      Requirements ({rfp.requirements.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {rfp.requirements.map((req, index) => (
                        <div key={req.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-neutral-500">
                                #{index + 1}
                              </span>
                              <span className="px-2 py-0.5 text-xs font-medium bg-neutral-100 rounded">
                                {req.category}
                              </span>
                              {req.is_mandatory && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                                  Mandatory
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-neutral-500">
                              Weight: {req.weight}%
                            </span>
                          </div>
                          <p className="text-neutral-700">{req.description}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Evaluation Criteria */}
              {rfp.evaluation_criteria && rfp.evaluation_criteria.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Evaluation Criteria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Criteria</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Weight</TableHead>
                          <TableHead className="text-right">Max Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rfp.evaluation_criteria.map((ec) => (
                          <TableRow key={ec.id}>
                            <TableCell className="font-medium">{ec.name}</TableCell>
                            <TableCell className="text-neutral-600">{ec.description}</TableCell>
                            <TableCell className="text-right">{ec.weight}%</TableCell>
                            <TableCell className="text-right">{ec.max_score}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Attachments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5" />
                    Attachments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AttachmentsSection
                    objectType="rfp"
                    objectId={rfp.id}
                    acceptedTypes={['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg']}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-500">Category</p>
                      <p className="font-medium">{categoryConfig?.label || rfp.category}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-500">Budget Range</p>
                      <p className="font-medium">
                        {rfp.budget_min || rfp.budget_max
                          ? `${formatCurrency(rfp.budget_min, rfp.currency)} - ${formatCurrency(rfp.budget_max, rfp.currency)}`
                          : 'Not specified'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-500">Published</p>
                      <p className="font-medium">{formatDate(rfp.publish_date)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-500">Submission Deadline</p>
                      <p className="font-medium">{formatDate(rfp.submission_deadline)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-500">Evaluation Deadline</p>
                      <p className="font-medium">{formatDate(rfp.evaluation_deadline)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-500">Created By</p>
                      <p className="font-medium">{rfp.created_by_name || 'Unknown'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${rfp.created_at ? 'bg-green-500' : 'bg-neutral-300'}`} />
                      <div>
                        <p className="text-sm font-medium">Created</p>
                        <p className="text-xs text-neutral-500">{formatDate(rfp.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${rfp.publish_date ? 'bg-green-500' : 'bg-neutral-300'}`} />
                      <div>
                        <p className="text-sm font-medium">Published</p>
                        <p className="text-xs text-neutral-500">{formatDate(rfp.publish_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${rfp.submission_deadline && new Date(rfp.submission_deadline) < new Date() ? 'bg-green-500' : 'bg-neutral-300'}`} />
                      <div>
                        <p className="text-sm font-medium">Submissions Closed</p>
                        <p className="text-xs text-neutral-500">{formatDate(rfp.submission_deadline)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${rfp.awarded_date ? 'bg-green-500' : 'bg-neutral-300'}`} />
                      <div>
                        <p className="text-sm font-medium">Awarded</p>
                        <p className="text-xs text-neutral-500">{formatDate(rfp.awarded_date)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Proposals Tab */}
        {showProposals && (
          <TabsContent value="proposals">
            <ProposalsList
              rfpId={id || ''}
              proposals={proposalsForList}
              onViewProposal={handleViewProposal}
              onShortlistProposal={handleShortlistProposal}
              onDisqualifyProposal={handleRejectProposal}
              onAwardProposal={handleAwardProposal}
              onRequestBAFO={handleRequestBAFO}
            />
          </TabsContent>
        )}

        {/* Evaluation/Scoring Tab */}
        {showEvaluationTabs && (
          <TabsContent value="evaluation" className="space-y-6">
            {/* Evaluation Summary Dashboard */}
            <EvaluationSummaryCard
              proposals={evaluationSummaryProposals}
              stats={evaluationStats}
              onViewDetails={(proposalId) => console.log('View proposal:', proposalId)}
              onShortlist={(proposalId) => handleShortlistProposal(proposalId)}
              isEvaluationComplete={evaluationTeam.every(m => m.has_submitted_scores)}
              canFinalize={rfp.status === 'UNDER_EVALUATION'}
            />

            {/* Scoring Matrix */}
            <ScoringMatrix
              criteria={scoringCriteria}
              proposals={proposalsForScoring}
              scores={scores}
              onScoreChange={handleScoreChange}
              onSaveScores={handleSaveScores}
              isEditable={rfp.status === 'UNDER_EVALUATION'}
            />
          </TabsContent>
        )}

        {/* Team Tab */}
        {showEvaluationTabs && (
          <TabsContent value="team">
            <EvaluationTeamPanel
              rfpId={rfp.id}
              team={evaluationTeam}
              availableUsers={availableUsers}
              onAddMember={handleAddTeamMember}
              onRemoveMember={handleRemoveTeamMember}
              onUpdateRole={handleUpdateTeamRole}
              isEditable={rfp.status !== 'AWARDED'}
            />
          </TabsContent>
        )}

        {/* Q&A Tab */}
        <TabsContent value="qa">
          <QASection
            rfpId={rfp.id}
            questions={questions}
            onAnswerQuestion={handleAnswerQuestion}
            onPublishAnswer={handlePublishAnswer}
            onUnpublishAnswer={handleUnpublishAnswer}
            onEditAnswer={handleEditAnswer}
            onDeleteQuestion={handleDeleteQuestion}
            isOwner={true}
            isLoading={qaLoading}
            rfpStatus={rfp.status}
          />
        </TabsContent>

        {/* BAFO Tab */}
        {rfp.status === 'SHORTLISTED' && (
          <TabsContent value="bafo">
            <BAFOPanel
              rfpId={rfp.id}
              currentRound={currentBAFORound}
              previousRounds={previousBAFORounds}
              shortlistedProposals={bafoShortlistedProposals.length > 0 ? bafoShortlistedProposals : shortlistedProposals}
              onStartBAFO={handleStartBAFO}
              onOpenBAFO={handleOpenBAFO}
              onCloseBAFO={handleCloseBAFO}
              onUpdateBAFO={handleUpdateBAFO}
              onAwardFromBAFO={handleAwardFromBAFO}
              onViewResponse={handleViewBAFOResponse}
              isOwner={true}
              isLoading={bafoLoading}
              rfpStatus={rfp.status}
            />
          </TabsContent>
        )}

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments & Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CommentsSection
                objectType="rfp"
                objectId={rfp.id}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Award Dialog */}
      <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Award RFP</DialogTitle>
            <DialogDescription>
              Select the winning supplier for this RFP.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAward}
              disabled={!selectedSupplier || awardMutation.isPending}
            >
              <Award className="h-4 w-4 mr-2" />
              Award RFP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BAFO Response Detail Dialog */}
      {selectedBAFOResponse && (
        <BAFOResponseView
          response={selectedBAFOResponse}
          open={bafoResponseDialogOpen}
          onOpenChange={(open) => {
            setBAFOResponseDialogOpen(open);
            if (!open) setSelectedBAFOResponse(null);
          }}
        />
      )}
    </motion.div>
  );
}
