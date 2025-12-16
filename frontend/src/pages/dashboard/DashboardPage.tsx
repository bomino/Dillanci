import {
  DollarSign,
  FileText,
  ShoppingCart,
  Clock,
  PieChart,
  TrendingUp,
} from 'lucide-react';
import {
  AnimatedMetricCard,
  MetricCardGrid,
  SpendByCategoryChart,
  SpendTrendChart,
} from '@/components/ui';
import { PendingActionsWidget, ActivityFeed } from '@/components/dashboard';
import {
  useDashboardKPIs,
  useSpendByCategory,
  useSpendTrend,
  usePendingActions,
  useRecentActivity,
} from '@/lib/api/dashboard';

// Map KPI types to icons
const kpiIcons: Record<string, React.ReactNode> = {
  TOTAL_SPEND_YTD: <DollarSign className="h-5 w-5" />,
  TOTAL_SPEND_MTD: <DollarSign className="h-5 w-5" />,
  OPEN_RFX_COUNT: <FileText className="h-5 w-5" />,
  PENDING_APPROVALS: <ShoppingCart className="h-5 w-5" />,
  AVG_PO_CYCLE_TIME: <Clock className="h-5 w-5" />,
  BUDGET_UTILIZATION: <PieChart className="h-5 w-5" />,
  SUPPLIER_PERFORMANCE_AVG: <TrendingUp className="h-5 w-5" />,
};

// Map KPI types to format types
const kpiFormats: Record<string, 'currency' | 'number' | 'percentage' | 'days'> = {
  TOTAL_SPEND_YTD: 'currency',
  TOTAL_SPEND_MTD: 'currency',
  OPEN_RFX_COUNT: 'number',
  PENDING_APPROVALS: 'number',
  AVG_PO_CYCLE_TIME: 'days',
  BUDGET_UTILIZATION: 'percentage',
  SUPPLIER_PERFORMANCE_AVG: 'percentage',
  EXPIRING_CONTRACTS_90D: 'number',
  INVOICE_MATCH_RATE: 'percentage',
  ON_TIME_DELIVERY_RATE: 'percentage',
};

// Determine trend direction from change percentage
function getTrend(changePercent: string | null): 'up' | 'down' | 'neutral' {
  if (!changePercent) return 'neutral';
  const value = parseFloat(changePercent);
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'neutral';
}

// Get the main value from a KPI
function getKpiValue(kpi: { numeric_value: string | null; percentage_value: string | null; count_value: number | null }): number {
  if (kpi.count_value !== null) return kpi.count_value;
  if (kpi.percentage_value !== null) return parseFloat(kpi.percentage_value);
  if (kpi.numeric_value !== null) return parseFloat(kpi.numeric_value);
  return 0;
}

export function DashboardPage() {
  // Fetch data using React Query hooks
  const { data: kpis = [], isLoading: kpisLoading } = useDashboardKPIs();
  const { data: spendByCategory = [], isLoading: categoryLoading } = useSpendByCategory();
  const { data: spendTrend = [], isLoading: trendLoading } = useSpendTrend(12);
  const { data: pendingActions = [], isLoading: actionsLoading } = usePendingActions();
  const { data: recentActivity = [], isLoading: activityLoading } = useRecentActivity(5);

  // Filter to top 4 KPIs for the header row
  const topKpis = kpis.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-neutral-500 mt-1">
          Welcome back! Here's an overview of your procurement activities.
        </p>
      </div>

      {/* KPI cards */}
      <MetricCardGrid columns={4}>
        {topKpis.map((kpi, index) => (
          <AnimatedMetricCard
            key={kpi.kpi_type}
            title={kpi.label}
            value={getKpiValue(kpi)}
            format={kpiFormats[kpi.kpi_type] || 'number'}
            icon={kpiIcons[kpi.kpi_type] || <FileText className="h-5 w-5" />}
            trend={getTrend(kpi.change_percent)}
            change={kpi.change_percent ? Math.abs(parseFloat(kpi.change_percent)) : undefined}
            changeLabel="vs last period"
            loading={kpisLoading}
            delay={index * 0.1}
          />
        ))}
      </MetricCardGrid>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendByCategoryChart
          data={spendByCategory}
          loading={categoryLoading}
          title="Spend by Category"
        />
        <SpendTrendChart
          data={spendTrend}
          loading={trendLoading}
          title="Monthly Spend Trend"
          showBudget={true}
        />
      </div>

      {/* Actions and Activity row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PendingActionsWidget
          actions={pendingActions}
          loading={actionsLoading}
          onActionClick={(action) => {
            // Navigate to the relevant page based on action type
            console.log('Action clicked:', action);
          }}
        />
        <ActivityFeed
          activities={recentActivity}
          loading={activityLoading}
          onActivityClick={(activity) => {
            console.log('Activity clicked:', activity);
          }}
        />
      </div>
    </div>
  );
}

export default DashboardPage;
