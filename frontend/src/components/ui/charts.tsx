import * as React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/lib/utils/format';

// Sahel color palette for charts
const CHART_COLORS = [
  '#8B4513', // SaddleBrown - Primary
  '#D4A84B', // Golden accent
  '#2d5a87', // Indigo Dye
  '#6b9ac4', // Light blue
  '#B8860B', // DarkGoldenRod
  '#1e3a5f', // Deep indigo
  '#a8a093', // Neutral
  '#e07b39', // Warning orange
];

// Common tooltip styles
const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e8e4df',
  borderRadius: '8px',
  boxShadow: '0 4px 6px rgba(74,44,23,0.08)',
  padding: '12px',
};

// Spend by Category Donut Chart
interface SpendByCategoryData {
  category: string;
  amount: number;
  percentage: number;
  color?: string;
}

interface SpendByCategoryChartProps {
  data: SpendByCategoryData[];
  loading?: boolean;
  title?: string;
  className?: string;
}

export function SpendByCategoryChart({
  data,
  loading = false,
  title = 'Spend by Category',
  className,
}: SpendByCategoryChartProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const chartData = data.map((item, index) => ({
    ...item,
    color: item.color || CHART_COLORS[index % CHART_COLORS.length],
  }));

  const total = chartData.reduce((sum, item) => sum + item.amount, 0);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: SpendByCategoryData }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={tooltipStyle}>
          <p className="font-medium text-neutral-900">{data.category}</p>
          <p className="text-sm text-neutral-600">{formatCurrency(data.amount)}</p>
          <p className="text-sm text-neutral-500">{data.percentage.toFixed(1)}% of total</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <Skeleton variant="circular" className="w-48 h-48" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="w-full lg:w-1/2 h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="amount"
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      opacity={activeIndex === null || activeIndex === index ? 1 : 0.6}
                      style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center -mt-36">
              <p className="text-sm text-neutral-500">Total</p>
              <p className="text-lg font-bold text-neutral-900">{formatCurrency(total)}</p>
            </div>
          </div>
          <div className="w-full lg:w-1/2">
            <div className="space-y-3">
              {chartData.map((item, index) => (
                <div
                  key={item.category}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-lg transition-colors',
                    activeIndex === index ? 'bg-neutral-100' : 'hover:bg-neutral-50'
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium text-neutral-700">{item.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-neutral-900">
                      {formatCurrency(item.amount)}
                    </span>
                    <span className="text-xs text-neutral-500 ml-2">
                      ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Spend Trend Line Chart
interface SpendTrendData {
  month: string;
  amount: number;
  budget?: number;
}

interface SpendTrendChartProps {
  data: SpendTrendData[];
  loading?: boolean;
  title?: string;
  showBudget?: boolean;
  className?: string;
}

export function SpendTrendChart({
  data,
  loading = false,
  title = 'Spend Trend',
  showBudget = true,
  className,
}: SpendTrendChartProps) {
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div style={tooltipStyle}>
          <p className="font-medium text-neutral-900 mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm text-neutral-600">
              {entry.dataKey === 'amount' ? 'Spend' : 'Budget'}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-64" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e4df" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#7c7468', fontSize: 12 }}
                tickLine={{ stroke: '#d4cfc7' }}
              />
              <YAxis
                tick={{ fill: '#7c7468', fontSize: 12 }}
                tickLine={{ stroke: '#d4cfc7' }}
                tickFormatter={(value) => `$${formatNumber(value / 1000)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Line
                type="monotone"
                dataKey="amount"
                name="Spend"
                stroke="#8B4513"
                strokeWidth={2}
                dot={{ fill: '#8B4513', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#8B4513' }}
              />
              {showBudget && data[0]?.budget !== undefined && (
                <Line
                  type="monotone"
                  dataKey="budget"
                  name="Budget"
                  stroke="#2d5a87"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Budget Utilization Bar Chart
interface BudgetUtilizationData {
  name: string;
  utilized: number;
  remaining: number;
  total: number;
}

interface BudgetUtilizationChartProps {
  data: BudgetUtilizationData[];
  loading?: boolean;
  title?: string;
  className?: string;
}

export function BudgetUtilizationChart({
  data,
  loading = false,
  title = 'Budget Utilization',
  className,
}: BudgetUtilizationChartProps) {
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum, p) => sum + p.value, 0);
      const utilization = ((payload[0]?.value || 0) / total * 100).toFixed(1);
      return (
        <div style={tooltipStyle}>
          <p className="font-medium text-neutral-900 mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'utilized' ? 'Utilized' : 'Remaining'}: {formatCurrency(entry.value)}
            </p>
          ))}
          <p className="text-sm text-neutral-600 mt-1 pt-1 border-t border-neutral-200">
            Utilization: {utilization}%
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-64" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e4df" horizontal={true} vertical={false} />
              <XAxis
                type="number"
                tick={{ fill: '#7c7468', fontSize: 12 }}
                tickLine={{ stroke: '#d4cfc7' }}
                tickFormatter={(value) => `$${formatNumber(value / 1000)}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#7c7468', fontSize: 12 }}
                tickLine={{ stroke: '#d4cfc7' }}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
              <Bar
                dataKey="utilized"
                name="Utilized"
                stackId="a"
                fill="#8B4513"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="remaining"
                name="Remaining"
                stackId="a"
                fill="#e8e4df"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Simple KPI Sparkline
interface SparklineData {
  value: number;
}

interface SparklineProps {
  data: SparklineData[];
  color?: string;
  height?: number;
  className?: string;
}

export function Sparkline({
  data,
  color = '#8B4513',
  height = 40,
  className,
}: SparklineProps) {
  return (
    <div className={cn('w-full', className)} style={{ height, minHeight: 20, minWidth: 50 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={20}>
        <LineChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export { CHART_COLORS };
