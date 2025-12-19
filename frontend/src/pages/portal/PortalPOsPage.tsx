/**
 * Portal Purchase Orders Page - List of POs sent to this supplier.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Search,
  ArrowRight,
  DollarSign,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

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
import { usePortalPOs, type PortalPO } from '@/lib/api/portal';

type AckFilter = 'all' | 'pending' | 'acknowledged' | 'rejected';

export default function PortalPOsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [ackFilter, setAckFilter] = useState<AckFilter>('all');

  const { data: pos, isLoading, error } = usePortalPOs();

  // Filter and search logic
  const filteredPOs = useMemo(() => {
    if (!pos) return [];

    return pos.filter((po) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          po.title.toLowerCase().includes(query) ||
          po.number.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Acknowledgment status filter
      const ackStatus = po.acknowledgment_status || po.acknowledgment?.status || 'PENDING';
      switch (ackFilter) {
        case 'pending':
          return ackStatus === 'PENDING';
        case 'acknowledged':
          return ackStatus === 'ACKNOWLEDGED';
        case 'rejected':
          return ackStatus === 'REJECTED';
        default:
          return true;
      }
    });
  }, [pos, searchQuery, ackFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!pos) return { total: 0, pending: 0, acknowledged: 0, totalValue: 0 };

    return {
      total: pos.length,
      pending: pos.filter((p) => {
        const status = p.acknowledgment_status || p.acknowledgment?.status;
        return status === 'PENDING' || !status;
      }).length,
      acknowledged: pos.filter((p) => {
        const status = p.acknowledgment_status || p.acknowledgment?.status;
        return status === 'ACKNOWLEDGED';
      }).length,
      totalValue: pos.reduce((sum, p) => sum + (p.total_amount || 0), 0),
    };
  }, [pos]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-lg font-medium text-neutral-900">Failed to load Purchase Orders</h3>
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
        <h1 className="text-2xl font-semibold text-neutral-900">Purchase Orders</h1>
        <p className="mt-1 text-sm text-neutral-500">
          View and acknowledge purchase orders from your customers.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total POs"
          value={stats.total}
          icon={ShoppingCart}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <SummaryCard
          title="Pending Acknowledgment"
          value={stats.pending}
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
          highlight={stats.pending > 0}
        />
        <SummaryCard
          title="Acknowledged"
          value={stats.acknowledged}
          icon={CheckCircle}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total Value</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  ${stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-100">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
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
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-amber-900">
                    {stats.pending} Purchase Order{stats.pending > 1 ? 's' : ''} require acknowledgment
                  </p>
                  <p className="text-sm text-amber-700">
                    Review and acknowledge these POs to confirm receipt and delivery commitment.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={() => setAckFilter('pending')}
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
            <CardTitle>All Purchase Orders</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Search POs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <Select
                value={ackFilter}
                onValueChange={(value) => setAckFilter(value as AckFilter)}
              >
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2 text-neutral-400" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All POs</SelectItem>
                  <SelectItem value="pending">Pending Acknowledgment</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPOs.length === 0 ? (
            <EmptyState
              hasFilters={!!searchQuery || ackFilter !== 'all'}
              onClearFilters={() => {
                setSearchQuery('');
                setAckFilter('all');
              }}
            />
          ) : (
            <div className="space-y-3">
              {filteredPOs.map((po, index) => (
                <motion.div
                  key={po.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <POCard po={po} onClick={() => navigate(`/portal/purchase-orders/${po.id}`)} />
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
    <Card className={highlight ? 'ring-2 ring-amber-200' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">{title}</p>
            <p className={`text-2xl font-semibold ${highlight ? 'text-amber-600' : 'text-neutral-900'}`}>
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

// PO Card Component
interface POCardProps {
  po: PortalPO;
  onClick: () => void;
}

function POCard({ po, onClick }: POCardProps) {
  const ackStatus = po.acknowledgment_status || po.acknowledgment?.status || 'PENDING';
  const sentDate = po.sent_at ? new Date(po.sent_at) : null;
  const deliveryDate = po.expected_delivery ? new Date(po.expected_delivery) : null;

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 hover:border-primary-200 hover:bg-primary-50/30 cursor-pointer transition-all group"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={`p-2.5 rounded-lg ${
          ackStatus === 'ACKNOWLEDGED'
            ? 'bg-green-100'
            : ackStatus === 'REJECTED'
            ? 'bg-red-100'
            : 'bg-amber-100'
        }`}>
          <ShoppingCart
            className={`h-5 w-5 ${
              ackStatus === 'ACKNOWLEDGED'
                ? 'text-green-600'
                : ackStatus === 'REJECTED'
                ? 'text-red-600'
                : 'text-amber-600'
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary-700">{po.number}</span>
            <POStatusBadge status={po.status} />
            <AckStatusBadge status={ackStatus} />
          </div>
          <p className="font-medium text-neutral-900 truncate mt-0.5">{po.title}</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            From {po.organization_name}
            {sentDate && ` • Sent ${format(sentDate, 'MMM d, yyyy')}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6 ml-4">
        <div className="text-right">
          <p className="text-lg font-semibold text-neutral-900">
            ${po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          {deliveryDate && (
            <p className="text-xs text-neutral-500">
              Delivery: {format(deliveryDate, 'MMM d')}
            </p>
          )}
        </div>
        <ArrowRight className="h-5 w-5 text-neutral-400 group-hover:text-primary-600 transition-colors" />
      </div>
    </div>
  );
}

// PO Status Badge
function POStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'SENT':
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          Sent
        </Badge>
      );
    case 'RECEIVED':
      return (
        <Badge variant="default" className="bg-purple-100 text-purple-700 hover:bg-purple-100">
          Received
        </Badge>
      );
    case 'COMPLETED':
      return (
        <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
          Completed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// Acknowledgment Status Badge
function AckStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'PENDING':
      return (
        <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
          Needs Acknowledgment
        </Badge>
      );
    case 'ACKNOWLEDGED':
      return (
        <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="h-3 w-3 mr-1" />
          Acknowledged
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge variant="default" className="bg-red-100 text-red-700 hover:bg-red-100">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return null;
  }
}

// Empty State Component
function EmptyState({ hasFilters, onClearFilters }: { hasFilters: boolean; onClearFilters: () => void }) {
  return (
    <div className="text-center py-12">
      <ShoppingCart className="h-12 w-12 text-neutral-300 mx-auto" />
      <h3 className="mt-4 text-lg font-medium text-neutral-900">
        {hasFilters ? 'No POs match your filters' : 'No Purchase Orders yet'}
      </h3>
      <p className="mt-2 text-sm text-neutral-500">
        {hasFilters
          ? 'Try adjusting your search or filter criteria.'
          : 'When your customers send you purchase orders, they will appear here.'}
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
          <Skeleton className="h-6 w-40" />
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
