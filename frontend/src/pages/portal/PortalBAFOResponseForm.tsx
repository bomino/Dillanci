/**
 * Portal BAFO Response Form - Form for submitting Best and Final Offer responses.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  X,
  Save,
  Send,
  RefreshCw,
  DollarSign,
  Loader2,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  useSaveBAFOResponseDraft,
  useSubmitBAFOResponse,
  type PortalRFP,
  type PortalBAFORound,
} from '@/lib/api/portal';
import { toast } from 'sonner';

// Form schema
const bafoResponseSchema = z.object({
  revised_amount: z.string().min(1, 'Revised amount is required'),
  pricing_adjustments: z.string().optional(),
  delivery_changes: z.string().optional(),
  payment_terms_changes: z.string().optional(),
  warranty_changes: z.string().optional(),
  scope_changes: z.string().optional(),
  technical_clarifications: z.string().optional(),
  notes: z.string().optional(),
});

type BAFOResponseFormData = z.infer<typeof bafoResponseSchema>;

interface PortalBAFOResponseFormProps {
  rfp: PortalRFP;
  bafoRound: PortalBAFORound;
  onClose: () => void;
}

export default function PortalBAFOResponseForm({ rfp, bafoRound, onClose }: PortalBAFOResponseFormProps) {
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const saveDraftMutation = useSaveBAFOResponseDraft();
  const submitResponseMutation = useSubmitBAFOResponse();

  // Get existing response data if any
  const existingResponse = bafoRound.my_response;
  const existingData = existingResponse?.response_data as Record<string, string> | null;

  // Get original proposal amount
  const originalAmount = existingResponse?.original_amount
    ? parseFloat(existingResponse.original_amount)
    : rfp.my_proposal?.proposed_amount
    ? parseFloat(rfp.my_proposal.proposed_amount)
    : null;

  const deadline = bafoRound.deadline ? new Date(bafoRound.deadline) : null;
  const isUrgent = deadline && !isPast(deadline) && (deadline.getTime() - Date.now()) < 24 * 60 * 60 * 1000;

  const form = useForm<BAFOResponseFormData>({
    resolver: zodResolver(bafoResponseSchema),
    defaultValues: {
      revised_amount: existingResponse?.revised_amount || '',
      pricing_adjustments: existingData?.pricing_adjustments || '',
      delivery_changes: existingData?.delivery_changes || '',
      payment_terms_changes: existingData?.payment_terms_changes || '',
      warranty_changes: existingData?.warranty_changes || '',
      scope_changes: existingData?.scope_changes || '',
      technical_clarifications: existingData?.technical_clarifications || '',
      notes: existingResponse?.notes || '',
    },
  });

  // Calculate price change
  const revisedAmountValue = form.watch('revised_amount');
  const revisedAmount = revisedAmountValue ? parseFloat(revisedAmountValue) : null;
  const priceChange = originalAmount && revisedAmount
    ? ((revisedAmount - originalAmount) / originalAmount) * 100
    : null;
  const savings = originalAmount && revisedAmount && revisedAmount < originalAmount
    ? originalAmount - revisedAmount
    : null;

  // Save draft
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const data = form.getValues();
      await saveDraftMutation.mutateAsync({
        rfpId: rfp.id,
        roundId: bafoRound.id,
        data: {
          revised_amount: data.revised_amount,
          response_data: {
            pricing_adjustments: data.pricing_adjustments,
            delivery_changes: data.delivery_changes,
            payment_terms_changes: data.payment_terms_changes,
            warranty_changes: data.warranty_changes,
            scope_changes: data.scope_changes,
            technical_clarifications: data.technical_clarifications,
          },
          notes: data.notes,
        },
      });
      toast.success('Draft saved successfully');
    } catch (err) {
      toast.error('Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit response
  const handleSubmit = async () => {
    try {
      // Save draft first
      await handleSaveDraft();
      // Then submit
      await submitResponseMutation.mutateAsync({
        rfpId: rfp.id,
        roundId: bafoRound.id,
      });
      toast.success('BAFO response submitted successfully!');
      setConfirmSubmitOpen(false);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit response';
      toast.error(message);
    }
  };

  // Focus area helpers
  const focusAreas = bafoRound.focus_areas || [];
  const focusAreaLabels: Record<string, string> = {
    pricing: 'Pricing Adjustments',
    delivery: 'Delivery Timeline Changes',
    payment: 'Payment Terms Changes',
    warranty: 'Warranty/Support Changes',
    scope: 'Scope Modifications',
    technical: 'Technical Clarifications',
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
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100">
              <RefreshCw className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">
                BAFO Response - Round {bafoRound.round_number}
              </h2>
              <p className="text-sm text-neutral-500">{rfp.title}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Deadline Banner */}
        {deadline && (
          <div className={`px-4 py-3 flex items-center gap-3 ${
            isUrgent ? 'bg-amber-50 border-b border-amber-200' : 'bg-blue-50 border-b border-blue-200'
          }`}>
            <Clock className={`h-5 w-5 ${isUrgent ? 'text-amber-600' : 'text-blue-600'}`} />
            <div className="flex-1">
              <p className={`font-medium ${isUrgent ? 'text-amber-900' : 'text-blue-900'}`}>
                {isUrgent ? 'Deadline Approaching!' : 'Submission Deadline'}
              </p>
              <p className={`text-sm ${isUrgent ? 'text-amber-700' : 'text-blue-700'}`}>
                {format(deadline, 'MMM d, yyyy h:mm a')} ({formatDistanceToNow(deadline, { addSuffix: true })})
              </p>
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form className="space-y-6">
            {/* Instructions */}
            {bafoRound.instructions && (
              <Card className="border-indigo-200 bg-indigo-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-indigo-800">Instructions from Buyer</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-indigo-700 whitespace-pre-wrap">{bafoRound.instructions}</p>
                </CardContent>
              </Card>
            )}

            {/* Focus Areas */}
            {focusAreas.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-neutral-700">Focus Areas for This Round</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {focusAreas.map((area) => (
                    <Badge key={area} variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                      {focusAreaLabels[area] || area}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Price Comparison Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary-600" />
                  Price Revision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {/* Original Amount */}
                  <div className="text-center p-3 bg-neutral-50 rounded-lg border">
                    <p className="text-xs text-neutral-500 mb-1">Original Amount</p>
                    <p className="text-lg font-bold text-neutral-700">
                      {originalAmount ? `${rfp.currency} ${originalAmount.toLocaleString()}` : '-'}
                    </p>
                  </div>

                  {/* Change Indicator */}
                  <div className="flex items-center justify-center">
                    {priceChange !== null && (
                      <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                        priceChange < 0
                          ? 'bg-green-100 text-green-700'
                          : priceChange > 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-neutral-100 text-neutral-500'
                      }`}>
                        {priceChange < 0 ? (
                          <ArrowDownRight className="h-4 w-4" />
                        ) : priceChange > 0 ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : null}
                        <span>
                          {priceChange < 0 ? '' : '+'}
                          {priceChange.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Revised Amount */}
                  <div className="text-center p-3 bg-neutral-50 rounded-lg border">
                    <p className="text-xs text-neutral-500 mb-1">Revised Amount</p>
                    <p className={`text-lg font-bold ${
                      priceChange && priceChange < 0
                        ? 'text-green-700'
                        : priceChange && priceChange > 0
                        ? 'text-red-700'
                        : 'text-neutral-700'
                    }`}>
                      {revisedAmount ? `${rfp.currency} ${revisedAmount.toLocaleString()}` : '-'}
                    </p>
                  </div>
                </div>

                {/* Savings Banner */}
                {savings && savings > 0 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center mb-4">
                    <p className="text-sm text-green-600">Price Reduction</p>
                    <p className="text-xl font-bold text-green-700">
                      {rfp.currency} {savings.toLocaleString()}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="revised_amount" required>
                    Revised Amount ({rfp.currency})
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      id="revised_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Enter your revised amount"
                      className="pl-9 text-lg"
                      {...form.register('revised_amount')}
                    />
                  </div>
                  {form.formState.errors.revised_amount && (
                    <p className="text-sm text-red-500">{form.formState.errors.revised_amount.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Focus Area Details */}
            {focusAreas.includes('pricing') && (
              <div className="space-y-2">
                <Label htmlFor="pricing_adjustments">Pricing Adjustments</Label>
                <Textarea
                  id="pricing_adjustments"
                  placeholder="Describe any pricing adjustments, discounts, or revised cost breakdown..."
                  rows={3}
                  {...form.register('pricing_adjustments')}
                />
              </div>
            )}

            {focusAreas.includes('delivery') && (
              <div className="space-y-2">
                <Label htmlFor="delivery_changes">Delivery Timeline Changes</Label>
                <Textarea
                  id="delivery_changes"
                  placeholder="Describe any changes to delivery schedule or milestones..."
                  rows={3}
                  {...form.register('delivery_changes')}
                />
              </div>
            )}

            {focusAreas.includes('payment') && (
              <div className="space-y-2">
                <Label htmlFor="payment_terms_changes">Payment Terms Changes</Label>
                <Textarea
                  id="payment_terms_changes"
                  placeholder="Describe any revised payment terms or financing options..."
                  rows={3}
                  {...form.register('payment_terms_changes')}
                />
              </div>
            )}

            {focusAreas.includes('warranty') && (
              <div className="space-y-2">
                <Label htmlFor="warranty_changes">Warranty/Support Changes</Label>
                <Textarea
                  id="warranty_changes"
                  placeholder="Describe any enhanced warranty or support offerings..."
                  rows={3}
                  {...form.register('warranty_changes')}
                />
              </div>
            )}

            {focusAreas.includes('scope') && (
              <div className="space-y-2">
                <Label htmlFor="scope_changes">Scope Modifications</Label>
                <Textarea
                  id="scope_changes"
                  placeholder="Describe any changes to scope of work or deliverables..."
                  rows={3}
                  {...form.register('scope_changes')}
                />
              </div>
            )}

            {focusAreas.includes('technical') && (
              <div className="space-y-2">
                <Label htmlFor="technical_clarifications">Technical Clarifications</Label>
                <Textarea
                  id="technical_clarifications"
                  placeholder="Provide any technical clarifications or enhancements..."
                  rows={3}
                  {...form.register('technical_clarifications')}
                />
              </div>
            )}

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any other information you'd like to share with the buyer..."
                rows={4}
                {...form.register('notes')}
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-neutral-50">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSaving || saveDraftMutation.isPending}
            >
              {isSaving || saveDraftMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Draft
            </Button>
            <Button
              onClick={() => setConfirmSubmitOpen(true)}
              disabled={!form.formState.isValid || submitResponseMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Send className="h-4 w-4 mr-2" />
              Submit BAFO
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Confirm Submit Dialog */}
      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm BAFO Submission</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit this Best and Final Offer? Once submitted, you may not
              be able to modify it.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 rounded-lg bg-neutral-50 border space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">RFP</span>
                <span className="font-medium text-neutral-900">{rfp.number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Round</span>
                <span className="font-medium text-neutral-900">{bafoRound.round_number}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-neutral-600">Original Amount</span>
                <span className="font-medium text-neutral-700">
                  {originalAmount ? `${rfp.currency} ${originalAmount.toLocaleString()}` : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Revised Amount</span>
                <span className={`font-semibold ${
                  priceChange && priceChange < 0 ? 'text-green-600' : 'text-neutral-900'
                }`}>
                  {revisedAmount ? `${rfp.currency} ${revisedAmount.toLocaleString()}` : '-'}
                </span>
              </div>
              {priceChange !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600">Change</span>
                  <span className={`font-medium ${
                    priceChange < 0 ? 'text-green-600' : priceChange > 0 ? 'text-red-600' : 'text-neutral-600'
                  }`}>
                    {priceChange < 0 ? '' : '+'}{priceChange.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitResponseMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submitResponseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit BAFO
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
