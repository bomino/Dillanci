import { useMemo, useState } from 'react';
import {
  FileText,
  Calendar,
  DollarSign,
  Star,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  MessageSquare,
  Paperclip,
  User,
  ChevronDown,
  ChevronRight,
  Hash,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import type {
  Proposal,
  ProposalStatus,
  ProposalSection,
  QuestionResponse,
} from '@/types';

// Helper component for collapsible sections
function SectionCollapsible({
  section,
  children,
}: {
  section: ProposalSection;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full p-3 rounded-lg border hover:bg-neutral-50 transition-colors">
          <div className="flex items-center gap-3">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-neutral-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-neutral-500" />
            )}
            <span className="font-medium text-left">{section.section_title}</span>
            {section.section_score && (
              <Badge variant="outline" className="text-xs">
                Score: {parseFloat(section.section_score).toFixed(1)}
              </Badge>
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Status configuration matching ProposalsList
const PROPOSAL_STATUS_CONFIG: Record<
  ProposalStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    icon: <FileText className="h-4 w-4" />,
  },
  SUBMITTED: {
    label: 'Submitted',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <Clock className="h-4 w-4" />,
  },
  SHORTLISTED: {
    label: 'Shortlisted',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <Star className="h-4 w-4" />,
  },
  BAFO_REQUESTED: {
    label: 'BAFO Requested',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  BAFO_SUBMITTED: {
    label: 'BAFO Submitted',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  AWARDED: {
    label: 'Awarded',
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: <Award className="h-4 w-4" />,
  },
  NOT_AWARDED: {
    label: 'Not Awarded',
    color: 'bg-neutral-100 text-neutral-600 border-neutral-200',
    icon: <XCircle className="h-4 w-4" />,
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  DISQUALIFIED: {
    label: 'Disqualified',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: <XCircle className="h-4 w-4" />,
  },
};

interface ProposalDetailViewProps {
  proposal: Proposal;
  onClose?: () => void;
  onShortlist?: () => Promise<void>;
  onRequestBAFO?: () => Promise<void>;
  onAward?: () => Promise<void>;
  onDisqualify?: (reason: string) => Promise<void>;
  onExportPDF?: () => void;
}

export function ProposalDetailView({
  proposal,
  onClose,
  onShortlist,
  onRequestBAFO,
  onAward,
  onDisqualify,
  onExportPDF,
}: ProposalDetailViewProps) {
  const statusConfig = PROPOSAL_STATUS_CONFIG[proposal.status];

  const formatCurrency = (amount: string | null | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate score percentages
  const scorePercentages = useMemo(() => {
    const technical = proposal.technical_score ? parseFloat(proposal.technical_score) : null;
    const management = proposal.management_score ? parseFloat(proposal.management_score) : null;
    const pricing = proposal.pricing_score ? parseFloat(proposal.pricing_score) : null;
    const overall = proposal.overall_score ? parseFloat(proposal.overall_score) : null;

    return { technical, management, pricing, overall };
  }, [proposal]);

  const renderQuestionAnswer = (response: QuestionResponse) => {
    switch (response.question_type) {
      case 'FILE':
        return (
          <div className="flex items-center gap-2 text-primary-600">
            <Paperclip className="h-4 w-4" />
            <span className="text-sm underline cursor-pointer hover:text-primary-700">
              {response.answer_text || 'View attachment'}
            </span>
          </div>
        );
      case 'DATE':
        return (
          <span className="text-neutral-700">
            {response.answer_date
              ? new Date(response.answer_date).toLocaleDateString()
              : response.answer_text || '-'}
          </span>
        );
      case 'NUMBER':
        return (
          <span className="font-mono text-neutral-700">
            {response.answer_number ?? response.answer_text ?? '-'}
          </span>
        );
      case 'SINGLE_CHOICE':
      case 'MULTI_CHOICE':
        return (
          <div className="flex flex-wrap gap-1.5">
            {(response.answer_choice || [response.answer_text]).filter(Boolean).map((choice, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {choice}
              </Badge>
            ))}
          </div>
        );
      case 'RATING':
        const rating = parseInt(response.answer_text || '0', 10);
        return (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 ${
                  star <= rating ? 'text-amber-400 fill-amber-400' : 'text-neutral-300'
                }`}
              />
            ))}
            <span className="ml-2 text-sm text-neutral-500">({rating}/5)</span>
          </div>
        );
      case 'TEXTAREA':
        return (
          <div className="bg-neutral-50 p-3 rounded-lg text-sm text-neutral-700 whitespace-pre-wrap">
            {response.answer_text || '-'}
          </div>
        );
      default:
        return <span className="text-neutral-700">{response.answer_text || '-'}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-neutral-900">{proposal.supplier_name}</h2>
            <Badge className={`${statusConfig.color} border`}>
              <span className="flex items-center gap-1.5">
                {statusConfig.icon}
                {statusConfig.label}
              </span>
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-neutral-500">
            <span className="flex items-center gap-1.5">
              <Hash className="h-4 w-4" />
              {proposal.proposal_number}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Submitted {formatDate(proposal.submitted_at)}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {proposal.submitted_by_name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onExportPDF && (
            <Button variant="outline" size="sm" onClick={onExportPDF}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total Amount</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {formatCurrency(proposal.total_amount)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Overall Score</p>
                <p
                  className={`text-2xl font-semibold ${
                    scorePercentages.overall !== null
                      ? scorePercentages.overall >= 80
                        ? 'text-green-600'
                        : scorePercentages.overall >= 60
                          ? 'text-amber-600'
                          : 'text-red-600'
                      : 'text-neutral-400'
                  }`}
                >
                  {scorePercentages.overall?.toFixed(1) ?? '-'}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Star className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Rank</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {proposal.rank ? `#${proposal.rank}` : '-'}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Award className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Revision</p>
                <p className="text-2xl font-semibold text-neutral-900">v{proposal.revision_number}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Breakdown */}
      {(scorePercentages.technical !== null ||
        scorePercentages.management !== null ||
        scorePercentages.pricing !== null) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-primary-600" />
              Score Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {scorePercentages.technical !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">Technical</span>
                    <span className="font-medium">{scorePercentages.technical.toFixed(1)}</span>
                  </div>
                  <Progress value={scorePercentages.technical} className="h-2" />
                </div>
              )}
              {scorePercentages.management !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">Management</span>
                    <span className="font-medium">{scorePercentages.management.toFixed(1)}</span>
                  </div>
                  <Progress value={scorePercentages.management} className="h-2" />
                </div>
              )}
              {scorePercentages.pricing !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">Pricing</span>
                    <span className="font-medium">{scorePercentages.pricing.toFixed(1)}</span>
                  </div>
                  <Progress value={scorePercentages.pricing} className="h-2" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section Responses */}
      {proposal.sections && proposal.sections.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary-600" />
              Section Responses
            </CardTitle>
            <CardDescription>Review responses by RFP section</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {proposal.sections.map((section) => (
                <SectionCollapsible key={section.id} section={section}>
                  <div className="pt-2 space-y-4">
                    {section.evaluator_comments && (
                      <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 text-amber-700 text-sm font-medium mb-1">
                          <MessageSquare className="h-4 w-4" />
                          Evaluator Comments
                        </div>
                        <p className="text-sm text-amber-900">{section.evaluator_comments}</p>
                      </div>
                    )}
                    {/* Show question responses for this section */}
                    {proposal.question_responses
                      .filter((r) => r.question === section.rfp_section)
                      .map((response) => (
                        <div key={response.id} className="border-b pb-3 last:border-0">
                          <p className="text-sm font-medium text-neutral-700 mb-2">
                            {response.question_text}
                          </p>
                          {renderQuestionAnswer(response)}
                        </div>
                      ))}
                  </div>
                </SectionCollapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Question Responses (if no sections) */}
      {(!proposal.sections || proposal.sections.length === 0) &&
        proposal.question_responses.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary-600" />
                Question Responses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {proposal.question_responses.map((response) => (
                  <div key={response.id} className="border-b pb-4 last:border-0">
                    <p className="text-sm font-medium text-neutral-700 mb-2">
                      {response.question_text}
                    </p>
                    {renderQuestionAnswer(response)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Line Items / Pricing */}
      {proposal.line_items && proposal.line_items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary-600" />
              Pricing Details
            </CardTitle>
            <CardDescription>Line item pricing breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50">
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Extended</TableHead>
                    <TableHead className="text-center">Lead Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposal.line_items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-neutral-500">{index + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-neutral-900">
                            {item.rfp_line_description}
                          </p>
                          {(item.manufacturer || item.part_number) && (
                            <p className="text-xs text-neutral-500">
                              {item.manufacturer}
                              {item.manufacturer && item.part_number && ' - '}
                              {item.part_number}
                            </p>
                          )}
                          {item.notes && <p className="text-xs text-neutral-400 mt-1">{item.notes}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {parseFloat(item.quantity).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(item.extended_price)}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.lead_time_days ? (
                          <Badge variant="outline" className="text-xs">
                            {item.lead_time_days} days
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Total */}
            <div className="flex justify-end mt-4 pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-neutral-500">Total Amount</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {formatCurrency(proposal.total_amount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {proposal.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary-600" />
              Additional Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-neutral-50 p-4 rounded-lg text-neutral-700 whitespace-pre-wrap">
              {proposal.notes}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        {proposal.status === 'SUBMITTED' && onShortlist && (
          <Button variant="outline" onClick={onShortlist}>
            <Star className="h-4 w-4 mr-2" />
            Add to Shortlist
          </Button>
        )}

        {(proposal.status === 'SUBMITTED' || proposal.status === 'SHORTLISTED') && onRequestBAFO && (
          <Button variant="outline" onClick={onRequestBAFO}>
            Request BAFO
          </Button>
        )}

        {(proposal.status === 'SHORTLISTED' || proposal.status === 'BAFO_SUBMITTED') && onAward && (
          <Button className="bg-green-600 hover:bg-green-700" onClick={onAward}>
            <Award className="h-4 w-4 mr-2" />
            Award Contract
          </Button>
        )}

        {proposal.status !== 'DISQUALIFIED' &&
          proposal.status !== 'AWARDED' &&
          proposal.status !== 'NOT_AWARDED' &&
          onDisqualify && (
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => {
                const reason = prompt('Enter disqualification reason:');
                if (reason) {
                  onDisqualify(reason);
                }
              }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Disqualify
            </Button>
          )}
      </div>
    </div>
  );
}

export default ProposalDetailView;
