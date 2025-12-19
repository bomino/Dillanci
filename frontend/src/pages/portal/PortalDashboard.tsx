/**
 * Portal Dashboard - Main dashboard for supplier portal.
 */

import * as React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ShoppingCart, Clock, ArrowRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePortalDashboard } from '@/lib/api/portal';
import { usePortalSupplier } from '@/stores/portal-store';
import { format } from 'date-fns';

export default function PortalDashboard() {
  const { data: dashboard, isLoading, error } = usePortalDashboard();
  const supplier = usePortalSupplier();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
        <h3 className="mt-4 text-lg font-medium text-neutral-900">
          Failed to load dashboard
        </h3>
        <p className="mt-2 text-sm text-neutral-500">Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Welcome back, {supplier?.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Here's what's happening with your procurement activities.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-500">Open RFQs</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {dashboard?.summary.open_rfqs || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-500">Pending Acknowledgments</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {dashboard?.summary.pending_acknowledgments || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100">
                <ShoppingCart className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-500">Active POs</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {dashboard?.summary.active_pos || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action required */}
      {(dashboard?.summary.pending_acknowledgments || 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-amber-100">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-amber-900">Action Required</h3>
                <p className="mt-1 text-sm text-amber-700">
                  You have {dashboard?.summary.pending_acknowledgments} purchase order(s)
                  waiting for acknowledgment.
                </p>
              </div>
              <Button asChild variant="outline" className="border-amber-300 text-amber-700">
                <Link to="/portal/purchase-orders">
                  View POs
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent RFQs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Recent RFQs</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/rfqs">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {dashboard?.recent_rfqs && dashboard.recent_rfqs.length > 0 ? (
              <div className="space-y-3">
                {dashboard.recent_rfqs.map((rfq) => (
                  <Link
                    key={rfq.id}
                    to={`/portal/rfqs/${rfq.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {rfq.title}
                      </p>
                      <p className="text-xs text-neutral-500">{rfq.number}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={rfq.has_submitted_bid ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {rfq.has_submitted_bid ? 'Bid Submitted' : 'Open'}
                      </Badge>
                      {rfq.due_date && (
                        <span className="text-xs text-neutral-500">
                          Due {format(new Date(rfq.due_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 text-center py-6">
                No recent RFQs
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent POs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Recent Purchase Orders</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/purchase-orders">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {dashboard?.recent_pos && dashboard.recent_pos.length > 0 ? (
              <div className="space-y-3">
                {dashboard.recent_pos.map((po) => (
                  <Link
                    key={po.id}
                    to={`/portal/purchase-orders/${po.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {po.title}
                      </p>
                      <p className="text-xs text-neutral-500">{po.number}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          po.acknowledgment_status === 'PENDING'
                            ? 'warning'
                            : po.acknowledgment_status === 'ACKNOWLEDGED'
                            ? 'success'
                            : 'default'
                        }
                        className="text-xs"
                      >
                        {po.acknowledgment_status === 'PENDING'
                          ? 'Needs Ack'
                          : po.acknowledgment_status}
                      </Badge>
                      <span className="text-xs font-medium text-neutral-700">
                        ${po.total_amount.toLocaleString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 text-center py-6">
                No recent purchase orders
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16 mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
