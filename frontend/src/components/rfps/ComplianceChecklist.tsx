import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Download,
  Filter,
  Building2,
  Paperclip,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { Proposal, RFPQuestion } from '@/types';

interface MandatoryRequirement {
  id: string;
  questionId: string;
  questionText: string;
  attachmentType?: string;
  minAttachments: number;
}

interface ProposalCompliance {
  proposalId: string;
  supplierName: string;
  proposalNumber: string;
  status: 'compliant' | 'non-compliant' | 'partial';
  requirements: {
    requirementId: string;
    isCompliant: boolean;
    attachmentCount: number;
  }[];
  compliantCount: number;
  totalRequired: number;
  compliancePercentage: number;
}

interface ComplianceChecklistProps {
  rfpId: string;
  proposals: Proposal[];
  questions: RFPQuestion[];
  onExportReport?: () => void;
  onViewProposal?: (proposal: Proposal) => void;
}

export function ComplianceChecklist({
  rfpId: _rfpId,
  proposals,
  questions,
  onExportReport,
  onViewProposal,
}: ComplianceChecklistProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'compliant' | 'non-compliant'>('all');

  // Extract mandatory requirements from questions
  const mandatoryRequirements = useMemo((): MandatoryRequirement[] => {
    return questions
      .filter((q) => q.is_mandatory_attachment || (q.is_required && q.question_type === 'FILE'))
      .map((q) => ({
        id: `req-${q.id}`,
        questionId: q.id,
        questionText: q.question_text,
        attachmentType: q.attachment_type || undefined,
        minAttachments: q.min_attachments || 1,
      }));
  }, [questions]);

  // Calculate compliance for each proposal
  const proposalCompliance = useMemo((): ProposalCompliance[] => {
    return proposals.map((proposal) => {
      const requirements = mandatoryRequirements.map((req) => {
        // Find matching response in proposal
        const response = proposal.question_responses.find(
          (r) => r.question === req.questionId
        );

        // Check if response has required attachments
        // For FILE type, check if answer_text contains file info
        const hasAttachment = response?.answer_text && response.answer_text.trim() !== '';
        const attachmentCount = hasAttachment ? 1 : 0; // Simplified - could be enhanced

        return {
          requirementId: req.id,
          isCompliant: attachmentCount >= req.minAttachments,
          attachmentCount,
        };
      });

      const compliantCount = requirements.filter((r) => r.isCompliant).length;
      const totalRequired = mandatoryRequirements.length;
      const compliancePercentage =
        totalRequired > 0 ? (compliantCount / totalRequired) * 100 : 100;

      let status: 'compliant' | 'non-compliant' | 'partial';
      if (compliancePercentage === 100) {
        status = 'compliant';
      } else if (compliancePercentage === 0) {
        status = 'non-compliant';
      } else {
        status = 'partial';
      }

      return {
        proposalId: proposal.id,
        supplierName: proposal.supplier_name,
        proposalNumber: proposal.proposal_number,
        status,
        requirements,
        compliantCount,
        totalRequired,
        compliancePercentage,
      };
    });
  }, [proposals, mandatoryRequirements]);

  // Filter proposals by compliance status
  const filteredCompliance = useMemo(() => {
    if (filterStatus === 'all') return proposalCompliance;
    if (filterStatus === 'compliant') {
      return proposalCompliance.filter((p) => p.status === 'compliant');
    }
    return proposalCompliance.filter((p) => p.status !== 'compliant');
  }, [proposalCompliance, filterStatus]);

  // Summary statistics
  const stats = useMemo(() => {
    const total = proposalCompliance.length;
    const compliant = proposalCompliance.filter((p) => p.status === 'compliant').length;
    const partial = proposalCompliance.filter((p) => p.status === 'partial').length;
    const nonCompliant = proposalCompliance.filter((p) => p.status === 'non-compliant').length;

    return { total, compliant, partial, nonCompliant };
  }, [proposalCompliance]);

  const getStatusBadge = (status: 'compliant' | 'non-compliant' | 'partial') => {
    switch (status) {
      case 'compliant':
        return (
          <Badge className="bg-green-50 text-green-700 border border-green-200">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Compliant
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            Partial
          </Badge>
        );
      case 'non-compliant':
        return (
          <Badge className="bg-red-50 text-red-700 border border-red-200">
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Non-Compliant
          </Badge>
        );
    }
  };

  if (mandatoryRequirements.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-neutral-500">
            <ShieldCheck className="h-12 w-12 text-neutral-300 mb-3" />
            <p className="font-medium">No mandatory requirements defined</p>
            <p className="text-sm text-neutral-400 mt-1">
              Add mandatory attachment requirements to RFP questions to enable compliance tracking
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total Proposals</p>
                <p className="text-2xl font-semibold text-neutral-900">{stats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Fully Compliant</p>
                <p className="text-2xl font-semibold text-green-600">{stats.compliant}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Partially Compliant</p>
                <p className="text-2xl font-semibold text-amber-600">{stats.partial}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Non-Compliant</p>
                <p className="text-2xl font-semibold text-red-600">{stats.nonCompliant}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Matrix */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary-600" />
                Compliance Matrix
              </CardTitle>
              <CardDescription>
                Track mandatory requirements across all proposals
              </CardDescription>
            </div>

            <div className="flex items-center gap-3">
              {/* Filter */}
              <Select
                value={filterStatus}
                onValueChange={(value) =>
                  setFilterStatus(value as 'all' | 'compliant' | 'non-compliant')
                }
              >
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Proposals</SelectItem>
                  <SelectItem value="compliant">Compliant Only</SelectItem>
                  <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                </SelectContent>
              </Select>

              {/* Export */}
              {onExportReport && (
                <Button variant="outline" size="sm" onClick={onExportReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredCompliance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
              <Building2 className="h-12 w-12 text-neutral-300 mb-3" />
              <p className="font-medium">No proposals match the filter</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50">
                    <TableHead className="w-[200px]">Supplier</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Compliance</TableHead>
                    {mandatoryRequirements.map((req, index) => (
                      <TableHead key={req.id} className="text-center min-w-[120px]">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center gap-1 cursor-help">
                                <Paperclip className="h-4 w-4 text-neutral-400" />
                                <span className="text-xs truncate max-w-[100px]">
                                  Req #{index + 1}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-medium">{req.questionText}</p>
                              {req.attachmentType && (
                                <p className="text-xs mt-1">Type: {req.attachmentType}</p>
                              )}
                              <p className="text-xs mt-1">
                                Min attachments: {req.minAttachments}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                    ))}
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompliance.map((compliance) => {
                    const proposal = proposals.find((p) => p.id === compliance.proposalId);

                    return (
                      <TableRow key={compliance.proposalId}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-neutral-900">
                              {compliance.supplierName}
                            </p>
                            <p className="text-xs text-neutral-500">{compliance.proposalNumber}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(compliance.status)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-medium">
                              {compliance.compliantCount}/{compliance.totalRequired}
                            </span>
                            <Progress
                              value={compliance.compliancePercentage}
                              className={`h-1.5 w-16 ${
                                compliance.compliancePercentage === 100
                                  ? '[&>div]:bg-green-500'
                                  : compliance.compliancePercentage > 0
                                    ? '[&>div]:bg-amber-500'
                                    : '[&>div]:bg-red-500'
                              }`}
                            />
                          </div>
                        </TableCell>
                        {mandatoryRequirements.map((req) => {
                          const reqCompliance = compliance.requirements.find(
                            (r) => r.requirementId === req.id
                          );

                          return (
                            <TableCell key={req.id} className="text-center">
                              {reqCompliance?.isCompliant ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {reqCompliance.attachmentCount} attachment(s) submitted
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Missing required attachment (need {req.minAttachments})
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          {proposal && onViewProposal && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewProposal(proposal)}
                            >
                              View
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requirements Detail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Paperclip className="h-5 w-5 text-primary-600" />
            Mandatory Requirements ({mandatoryRequirements.length})
          </CardTitle>
          <CardDescription>All mandatory attachment requirements for this RFP</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mandatoryRequirements.map((req, index) => {
              const compliantCount = proposalCompliance.filter((p) =>
                p.requirements.find((r) => r.requirementId === req.id)?.isCompliant
              ).length;

              return (
                <div
                  key={req.id}
                  className="flex items-start justify-between p-3 bg-neutral-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                      <span className="font-medium text-neutral-900">{req.questionText}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-neutral-500">
                      {req.attachmentType && <span>Type: {req.attachmentType}</span>}
                      <span>Min: {req.minAttachments} file(s)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`${
                        compliantCount === proposalCompliance.length
                          ? 'border-green-200 text-green-700 bg-green-50'
                          : compliantCount > 0
                            ? 'border-amber-200 text-amber-700 bg-amber-50'
                            : 'border-red-200 text-red-700 bg-red-50'
                      }`}
                    >
                      {compliantCount}/{proposalCompliance.length} compliant
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ComplianceChecklist;
