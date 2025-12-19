/**
 * Portal Proposal Form - Multi-section form for submitting proposals.
 */

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  X,
  Save,
  Send,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  DollarSign,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  useSaveProposalDraft,
  useSubmitProposal,
  type PortalRFP,
  type PortalProposal,
  type PortalRFPSection,
  type PortalRFPQuestion,
} from '@/lib/api/portal';
import { toast } from 'sonner';

// Form schemas
const questionResponseSchema = z.object({
  question_id: z.string(),
  response_text: z.string().optional(),
  response_number: z.number().optional(),
  response_date: z.string().optional(),
  selected_options: z.array(z.string()).optional(),
});

const sectionResponseSchema = z.object({
  section_id: z.string(),
  responses: z.array(questionResponseSchema),
});

const proposalFormSchema = z.object({
  executive_summary: z.string().min(1, 'Executive summary is required'),
  proposed_amount: z.string().optional(),
  sections: z.array(sectionResponseSchema),
});

type ProposalFormData = z.infer<typeof proposalFormSchema>;

interface PortalProposalFormProps {
  rfp: PortalRFP;
  proposal: PortalProposal | null | undefined;
  onClose: () => void;
}

export default function PortalProposalForm({ rfp, proposal, onClose }: PortalProposalFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const saveProposalMutation = useSaveProposalDraft();
  const submitProposalMutation = useSubmitProposal();

  // Steps: Overview + each section
  const sections = rfp.sections || [];
  const steps = [
    { id: 'overview', title: 'Overview', description: 'Basic proposal information' },
    ...sections.map((s) => ({
      id: s.id,
      title: s.title,
      description: `${s.questions.length} questions`,
    })),
  ];

  // Initialize form with existing proposal data or empty
  const form = useForm<ProposalFormData>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      executive_summary: proposal?.executive_summary || '',
      proposed_amount: proposal?.proposed_amount || '',
      sections: sections.map((section) => {
        const existingSection = proposal?.sections.find((s) => s.section_id === section.id);
        return {
          section_id: section.id,
          responses: section.questions.map((question) => {
            const existingResponse = existingSection?.responses.find(
              (r) => r.question_id === question.id
            );
            return {
              question_id: question.id,
              response_text: existingResponse?.response_text || '',
              response_number: existingResponse?.response_number ?? undefined,
              response_date: existingResponse?.response_date || '',
              selected_options: existingResponse?.selected_options || [],
            };
          }),
        };
      }),
    },
  });

  // Calculate completion percentage
  const calculateCompletion = () => {
    const values = form.getValues();
    let totalFields = 1; // executive_summary
    let completedFields = values.executive_summary ? 1 : 0;

    sections.forEach((section, sectionIndex) => {
      section.questions.forEach((question, questionIndex) => {
        if (question.is_required) {
          totalFields++;
          const response = values.sections[sectionIndex]?.responses[questionIndex];
          if (response) {
            if (question.question_type === 'TEXT' || question.question_type === 'TEXTAREA') {
              if (response.response_text) completedFields++;
            } else if (question.question_type === 'NUMBER') {
              if (response.response_number !== undefined) completedFields++;
            } else if (question.question_type === 'DATE') {
              if (response.response_date) completedFields++;
            } else if (question.question_type === 'SINGLE_CHOICE' || question.question_type === 'MULTI_CHOICE') {
              if (response.selected_options && response.selected_options.length > 0) completedFields++;
            }
          }
        }
      });
    });

    return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  };

  const completion = calculateCompletion();

  // Auto-save draft
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const data = form.getValues();
      await saveProposalMutation.mutateAsync({
        rfpId: rfp.id,
        data: {
          executive_summary: data.executive_summary,
          proposed_amount: data.proposed_amount,
          sections: data.sections.map((section) => ({
            section_id: section.section_id,
            responses: section.responses.map((response) => ({
              question_id: response.question_id,
              response_text: response.response_text,
              response_number: response.response_number,
              response_date: response.response_date,
              selected_options: response.selected_options,
            })),
          })),
        },
      });
      toast.success('Draft saved successfully');
    } catch (err) {
      toast.error('Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit proposal
  const handleSubmit = async () => {
    try {
      // Save draft first
      await handleSaveDraft();
      // Then submit
      await submitProposalMutation.mutateAsync(rfp.id);
      toast.success('Proposal submitted successfully!');
      setConfirmSubmitOpen(false);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit proposal';
      toast.error(message);
    }
  };

  // Navigate steps
  const goToNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              {proposal ? 'Edit Proposal' : 'Submit Proposal'}
            </h2>
            <p className="text-sm text-neutral-500">{rfp.title}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Progress value={completion} className="w-24 h-2" />
              <span className="text-sm text-neutral-500">{completion}%</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="px-4 py-3 border-b bg-neutral-50 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(index)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  index === currentStep
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : index < currentStep
                    ? 'bg-green-100 text-green-700'
                    : 'text-neutral-500 hover:bg-neutral-100'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <span className="flex items-center justify-center h-4 w-4 rounded-full bg-current text-white text-xs">
                    {index + 1}
                  </span>
                )}
                <span className="hidden sm:inline">{step.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form className="space-y-6">
            {currentStep === 0 ? (
              <OverviewStep
                form={form}
                rfp={rfp}
              />
            ) : (
              <SectionStep
                form={form}
                section={sections[currentStep - 1]}
                sectionIndex={currentStep - 1}
              />
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-neutral-50">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={goToPreviousStep}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button onClick={goToNextStep}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSaving || saveProposalMutation.isPending}
            >
              {isSaving || saveProposalMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Draft
            </Button>
            <Button
              onClick={() => setConfirmSubmitOpen(true)}
              disabled={completion < 100 || submitProposalMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              Submit Proposal
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Confirm Submit Dialog */}
      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Proposal Submission</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit this proposal? Once submitted, you may not be able
              to modify it.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 rounded-lg bg-neutral-50 border space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">RFP</span>
                <span className="font-medium text-neutral-900">{rfp.number}</span>
              </div>
              {form.getValues('proposed_amount') && (
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Proposed Amount</span>
                  <span className="font-medium text-neutral-900">
                    {rfp.currency} {parseFloat(form.getValues('proposed_amount') || '0').toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Completion</span>
                <span className="font-medium text-green-600">{completion}%</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitProposalMutation.isPending}
            >
              {submitProposalMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Proposal
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// Overview Step Component
interface OverviewStepProps {
  form: ReturnType<typeof useForm<ProposalFormData>>;
  rfp: PortalRFP;
}

function OverviewStep({ form, rfp }: OverviewStepProps) {
  const { register, formState: { errors } } = form;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Proposal Overview
          </CardTitle>
          <CardDescription>
            Provide a high-level summary of your proposal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="executive_summary" required>
              Executive Summary
            </Label>
            <Textarea
              id="executive_summary"
              placeholder="Summarize your proposal, highlighting key strengths and differentiators..."
              rows={6}
              {...register('executive_summary')}
            />
            {errors.executive_summary && (
              <p className="text-sm text-red-500">{errors.executive_summary.message}</p>
            )}
            <p className="text-xs text-neutral-500">
              This summary will be visible to evaluators as the first impression of your proposal.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proposed_amount">
              Proposed Amount ({rfp.currency})
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                id="proposed_amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="pl-9"
                {...register('proposed_amount')}
              />
            </div>
            {rfp.budget_min && rfp.budget_max && (
              <p className="text-xs text-neutral-500">
                Budget range: {rfp.currency} {rfp.budget_min} - {rfp.budget_max}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Section Step Component
interface SectionStepProps {
  form: ReturnType<typeof useForm<ProposalFormData>>;
  section: PortalRFPSection;
  sectionIndex: number;
}

function SectionStep({ form, section, sectionIndex }: SectionStepProps) {
  const { control, register, formState: { errors } } = form;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-neutral-900">{section.title}</h3>
        {section.description && (
          <p className="text-sm text-neutral-600 mt-1">{section.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline">{section.section_type}</Badge>
          <span className="text-sm text-neutral-500">Weight: {section.weight}%</span>
        </div>
      </div>

      <div className="space-y-6">
        {section.questions
          .sort((a, b) => a.order - b.order)
          .map((question, questionIndex) => (
            <QuestionField
              key={question.id}
              question={question}
              questionIndex={questionIndex}
              sectionIndex={sectionIndex}
              form={form}
            />
          ))}
      </div>
    </div>
  );
}

// Question Field Component
interface QuestionFieldProps {
  question: PortalRFPQuestion;
  questionIndex: number;
  sectionIndex: number;
  form: ReturnType<typeof useForm<ProposalFormData>>;
}

function QuestionField({ question, questionIndex, sectionIndex, form }: QuestionFieldProps) {
  const { control, register } = form;
  const fieldPath = `sections.${sectionIndex}.responses.${questionIndex}` as const;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-neutral-500">Q{questionIndex + 1}.</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-neutral-900">{question.question_text}</span>
                {question.is_required && (
                  <Badge variant="destructive" className="text-xs">Required</Badge>
                )}
              </div>
              {question.help_text && (
                <p className="text-sm text-neutral-500 mt-1">{question.help_text}</p>
              )}
            </div>
          </div>

          <div className="pl-6">
            {(question.question_type === 'TEXT') && (
              <Input
                placeholder="Enter your response..."
                {...register(`${fieldPath}.response_text`)}
              />
            )}

            {(question.question_type === 'TEXTAREA') && (
              <Textarea
                placeholder="Enter your detailed response..."
                rows={4}
                {...register(`${fieldPath}.response_text`)}
              />
            )}

            {(question.question_type === 'NUMBER') && (
              <Input
                type="number"
                placeholder="Enter a number..."
                {...register(`${fieldPath}.response_number`, { valueAsNumber: true })}
              />
            )}

            {(question.question_type === 'DATE') && (
              <Input
                type="date"
                {...register(`${fieldPath}.response_date`)}
              />
            )}

            {(question.question_type === 'SINGLE_CHOICE') && question.options && (
              <Controller
                name={`${fieldPath}.selected_options`}
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value?.[0] || ''}
                    onValueChange={(value) => field.onChange([value])}
                    className="space-y-2"
                  >
                    {question.options?.map((option) => (
                      <div key={option} className="flex items-center gap-2">
                        <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                        <Label htmlFor={`${question.id}-${option}`} className="font-normal">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              />
            )}

            {(question.question_type === 'MULTI_CHOICE') && question.options && (
              <Controller
                name={`${fieldPath}.selected_options`}
                control={control}
                render={({ field }) => (
                  <div className="space-y-2">
                    {question.options?.map((option) => (
                      <div key={option} className="flex items-center gap-2">
                        <Checkbox
                          id={`${question.id}-${option}`}
                          checked={field.value?.includes(option)}
                          onCheckedChange={(checked) => {
                            const current = field.value || [];
                            if (checked) {
                              field.onChange([...current, option]);
                            } else {
                              field.onChange(current.filter((v) => v !== option));
                            }
                          }}
                        />
                        <Label htmlFor={`${question.id}-${option}`} className="font-normal">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              />
            )}

            {(question.question_type === 'RATING') && (
              <Controller
                name={`${fieldPath}.response_number`}
                control={control}
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => field.onChange(rating)}
                        className={`w-10 h-10 rounded-lg border-2 font-medium transition-colors ${
                          field.value === rating
                            ? 'border-primary-500 bg-primary-100 text-primary-700'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                )}
              />
            )}

            {(question.question_type === 'FILE') && (
              <div className="border-2 border-dashed border-neutral-200 rounded-lg p-6 text-center">
                <p className="text-neutral-500">File upload coming soon</p>
                <p className="text-xs text-neutral-400 mt-1">
                  {question.allowed_file_types?.join(', ')}
                  {question.max_file_size && ` • Max ${question.max_file_size / 1024 / 1024}MB`}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
