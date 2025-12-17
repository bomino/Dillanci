import * as React from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  MessageCircleQuestion,
  Send,
  Eye,
  EyeOff,
  CheckCircle,
  Clock,
  User,
  Building2,
  AlertCircle,
  Loader2,
  Filter,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type QuestionStatus = 'PENDING' | 'ANSWERED' | 'PUBLISHED';

export interface RFPQuestion {
  id: string;
  rfp_id: string;
  supplier_id: string;
  supplier_name: string;
  question: string;
  answer: string | null;
  answered_by: string | null;
  answered_at: string | null;
  is_published: boolean;
  published_at: string | null;
  requires_amendment: boolean;
  amendment_note: string | null;
  created_at: string;
}

interface QASectionProps {
  rfpId: string;
  questions: RFPQuestion[];
  onAnswerQuestion: (questionId: string, answer: string, requiresAmendment: boolean, amendmentNote?: string) => Promise<void>;
  onPublishAnswer: (questionId: string) => Promise<void>;
  onUnpublishAnswer: (questionId: string) => Promise<void>;
  isOwner?: boolean;
  className?: string;
}

const statusConfig: Record<QuestionStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  PENDING: { label: 'Pending', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: Clock },
  ANSWERED: { label: 'Answered', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: CheckCircle },
  PUBLISHED: { label: 'Published', color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: Eye },
};

function getQuestionStatus(question: RFPQuestion): QuestionStatus {
  if (question.is_published) return 'PUBLISHED';
  if (question.answer) return 'ANSWERED';
  return 'PENDING';
}

export function QASection({
  questions,
  onAnswerQuestion,
  onPublishAnswer,
  onUnpublishAnswer,
  isOwner = false,
  className,
}: QASectionProps) {
  const [filter, setFilter] = React.useState<'all' | QuestionStatus>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [answerDialogOpen, setAnswerDialogOpen] = React.useState(false);
  const [selectedQuestion, setSelectedQuestion] = React.useState<RFPQuestion | null>(null);
  const [answerText, setAnswerText] = React.useState('');
  const [requiresAmendment, setRequiresAmendment] = React.useState(false);
  const [amendmentNote, setAmendmentNote] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [publishingId, setPublishingId] = React.useState<string | null>(null);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  // Filter and search questions
  const filteredQuestions = React.useMemo(() => {
    let result = [...questions];

    // Apply status filter
    if (filter !== 'all') {
      result = result.filter(q => getQuestionStatus(q) === filter);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(q =>
        q.question.toLowerCase().includes(query) ||
        q.supplier_name.toLowerCase().includes(query) ||
        (q.answer && q.answer.toLowerCase().includes(query))
      );
    }

    // Sort by date (newest first)
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return result;
  }, [questions, filter, searchQuery]);

  // Count by status
  const counts = React.useMemo(() => {
    return {
      all: questions.length,
      PENDING: questions.filter(q => getQuestionStatus(q) === 'PENDING').length,
      ANSWERED: questions.filter(q => getQuestionStatus(q) === 'ANSWERED').length,
      PUBLISHED: questions.filter(q => getQuestionStatus(q) === 'PUBLISHED').length,
    };
  }, [questions]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openAnswerDialog = (question: RFPQuestion) => {
    setSelectedQuestion(question);
    setAnswerText(question.answer || '');
    setRequiresAmendment(question.requires_amendment);
    setAmendmentNote(question.amendment_note || '');
    setAnswerDialogOpen(true);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedQuestion || !answerText.trim()) return;

    setIsSubmitting(true);
    try {
      await onAnswerQuestion(
        selectedQuestion.id,
        answerText.trim(),
        requiresAmendment,
        requiresAmendment ? amendmentNote.trim() : undefined
      );
      setAnswerDialogOpen(false);
      setSelectedQuestion(null);
      setAnswerText('');
      setRequiresAmendment(false);
      setAmendmentNote('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async (questionId: string) => {
    setPublishingId(questionId);
    try {
      await onPublishAnswer(questionId);
    } finally {
      setPublishingId(null);
    }
  };

  const handleUnpublish = async (questionId: string) => {
    setPublishingId(questionId);
    try {
      await onUnpublishAnswer(questionId);
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <MessageCircleQuestion className="h-5 w-5" />
            Q&A Section
            <Badge variant="secondary" className="ml-2">
              {questions.length} question{questions.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>

          {/* Stats Pills */}
          <div className="flex items-center gap-2">
            {counts.PENDING > 0 && (
              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                {counts.PENDING} pending
              </Badge>
            )}
            {counts.ANSWERED > 0 && (
              <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
                {counts.ANSWERED} answered
              </Badge>
            )}
            {counts.PUBLISHED > 0 && (
              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                {counts.PUBLISHED} published
              </Badge>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search questions..."
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
              <SelectItem value="PENDING">Pending ({counts.PENDING})</SelectItem>
              <SelectItem value="ANSWERED">Answered ({counts.ANSWERED})</SelectItem>
              <SelectItem value="PUBLISHED">Published ({counts.PUBLISHED})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircleQuestion className="h-10 w-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-neutral-500 text-sm">
              {questions.length === 0
                ? 'No questions have been submitted yet'
                : 'No questions match your filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((question) => {
              const status = getQuestionStatus(question);
              const config = statusConfig[status];
              const StatusIcon = config.icon;
              const isExpanded = expandedIds.has(question.id);

              return (
                <Collapsible
                  key={question.id}
                  open={isExpanded}
                  onOpenChange={() => toggleExpanded(question.id)}
                >
                  <div className={cn(
                    'border rounded-lg overflow-hidden',
                    question.requires_amendment && 'border-amber-300 bg-amber-50/50'
                  )}>
                    {/* Question Header */}
                    <CollapsibleTrigger asChild>
                      <div className="flex items-start gap-3 p-4 cursor-pointer hover:bg-neutral-50 transition-colors">
                        <div className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0',
                          config.bgColor
                        )}>
                          <StatusIcon className={cn('h-4 w-4', config.color)} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              'px-2 py-0.5 text-xs font-medium rounded-full',
                              config.bgColor,
                              config.color
                            )}>
                              {config.label}
                            </span>
                            <span className="text-xs text-neutral-400">
                              {formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}
                            </span>
                            {question.requires_amendment && (
                              <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Amendment
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm font-medium text-neutral-900 line-clamp-2">
                            {question.question}
                          </p>

                          <div className="flex items-center gap-1 mt-2 text-xs text-neutral-500">
                            <Building2 className="h-3 w-3" />
                            <span>{question.supplier_name}</span>
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    {/* Expanded Content */}
                    <CollapsibleContent>
                      <div className="px-4 pb-4 border-t bg-neutral-50/50">
                        {/* Full Question */}
                        <div className="pt-4">
                          <h4 className="text-xs font-medium text-neutral-500 uppercase mb-2">
                            Question
                          </h4>
                          <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                            {question.question}
                          </p>
                        </div>

                        {/* Answer Section */}
                        {question.answer ? (
                          <div className="mt-4 p-3 bg-white rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="h-4 w-4 text-neutral-400" />
                              <span className="text-xs text-neutral-500">
                                Answered by {question.answered_by}
                                {question.answered_at && (
                                  <> on {format(new Date(question.answered_at), 'MMM d, yyyy h:mm a')}</>
                                )}
                              </span>
                            </div>
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                              {question.answer}
                            </p>

                            {question.requires_amendment && question.amendment_note && (
                              <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
                                <div className="flex items-center gap-1 text-xs font-medium text-amber-700 mb-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Amendment Note
                                </div>
                                <p className="text-xs text-amber-700">{question.amendment_note}</p>
                              </div>
                            )}

                            {question.is_published && question.published_at && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                                <Eye className="h-3 w-3" />
                                Published on {format(new Date(question.published_at), 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-4 p-3 bg-neutral-100 rounded-lg border border-dashed text-center">
                            <Clock className="h-5 w-5 text-neutral-400 mx-auto mb-1" />
                            <p className="text-sm text-neutral-500">Awaiting response</p>
                          </div>
                        )}

                        {/* Actions */}
                        {isOwner && (
                          <div className="mt-4 flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAnswerDialog(question)}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              {question.answer ? 'Edit Answer' : 'Answer'}
                            </Button>

                            {question.answer && !question.is_published && (
                              <Button
                                size="sm"
                                onClick={() => handlePublish(question.id)}
                                disabled={publishingId === question.id}
                              >
                                {publishingId === question.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Eye className="h-4 w-4 mr-1" />
                                )}
                                Publish
                              </Button>
                            )}

                            {question.is_published && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnpublish(question.id)}
                                disabled={publishingId === question.id}
                              >
                                {publishingId === question.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <EyeOff className="h-4 w-4 mr-1" />
                                )}
                                Unpublish
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Answer Dialog */}
      <Dialog open={answerDialogOpen} onOpenChange={setAnswerDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedQuestion?.answer ? 'Edit Answer' : 'Answer Question'}
            </DialogTitle>
            <DialogDescription>
              Provide an answer to this question. You can publish it to all bidders afterward.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Question Display */}
            <div className="p-3 bg-neutral-50 rounded-lg">
              <div className="flex items-center gap-1 text-xs text-neutral-500 mb-2">
                <Building2 className="h-3 w-3" />
                {selectedQuestion?.supplier_name}
              </div>
              <p className="text-sm text-neutral-700">{selectedQuestion?.question}</p>
            </div>

            {/* Answer Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">Your Answer</label>
              <Textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Type your answer..."
                rows={5}
                className="resize-none"
              />
            </div>

            {/* Amendment Toggle */}
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requiresAmendment}
                  onChange={(e) => setRequiresAmendment(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-neutral-700">
                  This answer requires an RFP amendment
                </span>
              </label>

              {requiresAmendment && (
                <Textarea
                  value={amendmentNote}
                  onChange={(e) => setAmendmentNote(e.target.value)}
                  placeholder="Describe the amendment to be made..."
                  rows={2}
                  className="resize-none mt-2"
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAnswerDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAnswer}
              disabled={!answerText.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Save Answer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default QASection;
