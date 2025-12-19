import { useState, useMemo } from 'react';
import {
  MessageCircleQuestion,
  Send,
  Eye,
  EyeOff,
  Globe,
  Users,
  Lock,
  Filter,
  Download,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  User,
  Building2,
  MessageSquare,
  MoreVertical,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatDateTime, formatRelativeTime } from '@/lib/utils';

// Types for export
export type QuestionStatus = 'PENDING' | 'ANSWERED' | 'PUBLISHED';
export type QAVisibility = 'PRIVATE' | 'PUBLIC' | 'ALL_BIDDERS';

export interface RFPQuestion {
  id: string;
  rfp_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  asked_by_id: string;
  asked_by_name: string;
  question: string;
  answer: string | null;
  answered_by_id: string | null;
  answered_by_name: string | null;
  answered_at: string | null;
  visibility: QAVisibility;
  visibility_display: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // Amendment tracking
  requires_amendment?: boolean;
  amendment_note?: string | null;
  amendment_version?: number;
  previous_answers?: {
    answer: string;
    answered_at: string;
    answered_by_name: string;
  }[];
}

interface QASectionProps {
  rfpId: string;
  questions: RFPQuestion[];
  onAnswerQuestion?: (
    questionId: string,
    answer: string,
    visibility: QAVisibility,
    requiresAmendment?: boolean,
    amendmentNote?: string
  ) => Promise<void>;
  onPublishAnswer?: (questionId: string, visibility: QAVisibility) => Promise<void>;
  onUnpublishAnswer?: (questionId: string) => Promise<void>;
  onDeleteQuestion?: (questionId: string) => Promise<void>;
  onEditAnswer?: (
    questionId: string,
    answer: string,
    visibility: QAVisibility,
    amendmentNote?: string
  ) => Promise<void>;
  onExportQA?: (format: 'pdf' | 'csv') => Promise<void>;
  isOwner?: boolean;
  isLoading?: boolean;
  rfpStatus?: string;
}

type FilterStatus = 'all' | 'pending' | 'answered' | 'published';
type SortOption = 'newest' | 'oldest' | 'supplier';

export function QASection({
  rfpId: _rfpId,
  questions,
  onAnswerQuestion,
  onPublishAnswer,
  onUnpublishAnswer,
  onDeleteQuestion,
  onEditAnswer,
  onExportQA,
  isOwner = false,
  isLoading = false,
  rfpStatus = 'PUBLISHED',
}: QASectionProps) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  // Dialog states
  const [answerDialogOpen, setAnswerDialogOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<RFPQuestion | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerVisibility, setAnswerVisibility] = useState<QAVisibility>('ALL_BIDDERS');
  const [requiresAmendment, setRequiresAmendment] = useState(false);
  const [amendmentNote, setAmendmentNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Publish dialog
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishVisibility, setPublishVisibility] = useState<QAVisibility>('ALL_BIDDERS');

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  // History dialog
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyQuestion, setHistoryQuestion] = useState<RFPQuestion | null>(null);

  // Get unique suppliers from questions
  const suppliers = useMemo(() => {
    const supplierMap = new Map<string, string>();
    questions.forEach(q => {
      if (q.supplier_id && q.supplier_name) {
        supplierMap.set(q.supplier_id, q.supplier_name);
      }
    });
    return Array.from(supplierMap.entries()).map(([id, name]) => ({ id, name }));
  }, [questions]);

  // Computed stats
  const stats = useMemo(() => {
    const total = questions.length;
    const pending = questions.filter(q => !q.answer).length;
    const answered = questions.filter(q => q.answer && !q.is_published).length;
    const published = questions.filter(q => q.is_published).length;
    return { total, pending, answered, published };
  }, [questions]);

  // Filtered and sorted questions
  const filteredQuestions = useMemo(() => {
    let filtered = [...questions];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(q =>
        q.question.toLowerCase().includes(query) ||
        q.answer?.toLowerCase().includes(query) ||
        q.supplier_name?.toLowerCase().includes(query) ||
        q.asked_by_name.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(q => {
        if (filterStatus === 'pending') return !q.answer;
        if (filterStatus === 'answered') return q.answer && !q.is_published;
        if (filterStatus === 'published') return q.is_published;
        return true;
      });
    }

    // Supplier filter
    if (filterSupplier !== 'all') {
      filtered = filtered.filter(q => q.supplier_id === filterSupplier);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'supplier') {
        return (a.supplier_name || '').localeCompare(b.supplier_name || '');
      }
      return 0;
    });

    return filtered;
  }, [questions, searchQuery, filterStatus, filterSupplier, sortBy]);

  // Toggle question expansion
  const toggleExpanded = (questionId: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedQuestions(newExpanded);
  };

  // Open answer dialog
  const openAnswerDialog = (question: RFPQuestion) => {
    setSelectedQuestion(question);
    setAnswerText(question.answer || '');
    setAnswerVisibility(question.visibility || 'ALL_BIDDERS');
    setRequiresAmendment(false);
    setAmendmentNote('');
    setAnswerDialogOpen(true);
  };

  // Submit answer
  const handleSubmitAnswer = async () => {
    if (!selectedQuestion || !answerText.trim()) return;

    setIsSubmitting(true);
    try {
      if (selectedQuestion.answer && onEditAnswer) {
        // Editing existing answer
        await onEditAnswer(
          selectedQuestion.id,
          answerText,
          answerVisibility,
          requiresAmendment ? amendmentNote : undefined
        );
      } else if (onAnswerQuestion) {
        // New answer
        await onAnswerQuestion(
          selectedQuestion.id,
          answerText,
          answerVisibility,
          requiresAmendment,
          requiresAmendment ? amendmentNote : undefined
        );
      }
      setAnswerDialogOpen(false);
      setSelectedQuestion(null);
      setAnswerText('');
    } catch (error) {
      console.error('Failed to submit answer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open publish dialog
  const openPublishDialog = (question: RFPQuestion) => {
    setSelectedQuestion(question);
    setPublishVisibility(question.visibility || 'ALL_BIDDERS');
    setPublishDialogOpen(true);
  };

  // Publish answer
  const handlePublish = async () => {
    if (!selectedQuestion || !onPublishAnswer) return;

    setIsSubmitting(true);
    try {
      await onPublishAnswer(selectedQuestion.id, publishVisibility);
      setPublishDialogOpen(false);
      setSelectedQuestion(null);
    } catch (error) {
      console.error('Failed to publish answer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unpublish answer
  const handleUnpublish = async (questionId: string) => {
    if (!onUnpublishAnswer) return;

    try {
      await onUnpublishAnswer(questionId);
    } catch (error) {
      console.error('Failed to unpublish answer:', error);
    }
  };

  // Delete question
  const handleDelete = async () => {
    if (!questionToDelete || !onDeleteQuestion) return;

    setIsSubmitting(true);
    try {
      await onDeleteQuestion(questionToDelete);
      setDeleteDialogOpen(false);
      setQuestionToDelete(null);
    } catch (error) {
      console.error('Failed to delete question:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export Q&A
  const handleExport = async (format: 'pdf' | 'csv') => {
    if (!onExportQA) return;

    try {
      await onExportQA(format);
    } catch (error) {
      console.error('Failed to export Q&A:', error);
    }
  };

  // View history
  const openHistoryDialog = (question: RFPQuestion) => {
    setHistoryQuestion(question);
    setHistoryDialogOpen(true);
  };

  // Get status badge
  const getStatusBadge = (question: RFPQuestion) => {
    if (question.is_published) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-700">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Published
        </Badge>
      );
    }
    if (question.answer) {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          <MessageSquare className="h-3 w-3 mr-1" />
          Answered
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  // Get visibility icon
  const getVisibilityIcon = (visibility: QAVisibility) => {
    switch (visibility) {
      case 'PUBLIC':
        return <Globe className="h-3.5 w-3.5" />;
      case 'ALL_BIDDERS':
        return <Users className="h-3.5 w-3.5" />;
      case 'PRIVATE':
        return <Lock className="h-3.5 w-3.5" />;
    }
  };

  // Get visibility label
  const getVisibilityLabel = (visibility: QAVisibility) => {
    switch (visibility) {
      case 'PUBLIC':
        return 'Public';
      case 'ALL_BIDDERS':
        return 'All Bidders';
      case 'PRIVATE':
        return 'Private';
    }
  };

  // Can edit/answer based on RFP status
  const canManageQA = isOwner && ['PUBLISHED', 'EVALUATION'].includes(rfpStatus);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
            <p className="mt-4 text-neutral-500">Loading Q&A...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card with Stats */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageCircleQuestion className="h-5 w-5 text-primary-600" />
                Q&A Portal
              </CardTitle>
              <CardDescription>
                Centralized vendor questions and clarifications
              </CardDescription>
            </div>
            {onExportQA && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('pdf')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <button
              onClick={() => setFilterStatus('all')}
              className={cn(
                'p-3 rounded-lg border transition-colors text-left',
                filterStatus === 'all'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-neutral-200 hover:bg-neutral-50'
              )}
            >
              <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
              <p className="text-xs text-neutral-500">Total Questions</p>
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={cn(
                'p-3 rounded-lg border transition-colors text-left',
                filterStatus === 'pending'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-neutral-200 hover:bg-neutral-50'
              )}
            >
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-xs text-neutral-500">Pending</p>
            </button>
            <button
              onClick={() => setFilterStatus('answered')}
              className={cn(
                'p-3 rounded-lg border transition-colors text-left',
                filterStatus === 'answered'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-neutral-200 hover:bg-neutral-50'
              )}
            >
              <p className="text-2xl font-bold text-blue-600">{stats.answered}</p>
              <p className="text-xs text-neutral-500">Answered</p>
            </button>
            <button
              onClick={() => setFilterStatus('published')}
              className={cn(
                'p-3 rounded-lg border transition-colors text-left',
                filterStatus === 'published'
                  ? 'border-green-500 bg-green-50'
                  : 'border-neutral-200 hover:bg-neutral-50'
              )}
            >
              <p className="text-2xl font-bold text-green-600">{stats.published}</p>
              <p className="text-xs text-neutral-500">Published</p>
            </button>
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Search questions or answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger className="w-[180px]">
                <Building2 className="h-4 w-4 mr-2 text-neutral-400" />
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2 text-neutral-400" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="supplier">By Supplier</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Questions List */}
      <Card>
        <CardContent className="p-0">
          {filteredQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircleQuestion className="h-12 w-12 text-neutral-300 mb-3" />
              <p className="text-neutral-500 font-medium">No questions found</p>
              <p className="text-sm text-neutral-400 mt-1">
                {questions.length === 0
                  ? 'No questions have been submitted yet.'
                  : 'Try adjusting your filters.'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="divide-y divide-neutral-100">
                {filteredQuestions.map((question) => {
                  const isExpanded = expandedQuestions.has(question.id);

                  return (
                    <div key={question.id} className="p-4 hover:bg-neutral-50/50">
                      {/* Question Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {getStatusBadge(question)}
                            {question.is_published && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="gap-1">
                                      {getVisibilityIcon(question.visibility)}
                                      {getVisibilityLabel(question.visibility)}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Answer visible to: {getVisibilityLabel(question.visibility)}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {question.amendment_version && question.amendment_version > 1 && (
                              <Badge
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() => openHistoryDialog(question)}
                              >
                                v{question.amendment_version} (amended)
                              </Badge>
                            )}
                          </div>

                          {/* Question Text */}
                          <p className="text-sm text-neutral-900 font-medium">
                            {question.question}
                          </p>

                          {/* Meta info */}
                          <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                            {question.supplier_name && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {question.supplier_name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {question.asked_by_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatRelativeTime(question.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {question.answer && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpanded(question.id)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          )}

                          {canManageQA && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!question.answer ? (
                                  <DropdownMenuItem onClick={() => openAnswerDialog(question)}>
                                    <Send className="h-4 w-4 mr-2" />
                                    Answer Question
                                  </DropdownMenuItem>
                                ) : (
                                  <>
                                    <DropdownMenuItem onClick={() => openAnswerDialog(question)}>
                                      <Edit2 className="h-4 w-4 mr-2" />
                                      Edit Answer
                                    </DropdownMenuItem>
                                    {!question.is_published ? (
                                      <DropdownMenuItem onClick={() => openPublishDialog(question)}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        Publish Answer
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={() => handleUnpublish(question.id)}>
                                        <EyeOff className="h-4 w-4 mr-2" />
                                        Unpublish Answer
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                                {question.amendment_version && question.amendment_version > 1 && (
                                  <DropdownMenuItem onClick={() => openHistoryDialog(question)}>
                                    <Clock className="h-4 w-4 mr-2" />
                                    View History
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    setQuestionToDelete(question.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Question
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>

                      {/* Answer Section (Expandable) */}
                      {question.answer && isExpanded && (
                        <div className="mt-4 pl-4 border-l-2 border-primary-200">
                          <div className="bg-primary-50/50 rounded-lg p-3">
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                              {question.answer}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                              {question.answered_by_name && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  Answered by {question.answered_by_name}
                                </span>
                              )}
                              {question.answered_at && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDateTime(question.answered_at)}
                                </span>
                              )}
                            </div>
                            {question.amendment_note && (
                              <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                                <AlertCircle className="h-3 w-3 inline mr-1" />
                                Amendment: {question.amendment_note}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Quick Answer Button for unanswered questions */}
                      {!question.answer && canManageQA && (
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAnswerDialog(question)}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Answer this question
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Answer Dialog */}
      <Dialog open={answerDialogOpen} onOpenChange={setAnswerDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedQuestion?.answer ? 'Edit Answer' : 'Answer Question'}
            </DialogTitle>
            <DialogDescription>
              {selectedQuestion?.answer
                ? 'Update your answer to this question. Changes will be tracked.'
                : 'Provide an answer to the vendor\'s question.'}
            </DialogDescription>
          </DialogHeader>

          {selectedQuestion && (
            <div className="space-y-4">
              {/* Original Question */}
              <div className="bg-neutral-50 rounded-lg p-3">
                <p className="text-xs text-neutral-500 mb-1">Question from {selectedQuestion.supplier_name || 'Internal'}</p>
                <p className="text-sm text-neutral-900">{selectedQuestion.question}</p>
              </div>

              {/* Answer Input */}
              <div>
                <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                  Your Answer
                </label>
                <Textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={6}
                />
              </div>

              {/* Visibility Selection */}
              <div>
                <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                  Visibility
                </label>
                <Select value={answerVisibility} onValueChange={(v) => setAnswerVisibility(v as QAVisibility)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_BIDDERS">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        All Bidders - Visible to all invited suppliers
                      </div>
                    </SelectItem>
                    <SelectItem value="PUBLIC">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Public - Visible to everyone
                      </div>
                    </SelectItem>
                    <SelectItem value="PRIVATE">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Private - Only visible to the asking supplier
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-neutral-500 mt-1">
                  Choose who can see this answer when published.
                </p>
              </div>

              {/* Amendment Option (for edits) */}
              {selectedQuestion.answer && (
                <div className="border-t pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresAmendment}
                      onChange={(e) => setRequiresAmendment(e.target.checked)}
                      className="rounded border-neutral-300"
                    />
                    <span className="text-sm text-neutral-700">
                      Mark as amendment (notifies vendors of update)
                    </span>
                  </label>

                  {requiresAmendment && (
                    <div className="mt-3">
                      <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                        Amendment Note
                      </label>
                      <Input
                        value={amendmentNote}
                        onChange={(e) => setAmendmentNote(e.target.value)}
                        placeholder="Brief description of what changed..."
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAnswerDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAnswer}
              disabled={!answerText.trim() || isSubmitting}
            >
              {isSubmitting ? 'Saving...' : selectedQuestion?.answer ? 'Update Answer' : 'Submit Answer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Answer</DialogTitle>
            <DialogDescription>
              Choose the visibility for this answer. Once published, vendors will be able to see it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                Publish Visibility
              </label>
              <Select value={publishVisibility} onValueChange={(v) => setPublishVisibility(v as QAVisibility)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_BIDDERS">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      All Bidders
                    </div>
                  </SelectItem>
                  <SelectItem value="PUBLIC">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Public
                    </div>
                  </SelectItem>
                  <SelectItem value="PRIVATE">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Private (asking supplier only)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Publishing this answer will make it visible according to the selected visibility setting.
                All eligible vendors will be notified.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={isSubmitting}>
              {isSubmitting ? 'Publishing...' : 'Publish Answer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question and its answer? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Answer History</DialogTitle>
            <DialogDescription>
              View all versions of the answer to this question.
            </DialogDescription>
          </DialogHeader>

          {historyQuestion && (
            <div className="space-y-4">
              {/* Current Answer */}
              <div className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge>Current (v{historyQuestion.amendment_version || 1})</Badge>
                  {historyQuestion.answered_at && (
                    <span className="text-xs text-neutral-500">
                      {formatDateTime(historyQuestion.answered_at)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                  {historyQuestion.answer}
                </p>
                {historyQuestion.answered_by_name && (
                  <p className="text-xs text-neutral-500 mt-2">
                    by {historyQuestion.answered_by_name}
                  </p>
                )}
                {historyQuestion.amendment_note && (
                  <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                    Amendment: {historyQuestion.amendment_note}
                  </div>
                )}
              </div>

              {/* Previous Answers */}
              {historyQuestion.previous_answers && historyQuestion.previous_answers.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-neutral-700">Previous Versions</h4>
                  {historyQuestion.previous_answers.map((prev, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-neutral-50">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">
                          v{(historyQuestion.amendment_version || 1) - index - 1}
                        </Badge>
                        <span className="text-xs text-neutral-500">
                          {formatDateTime(prev.answered_at)}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 whitespace-pre-wrap">
                        {prev.answer}
                      </p>
                      <p className="text-xs text-neutral-500 mt-2">
                        by {prev.answered_by_name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default QASection;
