import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';

import { RFP_CATEGORY_CONFIG, type RFPPayload } from '@/lib/api/rfps';
import type { RFP } from '@/types';

const requirementSchema = z.object({
  id: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  is_mandatory: z.boolean(),
  weight: z.number().min(0).max(100),
});

const evaluationCriteriaSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  weight: z.number().min(0).max(100),
  max_score: z.number().min(1).max(100),
});

const rfpFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['GOODS', 'SERVICES', 'WORKS', 'CONSULTING']),
  budget_min: z.string().optional(),
  budget_max: z.string().optional(),
  currency: z.string(),
  submission_deadline: z.string().optional(),
  evaluation_deadline: z.string().optional(),
  requirements: z.array(requirementSchema),
  evaluation_criteria: z.array(evaluationCriteriaSchema),
});

type RFPFormValues = z.infer<typeof rfpFormSchema>;

interface RFPFormProps {
  rfp?: RFP;
  onSubmit: (data: RFPPayload) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode: 'create' | 'edit';
}

const requirementCategories = [
  'Technical',
  'Qualification',
  'Compliance',
  'Financial',
  'Support',
  'Legal',
  'Other',
];

export default function RFPForm({
  rfp,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode,
}: RFPFormProps) {
  const form = useForm<RFPFormValues>({
    resolver: zodResolver(rfpFormSchema),
    defaultValues: {
      title: rfp?.title || '',
      description: rfp?.description || '',
      category: rfp?.category || undefined,
      budget_min: rfp?.budget_min || '',
      budget_max: rfp?.budget_max || '',
      currency: rfp?.currency || 'USD',
      submission_deadline: rfp?.submission_deadline || '',
      evaluation_deadline: rfp?.evaluation_deadline || '',
      requirements: rfp?.requirements?.map(r => ({
        id: r.id,
        category: r.category,
        description: r.description,
        is_mandatory: r.is_mandatory,
        weight: r.weight,
      })) || [],
      evaluation_criteria: rfp?.evaluation_criteria?.map(ec => ({
        id: ec.id,
        name: ec.name,
        description: ec.description,
        weight: ec.weight,
        max_score: ec.max_score,
      })) || [],
    },
  });

  const { fields: requirementFields, append: appendRequirement, remove: removeRequirement } = useFieldArray({
    control: form.control,
    name: 'requirements',
  });

  const { fields: criteriaFields, append: appendCriteria, remove: removeCriteria } = useFieldArray({
    control: form.control,
    name: 'evaluation_criteria',
  });

  // Update form when RFP changes
  useEffect(() => {
    if (rfp) {
      form.reset({
        title: rfp.title,
        description: rfp.description,
        category: rfp.category,
        budget_min: rfp.budget_min || '',
        budget_max: rfp.budget_max || '',
        currency: rfp.currency,
        submission_deadline: rfp.submission_deadline || '',
        evaluation_deadline: rfp.evaluation_deadline || '',
        requirements: rfp.requirements?.map(r => ({
          id: r.id,
          category: r.category,
          description: r.description,
          is_mandatory: r.is_mandatory,
          weight: r.weight,
        })) || [],
        evaluation_criteria: rfp.evaluation_criteria?.map(ec => ({
          id: ec.id,
          name: ec.name,
          description: ec.description,
          weight: ec.weight,
          max_score: ec.max_score,
        })) || [],
      });
    }
  }, [rfp, form]);

  const handleFormSubmit = async (data: RFPFormValues) => {
    // Validate evaluation deadline is after submission deadline
    if (data.submission_deadline && data.evaluation_deadline) {
      if (new Date(data.evaluation_deadline) <= new Date(data.submission_deadline)) {
        form.setError('evaluation_deadline', {
          message: 'Evaluation deadline must be after submission deadline',
        });
        return;
      }
    }

    // Validate total weight of evaluation criteria
    const totalWeight = data.evaluation_criteria.reduce((sum, ec) => sum + ec.weight, 0);
    if (data.evaluation_criteria.length > 0 && totalWeight !== 100) {
      form.setError('evaluation_criteria', {
        type: 'manual',
        message: `Total weight must equal 100% (currently ${totalWeight}%)`,
      });
      return;
    }

    const payload: RFPPayload = {
      title: data.title,
      description: data.description,
      category: data.category,
      budget_min: data.budget_min || null,
      budget_max: data.budget_max || null,
      currency: data.currency,
      submission_deadline: data.submission_deadline || null,
      evaluation_deadline: data.evaluation_deadline || null,
      requirements: data.requirements,
      evaluation_criteria: data.evaluation_criteria,
    };

    await onSubmit(payload);
  };

  const addRequirement = () => {
    appendRequirement({
      category: 'Technical',
      description: '',
      is_mandatory: false,
      weight: 10,
    });
  };

  const addCriteria = () => {
    appendCriteria({
      name: '',
      description: '',
      weight: 25,
      max_score: 100,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>RFP Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Enterprise ERP System Implementation"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(RFP_CATEGORY_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div>
                            <span>{config.label}</span>
                            <span className="text-neutral-500 ml-2 text-sm">
                              - {config.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide a detailed description of the RFP scope, objectives, and expectations..."
                      className="resize-none"
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Budget & Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Budget & Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="budget_min"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Budget</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budget_max"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Budget</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="NGN">NGN - Nigerian Naira</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="submission_deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Submission Deadline</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      Last date for vendors to submit proposals
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="evaluation_deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Evaluation Deadline</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      Target date to complete proposal evaluation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Requirements</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addRequirement}>
              <Plus className="h-4 w-4 mr-2" />
              Add Requirement
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {requirementFields.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-4">
                No requirements added yet. Click "Add Requirement" to define project requirements.
              </p>
            ) : (
              requirementFields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">
                      Requirement #{index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRequirement(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name={`requirements.${index}.category`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {requirementCategories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`requirements.${index}.weight`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weight (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`requirements.${index}.is_mandatory`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-end space-x-3 space-y-0 pb-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Mandatory Requirement
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={`requirements.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe this requirement..."
                            className="resize-none"
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Evaluation Criteria */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Evaluation Criteria</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addCriteria}>
              <Plus className="h-4 w-4 mr-2" />
              Add Criteria
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.formState.errors.evaluation_criteria?.message && (
              <p className="text-sm text-red-600 mb-4">
                {form.formState.errors.evaluation_criteria.message}
              </p>
            )}

            {criteriaFields.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-4">
                No evaluation criteria added yet. Click "Add Criteria" to define how proposals will be scored.
              </p>
            ) : (
              <>
                {criteriaFields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-700">
                        Criteria #{index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCriteria(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`evaluation_criteria.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Technical Capability" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`evaluation_criteria.${index}.weight`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Weight (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`evaluation_criteria.${index}.max_score`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Score</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="100"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 100)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name={`evaluation_criteria.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe how this criteria will be evaluated..."
                              className="resize-none"
                              rows={2}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}

                <div className="text-sm text-neutral-500 text-right">
                  Total Weight: {criteriaFields.reduce((sum, _, idx) => {
                    const weight = form.watch(`evaluation_criteria.${idx}.weight`);
                    return sum + (weight || 0);
                  }, 0)}%
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
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
        </div>
      </form>
    </Form>
  );
}
