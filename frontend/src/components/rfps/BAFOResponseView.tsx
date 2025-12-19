import {
  Building2,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  MessageSquare,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';
import type { BAFOResponse } from './BAFOPanel';

interface BAFOResponseViewProps {
  response: BAFOResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalProposalAmount?: string | null;
}

interface ResponseDataItem {
  label: string;
  original?: string | number | null;
  revised?: string | number | null;
  type?: 'currency' | 'text' | 'number' | 'percentage';
}

export function BAFOResponseView({
  response,
  open,
  onOpenChange,
  originalProposalAmount,
}: BAFOResponseViewProps) {
  // Calculate price change
  const originalAmount = response.original_amount
    ? parseFloat(response.original_amount)
    : originalProposalAmount
    ? parseFloat(originalProposalAmount)
    : null;
  const revisedAmount = response.revised_amount ? parseFloat(response.revised_amount) : null;

  const priceChange = originalAmount && revisedAmount
    ? ((revisedAmount - originalAmount) / originalAmount) * 100
    : null;

  const savings = originalAmount && revisedAmount && revisedAmount < originalAmount
    ? originalAmount - revisedAmount
    : null;

  // Parse response data if it exists
  const responseData = response.response_data as Record<string, unknown> | null;

  // Extract key comparison items from response_data
  const comparisonItems: ResponseDataItem[] = [];

  if (responseData) {
    // Check for common fields
    if (responseData.pricing) {
      const pricing = responseData.pricing as Record<string, unknown>;
      if (pricing.original_total !== undefined && pricing.revised_total !== undefined) {
        comparisonItems.push({
          label: 'Total Price',
          original: pricing.original_total as number,
          revised: pricing.revised_total as number,
          type: 'currency',
        });
      }
      if (pricing.discount_percentage !== undefined) {
        comparisonItems.push({
          label: 'Discount Applied',
          revised: pricing.discount_percentage as number,
          type: 'percentage',
        });
      }
    }

    if (responseData.delivery) {
      const delivery = responseData.delivery as Record<string, unknown>;
      if (delivery.original_days !== undefined && delivery.revised_days !== undefined) {
        comparisonItems.push({
          label: 'Delivery Time',
          original: `${delivery.original_days} days`,
          revised: `${delivery.revised_days} days`,
          type: 'text',
        });
      }
    }

    if (responseData.payment_terms) {
      const terms = responseData.payment_terms as Record<string, unknown>;
      if (terms.original !== undefined && terms.revised !== undefined) {
        comparisonItems.push({
          label: 'Payment Terms',
          original: terms.original as string,
          revised: terms.revised as string,
          type: 'text',
        });
      }
    }

    if (responseData.warranty) {
      const warranty = responseData.warranty as Record<string, unknown>;
      if (warranty.original_months !== undefined && warranty.revised_months !== undefined) {
        comparisonItems.push({
          label: 'Warranty Period',
          original: `${warranty.original_months} months`,
          revised: `${warranty.revised_months} months`,
          type: 'text',
        });
      }
    }
  }

  // Format value based on type
  const formatValue = (value: string | number | null | undefined, type?: string): string => {
    if (value === null || value === undefined) return '-';
    if (type === 'currency' && typeof value === 'number') {
      return formatCurrency(value);
    }
    if (type === 'percentage' && typeof value === 'number') {
      return `${value}%`;
    }
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            BAFO Response Details
          </DialogTitle>
          <DialogDescription>
            Best and Final Offer submitted by {response.supplier_name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-150px)]">
          <div className="space-y-6 pr-4">
            {/* Header Info */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-neutral-400" />
                  <span className="font-semibold text-lg">{response.supplier_name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-neutral-500">
                  {response.submitted_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Submitted {formatDateTime(response.submitted_at)}
                    </span>
                  )}
                  <Badge
                    variant={response.status === 'SUBMITTED' ? 'default' : 'outline'}
                    className={response.status === 'SUBMITTED' ? 'bg-green-100 text-green-700' : ''}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {response.status}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Price Summary Card */}
            <Card className="bg-neutral-50 border-neutral-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary-600" />
                  Price Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {/* Original */}
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <p className="text-xs text-neutral-500 mb-1">Original Amount</p>
                    <p className="text-xl font-bold text-neutral-700">
                      {originalAmount ? formatCurrency(originalAmount) : '-'}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center justify-center">
                    <div className={cn(
                      'flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium',
                      priceChange === null ? 'bg-neutral-100 text-neutral-500' :
                      priceChange < 0 ? 'bg-green-100 text-green-700' :
                      priceChange > 0 ? 'bg-red-100 text-red-700' :
                      'bg-neutral-100 text-neutral-500'
                    )}>
                      {priceChange !== null ? (
                        <>
                          {priceChange < 0 ? (
                            <ArrowDownRight className="h-4 w-4" />
                          ) : priceChange > 0 ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                          <span>
                            {priceChange < 0 ? '' : '+'}
                            {priceChange.toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </div>
                  </div>

                  {/* Revised */}
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <p className="text-xs text-neutral-500 mb-1">BAFO Amount</p>
                    <p className={cn(
                      'text-xl font-bold',
                      priceChange && priceChange < 0 ? 'text-green-700' :
                      priceChange && priceChange > 0 ? 'text-red-700' :
                      'text-neutral-700'
                    )}>
                      {revisedAmount ? formatCurrency(revisedAmount) : '-'}
                    </p>
                  </div>
                </div>

                {/* Savings Banner */}
                {savings && savings > 0 && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-sm text-green-600">Potential Savings</p>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(savings)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Comparison Table */}
            {comparisonItems.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Detailed Comparison</CardTitle>
                  <CardDescription>Changes from original proposal</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-neutral-50">
                          <th className="text-left p-3 text-sm font-medium text-neutral-700">Item</th>
                          <th className="text-center p-3 text-sm font-medium text-neutral-700">Original</th>
                          <th className="text-center p-3 text-sm font-medium text-neutral-700">Revised</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonItems.map((item, index) => {
                          const hasChange = item.original !== undefined && item.revised !== undefined &&
                            String(item.original) !== String(item.revised);

                          return (
                            <tr key={index} className="border-t">
                              <td className="p-3 text-sm font-medium text-neutral-700">{item.label}</td>
                              <td className="p-3 text-sm text-center text-neutral-500">
                                {formatValue(item.original, item.type)}
                              </td>
                              <td className={cn(
                                'p-3 text-sm text-center font-medium',
                                hasChange ? 'text-primary-700 bg-primary-50' : 'text-neutral-700'
                              )}>
                                {formatValue(item.revised, item.type)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Raw Response Data */}
            {responseData && Object.keys(responseData).length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Additional Response Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <pre className="text-xs text-neutral-700 overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(responseData, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {response.notes && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary-600" />
                    Supplier Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                    {response.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BAFOResponseView;
