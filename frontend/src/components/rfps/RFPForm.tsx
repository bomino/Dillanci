import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Users,
  Calendar,
  DollarSign,
  FileText,
  ClipboardCheck,
  Scale,
  Building2,
  Target,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField, FormActions } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

import type { RFP, Supplier, RFPType, IPOwnership } from '@/types';

// RFP Type options
const rfpTypeOptions: { value: RFPType; label: string; description: string }[] = [
  { value: 'SERVICES', label: 'Services', description: 'Professional and operational services' },
  { value: 'GOODS', label: 'Goods', description: 'Physical products and materials' },
  { value: 'COMBINED', label: 'Combined', description: 'Both goods and services' },
];

// Bidding type options
const biddingTypeOptions = [
  { value: 'OPEN', label: 'Open Bid', description: 'Any supplier can view and respond' },
  { value: 'SEALED', label: 'Sealed Bid', description: 'Proposals hidden until deadline' },
  { value: 'MULTI_ROUND', label: 'Multi-Round', description: 'Multiple negotiation rounds' },
];

// Visibility options
const visibilityOptions = [
  { value: 'INVITED', label: 'Invited Only', description: 'Only invited suppliers can respond' },
  { value: 'PUBLIC', label: 'Public', description: 'Open to all qualified suppliers' },
];

// Payment terms options
const paymentTermsOptions = [
  { value: 'NET15', label: 'Net 15' },
  { value: 'NET30', label: 'Net 30' },
  { value: 'NET45', label: 'Net 45' },
  { value: 'NET60', label: 'Net 60' },
  { value: 'NET90', label: 'Net 90' },
  { value: 'DUE_ON_RECEIPT', label: 'Due on Receipt' },
  { value: 'ADVANCE', label: '50% Advance, 50% on Delivery' },
  { value: 'MILESTONE', label: 'Milestone-based' },
  { value: 'OTHER', label: 'Other' },
];

// IP Ownership options
const ipOwnershipOptions: { value: IPOwnership; label: string; description: string }[] = [
  { value: 'CLIENT', label: 'Client Owns All IP', description: 'All intellectual property belongs to the client' },
  { value: 'VENDOR', label: 'Vendor Retains IP', description: 'Vendor keeps intellectual property rights' },
  { value: 'SHARED', label: 'Shared/Licensed', description: 'Shared ownership or licensing arrangement' },
  { value: 'NEGOTIABLE', label: 'To Be Negotiated', description: 'IP terms to be negotiated with selected vendor' },
];

// Currency options
const currencyOptions = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'NGN', label: 'NGN - Nigerian Naira' },
];

// Section types
const sectionTypes = [
  { value: 'ADMINISTRATIVE', label: 'Administrative' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'MANAGEMENT', label: 'Management' },
  { value: 'PRICING', label: 'Pricing' },
  { value: 'TERMS', label: 'Terms & Legal' },
  { value: 'QUALIFICATIONS', label: 'Qualifications' },
];

// Question types
const questionTypes = [
  { value: 'TEXT', label: 'Short Text' },
  { value: 'TEXTAREA', label: 'Long Text' },
  { value: 'SINGLE_CHOICE', label: 'Single Choice' },
  { value: 'MULTI_CHOICE', label: 'Multiple Choice' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'FILE', label: 'File Upload' },
  { value: 'RATING', label: 'Rating Scale' },
];

// Evaluation criteria schema
const evaluationCriterionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  weight: z.number().min(0).max(100),
  max_score: z.number().min(1).max(100).default(100),
});

// RFP Section schema
const rfpSectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Section title is required'),
  section_type: z.string(),
  description: z.string().optional(),
  order: z.number(),
  weight: z.number().min(0).max(100),
});

// RFP Question schema
const rfpQuestionSchema = z.object({
  id: z.string().optional(),
  question_text: z.string().min(1, 'Question text is required'),
  question_type: z.string(),
  is_required: z.boolean().default(true),
  order: z.number(),
  is_mandatory_attachment: z.boolean().default(false),
  attachment_type: z.string().optional(),
});

// Form validation schema
const rfpFormSchema = z.object({
  // Basic Information (Tab 1)
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().min(1, 'Description is required'),
  rfp_type: z.enum(['SERVICES', 'GOODS', 'COMBINED']),
  bidding_type: z.enum(['OPEN', 'SEALED', 'MULTI_ROUND']),
  visibility: z.enum(['INVITED', 'PUBLIC']),

  // Project Overview (Tab 1 continued)
  executive_summary: z.string().optional(),
  current_state_description: z.string().optional(),
  future_state_goals: z.string().optional(),
  organization_context: z.string().optional(),

  // Timeline (Tab 4)
  response_deadline: z.string().nullable().optional(),
  question_deadline: z.string().nullable().optional(),
  qa_session_date: z.string().nullable().optional(),
  shortlist_announcement_date: z.string().nullable().optional(),
  award_target_date: z.string().nullable().optional(),
  contract_start_date: z.string().nullable().optional(),
  contract_end_date: z.string().nullable().optional(),

  // Budget (Tab 5)
  budget_min: z.string().optional(),
  budget_max: z.string().optional(),
  currency: z.string().default('USD'),

  // Terms & Conditions (Tab 7)
  nda_required: z.boolean().default(false),
  payment_terms: z.string().optional(),
  ip_ownership: z.enum(['CLIENT', 'VENDOR', 'SHARED', 'NEGOTIABLE']).default('CLIENT'),
  insurance_requirements: z.string().optional(),
  confidentiality_terms: z.string().optional(),

  // Scope of Work / Sections (Tab 2)
  sections: z.array(rfpSectionSchema).optional(),

  // Vendor Requirements / Questions (Tab 3)
  questions: z.array(rfpQuestionSchema).optional(),

  // Evaluation Criteria (Tab 6)
  scoring_criteria: z.array(evaluationCriterionSchema).optional(),
});

type RFPFormData = z.infer<typeof rfpFormSchema>;

// Payload types
export interface RFPSectionPayload {
  id?: string;
  title: string;
  section_type: string;
  description?: string;
  order: number;
  weight: number;
}

export interface RFPQuestionPayload {
  id?: string;
  question_text: string;
  question_type: string;
  is_required: boolean;
  order: number;
  is_mandatory_attachment: boolean;
  attachment_type?: string;
}

export interface ScoringCriteriaPayload {
  id?: string;
  name: string;
  description?: string;
  weight: number;
  max_score: number;
}

export interface RFPPayload {
  title: string;
  description: string;
  rfp_type: RFPType;
  bidding_type: string;
  visibility: string;
  executive_summary?: string;
  current_state_description?: string;
  future_state_goals?: string;
  organization_context?: string;
  response_deadline?: string | null;
  question_deadline?: string | null;
  qa_session_date?: string | null;
  shortlist_announcement_date?: string | null;
  award_target_date?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  budget_min?: string | null;
  budget_max?: string | null;
  currency: string;
  nda_required: boolean;
  payment_terms?: string;
  ip_ownership: IPOwnership;
  insurance_requirements?: string;
  confidentiality_terms?: string;
  sections?: RFPSectionPayload[];
  questions?: RFPQuestionPayload[];
  scoring_criteria?: ScoringCriteriaPayload[];
  invited_suppliers?: string[];
  // Backward compatibility fields
  category?: string;
  submission_deadline?: string | null;
  evaluation_deadline?: string | null;
}

interface RFPFormProps {
  initialData?: RFP;
  onSubmit: (data: RFPPayload) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
  availableSuppliers?: Supplier[];
}

// Default evaluation criteria
const defaultScoringCriteria: ScoringCriteriaPayload[] = [
  { name: 'Technical Capability', weight: 30, description: 'Assessment of technical solution and approach', max_score: 100 },
  { name: 'Experience & References', weight: 25, description: 'Relevant project experience and client references', max_score: 100 },
  { name: 'Cost', weight: 25, description: 'Total cost of ownership evaluation', max_score: 100 },
  { name: 'Implementation Plan', weight: 20, description: 'Project timeline and methodology', max_score: 100 },
];

export default function RFPForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = 'create',
  availableSuppliers = [],
}: RFPFormProps) {
  // Invited suppliers state
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(() => {
    if (initialData?.invitations) {
      return initialData.invitations.map(inv => inv.supplier);
    }
    return [];
  });

  // Active section for tab navigation
  const [activeSection, setActiveSection] = useState<string>('overview');

  const {
    control,
    handleSubmit,
    watch,
  } = useForm<RFPFormData>({
    resolver: zodResolver(rfpFormSchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      rfp_type: (initialData?.rfp_type as 'SERVICES' | 'GOODS' | 'COMBINED') || 'SERVICES',
      bidding_type: initialData?.bidding_type || 'OPEN',
      visibility: initialData?.visibility || 'INVITED',
      executive_summary: initialData?.executive_summary || '',
      current_state_description: initialData?.current_state_description || '',
      future_state_goals: initialData?.future_state_goals || '',
      organization_context: initialData?.organization_context || '',
      response_deadline: initialData?.response_deadline?.split('T')[0] || '',
      question_deadline: initialData?.question_deadline?.split('T')[0] || '',
      qa_session_date: initialData?.qa_session_date?.split('T')[0] || '',
      shortlist_announcement_date: initialData?.shortlist_announcement_date?.split('T')[0] || '',
      award_target_date: initialData?.award_target_date?.split('T')[0] || '',
      contract_start_date: initialData?.contract_start_date || '',
      contract_end_date: initialData?.contract_end_date || '',
      budget_min: initialData?.budget_min || '',
      budget_max: initialData?.budget_max || '',
      currency: initialData?.currency || 'USD',
      nda_required: initialData?.nda_required || false,
      payment_terms: initialData?.payment_terms || 'NET30',
      ip_ownership: initialData?.ip_ownership || 'CLIENT',
      insurance_requirements: initialData?.insurance_requirements || '',
      confidentiality_terms: initialData?.confidentiality_terms || '',
      sections: initialData?.sections?.map(s => ({
        id: s.id,
        title: s.title,
        section_type: s.section_type,
        description: s.instructions || '',
        order: s.order,
        weight: parseFloat(s.weight) || 0,
      })) || [],
      questions: initialData?.questions?.map(q => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        is_required: q.is_required,
        order: q.order,
        is_mandatory_attachment: q.is_mandatory_attachment,
        attachment_type: q.attachment_type || '',
      })) || [],
      scoring_criteria: initialData?.scoring_criteria?.map(sc => ({
        id: sc.id,
        name: sc.name,
        description: sc.description || '',
        weight: parseFloat(sc.weight) || 0,
        max_score: parseFloat(sc.max_score) || 100,
      })) || defaultScoringCriteria,
    },
  });

  // Field arrays for sections, questions, and criteria
  const { fields: sectionFields, append: appendSection, remove: removeSection } = useFieldArray({
    control,
    name: 'sections',
  });

  const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control,
    name: 'questions',
  });

  const { fields: criteriaFields, append: appendCriteria, remove: removeCriteria } = useFieldArray({
    control,
    name: 'scoring_criteria',
  });

  const scoringCriteria = watch('scoring_criteria') || [];
  const sections = watch('sections') || [];

  // Calculate total weights
  const totalCriteriaWeight = scoringCriteria.reduce((sum, c) => sum + (c?.weight || 0), 0);
  const totalSectionWeight = sections.reduce((sum, s) => sum + (s?.weight || 0), 0);

  // Validate scoring criteria weights
  const validateCriteriaWeights = (): boolean => {
    if (scoringCriteria.length > 0 && totalCriteriaWeight !== 100) {
      toast.error('Evaluation criteria weights must sum to 100%', {
        description: `Current total: ${totalCriteriaWeight}%`,
      });
      return false;
    }
    return true;
  };

  // Format date for API (ISO datetime)
  const formatDateForAPI = (date: string | null | undefined): string | null => {
    if (!date) return null;
    return `${date}T23:59:59Z`;
  };

  // Handle form submission
  const handleFormSubmit = async (formData: RFPFormData) => {
    // Validate criteria weights
    if (!validateCriteriaWeights()) {
      setActiveSection('evaluation');
      return;
    }

    // Build payload
    const payload: RFPPayload = {
      title: formData.title,
      description: formData.description,
      rfp_type: formData.rfp_type,
      bidding_type: formData.bidding_type,
      visibility: formData.visibility,
      executive_summary: formData.executive_summary || undefined,
      current_state_description: formData.current_state_description || undefined,
      future_state_goals: formData.future_state_goals || undefined,
      organization_context: formData.organization_context || undefined,
      response_deadline: formatDateForAPI(formData.response_deadline),
      question_deadline: formatDateForAPI(formData.question_deadline),
      qa_session_date: formatDateForAPI(formData.qa_session_date),
      shortlist_announcement_date: formatDateForAPI(formData.shortlist_announcement_date),
      award_target_date: formatDateForAPI(formData.award_target_date),
      contract_start_date: formData.contract_start_date || null,
      contract_end_date: formData.contract_end_date || null,
      budget_min: formData.budget_min || null,
      budget_max: formData.budget_max || null,
      currency: formData.currency,
      nda_required: formData.nda_required,
      payment_terms: formData.payment_terms || undefined,
      ip_ownership: formData.ip_ownership,
      insurance_requirements: formData.insurance_requirements || undefined,
      confidentiality_terms: formData.confidentiality_terms || undefined,
      sections: formData.sections?.map((s, idx) => ({
        id: s.id,
        title: s.title,
        section_type: s.section_type,
        description: s.description,
        order: idx + 1,
        weight: s.weight,
      })),
      questions: formData.questions?.map((q, idx) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        is_required: q.is_required,
        order: idx + 1,
        is_mandatory_attachment: q.is_mandatory_attachment,
        attachment_type: q.attachment_type,
      })),
      scoring_criteria: formData.scoring_criteria?.map(sc => ({
        id: sc.id,
        name: sc.name,
        description: sc.description,
        weight: sc.weight,
        max_score: sc.max_score,
      })),
      invited_suppliers: selectedSuppliers.length > 0 ? selectedSuppliers : undefined,
    };

    await onSubmit(payload);
  };

  // Toggle supplier selection
  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  // Add section
  const addSection = () => {
    appendSection({
      title: '',
      section_type: 'TECHNICAL',
      description: '',
      order: sectionFields.length + 1,
      weight: 0,
    });
  };

  // Add question
  const addQuestion = () => {
    appendQuestion({
      question_text: '',
      question_type: 'TEXTAREA',
      is_required: true,
      order: questionFields.length + 1,
      is_mandatory_attachment: false,
      attachment_type: '',
    });
  };

  // Add criterion
  const addCriterion = () => {
    appendCriteria({
      name: '',
      description: '',
      weight: 0,
      max_score: 100,
    });
  };

  // Section navigation tabs
  const tabs = [
    { id: 'overview', label: 'Project Overview', icon: Building2 },
    { id: 'scope', label: 'Scope of Work', icon: Target },
    { id: 'vendor', label: 'Vendor Requirements', icon: FileText },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'budget', label: 'Budget', icon: DollarSign },
    { id: 'evaluation', label: 'Evaluation', icon: ClipboardCheck },
    { id: 'terms', label: 'Terms & Conditions', icon: Scale },
    { id: 'suppliers', label: 'Suppliers', icon: Users },
  ];

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 p-2 bg-neutral-100 rounded-lg border border-neutral-200">
        {tabs.map(tab => {
          const isActive = activeSection === tab.id;
          return (
            <Button
              key={tab.id}
              type="button"
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveSection(tab.id)}
              className={`gap-2 transition-all ${
                isActive
                  ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-600 ring-offset-1'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Tab 1: Project Overview */}
      {activeSection === 'overview' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Project Overview
            </CardTitle>
            <CardDescription>
              Define the core RFP details and project context
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField control={control} name="title" label="RFP Title" required>
              {({ field, error }) => (
                <Input
                  {...field}
                  placeholder="Enter a descriptive title for this RFP"
                  error={error?.message}
                  disabled={isSubmitting}
                />
              )}
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={control} name="rfp_type" label="RFP Type" required>
                {({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {rfpTypeOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="font-medium">{option.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField control={control} name="bidding_type" label="Bidding Type" required>
                {({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bidding type" />
                    </SelectTrigger>
                    <SelectContent>
                      {biddingTypeOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="font-medium">{option.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField control={control} name="visibility" label="Visibility" required>
                {({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibilityOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="font-medium">{option.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </div>

            <FormField
              control={control}
              name="description"
              label="Description"
              description="Provide a high-level description of what you're looking for"
              required
            >
              {({ field, error }) => (
                <Textarea
                  {...field}
                  placeholder="Describe the overall project scope and objectives..."
                  rows={4}
                  className={error ? 'border-red-300' : ''}
                  disabled={isSubmitting}
                />
              )}
            </FormField>

            <FormField
              control={control}
              name="executive_summary"
              label="Executive Summary"
              description="Brief summary for leadership and stakeholders"
            >
              {({ field }) => (
                <Textarea
                  {...field}
                  placeholder="Provide a concise executive summary of this RFP..."
                  rows={3}
                  disabled={isSubmitting}
                />
              )}
            </FormField>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-neutral-900 mb-3">Project Context</h4>
              <div className="space-y-4">
                <FormField
                  control={control}
                  name="current_state_description"
                  label="Current State"
                  description="Describe current pain points and challenges"
                >
                  {({ field }) => (
                    <Textarea
                      {...field}
                      placeholder="Describe the current situation, challenges, and pain points..."
                      rows={3}
                      disabled={isSubmitting}
                    />
                  )}
                </FormField>

                <FormField
                  control={control}
                  name="future_state_goals"
                  label="Future State Goals"
                  description="Vision of desired outcomes and success criteria"
                >
                  {({ field }) => (
                    <Textarea
                      {...field}
                      placeholder="Describe the desired future state and success criteria..."
                      rows={3}
                      disabled={isSubmitting}
                    />
                  )}
                </FormField>

                <FormField
                  control={control}
                  name="organization_context"
                  label="Organization Context"
                  description="Company mission, values, strategic alignment"
                >
                  {({ field }) => (
                    <Textarea
                      {...field}
                      placeholder="Provide context about the organization and strategic alignment..."
                      rows={3}
                      disabled={isSubmitting}
                    />
                  )}
                </FormField>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Scope of Work */}
      {activeSection === 'scope' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Scope of Work
              </CardTitle>
              <CardDescription>
                Define the sections and deliverables for this RFP
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addSection}>
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {sectionFields.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-neutral-200 rounded-lg">
                <Target className="h-12 w-12 text-neutral-400 mx-auto mb-3" />
                <p className="text-neutral-500 mb-2">No sections defined yet</p>
                <p className="text-sm text-neutral-400">
                  Click "Add Section" to define RFP sections like Technical, Pricing, etc.
                </p>
              </div>
            ) : (
              <>
                {sectionFields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-700">
                        Section #{index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSection(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField control={control} name={`sections.${index}.title`} label="Section Title">
                        {({ field: inputField }) => (
                          <Input
                            {...inputField}
                            placeholder="e.g., Technical Requirements"
                            disabled={isSubmitting}
                          />
                        )}
                      </FormField>

                      <FormField control={control} name={`sections.${index}.section_type`} label="Type">
                        {({ field: selectField }) => (
                          <Select value={selectField.value} onValueChange={selectField.onChange} disabled={isSubmitting}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {sectionTypes.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </FormField>

                      <FormField control={control} name={`sections.${index}.weight`} label="Weight (%)">
                        {({ field: inputField }) => (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            {...inputField}
                            onChange={e => inputField.onChange(parseInt(e.target.value) || 0)}
                            disabled={isSubmitting}
                          />
                        )}
                      </FormField>
                    </div>

                    <FormField control={control} name={`sections.${index}.description`} label="Description">
                      {({ field: inputField }) => (
                        <Textarea
                          {...inputField}
                          placeholder="Describe this section's scope and requirements..."
                          rows={2}
                          disabled={isSubmitting}
                        />
                      )}
                    </FormField>
                  </div>
                ))}

                <div className="text-sm text-neutral-500 text-right">
                  Total Section Weight: {totalSectionWeight}%
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Vendor Requirements */}
      {activeSection === 'vendor' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Vendor Requirements
              </CardTitle>
              <CardDescription>
                Define questions vendors must answer in their proposals
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {questionFields.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-neutral-200 rounded-lg">
                <FileText className="h-12 w-12 text-neutral-400 mx-auto mb-3" />
                <p className="text-neutral-500 mb-2">No questions defined yet</p>
                <p className="text-sm text-neutral-400">
                  Add questions for methodology, team profiles, case studies, etc.
                </p>
              </div>
            ) : (
              questionFields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">
                      Question #{index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <FormField control={control} name={`questions.${index}.question_text`} label="Question">
                    {({ field: inputField }) => (
                      <Textarea
                        {...inputField}
                        placeholder="Enter the question vendors should answer..."
                        rows={2}
                        disabled={isSubmitting}
                      />
                    )}
                  </FormField>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={control} name={`questions.${index}.question_type`} label="Response Type">
                      {({ field: selectField }) => (
                        <Select value={selectField.value} onValueChange={selectField.onChange} disabled={isSubmitting}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {questionTypes.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>

                    <div className="flex items-center gap-4 pt-6">
                      <Controller
                        control={control}
                        name={`questions.${index}.is_required`}
                        render={({ field: checkField }) => (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={checkField.value}
                              onCheckedChange={checkField.onChange}
                              disabled={isSubmitting}
                            />
                            <label className="text-sm text-neutral-700">Required</label>
                          </div>
                        )}
                      />

                      <Controller
                        control={control}
                        name={`questions.${index}.is_mandatory_attachment`}
                        render={({ field: checkField }) => (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={checkField.value}
                              onCheckedChange={checkField.onChange}
                              disabled={isSubmitting}
                            />
                            <label className="text-sm text-neutral-700">Mandatory Attachment</label>
                          </div>
                        )}
                      />
                    </div>

                    {watch(`questions.${index}.is_mandatory_attachment`) && (
                      <FormField control={control} name={`questions.${index}.attachment_type`} label="Expected File Type">
                        {({ field: inputField }) => (
                          <Input
                            {...inputField}
                            placeholder="e.g., PDF, Excel"
                            disabled={isSubmitting}
                          />
                        )}
                      </FormField>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Timeline */}
      {activeSection === 'timeline' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Critical Timelines
            </CardTitle>
            <CardDescription>
              Set important dates for the RFP process (the "RFP Clock")
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name="question_deadline"
                label="Q&A Deadline"
                description="Last date for vendor questions"
              >
                {({ field }) => (
                  <Input
                    {...field}
                    type="date"
                    value={field.value || ''}
                    disabled={isSubmitting}
                  />
                )}
              </FormField>

              <FormField
                control={control}
                name="qa_session_date"
                label="Q&A Session Date"
                description="Date for Q&A session with vendors"
              >
                {({ field }) => (
                  <Input
                    {...field}
                    type="date"
                    value={field.value || ''}
                    disabled={isSubmitting}
                  />
                )}
              </FormField>

              <FormField
                control={control}
                name="response_deadline"
                label="Submission Deadline"
                description="Final deadline for proposal submissions"
                required
              >
                {({ field }) => (
                  <Input
                    {...field}
                    type="date"
                    value={field.value || ''}
                    disabled={isSubmitting}
                  />
                )}
              </FormField>

              <FormField
                control={control}
                name="shortlist_announcement_date"
                label="Shortlist Announcement"
                description="When shortlisted vendors will be notified"
              >
                {({ field }) => (
                  <Input
                    {...field}
                    type="date"
                    value={field.value || ''}
                    disabled={isSubmitting}
                  />
                )}
              </FormField>

              <FormField
                control={control}
                name="award_target_date"
                label="Target Award Date"
                description="Expected date to announce the winner"
              >
                {({ field }) => (
                  <Input
                    {...field}
                    type="date"
                    value={field.value || ''}
                    disabled={isSubmitting}
                  />
                )}
              </FormField>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-neutral-900 mb-3">Contract Period</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={control}
                  name="contract_start_date"
                  label="Contract Start Date"
                  description="Expected start of engagement"
                >
                  {({ field }) => (
                    <Input
                      {...field}
                      type="date"
                      value={field.value || ''}
                      disabled={isSubmitting}
                    />
                  )}
                </FormField>

                <FormField
                  control={control}
                  name="contract_end_date"
                  label="Contract End Date"
                  description="Expected end of engagement"
                >
                  {({ field }) => (
                    <Input
                      {...field}
                      type="date"
                      value={field.value || ''}
                      disabled={isSubmitting}
                    />
                  )}
                </FormField>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Budget */}
      {activeSection === 'budget' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Budget Framework
            </CardTitle>
            <CardDescription>
              Define the budget range and currency for this RFP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={control} name="budget_min" label="Minimum Budget">
                {({ field }) => (
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    {...field}
                    placeholder="0"
                    disabled={isSubmitting}
                  />
                )}
              </FormField>

              <FormField control={control} name="budget_max" label="Maximum Budget">
                {({ field }) => (
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    {...field}
                    placeholder="0"
                    disabled={isSubmitting}
                  />
                )}
              </FormField>

              <FormField control={control} name="currency" label="Currency">
                {({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </div>

            <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
              <p className="text-sm text-neutral-600">
                <strong>Note:</strong> For detailed cost breakdowns, add a Pricing section in the "Scope of Work" tab
                and require vendors to submit itemized pricing in their proposals.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 6: Evaluation */}
      {activeSection === 'evaluation' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Evaluation Criteria
              </CardTitle>
              <CardDescription>
                Define how proposals will be scored. Weights must total 100%.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCriterion}>
              <Plus className="h-4 w-4 mr-2" />
              Add Criterion
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {criteriaFields.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-neutral-200 rounded-lg">
                <ClipboardCheck className="h-12 w-12 text-neutral-400 mx-auto mb-3" />
                <p className="text-neutral-500 mb-2">No evaluation criteria defined yet</p>
                <p className="text-sm text-neutral-400">
                  Click "Add Criterion" to define how proposals will be scored
                </p>
              </div>
            ) : (
              <>
                {criteriaFields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-3 p-3 border rounded-lg bg-neutral-50">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <FormField control={control} name={`scoring_criteria.${index}.name`} label="Criterion Name">
                        {({ field: inputField }) => (
                          <Input
                            {...inputField}
                            placeholder="e.g., Technical Capability"
                            disabled={isSubmitting}
                          />
                        )}
                      </FormField>

                      <FormField control={control} name={`scoring_criteria.${index}.weight`} label="Weight (%)">
                        {({ field: inputField }) => (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              {...inputField}
                              onChange={e => inputField.onChange(parseInt(e.target.value) || 0)}
                              disabled={isSubmitting}
                              className="w-24"
                            />
                            <span className="text-neutral-500">%</span>
                          </div>
                        )}
                      </FormField>

                      <FormField control={control} name={`scoring_criteria.${index}.max_score`} label="Max Score">
                        {({ field: inputField }) => (
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            {...inputField}
                            onChange={e => inputField.onChange(parseInt(e.target.value) || 100)}
                            disabled={isSubmitting}
                          />
                        )}
                      </FormField>

                      <FormField control={control} name={`scoring_criteria.${index}.description`} label="Description">
                        {({ field: inputField }) => (
                          <Input
                            {...inputField}
                            placeholder="Description (optional)"
                            disabled={isSubmitting}
                          />
                        )}
                      </FormField>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCriteria(index)}
                      disabled={isSubmitting || criteriaFields.length <= 1}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 mt-6"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <div className={`text-sm text-right font-medium ${totalCriteriaWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                  Total: {totalCriteriaWeight}%
                  {totalCriteriaWeight !== 100 && (
                    <span className="ml-2">(must be 100%)</span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 7: Terms & Conditions */}
      {activeSection === 'terms' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Terms & Conditions
            </CardTitle>
            <CardDescription>
              Define legal and contractual terms for this RFP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={control} name="payment_terms" label="Payment Terms">
                {({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTermsOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField control={control} name="ip_ownership" label="IP Ownership">
                {({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select IP ownership" />
                    </SelectTrigger>
                    <SelectContent>
                      {ipOwnershipOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <span className="font-medium">{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </div>

            <div className="flex items-center gap-2 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <Controller
                control={control}
                name="nda_required"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
              <div>
                <label className="text-sm font-medium text-neutral-900">NDA Required</label>
                <p className="text-xs text-neutral-500">
                  Suppliers must sign a Non-Disclosure Agreement before receiving RFP details
                </p>
              </div>
            </div>

            <FormField
              control={control}
              name="insurance_requirements"
              label="Insurance Requirements"
              description="Required insurance coverage and limits"
            >
              {({ field }) => (
                <Textarea
                  {...field}
                  placeholder="e.g., General Liability: $1M per occurrence, Professional Liability: $2M..."
                  rows={3}
                  disabled={isSubmitting}
                />
              )}
            </FormField>

            <FormField
              control={control}
              name="confidentiality_terms"
              label="Confidentiality Terms"
              description="Additional confidentiality requirements"
            >
              {({ field }) => (
                <Textarea
                  {...field}
                  placeholder="Describe any additional confidentiality requirements..."
                  rows={3}
                  disabled={isSubmitting}
                />
              )}
            </FormField>
          </CardContent>
        </Card>
      )}

      {/* Tab 8: Suppliers */}
      {activeSection === 'suppliers' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Invite Suppliers
            </CardTitle>
            <CardDescription>
              Select suppliers to invite to this RFP
            </CardDescription>
          </CardHeader>
          <CardContent>
            {availableSuppliers.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-neutral-200 rounded-lg">
                <Users className="h-12 w-12 text-neutral-400 mx-auto mb-3" />
                <p className="text-neutral-500 mb-2">No approved suppliers available</p>
                <p className="text-sm text-neutral-400">
                  Add suppliers in the Suppliers module first
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-500">
                    {selectedSuppliers.length} of {availableSuppliers.length} suppliers selected
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSuppliers(availableSuppliers.map(s => s.id))}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSuppliers([])}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {availableSuppliers.map(supplier => (
                    <div
                      key={supplier.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedSuppliers.includes(supplier.id)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                      onClick={() => toggleSupplier(supplier.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedSuppliers.includes(supplier.id)}
                          onCheckedChange={() => toggleSupplier(supplier.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 truncate">{supplier.name}</p>
                          <p className="text-sm text-neutral-500 truncate">{supplier.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {supplier.supplier_type}
                            </Badge>
                            {supplier.city && (
                              <span className="text-xs text-neutral-400">{supplier.city}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form Actions */}
      <FormActions align="right">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === 'create'
              ? 'Creating...'
              : 'Saving...'
            : mode === 'create'
              ? 'Create RFP'
              : 'Save Changes'}
        </Button>
      </FormActions>
    </form>
  );
}
