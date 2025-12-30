import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Building2,
  Star,
  RefreshCw,
  Loader2,
  ArrowLeft,
  ChevronRight,
  Users,
  Award,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import {
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DataTable,
  DataTableColumnHeader,
} from '@/components/ui/data-table';
import type { ColumnDef, Row } from '@tanstack/react-table';

import { reportsApi } from '@/lib/api/reports';
import type { SupplierRanking } from '@/lib/api/reports';
import { useRecalculateAllSupplierScores, performanceTierConfig } from '@/lib/api/suppliers';
import { toast } from '@/components/ui/toast';

export default function SupplierPerformancePage() {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');

  const recalculateAllMutation = useRecalculateAllSupplierScores();

  // Fetch supplier rankings
  const { data: rankings, isLoading: rankingsLoading, refetch: refetchRankings } = useQuery({
    queryKey: ['supplier-rankings'],
    queryFn: () => reportsApi.getSupplierRankings(50),
  });

  // Fetch tier distribution
  const { data: tierDistribution, isLoading: tierLoading } = useQuery({
    queryKey: ['supplier-tier-distribution'],
    queryFn: reportsApi.getSupplierTierDistribution,
  });

  // Filter rankings by search
  const filteredRankings = rankings?.filter(
    (s) => s.name.toLowerCase().includes(searchValue.toLowerCase())
  ) || [];

  // Calculate summary stats
  const totalSuppliers = rankings?.length || 0;
  const avgScore = rankings && rankings.length > 0
    ? (rankings.reduce((sum, s) => sum + s.overall_score, 0) / rankings.length).toFixed(1)
    : '0';
  const strategicCount = rankings?.filter(s => s.performance_tier === 'STRATEGIC').length || 0;
  const atRiskCount = rankings?.filter(s =>
    s.performance_tier === 'PROBATION' || s.performance_tier === 'CONDITIONAL'
  ).length || 0;

  // Prepare data for radar chart (top supplier)
  const topSupplier = rankings?.[0];
  const radarData = topSupplier ? [
    { subject: 'Delivery', value: topSupplier.delivery_score, fullMark: 100 },
    { subject: 'Quality', value: topSupplier.quality_score, fullMark: 100 },
    { subject: 'Cost', value: topSupplier.cost_score, fullMark: 100 },
  ] : [];

  // Handle recalculate all scores
  const handleRecalculateAll = async () => {
    try {
      const result = await recalculateAllMutation.mutateAsync();
      toast.success('Scores Updated', {
        description: result.message,
      });
      refetchRankings();
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to recalculate scores. Please try again.',
      });
    }
  };

  // Column definitions for rankings table
  const columns: ColumnDef<SupplierRanking>[] = [
    {
      id: 'rank',
      header: '#',
      cell: ({ row }) => (
        <span className="font-medium text-neutral-500">
          {row.index + 1}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Supplier" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-neutral-900 flex items-center gap-2">
              {row.original.name}
              {row.original.is_preferred && (
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'overall_score',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Overall" />
      ),
      cell: ({ row }) => {
        const score = row.original.overall_score;
        const colorClass =
          score >= 90 ? 'text-purple-700' :
          score >= 80 ? 'text-emerald-700' :
          score >= 70 ? 'text-blue-700' :
          score >= 60 ? 'text-amber-700' :
          'text-red-700';
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 bg-neutral-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  score >= 90 ? 'bg-purple-500' :
                  score >= 80 ? 'bg-emerald-500' :
                  score >= 70 ? 'bg-blue-500' :
                  score >= 60 ? 'bg-amber-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className={`text-sm font-semibold ${colorClass}`}>
              {score.toFixed(0)}%
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'delivery_score',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Delivery" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-neutral-600">
          {row.original.delivery_score.toFixed(0)}%
        </span>
      ),
    },
    {
      accessorKey: 'quality_score',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Quality" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-neutral-600">
          {row.original.quality_score.toFixed(0)}%
        </span>
      ),
    },
    {
      accessorKey: 'cost_score',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Cost" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-neutral-600">
          {row.original.cost_score.toFixed(0)}%
        </span>
      ),
    },
    {
      accessorKey: 'performance_tier',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tier" />
      ),
      cell: ({ row }) => {
        const tier = row.original.performance_tier;
        const config = performanceTierConfig[tier as keyof typeof performanceTierConfig] || performanceTierConfig[''];
        return (
          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${config.bgColor} ${config.color}`}>
            {config.label}
          </span>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/suppliers/${row.original.id}`);
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  // Handle row click
  const handleRowClick = (row: Row<SupplierRanking>) => {
    navigate(`/suppliers/${row.original.id}`);
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/suppliers')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Supplier Performance Dashboard
            </h1>
            <p className="text-neutral-500 mt-1">
              Track and compare supplier performance metrics
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleRecalculateAll}
          disabled={recalculateAllMutation.isPending}
        >
          {recalculateAllMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Recalculate All
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Total Suppliers</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {rankingsLoading ? <Skeleton className="h-8 w-16" /> : totalSuppliers}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Average Score</p>
                <p className="text-2xl font-semibold text-neutral-900">
                  {rankingsLoading ? <Skeleton className="h-8 w-16" /> : `${avgScore}%`}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Strategic Partners</p>
                <p className="text-2xl font-semibold text-purple-600">
                  {rankingsLoading ? <Skeleton className="h-8 w-16" /> : strategicCount}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">At Risk</p>
                <p className="text-2xl font-semibold text-red-600">
                  {rankingsLoading ? <Skeleton className="h-8 w-16" /> : atRiskCount}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {tierLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
              </div>
            ) : tierDistribution && tierDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={tierDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="label"
                  >
                    {tierDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Suppliers']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-neutral-400">
                <CheckCircle className="h-12 w-12 mb-2" />
                <p>No tier data available</p>
                <p className="text-sm">Recalculate scores to populate tiers</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Supplier Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>
              Top Performer: {topSupplier?.name || 'N/A'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rankingsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
              </div>
            ) : topSupplier ? (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar
                    name={topSupplier.name}
                    dataKey="value"
                    stroke="#9333ea"
                    fill="#9333ea"
                    fillOpacity={0.5}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-neutral-400">
                <TrendingUp className="h-12 w-12 mb-2" />
                <p>No supplier data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Suppliers by Score</CardTitle>
        </CardHeader>
        <CardContent>
          {rankingsLoading ? (
            <div className="h-80 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            </div>
          ) : rankings && rankings.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={rankings.slice(0, 10).map(s => ({
                  name: s.name.length > 15 ? s.name.slice(0, 15) + '...' : s.name,
                  delivery: s.delivery_score,
                  quality: s.quality_score,
                  cost: s.cost_score,
                }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="delivery" name="Delivery" fill="#3b82f6" />
                <Bar dataKey="quality" name="Quality" fill="#10b981" />
                <Bar dataKey="cost" name="Cost" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex flex-col items-center justify-center text-neutral-400">
              <Building2 className="h-12 w-12 mb-2" />
              <p>No supplier data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="Search suppliers..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Data Table */}
          <DataTable
            columns={columns}
            data={filteredRankings}
            loading={rankingsLoading}
            showToolbar={false}
            showPagination={true}
            onRowClick={handleRowClick}
            getRowId={(row) => row.id}
            emptyState={{
              title: 'No rankings available',
              description: searchValue
                ? 'Try adjusting your search.'
                : 'Recalculate scores to populate rankings.',
            }}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}
