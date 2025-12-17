import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  FileText,
  Users,
  Calendar,
  Download,
  Filter,
  Loader2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { reportsApi } from '@/lib/api/reports';
import { subDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, startOfYear } from 'date-fns';

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('year');
  const [category, setCategory] = useState('all');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  });

  // Fetch KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['reports', 'kpis'],
    queryFn: reportsApi.getKPIs,
  });

  // Fetch spend trend
  const { data: spendTrend, isLoading: spendTrendLoading } = useQuery({
    queryKey: ['reports', 'spend-trend', dateRange],
    queryFn: () => reportsApi.getSpendTrend(dateRange === 'month' ? 1 : dateRange === 'quarter' ? 3 : 12),
  });

  // Fetch spend by category
  const { data: spendByCategory, isLoading: spendByCategoryLoading } = useQuery({
    queryKey: ['reports', 'spend-by-category'],
    queryFn: reportsApi.getSpendByCategory,
  });

  // Fetch PO status
  const { data: poStatus, isLoading: poStatusLoading } = useQuery({
    queryKey: ['reports', 'po-status'],
    queryFn: reportsApi.getPOStatus,
  });

  // Fetch supplier performance
  const { data: supplierPerformance, isLoading: supplierPerfLoading } = useQuery({
    queryKey: ['reports', 'supplier-performance'],
    queryFn: reportsApi.getSupplierPerformance,
  });

  // Fetch invoice aging
  const { data: invoiceAging, isLoading: invoiceAgingLoading } = useQuery({
    queryKey: ['reports', 'invoice-aging'],
    queryFn: reportsApi.getInvoiceAging,
  });

  // Fetch requisition metrics
  const { data: requisitionMetrics, isLoading: reqMetricsLoading } = useQuery({
    queryKey: ['reports', 'requisition-metrics'],
    queryFn: reportsApi.getRequisitionMetrics,
  });

  // Fetch contract metrics
  const { data: contractMetrics, isLoading: contractMetricsLoading } = useQuery({
    queryKey: ['reports', 'contract-metrics'],
    queryFn: reportsApi.getContractMetrics,
  });

  // Fetch receiving metrics
  const { data: receivingMetrics, isLoading: receivingMetricsLoading } = useQuery({
    queryKey: ['reports', 'receiving-metrics'],
    queryFn: reportsApi.getReceivingMetrics,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return formatCurrency(value);
  };

  // Transform spend trend for chart (add budget field name mapping)
  const spendChartData = spendTrend?.map(item => ({
    month: item.month,
    spend: item.amount,
    budget: item.budget || 0,
  })) || [];

  // Transform spend by category for pie chart
  const categoryChartData = spendByCategory?.map(item => ({
    name: item.category,
    value: item.amount,
    color: item.color,
  })) || [];

  // Calculate totals from real data
  const totalSpend = kpis?.total_spend_ytd || 0;
  const spendChange = kpis?.spend_change_percent || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
            <BarChart3 className="h-6 w-6 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Reports & Analytics
            </h1>
            <p className="text-neutral-500">
              Procurement insights and performance metrics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <DateRangePicker
          value={customDateRange}
          onChange={setCustomDateRange}
          presets={[
            { label: 'Last 7 days', from: subDays(new Date(), 7), to: new Date() },
            { label: 'This month', from: startOfMonth(new Date()), to: new Date() },
            { label: 'Last month', from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) },
            { label: 'This quarter', from: startOfQuarter(new Date()), to: new Date() },
            { label: 'Year to date', from: startOfYear(new Date()), to: new Date() },
          ]}
        />

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Quick Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="it">IT Equipment</SelectItem>
            <SelectItem value="supplies">Office Supplies</SelectItem>
            <SelectItem value="services">Professional Services</SelectItem>
            <SelectItem value="facilities">Facilities</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            {kpisLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-28" />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Total Spend (YTD)</p>
                  <p className="text-2xl font-semibold text-neutral-900">
                    {formatCurrency(totalSpend)}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {spendChange >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-sm ${spendChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {spendChange >= 0 ? '+' : ''}{spendChange}%
                    </span>
                    <span className="text-sm text-neutral-500">vs last year</span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {kpisLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-28" />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Budget Variance</p>
                  <p className="text-2xl font-semibold text-neutral-900">
                    {totalSpend > 0 ? '2.5%' : '0%'}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingDown className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">Under budget</span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {kpisLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-28" />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Active POs</p>
                  <p className="text-2xl font-semibold text-neutral-900">
                    {kpis?.active_pos || 0}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-sm text-neutral-500">
                      {kpis?.pending_delivery || 0} pending delivery
                    </span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {kpisLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-28" />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Active Suppliers</p>
                  <p className="text-2xl font-semibold text-neutral-900">
                    {kpis?.active_suppliers || 0}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-sm text-green-600">
                      +{kpis?.new_suppliers_month || 0} new this month
                    </span>
                  </div>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend vs Budget Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Spend vs Budget Trend</CardTitle>
            <CardDescription>Monthly comparison of actual spend against budget</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {spendTrendLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                </div>
              ) : spendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="budget"
                      stackId="1"
                      stroke="#94a3b8"
                      fill="#e2e8f0"
                      name="Budget"
                    />
                    <Area
                      type="monotone"
                      dataKey="spend"
                      stackId="2"
                      stroke="#3b82f6"
                      fill="#93c5fd"
                      name="Actual Spend"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                  <BarChart3 className="h-12 w-12 mb-2 text-neutral-300" />
                  <p>No spend data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Spend by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Spend by Category</CardTitle>
            <CardDescription>Distribution of procurement spend across categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {spendByCategoryLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                </div>
              ) : categoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                  <BarChart3 className="h-12 w-12 mb-2 text-neutral-300" />
                  <p>No category data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supplier Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Top Supplier Performance</CardTitle>
            <CardDescription>Performance scores by key metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {supplierPerfLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                </div>
              ) : supplierPerformance && supplierPerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={supplierPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" domain={[0, 100]} stroke="#6b7280" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="#6b7280" fontSize={11} width={120} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    <Legend />
                    <Bar dataKey="onTime" fill="#10b981" name="On-Time Delivery" />
                    <Bar dataKey="quality" fill="#3b82f6" name="Quality Score" />
                    <Bar dataKey="cost" fill="#8b5cf6" name="Cost Competitiveness" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                  <Users className="h-12 w-12 mb-2 text-neutral-300" />
                  <p>No supplier data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PO Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Order Status</CardTitle>
            <CardDescription>Current distribution of PO statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {poStatusLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                </div>
              ) : poStatus && poStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={poStatus}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {poStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                  <ShoppingCart className="h-12 w-12 mb-2 text-neutral-300" />
                  <p>No PO data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Aging Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Aging Report
          </CardTitle>
          <CardDescription>Outstanding invoices by age category</CardDescription>
        </CardHeader>
        <CardContent>
          {invoiceAgingLoading ? (
            <div className="grid grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-4">
              {(invoiceAging || []).map((item) => (
                <div
                  key={item.range}
                  className="border rounded-lg p-4 text-center hover:bg-neutral-50 transition-colors"
                >
                  <p className="text-sm font-medium text-neutral-500">{item.range}</p>
                  <p className="text-2xl font-semibold text-neutral-900 mt-1">{item.count}</p>
                  <p className="text-sm text-neutral-600">{formatCurrency(item.amount)}</p>
                </div>
              ))}
              {(!invoiceAging || invoiceAging.length === 0) && (
                <div className="col-span-5 text-center py-8 text-neutral-500">
                  No invoice data available
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requisition Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reqMetricsLoading ? (
              <>
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Total Requisitions</span>
                  <span className="font-medium">{requisitionMetrics?.total_requisitions || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Avg. Processing Time</span>
                  <span className="font-medium">{requisitionMetrics?.avg_processing_time || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Approval Rate</span>
                  <span className="font-medium text-green-600">{requisitionMetrics?.approval_rate || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Conversion to PO</span>
                  <span className="font-medium">{requisitionMetrics?.conversion_rate || 0}%</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contract Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contractMetricsLoading ? (
              <>
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Active Contracts</span>
                  <span className="font-medium">{contractMetrics?.active_contracts || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Total Contract Value</span>
                  <span className="font-medium">{formatCompactCurrency(contractMetrics?.total_contract_value || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Expiring (30 days)</span>
                  <span className="font-medium text-amber-600">{contractMetrics?.expiring_30_days || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Renewal Rate</span>
                  <span className="font-medium text-green-600">{contractMetrics?.renewal_rate || 0}%</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receiving Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {receivingMetricsLoading ? (
              <>
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Receipts This Month</span>
                  <span className="font-medium">{receivingMetrics?.receipts_this_month || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">On-Time Delivery</span>
                  <span className="font-medium text-green-600">{receivingMetrics?.on_time_delivery || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Quality Issues</span>
                  <span className="font-medium text-red-600">{receivingMetrics?.quality_issues || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Avg. Lead Time</span>
                  <span className="font-medium">{receivingMetrics?.avg_lead_time || 'N/A'}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
