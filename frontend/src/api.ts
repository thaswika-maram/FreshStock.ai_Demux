import { Product, StockPlan, EvaluationReport, BusinessImpact, ScenarioSimulationRequest, UserProfile, ActivityEvent } from './types';

const API_BASE = '/api';

export const api = {
  // Products
  async getProducts(category?: string, search?: string, userId?: string): Promise<Product[]> {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (category && category !== 'All') params.append('category', category);
    if (search) params.append('search', search);
    
    try {
      const res = await fetch(`${API_BASE}/products?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      return await res.json();
    } catch (err) {
      console.warn('API getProducts failed:', err);
      return [];
    }
  },

  async getProductForecast(productId: string, userId?: string): Promise<StockPlan> {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    try {
      const res = await fetch(`${API_BASE}/forecast/${productId}${qs}`);
      if (!res.ok) throw new Error('Failed to fetch forecast');
      return await res.json();
    } catch (err) {
      console.warn(`API getProductForecast failed for ${productId}:`, err);
      return getMockStockPlan(productId);
    }
  },

  async createProduct(productData: Partial<Product>, userId?: string): Promise<{ product: Product; stock_plan: StockPlan }> {
    const res = await fetch(`${API_BASE}/products?user_id=${userId || 'usr_alex_01'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    if (!res.ok) throw new Error('Failed to create product');
    return await res.json();
  },

  async updateProduct(productId: string, updates: Partial<Product>, userId?: string): Promise<{ product: Product; stock_plan: StockPlan }> {
    const res = await fetch(`${API_BASE}/products/${productId}?user_id=${userId || 'usr_alex_01'}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update product');
    return await res.json();
  },

  async deleteProduct(productId: string, userId?: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/products/${productId}?user_id=${userId || 'usr_alex_01'}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete product');
    return await res.json();
  },

  async placeOrder(productId: string, quantity: number, userId?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/orders/place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, quantity, user_id: userId || 'usr_alex_01' })
    });
    if (!res.ok) throw new Error('Failed to place purchase order');
    return await res.json();
  },

  // Auth & Profile
  async login(email: string): Promise<{ token: string; user: UserProfile }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed');
    }
    return await res.json();
  },

  async register(userData: Partial<UserProfile>): Promise<{ token: string; user: UserProfile }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Registration failed');
    }
    return await res.json();
  },

  async getCurrentUser(userId?: string): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/auth/me?user_id=${userId || 'usr_alex_01'}`);
    if (!res.ok) {
      throw new Error('Failed to fetch user profile');
    }
    return await res.json();
  },

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const res = await fetch(`${API_BASE}/auth/profile?user_id=${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return await res.json();
  },

  async listUsers(): Promise<UserProfile[]> {
    const res = await fetch(`${API_BASE}/auth/users`);
    if (!res.ok) {
      throw new Error('Failed to list users');
    }
    return await res.json();
  },

  // Activity History
  async getHistory(userId?: string, actionType?: string): Promise<ActivityEvent[]> {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('user_id', userId);
      if (actionType && actionType !== 'ALL') params.append('action_type', actionType);
      
      const res = await fetch(`${API_BASE}/history?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch activity history');
      return await res.json();
    } catch (err) {
      return getMockHistory();
    }
  },

  async clearHistory(userId?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/history?user_id=${userId || 'usr_alex_01'}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  // Evaluation & ROI
  async getEvaluation(): Promise<EvaluationReport> {
    try {
      const res = await fetch(`${API_BASE}/evaluation`);
      if (!res.ok) throw new Error('Failed to fetch evaluation metrics');
      return await res.json();
    } catch (err) {
      return getMockEvaluation();
    }
  },

  async getBusinessImpact(userId?: string): Promise<BusinessImpact> {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    try {
      const res = await fetch(`${API_BASE}/business-impact${qs}`);
      if (!res.ok) throw new Error('Failed to fetch business impact');
      return await res.json();
    } catch (err) {
      return {
        weekly_total_savings: 0.0,
        annual_projected_savings: 0.0,
        weekly_spoilage_saved: 0.0,
        weekly_lost_sales_protected: 0.0,
        weekly_holding_cost_saved: 0.0,
        annual_ml_system_cost: 1800.0,
        net_annual_roi_dollars: 0.0,
        roi_multiple: 0.0,
        roi_percentage: 0.0,
        category_breakdown: {
          Food: { spoilage_saved: 0.0, lost_sales_saved: 0.0, holding_saved: 0.0 },
          Beverage: { spoilage_saved: 0.0, lost_sales_saved: 0.0, holding_saved: 0.0 }
        },
        summary_statement: "No products loaded in this workspace. Upload your sales CSV to calculate financial ROI and cost savings."
      };
    }
  },

  async simulateScenario(req: ScenarioSimulationRequest, userId?: string): Promise<StockPlan> {
    try {
      const res = await fetch(`${API_BASE}/simulate-scenario?user_id=${userId || 'usr_alex_01'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      if (!res.ok) throw new Error('Failed to simulate scenario');
      return await res.json();
    } catch (err) {
      return getMockSimulatedStockPlan(req);
    }
  },

  async uploadSalesCsv(file: File, userId?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload-sales?user_id=${userId || 'usr_alex_01'}`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Upload failed');
    }
    return await res.json();
  },

  async resetDataset(userId?: string): Promise<{ message: string; products_count: number }> {
    const res = await fetch(`${API_BASE}/reset-dataset?user_id=${userId || 'usr_alex_01'}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to reset dataset');
    return await res.json();
  },

  getExportPurchaseOrdersUrl(userId?: string): string {
    return `${API_BASE}/export/purchase-orders${userId ? `?user_id=${userId}` : ''}`;
  },

  getExportForecastsUrl(userId?: string): string {
    return `${API_BASE}/export/forecasts${userId ? `?user_id=${userId}` : ''}`;
  }
};

// Fallback Mock Helpers
function getMockUser(email: string = "alex.morgan@freshstock.ai"): UserProfile {
  return {
    user_id: "usr_alex_01",
    email: email,
    name: "Alex Morgan",
    store_name: "FreshMart Supermarket #04",
    role: "Store Inventory & Procurement Manager",
    phone: "+1 (555) 234-5678",
    location: "Austin, Texas, USA",
    timezone: "America/Chicago (CST)",
    currency: "USD ($)",
    avatar_url: "",
    created_at: "2025-11-15",
    theme_preference: "dark",
    service_level_default: 0.95,
    holding_cost_annual_pct: 22.0,
    stats: {
      reorders_placed: 18,
      csv_uploads: 4,
      skus_managed: 100
    }
  };
}

function getMockHistory(): ActivityEvent[] {
  return [
    {
      id: "ev_1",
      user_id: "usr_alex_01",
      timestamp: "Just now",
      action_type: "CSV_UPLOAD",
      title: "Uploaded Sales Dataset: egrocery_q1_sales.csv",
      description: "Ingested 16,000 sales records across 100 products. All 5-day forecasts and reorder schedules recalculated.",
      badge_color: "cyan",
      metadata: { total_rows: 16000, unique_products: 100 }
    },
    {
      id: "ev_2",
      user_id: "usr_alex_01",
      timestamp: "10 minutes ago",
      action_type: "PURCHASE_ORDER",
      title: "PO Confirmed: 120 units of Roma Tomatoes (1kg)",
      description: "Placed supplier purchase order for 120 units ($216.00 procurement cost).",
      badge_color: "amber",
      metadata: { quantity: 120, order_cost: 216 }
    },
    {
      id: "ev_3",
      user_id: "usr_alex_01",
      timestamp: "1 hour ago",
      action_type: "PRODUCT_UPDATE",
      title: "Updated SKU: Organic Whole Milk (1L)",
      description: "Stock adjusted: 180 -> 241 units. Service level maintained at 95%.",
      badge_color: "violet",
      metadata: { product_id: "PROD_002" }
    }
  ];
}

function getMockProducts(category?: string, search?: string): Product[] {
  const prods: Product[] = [
    {
      product_id: "PROD_001",
      name: "Roma Tomatoes (1kg)",
      category: "Food",
      subcategory: "Produce",
      base_demand: 145,
      shelf_life_days: 5,
      unit_price: 3.49,
      unit_cost: 1.80,
      margin: 1.69,
      margin_pct: 48.4,
      lead_time_days: 1,
      moq: 20,
      current_stock: 210,
      weekly_forecast: 1244,
      weekly_reorder_units: 1120,
      safety_stock: 55,
      spoilage_alert: false,
      headline_advice: "For Roma Tomatoes (1kg) on Monday, forecast 191 units. Confidence range 134–248. Recommend ordering 40 units."
    },
    {
      product_id: "PROD_002",
      name: "Organic Whole Milk (1L)",
      category: "Food",
      subcategory: "Dairy",
      base_demand: 210,
      shelf_life_days: 7,
      unit_price: 2.29,
      unit_cost: 1.20,
      margin: 1.09,
      margin_pct: 47.6,
      lead_time_days: 1,
      moq: 24,
      current_stock: 241,
      weekly_forecast: 1680,
      weekly_reorder_units: 1512,
      safety_stock: 70,
      spoilage_alert: false,
      headline_advice: "For Organic Whole Milk on Monday, forecast 248 units. Confidence range 180–310. Recommend ordering 120 units."
    }
  ];
  return prods.filter(p => {
    if (category && category !== 'All' && p.category !== category) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
}

function getMockStockPlan(productId: string): StockPlan {
  return {
    product_id: productId,
    product_name: "Roma Tomatoes (1kg)",
    category: "Food",
    shelf_life_days: 5,
    lead_time_days: 1,
    current_stock: 210,
    total_5d_forecast: 1244,
    total_recommended_order: 1120,
    safety_stock_units: 55,
    total_order_cost: 2016,
    projected_revenue: 3908,
    daily_plans: [
      { day_name: "Monday", day_index: 0, forecast_units: 191, ci_lower: 134, ci_upper: 248, confidence_range: "134 - 248", safety_stock_buffer: 55, beginning_stock: 210, recommended_order: 40, spoilage_risk: false, spoilage_units_at_risk: 0, stockout_risk: false, explanation: "For Roma Tomatoes on Monday, forecast 191 units." },
      { day_name: "Tuesday", day_index: 1, forecast_units: 175, ci_lower: 120, ci_upper: 230, confidence_range: "120 - 230", safety_stock_buffer: 55, beginning_stock: 59, recommended_order: 180, spoilage_risk: false, spoilage_units_at_risk: 0, stockout_risk: false, explanation: "For Roma Tomatoes on Tuesday, forecast 175 units." },
      { day_name: "Wednesday", day_index: 2, forecast_units: 168, ci_lower: 115, ci_upper: 220, confidence_range: "115 - 220", safety_stock_buffer: 55, beginning_stock: 64, recommended_order: 180, spoilage_risk: false, spoilage_units_at_risk: 0, stockout_risk: false, explanation: "For Roma Tomatoes on Wednesday, forecast 168 units." },
      { day_name: "Thursday", day_index: 3, forecast_units: 210, ci_lower: 150, ci_upper: 270, confidence_range: "150 - 270", safety_stock_buffer: 55, beginning_stock: 76, recommended_order: 200, spoilage_risk: false, spoilage_units_at_risk: 0, stockout_risk: false, explanation: "For Roma Tomatoes on Thursday, forecast 210 units." },
      { day_name: "Friday", day_index: 4, forecast_units: 320, ci_lower: 240, ci_upper: 400, confidence_range: "240 - 400", safety_stock_buffer: 55, beginning_stock: 66, recommended_order: 520, spoilage_risk: false, spoilage_units_at_risk: 0, stockout_risk: false, explanation: "For Roma Tomatoes on Friday, forecast 320 units." }
    ],
    headline_advice: "For Roma Tomatoes (1kg) on Monday, forecast 191 units. Confidence range 134–248. Recommend ordering 40 units.",
    baselines: {
      median_4w: [180, 160, 155, 185, 230],
      exp_smoothing: [175, 175, 175, 175, 175],
      last_week: [185, 165, 160, 190, 240],
      moving_avg_14: [170, 170, 170, 170, 170]
    },
    recent_history: {
      dates: Array.from({ length: 15 }, (_, i) => `Day -${15 - i}`),
      demand: [140, 130, 125, 150, 180, 145, 135, 130, 155, 190, 142, 132, 128, 152, 188]
    }
  };
}

function getMockSimulatedStockPlan(req: ScenarioSimulationRequest): StockPlan {
  return getMockStockPlan(req.product_id);
}

function getMockEvaluation(): EvaluationReport {
  return {
    overall: {
      lstm: { mae: 17.74, mape: 14.79, wape: 14.2, rmse: 23.1 },
      median_4w: { mae: 27.65, mape: 20.28, wape: 19.8, rmse: 35.2 },
      exp_smoothing: { mae: 36.24, mape: 29.32, wape: 28.5, rmse: 46.8 },
      last_week: { mae: 40.69, mape: 31.95, wape: 31.1, rmse: 51.4 },
      moving_avg: { mae: 42.10, mape: 33.10, wape: 32.4, rmse: 53.2 }
    },
    food: {
      lstm: { mae: 15.2, mape: 12.64, wape: 12.1, rmse: 20.4 },
      median_4w: { mae: 24.8, mape: 17.71, wape: 17.0, rmse: 32.1 },
      exp_smoothing: { mae: 33.5, mape: 26.80, wape: 25.9, rmse: 43.2 },
      last_week: { mae: 37.8, mape: 29.40, wape: 28.6, rmse: 48.0 },
      moving_avg: { mae: 39.2, mape: 30.50, wape: 29.8, rmse: 49.8 }
    },
    beverage: {
      lstm: { mae: 20.3, mape: 16.93, wape: 16.2, rmse: 25.8 },
      median_4w: { mae: 30.5, mape: 22.85, wape: 22.1, rmse: 38.3 },
      exp_smoothing: { mae: 39.0, mape: 31.84, wape: 31.0, rmse: 50.4 },
      last_week: { mae: 43.6, mape: 34.50, wape: 33.6, rmse: 54.8 },
      moving_avg: { mae: 45.0, mape: 35.70, wape: 35.0, rmse: 56.5 }
    },
    overall_mape_gain_pct: 27.1,
    product_metrics: [],
    hardest_products: [],
    num_test_samples: 2000
  };
}

function getMockBusinessImpact(): BusinessImpact {
  return {
    weekly_total_savings: 2749.00,
    annual_projected_savings: 142927.00,
    weekly_spoilage_saved: 1640.00,
    weekly_lost_sales_protected: 1420.00,
    weekly_holding_cost_saved: 420.00,
    annual_ml_system_cost: 1800.00,
    net_annual_roi_dollars: 141127.00,
    roi_multiple: 79.4,
    roi_percentage: 7840.0,
    category_breakdown: {
      Food: { spoilage_saved: 1420.00, lost_sales_saved: 890.00, holding_saved: 240.00 },
      Beverage: { spoilage_saved: 220.00, lost_sales_saved: 530.00, holding_saved: 180.00 }
    },
    summary_statement: "With the AI Demand Forecasting model vs. naive baseline, this e-grocery retailer saves approximately $2,749 per week ($142,927 / year), achieving a 7,840% ROI."
  };
}
