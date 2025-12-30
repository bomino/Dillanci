import apiClient from './client';

// Types for report data
export interface SpendTrendData {
  month: string;
  amount: number;
  budget: number | null;
}

export interface SpendByCategoryData {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface KPIData {
  total_spend_ytd: number;
  spend_change_percent: number;
  active_pos: number;
  pending_delivery: number;
  active_suppliers: number;
  new_suppliers_month: number;
}

export interface POStatusData {
  [key: string]: string | number;
  name: string;
  value: number;
  color: string;
}

export interface SupplierPerformanceData {
  name: string;
  onTime: number;
  quality: number;
  cost: number;
}

export interface InvoiceAgingData {
  range: string;
  count: number;
  amount: number;
}

export interface RequisitionMetrics {
  total_requisitions: number;
  avg_processing_time: string;
  approval_rate: number;
  conversion_rate: number;
}

export interface ContractMetrics {
  active_contracts: number;
  total_contract_value: number;
  expiring_30_days: number;
  renewal_rate: number;
}

export interface ReceivingMetrics {
  receipts_this_month: number;
  on_time_delivery: number;
  quality_issues: number;
  avg_lead_time: string;
}

export interface SupplierScorecard {
  supplier_id: string;
  supplier_name: string;
  overall_score: number;
  on_time_delivery: number;
  invoice_accuracy: number;
  fulfillment_rate: number;
  total_pos: number;
  total_spend: number;
  total_invoices: number;
  total_receipts: number;
  performance_tier?: string;
  scores_calculated_at?: string;
}

export interface SupplierRanking {
  id: string;
  name: string;
  overall_score: number;
  delivery_score: number;
  quality_score: number;
  cost_score: number;
  performance_tier: string;
  is_preferred: boolean;
}

export interface TierDistribution {
  tier: string;
  label: string;
  count: number;
  color: string;
}

/**
 * Reports API endpoints
 */
export const reportsApi = {
  /**
   * Get spend trend data
   */
  getSpendTrend: async (months: number = 12): Promise<SpendTrendData[]> => {
    const response = await apiClient.get<SpendTrendData[]>('/reports/spend/trend/', {
      params: { months },
    });
    return response.data;
  },

  /**
   * Get spend by category
   */
  getSpendByCategory: async (): Promise<SpendByCategoryData[]> => {
    const response = await apiClient.get<SpendByCategoryData[]>('/reports/spend/by-category/');
    return response.data;
  },

  /**
   * Get KPI metrics
   */
  getKPIs: async (): Promise<KPIData> => {
    const response = await apiClient.get<KPIData>('/reports/analytics/kpis/');
    return response.data;
  },

  /**
   * Get PO status distribution
   */
  getPOStatus: async (): Promise<POStatusData[]> => {
    const response = await apiClient.get<POStatusData[]>('/reports/analytics/po-status/');
    return response.data;
  },

  /**
   * Get supplier performance data
   */
  getSupplierPerformance: async (): Promise<SupplierPerformanceData[]> => {
    const response = await apiClient.get<SupplierPerformanceData[]>('/reports/analytics/supplier-performance/');
    return response.data;
  },

  /**
   * Get invoice aging report
   */
  getInvoiceAging: async (): Promise<InvoiceAgingData[]> => {
    const response = await apiClient.get<InvoiceAgingData[]>('/reports/analytics/invoice-aging/');
    return response.data;
  },

  /**
   * Get requisition metrics
   */
  getRequisitionMetrics: async (): Promise<RequisitionMetrics> => {
    const response = await apiClient.get<RequisitionMetrics>('/reports/analytics/requisition-metrics/');
    return response.data;
  },

  /**
   * Get contract metrics
   */
  getContractMetrics: async (): Promise<ContractMetrics> => {
    const response = await apiClient.get<ContractMetrics>('/reports/analytics/contract-metrics/');
    return response.data;
  },

  /**
   * Get receiving metrics
   */
  getReceivingMetrics: async (): Promise<ReceivingMetrics> => {
    const response = await apiClient.get<ReceivingMetrics>('/reports/analytics/receiving-metrics/');
    return response.data;
  },

  /**
   * Get detailed scorecard for a single supplier
   */
  getSupplierScorecard: async (supplierId: string): Promise<SupplierScorecard> => {
    const response = await apiClient.get<SupplierScorecard>(`/reports/analytics/supplier-scorecard/${supplierId}/`);
    return response.data;
  },

  /**
   * Get ranked list of all suppliers by performance score
   */
  getSupplierRankings: async (limit: number = 20): Promise<SupplierRanking[]> => {
    const response = await apiClient.get<SupplierRanking[]>('/reports/analytics/supplier-rankings/', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get distribution of suppliers across performance tiers
   */
  getSupplierTierDistribution: async (): Promise<TierDistribution[]> => {
    const response = await apiClient.get<TierDistribution[]>('/reports/analytics/supplier-tier-distribution/');
    return response.data;
  },
};

export default reportsApi;
