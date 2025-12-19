/**
 * Portal RFPs Page - List of RFPs for supplier to view and submit proposals.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  Search,
  ArrowRight,
  Award,
  Send,
  RefreshCw,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePortalRFPs, type PortalRFP } from '@/lib/api/portal';

type StatusFilter = 'all' | 'open' | 'submitted' | 'not_submitted' | 'bafo' | 'closed';

export default function PortalRFPsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: rfps, isLoading, error } = usePortalRFPs();

  // Filter and search logic
  const filteredRFPs = useMemo(() => {
    if (!rfps) return [];

    return rfps.filter((rfp) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          rfp.title.toLowerCase().includes(query) ||
          rfp.number.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      switch (statusFilter) {
        case 'open':
          return rfp.status === 'PUBLISHED' && !rfp.has_submitted_proposal;
        case 'submitted':
          return rfp.has_submitted_proposal === true;
        case 'not_submitted':
          return rfp.status === 'PUBLISHED' && !rfp.has_submitted_proposal;
        case 'bafo':
          return rfp.bafo_status === 'REQUESTED';
        case 'closed':
          return ['CLOSED', 'AWARDED'].includes(rfp.status);
        default:
          return true;
      }
    });
  }, [rfps, searchQuery, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!rfps) return { total: 0, open: 0, submitted: 0, pending: 0, bafo: 0 };

    return {
      total: rfps.length,
      open: rfps.filter((r) => r.status === 'PUBLISHED').length,
      submitted: rfps.filter((r) => r.has_submitted_proposal).length,
      pending: rfps.filter((r) => r.status === 'PUBLISHED' && !r.has_submitted_proposal).length,
      bafo: rfps.filter((r) => r.bafo_status === 'REQUESTED').length,
    };
  }, [rfps]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-lg font-medium text-neutral-900">Failed to load RFPs</h3>
        <p className="mt-2 text-sm text-neutral-500">Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Requests for Proposal</h1>
        <p className="mt-1 text-sm text-neutral-500">
          View RFPs you've been invited to and submit comprehensive proposals.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard
          title="Total RFPs"
          value={stats.total}
          icon={FileText}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
        />
        <SummaryCard
          title="Open"
          value={stats.open}
          icon={Clock}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <SummaryCard
          title="Proposals Submitted"
          value={stats.submitted}
          icon={CheckCircle}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <SummaryCard
          title="Pending Response"
          value={stats.pending}
          icon={Send}
          iconColor="text-orange-600"
          iconBg="bg-orange-100"
          highlight={stats.pending > 0}
        />
        <SummaryCard
          title="BAFO Requested"
          value={stats.bafo}
          icon={RefreshCw}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-100"
          highlight={stats.bafo > 0}
        />
      </div>

      {/* BAFO Action Banner */}
      {stats.bafo > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-indigo-200 bg-indigo-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-indigo-100">
                  <RefreshCw className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-indigo-900">
                    You have {stats.bafo} Best and Final Offer (BAFO) request{stats.bafo > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-indigo-700">
                    Submit your revised offer before the deadline to improve your chances.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                  onClick={() => setStatusFilter('bafo')}
                >
                  View BAFO Requests
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Pending Action Banner */}
      {stats.pending > 0 && stats.bafo === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-amber-900">
                    You have {stats.pending} RFP{stats.pending > 1 ? 's' : ''} awaiting your proposal
                  </p>
                  <p className="text-sm text-amber-700">
                    Submit your proposals before the deadline to participate.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={() => setStatusFilter('not_submitted')}
                >
                  View Pending
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>All RFPs</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Search RFPs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2 text-neutral-400" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All RFPs</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="submitted">Proposal Submitted</SelectItem>
                  <SelectItem value="not_submitted">Pending Response</SelectItem>
                  <SelectItem value="bafo">BAFO Requested</SelectItem>
                  <SelectItem value="closed">Closed/Awarded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRFPs.length === 0 ? (
            <EmptyState
              hasFilters={!!searchQuery || statusFilter !== 'all'}
              onClearFilters={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
            />
          ) : (
            <div className="space-y-3">
              {filteredRFPs.map((rfp, index) => (
                <motion.div
                  key={rfp.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <RFPCard rfp={rfp} onClick={() => navigate(`/portal/rfps/${rfp.id}`)} />
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Summary Card Component
interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  highlight?: boolean;
}

function SummaryCard({ title, value, icon: Icon, iconColor, iconBg, highlight }: SummaryCardProps) {
  return (
    <Card className={highlight ? 'ring-2 ring-orange-200' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">{title}</p>
            <p className={`text-2xl font-semibold ${highlight ? 'text-orange-600' : 'text-neutral-900'}`}>
              {value}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// RFP Card Component
interface RFPCardProps {
  rfp: PortalRFP;
  onClick: () => void;
}

function RFPCard({ rfp, onClick }: RFPCardProps) {
  const isOpen = rfp.status === 'PUBLISHED';
  const hasSubmittedProposal = rfp.has_submitted_proposal;
  const hasBAFORequest = rfp.bafo_status === 'REQUESTED';
  const isAwarded = rfp.status === 'AWARDED';
  const dueDate = rfp.submission_deadline ? new Date(rfp.submission_deadline) : null;
  const isOverdue = dueDate ? isPast(dueDate) : false;
  const isUrgent = dueDate && !isOverdue && (dueDate.getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000;

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 hover:border-primary-200 hover:bg-primary-50/30 cursor-pointer transition-all group"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={`p-2.5 rounded-lg ${
          isAwarded ? 'bg-yellow-100' :
          hasBAFORequest ? 'bg-indigo-100' :
          hasSubmittedProposal ? 'bg-green-100' :
          isOpen ? 'bg-purple-100' :
          'bg-neutral-100'
        }`}>
          {isAwarded ? (
            <Award className="h-5 w-5 text-yellow-600" />
          ) : (
            <FileText
              className={`h-5 w-5 ${
                hasBAFORequest ? 'text-indigo-600' :
                hasSubmittedProposal ? 'text-green-600' :
                isOpen ? 'text-purple-600' :
                'text-neutral-500'
              }`}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-primary-700">{rfp.number}</span>
            <RFPStatusBadge
              status={rfp.status}
              hasSubmittedProposal={hasSubmittedProposal}
              bafoStatus={rfp.bafo_status}
            />
          </div>
          <p className="font-medium text-neutral-900 truncate mt-0.5">{rfp.title}</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            From {rfp.organization_name}
            {rfp.category && ` • ${rfp.category}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 ml-4">
        {dueDate && (
          <div className="text-right">
            <p className={`text-sm font-medium ${
              isOverdue ? 'text-red-600' :
              isUrgent ? 'text-amber-600' :
              'text-neutral-700'
            }`}>
              {format(dueDate, 'MMM d, yyyy')}
            </p>
            <p className={`text-xs ${
              isOverdue ? 'text-red-500' :
              isUrgent ? 'text-amber-500' :
              'text-neutral-400'
            }`}>
              {isOverdue ? 'Deadline passed' : formatDistanceToNow(dueDate, { addSuffix: true })}
            </p>
          </div>
        )}
        <ArrowRight className="h-5 w-5 text-neutral-400 group-hover:text-primary-600 transition-colors" />
      </div>
    </div>
  );
}

// Status Badge Component
function RFPStatusBadge({
  status,
  hasSubmittedProposal,
  bafoStatus,
}: {
  status: string;
  hasSubmittedProposal?: boolean;
  bafoStatus?: string | null;
}) {
  if (bafoStatus === 'REQUESTED') {
    return (
      <Badge variant="default" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
        BAFO Requested
      </Badge>
    );
  }

  if (bafoStatus === 'SUBMITTED') {
    return (
      <Badge variant="default" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
        BAFO Submitted
      </Badge>
    );
  }

  if (hasSubmittedProposal) {
    return (
      <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
        Proposal Submitted
      </Badge>
    );
  }

  switch (status) {
    case 'PUBLISHED':
      return (
        <Badge variant="default" className="bg-purple-100 text-purple-700 hover:bg-purple-100">
          Open
        </Badge>
      );
    case 'UNDER_EVALUATION':
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          Under Evaluation
        </Badge>
      );
    case 'SHORTLISTED':
      return (
        <Badge variant="default" className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100">
          Shortlisted
        </Badge>
      );
    case 'CLOSED':
      return (
        <Badge variant="outline" className="text-neutral-600">
          Closed
        </Badge>
      );
    case 'AWARDED':
      return (
        <Badge variant="default" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
          Awarded
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// Empty State Component
function EmptyState({ hasFilters, onClearFilters }: { hasFilters: boolean; onClearFilters: () => void }) {
  return (
    <div className="text-center py-12">
      <FileText className="h-12 w-12 text-neutral-300 mx-auto" />
      <h3 className="mt-4 text-lg font-medium text-neutral-900">
        {hasFilters ? 'No RFPs match your filters' : 'No RFPs yet'}
      </h3>
      <p className="mt-2 text-sm text-neutral-500">
        {hasFilters
          ? 'Try adjusting your search or filter criteria.'
          : 'When you receive RFP invitations, they will appear here.'}
      </p>
      {hasFilters && (
        <Button variant="outline" className="mt-4" onClick={onClearFilters}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}

// Page Skeleton
function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-12 mt-1" />
                </div>
                <Skeleton className="h-12 w-12 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
