import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Calendar, DollarSign, FileText, ClipboardCheck, AlertCircle } from 'lucide-react';

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
import RFQLineItemsTable, { type RFQLineItem } from './RFQLineItemsTable';

import type { RFQ, Supplier } from '@/types';
import type { RFQPayload, EvaluationCriterionPayload } from '@/lib/api/rfqs';

// Bid type options
const bidTypeOptions = [
  { value: 'INVITED', label: 'Invited Bid', description: 'Only invited suppliers can submit bids' },
  { value: 'OPEN', label: 'Open Bid', description: 'Any approved supplier can submit bids' },
  { value: 'SEALED', label: 'Sealed Bid', description: 'Bids are hidden until deadline' },
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

// Delivery terms (Incoterms)
const deliveryTermsOptions = [
  { value: 'EXW', label: 'EXW - Ex Works' },
  { value: 'FCA', label: 'FCA - Free Carrier' },
  { value: 'CPT', label: 'CPT - Carriage Paid To' },
  { value: 'CIP', label: 'CIP - Carriage and Insurance Paid To' },
  { value: 'DAP', label: 'DAP - Delivered at Place' },
  { value: 'DPU', label: 'DPU - Delivered at Place Unloaded' },
  { value: 'DDP', label: 'DDP - Delivered Duty Paid' },
  { value: 'FOB', label: 'FOB - Free on Board' },
  { value: 'CIF', label: 'CIF - Cost, Insurance and Freight' },
];

// Currency options
const currencyOptions = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'NGN', label: 'NGN - Nigerian Naira' },
];

// Default evaluation criteria
const defaultEvaluationCriteria: EvaluationCriterionPayload[] = [
  { name: 'Price', weight: 40, description: 'Competitiveness of pricing' },
  { name: 'Quality', weight: 25, description: 'Quality of products/services' },
  { name: 'Delivery', weight: 20, description: 'Lead time and delivery reliability' },
  { name: 'Experience', weight: 15, description: 'Relevant experience and references' },
];

// Form validation schema
const rfqFormSchema = z.object({
  // Basic Information
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().min(1, 'Description is required'),
  bid_type: z.enum(['OPEN', 'SEALED', 'INVITED']),
  // Buyer Contact
  buyer_name: z.string().optional(),
  buyer_email: z.string().email().optional().or(z.literal('')),
  buyer_phone: z.string().optional(),
  department: z.string().optional(),
  // Project Background
  project_background: z.string().optional(),
  // Critical Timelines
  qa_deadline: z.string().nullable().optional(),
  submission_deadline: z.string().nullable().optional(),
  expected_award_date: z.string().nullable().optional(),
  // Commercial Terms
  payment_terms: z.string(),
  payment_terms_notes: z.string().optional(),
  contract_duration_months: z.number().nullable().optional(),
  contract_renewal_options: z.string().optional(),
  currency: z.string(),
  // Delivery Requirements
  delivery_address: z.string().optional(),
  delivery_terms: z.string().optional(),
  required_delivery_date: z.string().nullable().optional(),
  // Evaluation & Compliance
  required_certifications: z.string().optional(),
  required_attachments_description: z.string().optional(),
  // Terms and Conditions
  terms_and_conditions: z.string().optional(),
  nda_required: z.boolean(),
});

type RFQFormData = z.infer<typeof rfqFormSchema>;

interface RFQFormProps {
  initialData?: RFQ;
  onSubmit: (data: RFQPayload) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
  availableSuppliers?: Supplier[];
}

export default function RFQForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = 'create',
  availableSuppliers = [],
}: RFQFormProps) {
  // Line items state
  const [lineItems, setLineItems] = useState<RFQLineItem[]>(() => {
    if (initialData?.lines) {
      return initialData.lines.map(line => ({
        id: line.id,
        description: line.description,
        quantity: line.quantity,
        unit_of_measure: line.unit_of_measure,
        target_unit_price: line.target_unit_price || '',
      }));
    }
    return [];
  });
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});

  // Invited suppliers state
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(() => {
    if (initialData?.invitations) {
      return initialData.invitations.map(inv => inv.supplier);
    }
    return [];
  });

  // Evaluation criteria state
  const [evaluationCriteria, setEvaluationCriteria] = useState<EvaluationCriterionPayload[]>(() => {
    if (initialData?.evaluation_criteria && initialData.evaluation_criteria.length > 0) {
      return initialData.evaluation_criteria;
    }
    return defaultEvaluationCriteria;
  });

  // Active section for accordion-style navigation
  const [activeSection, setActiveSection] = useState<string>('basic');

  const {
    control,
    handleSubmit,
    formState: { errors: formErrors },
    watch,
  } = useForm<RFQFormData>({
    resolver: zodResolver(rfqFormSchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      bid_type: initialData?.bid_type || 'INVITED',
      buyer_name: initialData?.buyer_name || '',
      buyer_email: initialData?.buyer_email || '',
      buyer_phone: initialData?.buyer_phone || '',
      department: initialData?.department || '',
      project_background: initialData?.project_background || '',
      qa_deadline: initialData?.qa_deadline?.split('T')[0] || '',
      submission_deadline: initialData?.submission_deadline?.split('T')[0] || '',
      expected_award_date: initialData?.expected_award_date?.split('T')[0] || '',
      payment_terms: initialData?.payment_terms || 'NET30',
      payment_terms_notes: initialData?.payment_terms_notes || '',
      contract_duration_months: initialData?.contract_duration_months || null,
      contract_renewal_options: initialData?.contract_renewal_options || '',
      currency: initialData?.currency || 'USD',
      delivery_address: initialData?.delivery_address || '',
      delivery_terms: initialData?.delivery_terms || '',
      required_delivery_date: initialData?.required_delivery_date || '',
      required_certifications: initialData?.required_certifications || '',
      required_attachments_description: initialData?.required_attachments_description || '',
      terms_and_conditions: initialData?.terms_and_conditions || '',
      nda_required: initialData?.nda_required || false,
    },
  });

  const bidType = watch('bid_type');

  // Validate line items
  const validateLineItems = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (lineItems.length === 0) {
      newErrors['lines.empty'] = 'At least one line item is required';
      isValid = false;
    }

    lineItems.forEach((item, index) => {
      if (!item.description.trim()) {
        newErrors[`lines.${index}`] = 'Description is required';
        isValid = false;
      } else if (!item.quantity || parseFloat(item.quantity) <= 0) {
        newErrors[`lines.${index}`] = 'Valid quantity is required';
        isValid = false;
      }
    });

    setLineErrors(newErrors);
    return isValid;
  };

  // Validate evaluation criteria
  const validateEvaluationCriteria = (): boolean => {
    const totalWeight = evaluationCriteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight !== 100) {
      toast.error('Evaluation criteria weights must sum to 100%', {
        description: `Current total: ${totalWeight}%`,
      });
      return false;
    }
    return true;
  };

  // Handle form validation errors
  const onFormError = () => {
    validateLineItems();
    const errorMessages: string[] = [];
    if (formErrors.title) errorMessages.push('Title is required');
    if (formErrors.description) errorMessages.push('Description is required');

    if (errorMessages.length > 0) {
      toast.error('Please fix the errors in the form', {
        description: errorMessages.join(', '),
      });
    }
  };

  // Format date for API (ISO datetime)
  const formatDateForAPI = (date: string | null | undefined): string | null => {
    if (!date) return null;
    return `${date}T23:59:59Z`;
  };

  // Handle form submission
  const handleFormSubmit = async (formData: RFQFormData) => {
    // Validate line items
    if (!validateLineItems()) {
      toast.error('Please fix the errors in the form', {
        description: lineItems.length === 0
          ? 'You must add at least one line item'
          : 'Check that all line items have descriptions and valid quantities',
      });
      setActiveSection('items');
      return;
    }

    // Validate evaluation criteria
    if (!validateEvaluationCriteria()) {
      setActiveSection('evaluation');
      return;
    }

    // Build payload
    const payload: RFQPayload = {
      // Basic Information
      title: formData.title,
      description: formData.description,
      bid_type: formData.bid_type,
      // Buyer Contact
      buyer_name: formData.buyer_name || undefined,
      buyer_email: formData.buyer_email || undefined,
      buyer_phone: formData.buyer_phone || undefined,
      department: formData.department || undefined,
      // Project Background
      project_background: formData.project_background || undefined,
      // Critical Timelines
      qa_deadline: formatDateForAPI(formData.qa_deadline),
      submission_deadline: formatDateForAPI(formData.submission_deadline),
      expected_award_date: formatDateForAPI(formData.expected_award_date),
      close_date: formatDateForAPI(formData.submission_deadline), // Same as submission_deadline
      // Commercial Terms
      payment_terms: formData.payment_terms,
      payment_terms_notes: formData.payment_terms_notes || undefined,
      contract_duration_months: formData.contract_duration_months || undefined,
      contract_renewal_options: formData.contract_renewal_options || undefined,
      currency: formData.currency,
      // Delivery Requirements
      delivery_address: formData.delivery_address || undefined,
      delivery_terms: formData.delivery_terms || undefined,
      required_delivery_date: formData.required_delivery_date || undefined,
      // Evaluation Criteria
      evaluation_criteria: evaluationCriteria,
      required_certifications: formData.required_certifications || undefined,
      required_attachments_description: formData.required_attachments_description || undefined,
      // Terms and Conditions
      terms_and_conditions: formData.terms_and_conditions || undefined,
      nda_required: formData.nda_required,
      // Line Items
      lines: lineItems.map(item => ({
        id: item.id.startsWith('temp-') ? undefined : item.id,
        description: item.description,
        quantity: item.quantity,
        unit_of_measure: item.unit_of_measure,
        target_unit_price: item.target_unit_price || null,
      })),
      // Invited Suppliers
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

  // Add evaluation criterion
  const addCriterion = () => {
    setEvaluationCriteria([...evaluationCriteria, { name: '', weight: 0, description: '' }]);
  };

  // Remove evaluation criterion
  const removeCriterion = (index: number) => {
    setEvaluationCriteria(evaluationCriteria.filter((_, i) => i !== index));
  };

  // Update evaluation criterion
  const updateCriterion = (index: number, field: keyof EvaluationCriterionPayload, value: string | number) => {
    const updated = [...evaluationCriteria];
    updated[index] = { ...updated[index], [field]: value };
    setEvaluationCriteria(updated);
  };

  // Calculate total weight
  const totalWeight = evaluationCriteria.reduce((sum, c) => sum + c.weight, 0);

  // Section navigation
  const sections = [
    { id: 'basic', label: 'Basic Info', icon: FileText },
    { id: 'items', label: 'Line Items', icon: ClipboardCheck },
    { id: 'suppliers', label: 'Suppliers', icon: Users },
    { id: 'timelines', label: 'Timelines', icon: Calendar },
    { id: 'commercial', label: 'Commercial', icon: DollarSign },
    { id: 'evaluation', label: 'Evaluation', icon: ClipboardCheck },
  ];

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, onFormError)} className="space-y-6">
      {/* Section Navigation */}
      <div className="flex flex-wrap gap-2 p-2 bg-neutral-100 rounded-lg border border-neutral-200">
        {sections.map(section => {
          const isActive = activeSection === section.id;
          return (
            <Button
              key={section.id}
              type="button"
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveSection(section.id)}
              className={`gap-2 transition-all ${
                isActive
                  ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-600 ring-offset-1'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200'
              }`}
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </Button>
          );
        })}
      </div>

      {/* Basic Information Section */}
      {activeSection === 'basic' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              RFQ Information
            </CardTitle>
            <CardDescription>Basic details about this Request for Quotation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField control={control} name="title" label="Title" required>
              {({ field, error }) => (
                <Input
                  {...field}
                  placeholder="Enter a descriptive title for this RFQ"
                  error={error?.message}
                  disabled={isSubmitting}
                />
              )}
            </FormField>

            <FormField
              control={control}
              name="description"
              label="Description"
              description="Provide details about what you're looking for"
              required
            >
              {({ field, error }) => (
                <Textarea
                  {...field}
                  placeholder="Describe the items or services you need quotes for..."
                  rows={4}
                  className={error ? 'border-red-300' : ''}
                  disabled={isSubmitting}
                />
              )}
            </FormField>

            <FormField
              control={control}
              name="bid_type"
              label="Bid Type"
              description="How suppliers will be able to participate"
              required
            >
              {({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bid type" />
                  </SelectTrigger>
                  <SelectContent>
                    {bidTypeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div>
                          <span className="font-medium">{option.label}</span>
                          <span className="text-neutral-500 text-sm ml-2">- {option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <FormField
              control={control}
              name="project_background"
              label="Project Background"
              description="Brief summary of the project goals to provide context for suppliers"
            >
              {({ field }) => (
                <Textarea
                  {...field}
                  placeholder="Provide context about the project, business needs, and objectives..."
                  rows={3}
                  disabled={isSubmitting}
                />
              )}
            </FormField>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-neutral-900 mb-3">Buyer Contact Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={control} name="buyer_name" label="Contact Name">
                  {({ field }) => (
                    <Input {...field} placeholder="Primary contact name" disabled={isSubmitting} />
                  )}
                </FormField>
                <FormField control={control} name="department" label="Department">
                  {({ field }) => (
                    <Input {...field} placeholder="e.g., Procurement, IT, Operations" disabled={isSubmitting} />
                  )}
                </FormField>
                <FormField control={control} name="buyer_email" label="Email">
                  {({ field }) => (
                    <Input {...field} type="email" placeholder="contact@company.com" disabled={isSubmitting} />
                  )}
                </FormField>
                <FormField control={control} name="buyer_phone" label="Phone">
                  {({ field }) => (
                    <Input {...field} placeholder="+1 (555) 123-4567" disabled={isSubmitting} />
                  )}
                </FormField>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line Items Section */}
      {activeSection === 'items' && (
        <>
          <RFQLineItemsTable
            items={lineItems}
            onChange={setLineItems}
            disabled={isSubmitting}
            errors={lineErrors}
          />
          {lineErrors['lines.empty'] && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-600">Please add at least one line item to your RFQ.</p>
            </div>
          )}
        </>
      )}

      {/* Suppliers Section */}
      {activeSection === 'suppliers' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Invite Suppliers
            </CardTitle>
            <CardDescription>
              {bidType === 'INVITED'
                ? 'Select suppliers to invite to this RFQ. Only invited suppliers can submit bids.'
                : 'For open bids, all approved suppliers can participate. You can still select specific suppliers to notify.'}
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

      {/* Timelines Section */}
      {activeSection === 'timelines' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Critical Timelines
            </CardTitle>
            <CardDescription>Set important dates for the RFQ process</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name="qa_deadline"
                label="Q&A Deadline"
                description="Deadline for supplier questions"
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
                name="submission_deadline"
                label="Submission Deadline"
                description="Final deadline for bid submissions"
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
                name="expected_award_date"
                label="Expected Award Date"
                description="Target date for announcing the winner"
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
                name="required_delivery_date"
                label="Required Delivery Date"
                description="When goods/services must be delivered"
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
          </CardContent>
        </Card>
      )}

      {/* Commercial Terms Section */}
      {activeSection === 'commercial' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Commercial Terms
            </CardTitle>
            <CardDescription>Payment, delivery, and contract terms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <FormField control={control} name="payment_terms" label="Payment Terms">
                {({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
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

              <FormField control={control} name="delivery_terms" label="Delivery Terms (Incoterms)">
                {({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select delivery terms" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryTermsOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField
                control={control}
                name="contract_duration_months"
                label="Contract Duration (months)"
              >
                {({ field }) => (
                  <Input
                    type="number"
                    min="1"
                    value={field.value || ''}
                    onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="e.g., 12"
                    disabled={isSubmitting}
                  />
                )}
              </FormField>
            </div>

            <FormField
              control={control}
              name="contract_renewal_options"
              label="Renewal Options"
              description="e.g., '2 x 1-year renewals'"
            >
              {({ field }) => (
                <Input {...field} placeholder="Describe renewal options" disabled={isSubmitting} />
              )}
            </FormField>

            <FormField control={control} name="payment_terms_notes" label="Additional Payment Notes">
              {({ field }) => (
                <Textarea
                  {...field}
                  placeholder="Any specific payment requirements or conditions..."
                  rows={2}
                  disabled={isSubmitting}
                />
              )}
            </FormField>

            <FormField
              control={control}
              name="delivery_address"
              label="Delivery Address"
              description="Where goods/services should be delivered"
            >
              {({ field }) => (
                <Textarea
                  {...field}
                  placeholder="Enter delivery address..."
                  rows={2}
                  disabled={isSubmitting}
                />
              )}
            </FormField>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-neutral-900 mb-3">Terms & Conditions</h4>
              <FormField control={control} name="terms_and_conditions" label="Terms and Conditions">
                {({ field }) => (
                  <Textarea
                    {...field}
                    placeholder="Enter any specific terms and conditions..."
                    rows={4}
                    disabled={isSubmitting}
                  />
                )}
              </FormField>

              <div className="flex items-center gap-2 mt-4">
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
                <label className="text-sm text-neutral-700">
                  NDA Required - Suppliers must sign a Non-Disclosure Agreement
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evaluation Criteria Section */}
      {activeSection === 'evaluation' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Evaluation Criteria
            </CardTitle>
            <CardDescription>
              Define how bids will be scored. Weights must total 100%.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {evaluationCriteria.map((criterion, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 border rounded-lg bg-neutral-50"
                >
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input
                      value={criterion.name}
                      onChange={e => updateCriterion(index, 'name', e.target.value)}
                      placeholder="Criterion name"
                      disabled={isSubmitting}
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={criterion.weight}
                        onChange={e => updateCriterion(index, 'weight', parseInt(e.target.value) || 0)}
                        placeholder="Weight"
                        disabled={isSubmitting}
                        className="w-24"
                      />
                      <span className="text-neutral-500">%</span>
                    </div>
                    <Input
                      value={criterion.description || ''}
                      onChange={e => updateCriterion(index, 'description', e.target.value)}
                      placeholder="Description (optional)"
                      disabled={isSubmitting}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCriterion(index)}
                    disabled={isSubmitting || evaluationCriteria.length <= 1}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCriterion}
                disabled={isSubmitting}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Criterion
              </Button>
              <div className={`font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                Total: {totalWeight}%
                {totalWeight !== 100 && (
                  <span className="text-sm ml-2">(must be 100%)</span>
                )}
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-neutral-900 mb-3">Required Qualifications</h4>
              <FormField
                control={control}
                name="required_certifications"
                label="Required Certifications"
                description="e.g., ISO 9001, SOC 2, industry-specific certifications"
              >
                {({ field }) => (
                  <Textarea
                    {...field}
                    placeholder="List required certifications or standards..."
                    rows={2}
                    disabled={isSubmitting}
                  />
                )}
              </FormField>

              <FormField
                control={control}
                name="required_attachments_description"
                label="Required Attachments"
                description="Documents suppliers must include with their bid"
              >
                {({ field }) => (
                  <Textarea
                    {...field}
                    placeholder="e.g., Company profile, financial statements, references, signed NDA..."
                    rows={2}
                    disabled={isSubmitting}
                  />
                )}
              </FormField>
            </div>
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
              ? 'Create RFQ'
              : 'Save Changes'}
        </Button>
      </FormActions>
    </form>
  );
}
