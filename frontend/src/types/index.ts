export interface HealthStatus {
  status: "healthy" | "degraded" | "sleeping" | "offline";
  project_name: string;
  version: string;
  environment: string;
  timestamp: string;
  uptime_seconds: number;
}

export interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  price_npr: number;
  reorder_level: number;
}

export type ConnectionState = "checking" | "waking_up" | "connected" | "failed";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  business_name?: string;
  role: string;
  business_id: string;
  phone?: string;
  is_active: boolean;
  is_business_owner: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in_seconds: number;
  user: UserProfile;
}

export interface ETLRowError {
  row_number: number;
  invoice_number?: string;
  reason: string;
}

export interface ETLWarning {
  row_number: number;
  invoice_number?: string;
  message: string;
}

export interface ETLUploadSummary {
  status: string;
  business_id: string;
  file_name: string;
  total_rows_processed: number;
  valid_rows_count: number;
  invalid_rows_count: number;
  invoices_created: number;
  items_recorded: number;
  products_auto_created: number;
  total_revenue_npr: number;
  errors?: ETLRowError[];
  warnings?: ETLWarning[];
  category_breakdown?: Record<string, number>;
  top_products?: Array<{
    name: string;
    sku: string;
    category: string;
    unitsSold: number;
    revenue: number;
    stockLeft?: number;
  }>;
  monthly_trend?: Array<{
    month: string;
    monthNepali?: string;
    revenue: number;
    profit: number;
    orders: number;
  }>;
  payment_breakdown?: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
    nepaliLabel: string;
  }>;
}
