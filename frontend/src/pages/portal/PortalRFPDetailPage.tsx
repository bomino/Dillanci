/**
 * Portal RFP Detail Page - View RFP details, submit proposals, and respond to BAFO.
 */

import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  Clock,
  Building2,
  CheckCircle,
  AlertCircle,
  Calendar,
  DollarSign,
  ClipboardList,
  MessageCircleQuestion,
  Send,
  Edit3,
  RefreshCw,
  Award,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Scale,
  Target,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import {
  usePortalRFP,
  usePortalRFPQA,
  usePortalBAFORound,
  type PortalRFP,
  type PortalRFPSection,
  type PortalProposal,
  type PortalBAFORound,
} from '@/lib/api/portal';
import PortalProposalForm from './PortalProposalForm';
import PortalBAFOResponseForm from './PortalBAFOResponseForm';

export default function PortalRFPDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [showBAFOForm, setShowBAFOForm] = useState(false);

  const { data: rfp, isLoading, error } = usePortalRFP(id || '');
  const { data: qaList = [] } = usePortalRFPQA(id || '');
  const { data: bafoRound } = usePortalBAFORound(id || '');

  // Check if RFP is open and accepting proposals
  const canSubmitProposal = useMemo(() => {
    if (!rfp) return false;
    if (rfp.status !== 'PUBLISHED') return false;
    if (rfp.my_proposal && rfp.my_proposal.status !== 'DRAFT') return false;
    if (rfp.submission_deadline && isPast(new Date(rfp.submission_deadline))) return false;
    return true;
  }, [rfp]);

  // Check if BAFO response can be submitted
  const canSubmitBAFO = useMemo(() => {
    if (!bafoRound) return false;
    if (bafoRound.status !== 'OPEN') return false;
    if (bafoRound.my_response?.status === 'SUBMITTED') return false;
    if (bafoRound.deadline && isPast(new Date(bafoRound.deadline))) return false;
    return true;
  }, [bafoRound]);

  const dueDate = rfp?.submission_deadline ? new Date(rfp.submission_deadline) : null;
  const isOverdue = dueDate ? isPast(dueDate) : false;
  const isUrgent = dueDate && !isOverdue && (dueDate.getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000;

  const questionDeadline = rfp?.question_deadline ? new Date(rfp.question_deadline) : null;
  const canAskQuestions = questionDeadline ? !isPast(questionDeadline) : false;

  // Unanswered/published Q&A count
  const publishedQA = qaList.filter(q => q.is_published && q.answer);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error || !rfp) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-lg font-medium text-neutral-900">RFP not found</h3>
        <p className="mt-2 text-sm text-neutral-500">
          This RFP may have been removed or you don't have access.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/portal/rfps')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to RFPs
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Back Button */}
      <Link
        to="/portal/rfps"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to RFPs
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-purple-100">
            <FileText className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-primary-600">{rfp.number}</span>
              <RFPStatusBadge rfp={rfp} bafoRound={bafoRound} />
            </div>
            <h1 className="text-2xl font-semibold text-neutral-900 mt-1">{rfp.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {rfp.organization_name}
              </span>
              {rfp.category && (
                <span className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  {rfp.category}
                </span>
              )}
              {dueDate && (
                <span
                  className={`flex items-center gap-1 ${
                    isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : ''
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  Due {format(dueDate, 'MMM d, yyyy')}
                  {!isOverdue && ` (${formatDistanceToNow(dueDate, { addSuffix: true })})`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {canSubmitBAFO && !showBAFOForm && (
            <Button onClick={() => setShowBAFOForm(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              Submit BAFO Response
            </Button>
          )}
          {canSubmitProposal && !showProposalForm && !rfp.my_proposal && (
            <Button onClick={() => setShowProposalForm(true)}>
              <Send className="h-4 w-4 mr-2" />
              Start Proposal
            </Button>
          )}
          {canSubmitProposal && rfp.my_proposal?.status === 'DRAFT' && !showProposalForm && (
            <Button onClick={() => setShowProposalForm(true)} variant="outline">
              <Edit3 className="h-4 w-4 mr-2" />
              Continue Proposal
            </Button>
          )}
        </div>
      </motion.div>

      {/* BAFO Alert */}
      {bafoRound?.status === 'OPEN' && canSubmitBAFO && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-indigo-200 bg-indigo-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-indigo-100">
                  <RefreshCw className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-indigo-900">
                    Best and Final Offer (BAFO) Round {bafoRound.round_number} is Open
                  </p>
                  <p className="text-sm text-indigo-700">
                    {bafoRound.deadline
                      ? `Deadline: ${format(new Date(bafoRound.deadline), 'MMM d, yyyy h:mm a')}`
                      : 'No deadline specified'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requirements">
            Requirements
            {rfp.sections && rfp.sections.length > 0 && (
              <Badge variant="secondary" className="ml-2">{rfp.sections.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="qa">
            Q&A
            {publishedQA.length > 0 && (
              <Badge variant="secondary" className="ml-2">{publishedQA.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="my-proposal">My Proposal</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Executive Summary */}
              {rfp.executive_summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Executive Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-neutral-600 whitespace-pre-wrap">{rfp.executive_summary}</p>
                  </CardContent>
                </Card>
              )}

              {/* Description */}
              {rfp.description && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-neutral-600 whitespace-pre-wrap">{rfp.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* Evaluation Criteria */}
              {rfp.evaluation_criteria && rfp.evaluation_criteria.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Scale className="h-5 w-5" />
                      Evaluation Criteria
                    </CardTitle>
                    <CardDescription>
                      Your proposal will be evaluated based on these criteria
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {rfp.evaluation_criteria.map((criterion) => (
                        <div key={criterion.id} className="flex items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-neutral-900">{criterion.name}</span>
                              <span className="text-sm text-neutral-500">{criterion.weight}%</span>
                            </div>
                            <Progress value={criterion.weight} className="h-2" />
                            {criterion.description && (
                              <p className="text-sm text-neutral-500 mt-1">{criterion.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Attachments */}
              {rfp.attachments && rfp.attachments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Paperclip className="h-5 w-5" />
                      Attachments ({rfp.attachments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {rfp.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-neutral-50 transition-colors"
                        >
                          <FileText className="h-5 w-5 text-neutral-400" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-neutral-900 truncate">{attachment.filename}</p>
                            <p className="text-xs text-neutral-500">
                              {(attachment.file_size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* RFP Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">RFP Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoRow label="RFP Number" value={rfp.number} />
                  <InfoRow label="Organization" value={rfp.organization_name} />
                  <InfoRow label="Category" value={rfp.category || 'Not specified'} />
                  {(rfp.budget_min || rfp.budget_max) && (
                    <InfoRow
                      label="Budget Range"
                      value={`${rfp.currency} ${rfp.budget_min || '0'} - ${rfp.budget_max || 'N/A'}`}
                    />
                  )}
                  <Separator />
                  <InfoRow
                    label="Submission Deadline"
                    value={dueDate ? format(dueDate, 'MMM d, yyyy h:mm a') : 'No deadline'}
                    highlight={isUrgent}
                  />
                  {questionDeadline && (
                    <InfoRow
                      label="Question Deadline"
                      value={format(questionDeadline, 'MMM d, yyyy h:mm a')}
                    />
                  )}
                  <InfoRow
                    label="Created"
                    value={format(new Date(rfp.created_at), 'MMM d, yyyy')}
                  />
                </CardContent>
              </Card>

              {/* Deadline Warning */}
              {dueDate && !isOverdue && canSubmitProposal && (
                <Card className={isUrgent ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Calendar className={`h-5 w-5 ${isUrgent ? 'text-amber-600' : 'text-blue-600'}`} />
                      <div>
                        <p className={`font-medium ${isUrgent ? 'text-amber-900' : 'text-blue-900'}`}>
                          {isUrgent ? 'Deadline Approaching!' : 'Submission Deadline'}
                        </p>
                        <p className={`text-sm mt-1 ${isUrgent ? 'text-amber-700' : 'text-blue-700'}`}>
                          {formatDistanceToNow(dueDate, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Award Notice */}
              {rfp.status === 'AWARDED' && (
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Award className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="font-medium text-yellow-900">RFP Awarded</p>
                        <p className="text-sm mt-1 text-yellow-700">
                          This RFP has been awarded to a supplier.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Requirements Tab */}
        <TabsContent value="requirements" className="space-y-6 mt-6">
          {rfp.sections && rfp.sections.length > 0 ? (
            <div className="space-y-4">
              {rfp.sections
                .sort((a, b) => a.order - b.order)
                .map((section) => (
                  <SectionCard key={section.id} section={section} />
                ))}
            </div>
          ) : rfp.requirements && rfp.requirements.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Requirements ({rfp.requirements.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rfp.requirements.map((req, index) => (
                    <div key={req.id} className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary-100 text-primary-700 text-xs font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">{req.category}</Badge>
                          {req.is_mandatory && (
                            <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                          )}
                          <span className="text-xs text-neutral-500">Weight: {req.weight}%</span>
                        </div>
                        <p className="text-neutral-700">{req.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardList className="h-12 w-12 text-neutral-300 mx-auto" />
                <h3 className="mt-4 text-lg font-medium text-neutral-900">No requirements specified</h3>
                <p className="mt-2 text-sm text-neutral-500">
                  This RFP doesn't have detailed requirements sections.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Q&A Tab */}
        <TabsContent value="qa" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircleQuestion className="h-5 w-5" />
                Published Q&A ({publishedQA.length})
              </CardTitle>
              <CardDescription>
                Questions and answers that have been shared with all bidders
              </CardDescription>
            </CardHeader>
            <CardContent>
              {publishedQA.length > 0 ? (
                <div className="space-y-4">
                  {publishedQA.map((qa) => (
                    <div key={qa.id} className="p-4 rounded-lg border">
                      <p className="font-medium text-neutral-900 mb-2">Q: {qa.question}</p>
                      <p className="text-neutral-600 pl-4 border-l-2 border-primary-200">
                        A: {qa.answer}
                      </p>
                      <p className="text-xs text-neutral-400 mt-2">
                        Answered {qa.answered_at && format(new Date(qa.answered_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageCircleQuestion className="h-12 w-12 text-neutral-300 mx-auto" />
                  <p className="mt-4 text-neutral-500">No published Q&A yet</p>
                  {canAskQuestions && (
                    <p className="text-sm text-neutral-400 mt-1">
                      Questions can be asked until {questionDeadline && format(questionDeadline, 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Proposal Tab */}
        <TabsContent value="my-proposal" className="space-y-6 mt-6">
          {rfp.my_proposal ? (
            <ProposalSummary proposal={rfp.my_proposal} rfp={rfp} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-neutral-300 mx-auto" />
                <h3 className="mt-4 text-lg font-medium text-neutral-900">No proposal yet</h3>
                <p className="mt-2 text-sm text-neutral-500">
                  {canSubmitProposal
                    ? 'Start working on your proposal to participate in this RFP.'
                    : 'The submission deadline has passed or the RFP is no longer accepting proposals.'}
                </p>
                {canSubmitProposal && (
                  <Button className="mt-4" onClick={() => setShowProposalForm(true)}>
                    <Send className="h-4 w-4 mr-2" />
                    Start Proposal
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Proposal Form Modal/Panel */}
      <AnimatePresence>
        {showProposalForm && (
          <PortalProposalForm
            rfp={rfp}
            proposal={rfp.my_proposal}
            onClose={() => setShowProposalForm(false)}
          />
        )}
      </AnimatePresence>

      {/* BAFO Form Modal/Panel */}
      <AnimatePresence>
        {showBAFOForm && bafoRound && (
          <PortalBAFOResponseForm
            rfp={rfp}
            bafoRound={bafoRound}
            onClose={() => setShowBAFOForm(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Section Card Component
function SectionCard({ section }: { section: PortalRFPSection }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-neutral-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary-100 text-primary-700 font-medium">
                  {section.order}
                </span>
                <div>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs">{section.section_type}</Badge>
                    <span>Weight: {section.weight}%</span>
                    <span>{section.questions.length} questions</span>
                  </CardDescription>
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-neutral-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-neutral-400" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {section.description && (
              <p className="text-sm text-neutral-600 mb-4">{section.description}</p>
            )}
            <div className="space-y-3">
              {section.questions
                .sort((a, b) => a.order - b.order)
                .map((question, index) => (
                  <div key={question.id} className="p-3 rounded-lg bg-neutral-50">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-neutral-500 mt-0.5">
                        Q{index + 1}.
                      </span>
                      <div className="flex-1">
                        <p className="text-neutral-900">{question.question_text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{question.question_type}</Badge>
                          {question.is_required && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                        </div>
                        {question.help_text && (
                          <p className="text-xs text-neutral-500 mt-1">{question.help_text}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Proposal Summary Component
function ProposalSummary({ proposal, rfp }: { proposal: PortalProposal; rfp: PortalRFP }) {
  const statusColors: Record<string, string> = {
    DRAFT: 'bg-neutral-100 text-neutral-700',
    SUBMITTED: 'bg-green-100 text-green-700',
    SHORTLISTED: 'bg-cyan-100 text-cyan-700',
    BAFO_REQUESTED: 'bg-indigo-100 text-indigo-700',
    BAFO_SUBMITTED: 'bg-indigo-100 text-indigo-700',
    AWARDED: 'bg-yellow-100 text-yellow-700',
    NOT_AWARDED: 'bg-neutral-100 text-neutral-600',
    WITHDRAWN: 'bg-red-100 text-red-700',
  };

  return (
    <Card className={proposal.status === 'AWARDED' ? 'border-yellow-200 bg-yellow-50/30' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {proposal.status === 'AWARDED' && <Award className="h-5 w-5 text-yellow-600" />}
            Your Proposal
          </CardTitle>
          <Badge className={statusColors[proposal.status] || 'bg-neutral-100'}>
            {proposal.status.replace('_', ' ')}
          </Badge>
        </div>
        <CardDescription>
          {proposal.submitted_at
            ? `Submitted ${format(new Date(proposal.submitted_at), 'MMM d, yyyy h:mm a')}`
            : `Last updated ${format(new Date(proposal.updated_at), 'MMM d, yyyy h:mm a')}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {proposal.proposed_amount && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
            <span className="text-neutral-600">Proposed Amount</span>
            <span className="text-lg font-semibold text-neutral-900">
              {rfp.currency} {parseFloat(proposal.proposed_amount).toLocaleString()}
            </span>
          </div>
        )}

        {proposal.executive_summary && (
          <div>
            <p className="text-sm font-medium text-neutral-700 mb-1">Executive Summary</p>
            <p className="text-neutral-600 text-sm">{proposal.executive_summary}</p>
          </div>
        )}

        {proposal.sections.length > 0 && (
          <div>
            <p className="text-sm font-medium text-neutral-700 mb-2">Response Sections</p>
            <div className="space-y-2">
              {proposal.sections.map((section) => {
                const answeredCount = section.responses.filter(
                  r => r.response_text || r.response_number || r.response_date || r.selected_options.length > 0
                ).length;
                const totalCount = section.responses.length;

                return (
                  <div key={section.id} className="flex items-center justify-between p-2 rounded bg-neutral-50">
                    <span className="text-sm text-neutral-700">{section.section_title}</span>
                    <span className="text-xs text-neutral-500">
                      {answeredCount}/{totalCount} answered
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {proposal.status === 'AWARDED' && (
          <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-yellow-900">Congratulations!</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              Your proposal has been selected for this RFP.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Status Badge Component
function RFPStatusBadge({ rfp, bafoRound }: { rfp: PortalRFP; bafoRound?: PortalBAFORound | null }) {
  if (bafoRound?.status === 'OPEN' && bafoRound.my_response?.status !== 'SUBMITTED') {
    return (
      <Badge className="bg-indigo-100 text-indigo-700">BAFO Requested</Badge>
    );
  }

  if (bafoRound?.my_response?.status === 'SUBMITTED') {
    return (
      <Badge className="bg-indigo-100 text-indigo-700">BAFO Submitted</Badge>
    );
  }

  if (rfp.my_proposal?.status === 'SUBMITTED') {
    return (
      <Badge className="bg-green-100 text-green-700">Proposal Submitted</Badge>
    );
  }

  if (rfp.my_proposal?.status === 'SHORTLISTED') {
    return (
      <Badge className="bg-cyan-100 text-cyan-700">Shortlisted</Badge>
    );
  }

  if (rfp.my_proposal?.status === 'AWARDED') {
    return (
      <Badge className="bg-yellow-100 text-yellow-700">Awarded</Badge>
    );
  }

  switch (rfp.status) {
    case 'PUBLISHED':
      return <Badge className="bg-purple-100 text-purple-700">Open</Badge>;
    case 'UNDER_EVALUATION':
      return <Badge className="bg-blue-100 text-blue-700">Under Evaluation</Badge>;
    case 'CLOSED':
      return <Badge variant="outline">Closed</Badge>;
    case 'AWARDED':
      return <Badge className="bg-yellow-100 text-yellow-700">Awarded</Badge>;
    default:
      return <Badge variant="outline">{rfp.status}</Badge>;
  }
}

// Helper Components
function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-amber-600' : 'text-neutral-900'}`}>
        {value}
      </span>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64 mt-2" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
