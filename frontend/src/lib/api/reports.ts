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
};

export default reportsApi;
