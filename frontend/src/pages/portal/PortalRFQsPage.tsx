/**
 * Portal RFQs Page - List of RFQs for supplier to view and submit bids.
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
import { usePortalRFQs, type PortalRFQ } from '@/lib/api/portal';

type StatusFilter = 'all' | 'open' | 'submitted' | 'not_submitted' | 'closed';

export default function PortalRFQsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: rfqs, isLoading, error } = usePortalRFQs();

  // Filter and search logic
  const filteredRFQs = useMemo(() => {
    if (!rfqs) return [];

    return rfqs.filter((rfq) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          rfq.title.toLowerCase().includes(query) ||
          rfq.number.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      switch (statusFilter) {
        case 'open':
          return rfq.status === 'OPEN';
        case 'submitted':
          return rfq.has_submitted_bid === true;
        case 'not_submitted':
          return rfq.status === 'OPEN' && !rfq.has_submitted_bid;
        case 'closed':
          return rfq.status === 'CLOSED' || rfq.status === 'AWARDED';
        default:
          return true;
      }
    });
  }, [rfqs, searchQuery, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!rfqs) return { total: 0, open: 0, submitted: 0, pending: 0 };

    return {
      total: rfqs.length,
      open: rfqs.filter((r) => r.status === 'OPEN').length,
      submitted: rfqs.filter((r) => r.has_submitted_bid).length,
      pending: rfqs.filter((r) => r.status === 'OPEN' && !r.has_submitted_bid).length,
    };
  }, [rfqs]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-lg font-medium text-neutral-900">Failed to load RFQs</h3>
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
        <h1 className="text-2xl font-semibold text-neutral-900">Requests for Quotation</h1>
        <p className="mt-1 text-sm text-neutral-500">
          View RFQs you've been invited to and submit competitive bids.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total RFQs"
          value={stats.total}
          icon={FileText}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <SummaryCard
          title="Open"
          value={stats.open}
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
        />
        <SummaryCard
          title="Bids Submitted"
          value={stats.submitted}
          icon={CheckCircle}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <SummaryCard
          title="Pending Response"
          value={stats.pending}
          icon={AlertCircle}
          iconColor="text-orange-600"
          iconBg="bg-orange-100"
          highlight={stats.pending > 0}
        />
      </div>

      {/* Pending Action Banner */}
      {stats.pending > 0 && (
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
                    You have {stats.pending} RFQ{stats.pending > 1 ? 's' : ''} awaiting your bid
                  </p>
                  <p className="text-sm text-amber-700">
                    Submit your bids before the deadline to stay competitive.
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
            <CardTitle>All RFQs</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Search RFQs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger className="w-44">
                  <Filter className="h-4 w-4 mr-2 text-neutral-400" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All RFQs</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="submitted">Bid Submitted</SelectItem>
                  <SelectItem value="not_submitted">Pending Response</SelectItem>
                  <SelectItem value="closed">Closed/Awarded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRFQs.length === 0 ? (
            <EmptyState
              hasFilters={!!searchQuery || statusFilter !== 'all'}
              onClearFilters={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
            />
          ) : (
            <div className="space-y-3">
              {filteredRFQs.map((rfq, index) => (
                <motion.div
                  key={rfq.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <RFQCard rfq={rfq} onClick={() => navigate(`/portal/rfqs/${rfq.id}`)} />
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

// RFQ Card Component
interface RFQCardProps {
  rfq: PortalRFQ;
  onClick: () => void;
}

function RFQCard({ rfq, onClick }: RFQCardProps) {
  const isOpen = rfq.status === 'OPEN';
  const hasSubmittedBid = rfq.has_submitted_bid;
  const dueDate = rfq.due_date ? new Date(rfq.due_date) : null;
  const isOverdue = dueDate ? isPast(dueDate) : false;
  const isUrgent = dueDate && !isOverdue && (dueDate.getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000;

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 hover:border-primary-200 hover:bg-primary-50/30 cursor-pointer transition-all group"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={`p-2.5 rounded-lg ${hasSubmittedBid ? 'bg-green-100' : isOpen ? 'bg-blue-100' : 'bg-neutral-100'}`}>
          <FileText
            className={`h-5 w-5 ${hasSubmittedBid ? 'text-green-600' : isOpen ? 'text-blue-600' : 'text-neutral-500'}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary-700">{rfq.number}</span>
            <RFQStatusBadge status={rfq.status} hasSubmittedBid={hasSubmittedBid} />
          </div>
          <p className="font-medium text-neutral-900 truncate mt-0.5">{rfq.title}</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            From {rfq.organization_name} • {rfq.line_count || 0} line items
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 ml-4">
        {dueDate && (
          <div className="text-right">
            <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-neutral-700'}`}>
              {format(dueDate, 'MMM d, yyyy')}
            </p>
            <p className={`text-xs ${isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-neutral-400'}`}>
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
function RFQStatusBadge({ status, hasSubmittedBid }: { status: string; hasSubmittedBid?: boolean }) {
  if (hasSubmittedBid) {
    return (
      <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
        Bid Submitted
      </Badge>
    );
  }

  switch (status) {
    case 'OPEN':
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          Open
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
        <Badge variant="default" className="bg-purple-100 text-purple-700 hover:bg-purple-100">
          Awarded
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">{status}</Badge>
      );
  }
}

// Empty State Component
function EmptyState({ hasFilters, onClearFilters }: { hasFilters: boolean; onClearFilters: () => void }) {
  return (
    <div className="text-center py-12">
      <FileText className="h-12 w-12 text-neutral-300 mx-auto" />
      <h3 className="mt-4 text-lg font-medium text-neutral-900">
        {hasFilters ? 'No RFQs match your filters' : 'No RFQs yet'}
      </h3>
      <p className="mt-2 text-sm text-neutral-500">
        {hasFilters
          ? 'Try adjusting your search or filter criteria.'
          : 'When you receive RFQ invitations, they will appear here.'}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
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
