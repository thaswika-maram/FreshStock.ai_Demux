export interface Product {
  product_id: string;
  name: string;
  category: 'Food' | 'Beverage';
  subcategory: string;
  base_demand: number;
  shelf_life_days: number;
  unit_price: number;
  unit_cost: number;
  margin: number;
  margin_pct: number;
  lead_time_days: number;
  moq: number;
  current_stock: number;
  service_level?: number;
  weekly_forecast?: number;
  weekly_reorder_units?: number;
  safety_stock?: number;
  daily_avg_demand?: number;
  days_of_stock_remaining?: number;
  stock_alert_status?: 'OUT_OF_STOCK' | 'CRITICAL_LOW' | 'OVERSTOCK_DO_NOT_BUY' | 'HEALTHY';
  stockout_warning?: boolean;
  do_not_buy_warning?: boolean;
  smart_alert_message?: string;
  spoilage_alert?: boolean;
  headline_advice?: string;
}

export interface DailyPlan {
  day_name: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  day_index: number;
  forecast_units: number;
  ci_lower: number;
  ci_upper: number;
  confidence_range: string;
  safety_stock_buffer: number;
  beginning_stock: number;
  recommended_order: number;
  spoilage_risk: boolean;
  spoilage_units_at_risk: number;
  stockout_risk: boolean;
  explanation: string;
}

export interface StockPlan {
  product_id: string;
  product_name: string;
  category: 'Food' | 'Beverage';
  shelf_life_days: number;
  lead_time_days: number;
  current_stock: number;
  daily_avg_demand?: number;
  days_of_stock_remaining?: number;
  stock_alert_status?: 'OUT_OF_STOCK' | 'CRITICAL_LOW' | 'OVERSTOCK_DO_NOT_BUY' | 'HEALTHY';
  stockout_warning?: boolean;
  do_not_buy_warning?: boolean;
  smart_alert_message?: string;
  total_5d_forecast: number;
  total_recommended_order: number;
  safety_stock_units: number;
  total_order_cost: number;
  projected_revenue: number;
  daily_plans: DailyPlan[];
  headline_advice: string;
  baselines?: {
    median_4w: number[];
    exp_smoothing: number[];
    last_week: number[];
    moving_avg_14: number[];
  };
  recent_history?: {
    dates: string[];
    demand: number[];
  };
  features_active?: {
    is_promo: number;
    store_open_tomorrow: number;
    holiday_tomorrow: number;
    weather_temp: number;
  };
  baseline_comparison?: {
    original_total_forecast: number;
    simulated_total_forecast: number;
    delta_units: number;
    delta_pct: number;
  };
}

export interface MetricSummary {
  mae: number;
  mape: number;
  wape: number;
  rmse: number;
}

export interface HardestProduct {
  product_id: string;
  product_name: string;
  category: 'Food' | 'Beverage';
  mean_actual: number;
  lstm_mae: number;
  lstm_mape: number;
  median_mape: number;
  mape_improvement_pct: number;
  demand_cv: number;
  difficulty: 'Easy' | 'Moderate' | 'Hard';
  difficulty_reason: string;
}

export interface EvaluationReport {
  overall: Record<'lstm' | 'median_4w' | 'exp_smoothing' | 'last_week' | 'moving_avg', MetricSummary>;
  food: Record<'lstm' | 'median_4w' | 'exp_smoothing' | 'last_week' | 'moving_avg', MetricSummary>;
  beverage: Record<'lstm' | 'median_4w' | 'exp_smoothing' | 'last_week' | 'moving_avg', MetricSummary>;
  overall_mape_gain_pct: number;
  product_metrics: HardestProduct[];
  hardest_products: HardestProduct[];
  num_test_samples: number;
}

export interface BusinessImpact {
  weekly_total_savings: number;
  annual_projected_savings: number;
  weekly_spoilage_saved: number;
  weekly_lost_sales_protected: number;
  weekly_holding_cost_saved: number;
  annual_ml_system_cost: number;
  net_annual_roi_dollars: number;
  roi_multiple: number;
  roi_percentage: number;
  category_breakdown: {
    Food: { spoilage_saved: number; lost_sales_saved: number; holding_saved: number };
    Beverage: { spoilage_saved: number; lost_sales_saved: number; holding_saved: number };
  };
  summary_statement: string;
}

export interface ScenarioSimulationRequest {
  product_id: string;
  promo_discount_pct: number;
  is_store_closed_friday: boolean;
  holiday_on_wednesday: boolean;
  price_change_pct: number;
  weather_temp_celsius: number;
  weather_rain: boolean;
  safety_stock_service_level: number;
}

export interface UserProfile {
  user_id: string;
  email: string;
  name: string;
  store_name: string;
  role: string;
  phone?: string;
  location?: string;
  timezone?: string;
  currency?: string;
  avatar_url?: string;
  created_at: string;
  theme_preference?: string;
  service_level_default?: number;
  holding_cost_annual_pct?: number;
  stats?: {
    reorders_placed: number;
    csv_uploads: number;
    skus_managed: number;
  };
}

export interface ActivityEvent {
  id: string;
  user_id: string;
  timestamp: string;
  action_type: 'CSV_UPLOAD' | 'PRODUCT_CREATE' | 'PRODUCT_UPDATE' | 'PRODUCT_DELETE' | 'PURCHASE_ORDER' | 'SCENARIO_SIMULATION' | 'DATASET_INIT' | 'DATASET_RESET';
  title: string;
  description: string;
  badge_color: string;
  metadata?: Record<string, any>;
}
