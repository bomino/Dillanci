import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Mock data for charts
const spendByMonth = [
  { month: 'Jan', spend: 125000, budget: 150000 },
  { month: 'Feb', spend: 142000, budget: 150000 },
  { month: 'Mar', spend: 138000, budget: 150000 },
  { month: 'Apr', spend: 165000, budget: 160000 },
  { month: 'May', spend: 152000, budget: 160000 },
  { month: 'Jun', spend: 148000, budget: 160000 },
  { month: 'Jul', spend: 175000, budget: 170000 },
  { month: 'Aug', spend: 168000, budget: 170000 },
  { month: 'Sep', spend: 182000, budget: 180000 },
  { month: 'Oct', spend: 195000, budget: 190000 },
  { month: 'Nov', spend: 188000, budget: 190000 },
  { month: 'Dec', spend: 210000, budget: 200000 },
];

const spendByCategory = [
  { name: 'IT Equipment', value: 450000, color: '#3b82f6' },
  { name: 'Office Supplies', value: 180000, color: '#10b981' },
  { name: 'Professional Services', value: 320000, color: '#8b5cf6' },
  { name: 'Facilities', value: 250000, color: '#f59e0b' },
  { name: 'Marketing', value: 150000, color: '#ef4444' },
  { name: 'Other', value: 88000, color: '#6b7280' },
];

const supplierPerformance = [
  { name: 'TechPro Solutions', onTime: 95, quality: 92, cost: 88 },
  { name: 'Office Essentials', onTime: 88, quality: 85, cost: 92 },
  { name: 'BuildRight Corp', onTime: 82, quality: 90, cost: 78 },
  { name: 'Global Consulting', onTime: 98, quality: 95, cost: 75 },
  { name: 'Industrial Parts', onTime: 85, quality: 88, cost: 90 },
];

const poStatusData = [
  { name: 'Draft', value: 12, color: '#6b7280' },
  { name: 'Pending Approval', value: 8, color: '#f59e0b' },
  { name: 'Approved', value: 15, color: '#3b82f6' },
  { name: 'Sent', value: 25, color: '#8b5cf6' },
  { name: 'Received', value: 45, color: '#10b981' },
  { name: 'Cancelled', value: 5, color: '#ef4444' },
];

const invoiceAgingData = [
  { range: 'Current', count: 45, amount: 125000 },
  { range: '1-30 Days', count: 28, amount: 85000 },
  { range: '31-60 Days', count: 12, amount: 42000 },
  { range: '61-90 Days', count: 5, amount: 18000 },
  { range: '90+ Days', count: 3, amount: 12000 },
];

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('year');
  const [category, setCategory] = useState('all');

  // Calculate totals
  const totalSpend = spendByMonth.reduce((sum, m) => sum + m.spend, 0);
  const totalBudget = spendByMonth.reduce((sum, m) => sum + m.budget, 0);
  const budgetVariance = ((totalBudget - totalSpend) / totalBudget) * 100;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

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
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Date Range" />
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total Spend (YTD)</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {formatCurrency(totalSpend)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">+12.5%</span>
                  <span className="text-sm text-neutral-500">vs last year</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Budget Variance</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {budgetVariance.toFixed(1)}%
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {budgetVariance >= 0 ? (
                    <>
                      <TrendingDown className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">Under budget</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600">Over budget</span>
                    </>
                  )}
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Active POs</p>
                <p className="text-2xl font-semibold text-neutral-900">48</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-sm text-neutral-500">15 pending delivery</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Active Suppliers</p>
                <p className="text-2xl font-semibold text-neutral-900">24</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-sm text-green-600">+3 new this month</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-amber-600" />
              </div>
            </div>
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
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spendByMonth}>
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
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={spendByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {spendByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={poStatusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {poStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
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
          <div className="grid grid-cols-5 gap-4">
            {invoiceAgingData.map((item) => (
              <div
                key={item.range}
                className="border rounded-lg p-4 text-center hover:bg-neutral-50 transition-colors"
              >
                <p className="text-sm font-medium text-neutral-500">{item.range}</p>
                <p className="text-2xl font-semibold text-neutral-900 mt-1">{item.count}</p>
                <p className="text-sm text-neutral-600">{formatCurrency(item.amount)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requisition Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Total Requisitions</span>
              <span className="font-medium">156</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Avg. Processing Time</span>
              <span className="font-medium">2.3 days</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Approval Rate</span>
              <span className="font-medium text-green-600">92%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Conversion to PO</span>
              <span className="font-medium">85%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contract Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Active Contracts</span>
              <span className="font-medium">32</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Total Contract Value</span>
              <span className="font-medium">$4.2M</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Expiring (30 days)</span>
              <span className="font-medium text-amber-600">5</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Renewal Rate</span>
              <span className="font-medium text-green-600">78%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receiving Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Receipts This Month</span>
              <span className="font-medium">45</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">On-Time Delivery</span>
              <span className="font-medium text-green-600">89%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Quality Issues</span>
              <span className="font-medium text-red-600">3</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Avg. Lead Time</span>
              <span className="font-medium">8.5 days</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
