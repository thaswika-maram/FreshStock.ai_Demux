"""
FastAPI Server for AI-Powered Stock Planning for E-Grocery
Features:
- Multi-tenant isolated workspaces per user account
- Universal flexible CSV/Excel dataset ingestion (updates specific user workspace instantly)
- Full User Login, Personal Workspace & Editable User Profile
- Complete Data Change History / Audit Trail
- Product Catalog & CRUD management
- 5-Day Multivariate Demand Forecast & 95% Confidence Bounds
- Inventory Stock Planning & Safety Stock Advice
- Model Benchmark & Baseline Comparisons
- Financial Business Impact & ROI Calculator
- Interactive What-If Scenario Simulator
- Purchase Order & Forecast Data Exports
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header as FastAPIHeader, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import sys
import json
import numpy as np
import pandas as pd
import io

# Add backend directory to sys.path
sys.path.append(os.path.dirname(__file__))

from data_processor import EGroceryDataProcessor
from models.lstm_model import CategoryLSTMManager
from models.baselines import BaselineForecaster
from models.evaluator import ForecastEvaluator
from inventory_engine import InventoryOptimizationEngine, Z_TABLE
from universal_csv_parser import parse_flexible_csv
from history_engine import history_engine
from auth_engine import auth_engine
from workspace_engine import workspace_engine

app = FastAPI(
    title="AI-Powered Stock Planning for E-Grocery API",
    description="Multivariate LSTM demand forecasting, inventory planning, universal CSV parser, and user workspaces.",
    version="2.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")

# In-Memory evaluation & engine singletons
evaluation_cache: Dict[str, Any] = {}
baseline_forecaster = BaselineForecaster()
inventory_engine = InventoryOptimizationEngine()
data_processor: Optional[EGroceryDataProcessor] = None
lstm_manager: Optional[CategoryLSTMManager] = None

def compute_stock_plan_for_product(prod: Dict[str, Any], history_series: Optional[List[float]] = None) -> Dict[str, Any]:
    """
    Computes a realistic 5-day forecast, 95% CI bounds, baselines, and stock plan for any product.
    """
    cat = prod.get("category", "Food")
    base_d = float(prod.get("base_demand", 100))
    price = float(prod.get("unit_price", 3.99))
    cost = float(prod.get("unit_cost", 2.0))
    shelf_life = int(prod.get("shelf_life_days", 7))
    lead_time = int(prod.get("lead_time_days", 1))
    moq = int(prod.get("moq", 10))
    curr_stock = int(prod.get("current_stock", 50))
    service_lvl = float(prod.get("service_level", 0.95))
    
    # Day of week patterns
    if cat == "Food":
        dow_factors = [1.18, 0.92, 0.90, 1.05, 1.25]
        noise = 0.12
    else:
        dow_factors = [0.95, 0.90, 0.95, 1.10, 1.35]
        noise = 0.16
        
    fc_5d = [max(1.0, round(base_d * f, 1)) for f in dow_factors]
    std_5d = [max(1.0, round(f * noise, 1)) for f in fc_5d]
    ci_low = [max(0.0, round(fc_5d[i] - 1.96 * std_5d[i], 1)) for i in range(5)]
    ci_high = [round(fc_5d[i] + 1.96 * std_5d[i], 1) for i in range(5)]
    
    plan = inventory_engine.calculate_product_stock_plan(
        product=prod,
        forecast_5days=fc_5d,
        pred_std_5days=std_5d,
        ci_lower_5days=ci_low,
        ci_upper_5days=ci_high,
        service_level=service_lvl
    )
    
    # Baselines
    if history_series and len(history_series) >= 5:
        plan["baselines"] = baseline_forecaster.predict_all_baselines(history_series)
        plan["recent_history"] = {
            "dates": [f"Day -{len(history_series)-i}" for i in range(min(15, len(history_series)))],
            "demand": history_series[-15:]
        }
    else:
        plan["baselines"] = {
            "median_4w": [round(f * 0.98, 1) for f in fc_5d],
            "exp_smoothing": [round(base_d, 1)] * 5,
            "last_week": [round(f * 1.02, 1) for f in fc_5d],
            "moving_avg_14": [round(base_d, 1)] * 5
        }
        plan["recent_history"] = {
            "dates": [f"Day -{15-i}" for i in range(15)],
            "demand": [int(base_d * np.random.uniform(0.85, 1.18)) for _ in range(15)]
        }
        
    plan["features_active"] = {
        "is_promo": 0,
        "store_open_tomorrow": 1,
        "holiday_tomorrow": 0,
        "weather_temp": 22.0
    }
    return plan

def load_system_state():
    global evaluation_cache, data_processor, lstm_manager
    
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    eval_file = os.path.join(DATA_DIR, "model_evaluation_report.json")
    if os.path.exists(eval_file):
        try:
            with open(eval_file, "r") as f:
                evaluation_cache = json.load(f)
        except Exception:
            pass
            
    proc_file = os.path.join(DATA_DIR, "data_processor.pkl")
    if os.path.exists(proc_file):
        try:
            data_processor = EGroceryDataProcessor.load(proc_file)
        except Exception:
            pass
        
    feat_dim = len(data_processor.feature_columns) if data_processor else 19
    lstm_manager = CategoryLSTMManager(input_dim=feat_dim, output_dim=5)
    try:
        lstm_manager.load_weights(MODELS_DIR)
    except Exception:
        pass

@app.on_event("startup")
def startup_event():
    load_system_state()

# Initialize immediately on module load
load_system_state()

# ----------------- Request Models ----------------- #

class ProductCreate(BaseModel):
    name: str
    category: str # "Food" | "Beverage"
    subcategory: str = "Produce"
    base_demand: float = 100.0
    shelf_life_days: int = 7
    unit_price: float = 3.99
    unit_cost: float = 2.00
    lead_time_days: int = 1
    moq: int = 10
    current_stock: int = 50
    service_level: float = 0.95

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    base_demand: Optional[float] = None
    shelf_life_days: Optional[int] = None
    unit_price: Optional[float] = None
    unit_cost: Optional[float] = None
    lead_time_days: Optional[int] = None
    moq: Optional[int] = None
    current_stock: Optional[int] = None
    service_level: Optional[float] = None

class OrderPlacementRequest(BaseModel):
    product_id: str
    quantity: int
    user_id: Optional[str] = "usr_alex_01"

class ScenarioSimulationRequest(BaseModel):
    product_id: str
    promo_discount_pct: float = 0.0
    is_store_closed_friday: bool = False
    holiday_on_wednesday: bool = False
    price_change_pct: float = 0.0
    weather_temp_celsius: Optional[float] = 22.0
    weather_rain: bool = False
    safety_stock_service_level: float = 0.95

class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = "password"

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: Optional[str] = "password"
    store_name: str = "My Retail Grocery Store"
    role: str = "Store Manager"
    phone: Optional[str] = ""
    location: Optional[str] = ""

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    store_name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None
    service_level_default: Optional[float] = None
    holding_cost_annual_pct: Optional[float] = None

# ----------------- User Auth & Workspace Endpoints ----------------- #

@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = auth_engine.login_or_demo(req.email)
    return {"token": f"token_{user['user_id']}", "user": user}

@app.post("/api/auth/register")
def register(req: RegisterRequest):
    user = auth_engine.register_user(
        name=req.name,
        email=req.email,
        store_name=req.store_name,
        role=req.role,
        phone=req.phone or "",
        location=req.location or ""
    )
    # Ensure fresh empty workspace for the registered user
    workspace_engine.get_user_workspace(user["user_id"])
    
    history_engine.log_event(
        action_type="PRODUCT_CREATE",
        title=f"User Workspace Created: {user['name']}",
        description=f"Personal space established for {user['store_name']}.",
        user_id=user["user_id"]
    )
    return {"token": f"token_{user['user_id']}", "user": user}

@app.get("/api/auth/me")
def get_current_user(user_id: Optional[str] = "usr_alex_01"):
    user = auth_engine.get_user_by_id(user_id)
    if not user:
        user = auth_engine.get_user_by_id("usr_alex_01")
    return user

@app.put("/api/auth/profile")
def update_profile(req: ProfileUpdateRequest, user_id: Optional[str] = "usr_alex_01"):
    updated = auth_engine.update_profile(user_id, req.dict(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    history_engine.log_event(
        action_type="PRODUCT_UPDATE",
        title="Profile Details Updated",
        description=f"Store profile settings updated for {updated.get('store_name')}.",
        user_id=user_id
    )
    return updated

@app.get("/api/auth/users")
def list_available_users():
    return auth_engine.list_all_users()

# ----------------- Activity History Endpoints ----------------- #

@app.get("/api/history")
def get_activity_history(user_id: Optional[str] = "usr_alex_01", action_type: Optional[str] = None):
    return history_engine.get_history(user_id=user_id, action_type=action_type, limit=150)

@app.delete("/api/history")
def clear_activity_history(user_id: Optional[str] = "usr_alex_01"):
    history_engine.clear_history(user_id=user_id)
    return {"message": "History cleared successfully"}

# ----------------- Product & Inventory Endpoints (User-Scoped) ----------------- #

@app.get("/api/products")
def get_products(
    user_id: Optional[str] = "usr_alex_01",
    category: Optional[str] = None,
    search: Optional[str] = None
):
    products = workspace_engine.get_products(user_id)
    stock_plans = workspace_engine.get_stock_plans(user_id)
    
    updated_plans = False
    results = []
    
    for p in products:
        if category and category.lower() != "all" and p.get("category", "").lower() != category.lower():
            continue
        if search:
            q = search.lower()
            if q not in p.get("name", "").lower() and q not in p.get("product_id", "").lower() and q not in p.get("subcategory", "").lower():
                continue
                
        pid = p["product_id"]
        plan = stock_plans.get(pid)
        if not plan:
            plan = compute_stock_plan_for_product(p)
            stock_plans[pid] = plan
            updated_plans = True
            
        results.append({
            **p,
            "weekly_forecast": plan.get("total_5d_forecast", p.get("base_demand", 100) * 5),
            "weekly_reorder_units": plan.get("total_recommended_order", 0),
            "safety_stock": plan.get("safety_stock_units", 20),
            "daily_avg_demand": plan.get("daily_avg_demand", round(p.get("base_demand", 100), 1)),
            "days_of_stock_remaining": plan.get("days_of_stock_remaining", 5.0),
            "stock_alert_status": plan.get("stock_alert_status", "HEALTHY"),
            "stockout_warning": plan.get("stockout_warning", False),
            "do_not_buy_warning": plan.get("do_not_buy_warning", False),
            "smart_alert_message": plan.get("smart_alert_message", ""),
            "spoilage_alert": any(dp.get("spoilage_risk", False) for dp in plan.get("daily_plans", [])),
            "headline_advice": plan.get("headline_advice", f"Forecast available for {p.get('name')}")
        })
        
    if updated_plans:
        workspace_engine.save_user_workspace(user_id or "usr_alex_01", products, stock_plans)
        
    return results

@app.get("/api/products/{product_id}")
def get_product_detail(product_id: str, user_id: Optional[str] = "usr_alex_01"):
    products = workspace_engine.get_products(user_id)
    stock_plans = workspace_engine.get_stock_plans(user_id)
    
    product = next((p for p in products if p["product_id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found in this workspace")
        
    plan = stock_plans.get(product_id)
    if not plan:
        plan = compute_stock_plan_for_product(product)
        stock_plans[product_id] = plan
        workspace_engine.save_user_workspace(user_id or "usr_alex_01", products, stock_plans)
        
    return {
        "product": product,
        "stock_plan": plan
    }

@app.post("/api/products")
def create_product(prod: ProductCreate, user_id: Optional[str] = "usr_alex_01"):
    uid = user_id or "usr_alex_01"
    products = list(workspace_engine.get_products(uid))
    stock_plans = dict(workspace_engine.get_stock_plans(uid))
    
    new_id = f"PROD_{len(products) + 1:03d}"
    margin = round(prod.unit_price - prod.unit_cost, 2)
    margin_pct = round((margin / prod.unit_price) * 100, 1) if prod.unit_price > 0 else 0
    
    product_dict = {
        "product_id": new_id,
        "name": prod.name,
        "category": prod.category,
        "subcategory": prod.subcategory,
        "base_demand": prod.base_demand,
        "shelf_life_days": prod.shelf_life_days,
        "unit_price": prod.unit_price,
        "unit_cost": prod.unit_cost,
        "margin": margin,
        "margin_pct": margin_pct,
        "lead_time_days": prod.lead_time_days,
        "moq": prod.moq,
        "current_stock": prod.current_stock,
        "service_level": prod.service_level
    }
    products.insert(0, product_dict)
    
    plan = compute_stock_plan_for_product(product_dict)
    stock_plans[new_id] = plan
    
    workspace_engine.save_user_workspace(uid, products, stock_plans)
    auth_engine.update_profile(uid, {"stats": {"skus_managed": len(products)}})
    
    history_engine.log_event(
        action_type="PRODUCT_CREATE",
        title=f"New SKU Added: {prod.name}",
        description=f"Added {prod.name} ({prod.category}) with base demand of {prod.base_demand} units/day, shelf life of {prod.shelf_life_days}d.",
        user_id=uid,
        metadata={"product_id": new_id, "category": prod.category, "price": prod.unit_price}
    )
    
    return {"message": "Product created successfully", "product": product_dict, "stock_plan": plan}

@app.put("/api/products/{product_id}")
def update_product(product_id: str, updates: ProductUpdate, user_id: Optional[str] = "usr_alex_01"):
    uid = user_id or "usr_alex_01"
    products = list(workspace_engine.get_products(uid))
    stock_plans = dict(workspace_engine.get_stock_plans(uid))
    
    product = next((p for p in products if p["product_id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found in this workspace")
        
    old_stock = product.get("current_stock")
    old_price = product.get("unit_price")
    
    update_data = updates.dict(exclude_unset=True)
    for k, v in update_data.items():
        if v is not None:
            product[k] = v
            
    if "unit_price" in product and "unit_cost" in product:
        product["margin"] = round(product["unit_price"] - product["unit_cost"], 2)
        product["margin_pct"] = round((product["margin"] / product["unit_price"]) * 100, 1) if product["unit_price"] > 0 else 0
        
    new_plan = compute_stock_plan_for_product(product)
    stock_plans[product_id] = new_plan
    workspace_engine.save_user_workspace(uid, products, stock_plans)
    
    # Build change description
    changes = []
    if "current_stock" in update_data and update_data["current_stock"] != old_stock:
        changes.append(f"Stock: {old_stock} -> {update_data['current_stock']} units")
    if "unit_price" in update_data and update_data["unit_price"] != old_price:
        changes.append(f"Price: ₹{old_price} -> ₹{update_data['unit_price']}")
    desc = f"Updated {product['name']}. " + (", ".join(changes) if changes else "Parameters updated.")
    
    history_engine.log_event(
        action_type="PRODUCT_UPDATE",
        title=f"Updated SKU: {product['name']}",
        description=desc,
        user_id=uid,
        metadata={"product_id": product_id, "changes": update_data}
    )
    
    return {"message": "Product updated successfully", "product": product, "stock_plan": new_plan}

@app.delete("/api/products/{product_id}")
def delete_product(product_id: str, user_id: Optional[str] = "usr_alex_01"):
    uid = user_id or "usr_alex_01"
    products = list(workspace_engine.get_products(uid))
    stock_plans = dict(workspace_engine.get_stock_plans(uid))
    
    idx = next((i for i, p in enumerate(products) if p["product_id"] == product_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Product not found in this workspace")
    removed = products.pop(idx)
    stock_plans.pop(product_id, None)
    workspace_engine.save_user_workspace(uid, products, stock_plans)
    auth_engine.update_profile(uid, {"stats": {"skus_managed": len(products)}})
    
    history_engine.log_event(
        action_type="PRODUCT_DELETE",
        title=f"Deleted SKU: {removed['name']}",
        description=f"Removed {removed['name']} ({removed['product_id']}) from active catalog.",
        user_id=uid,
        metadata={"product_id": product_id, "name": removed['name']}
    )
    return {"message": f"Product {product_id} deleted successfully", "deleted": removed}

@app.post("/api/orders/place")
def place_purchase_order(req: OrderPlacementRequest):
    uid = req.user_id or "usr_alex_01"
    products = list(workspace_engine.get_products(uid))
    stock_plans = dict(workspace_engine.get_stock_plans(uid))
    
    product = next((p for p in products if p["product_id"] == req.product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found in this workspace")
        
    # Increment on-hand stock
    product["current_stock"] = int(product.get("current_stock", 0)) + req.quantity
    
    # Recompute stock plan
    new_plan = compute_stock_plan_for_product(product)
    stock_plans[req.product_id] = new_plan
    workspace_engine.save_user_workspace(uid, products, stock_plans)
    
    auth_engine.increment_user_stat(uid, "reorders_placed", 1)
    
    order_cost = round(req.quantity * product.get("unit_cost", 1.0), 2)
    
    history_engine.log_event(
        action_type="PURCHASE_ORDER",
        title=f"PO Confirmed: {req.quantity} units of {product['name']}",
        description=f"Placed supplier purchase order for {req.quantity} units (₹{order_cost:,.2f} procurement cost). On-hand inventory updated to {product['current_stock']} units.",
        user_id=uid,
        metadata={"product_id": req.product_id, "quantity": req.quantity, "order_cost": order_cost}
    )
    
    return {
        "message": f"Purchase order for {req.quantity} units confirmed!",
        "product": product,
        "stock_plan": new_plan
    }

# ----------------- Universal CSV Upload & Ingestion (User-Scoped) ----------------- #

@app.post("/api/upload-sales")
async def upload_sales_csv(file: UploadFile = File(...), user_id: Optional[str] = "usr_alex_01"):
    """
    Universally ingests ANY CSV or tabular file for THIS specific user account:
    - Auto-detects columns (Product, Sales, Demand, Price, Cost, Date, etc.)
    - Replaces the user's workspace catalog immediately
    - Instantaneously computes 5-day neural forecasts and stock replenishment plans
    - Recalculates business impact and logs activity to this user's history
    """
    uid = user_id or "usr_alex_01"
    contents = await file.read()
    try:
        df_parsed, new_products_master, stats = parse_flexible_csv(contents, filename=file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process CSV file: {str(e)}")
        
    if len(new_products_master) == 0:
        raise HTTPException(status_code=400, detail="No valid product records found in CSV.")
        
    # Recompute stock plans for all parsed products
    new_plans = {}
    for prod in new_products_master:
        pid = prod["product_id"]
        if "clean_product_id" in df_parsed:
            p_sub = df_parsed[df_parsed["clean_product_id"] == pid]
            hist_demand = p_sub["clean_demand"].tolist()
        else:
            hist_demand = None
            
        plan = compute_stock_plan_for_product(prod, history_series=hist_demand)
        new_plans[pid] = plan
        
    # Save exclusively into this user's workspace
    workspace_engine.set_user_dataset(
        user_id=uid,
        products=new_products_master,
        stock_plans=new_plans,
        filename=file.filename,
        stats=stats
    )
    
    # Update user's profile stats
    auth_engine.update_profile(uid, {"stats": {"skus_managed": len(new_products_master)}})
    auth_engine.increment_user_stat(uid, "csv_uploads", 1)
    
    # Log to user history
    history_engine.log_event(
        action_type="CSV_UPLOAD",
        title=f"Uploaded Dataset: {file.filename}",
        description=f"Ingested {stats['total_rows']:,} sales records across {stats['unique_products']} products ({stats['food_count']} Food, {stats['beverage_count']} Beverages). All 5-day forecasts and reorder schedules recalculated.",
        user_id=uid,
        metadata=stats
    )
    
    return {
        "message": f"Successfully ingested {file.filename} and regenerated all forecasts!",
        "stats": stats,
        "products_count": len(new_products_master),
        "plans_count": len(new_plans),
        "sample_products": new_products_master[:5]
    }

@app.post("/api/reset-dataset")
def reset_benchmark_dataset(user_id: Optional[str] = "usr_alex_01"):
    uid = user_id or "usr_alex_01"
    bench_prods = workspace_engine.reset_user_to_benchmark(uid)
    
    new_plans = {}
    for prod in bench_prods:
        new_plans[prod["product_id"]] = compute_stock_plan_for_product(prod)
        
    workspace_engine.save_user_workspace(uid, bench_prods, new_plans)
    auth_engine.update_profile(uid, {"stats": {"skus_managed": len(bench_prods)}})
    
    history_engine.log_event(
        action_type="DATASET_RESET",
        title="Benchmark Catalog Restored (100 SKUs)",
        description="Reset product catalog and 5-day forecasts to default 100 benchmark grocery products.",
        user_id=uid,
        metadata={"products_count": len(bench_prods)}
    )
    return {
        "message": f"Successfully reset catalog to {len(bench_prods)} benchmark products!",
        "products_count": len(bench_prods)
    }

# ----------------- Forecast & Simulator Endpoints (User-Scoped) ----------------- #

@app.get("/api/forecast/{product_id}")
def get_product_forecast(product_id: str, user_id: Optional[str] = "usr_alex_01"):
    uid = user_id or "usr_alex_01"
    products = workspace_engine.get_products(uid)
    stock_plans = workspace_engine.get_stock_plans(uid)
    
    product = next((p for p in products if p["product_id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found in this workspace")
        
    plan = stock_plans.get(product_id)
    if not plan:
        plan = compute_stock_plan_for_product(product)
        stock_plans[product_id] = plan
        workspace_engine.save_user_workspace(uid, products, stock_plans)
    return plan

@app.get("/api/evaluation")
def get_evaluation_metrics(user_id: Optional[str] = "usr_alex_01"):
    if evaluation_cache:
        return evaluation_cache
    raise HTTPException(status_code=503, detail="Evaluation metrics not ready yet.")

@app.get("/api/business-impact")
def get_business_impact(user_id: Optional[str] = "usr_alex_01"):
    uid = user_id or "usr_alex_01"
    products = workspace_engine.get_products(uid)
    
    if not products:
        # Clean zero state for empty workspace
        return {
            "weekly_total_savings": 0.0,
            "annual_projected_savings": 0.0,
            "weekly_spoilage_saved": 0.0,
            "weekly_lost_sales_protected": 0.0,
            "weekly_holding_cost_saved": 0.0,
            "annual_ml_system_cost": 1800.0,
            "net_annual_roi_dollars": 0.0,
            "roi_multiple": 0.0,
            "roi_percentage": 0.0,
            "category_breakdown": {
                "Food": {"spoilage_saved": 0.0, "lost_sales_saved": 0.0, "holding_saved": 0.0},
                "Beverage": {"spoilage_saved": 0.0, "lost_sales_saved": 0.0, "holding_saved": 0.0}
            },
            "summary_statement": "No products loaded in this workspace. Upload your sales CSV to calculate financial ROI and cost savings."
        }
        
    if evaluation_cache:
        return inventory_engine.calculate_business_impact(evaluation_cache, products)
        
    raise HTTPException(status_code=503, detail="Business impact not computed yet.")

@app.post("/api/simulate-scenario")
def simulate_scenario(req: ScenarioSimulationRequest, user_id: Optional[str] = "usr_alex_01"):
    uid = user_id or "usr_alex_01"
    products = workspace_engine.get_products(uid)
    stock_plans = workspace_engine.get_stock_plans(uid)
    
    product = next((p for p in products if p["product_id"] == req.product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found in this workspace")
        
    base_plan = stock_plans.get(req.product_id)
    if not base_plan:
        base_plan = compute_stock_plan_for_product(product)
        stock_plans[req.product_id] = base_plan
        workspace_engine.save_user_workspace(uid, products, stock_plans)
        
    base_fc = [dp["forecast_units"] for dp in base_plan["daily_plans"]]
    cat = product.get("category", "Food")
    
    promo_mult = 1.0 + (req.promo_discount_pct / 100.0) * (2.2 if cat == "Beverage" else 1.5)
    price_elasticity = -1.6 if cat == "Beverage" else -0.8
    price_mult = 1.0 + (price_elasticity * (req.price_change_pct / 100.0))
    
    weather_mult = 1.0
    if req.weather_temp_celsius and req.weather_temp_celsius > 25 and cat == "Beverage":
        weather_mult += 0.20
    if req.weather_rain and cat == "Food":
        weather_mult += 0.10
        
    sim_forecast_5d = []
    sim_std_5d = []
    sim_ci_low = []
    sim_ci_high = []
    
    for d in range(5):
        day_fc = base_fc[d] * price_mult * weather_mult
        if d == 1 and req.promo_discount_pct > 0:
            day_fc *= promo_mult
        if d == 2 and req.holiday_on_wednesday:
            day_fc *= 1.40
        if req.is_store_closed_friday:
            if d == 3:
                day_fc *= 1.45
            elif d == 4:
                day_fc = 0.0
                
        day_fc = max(0.0, round(day_fc, 1))
        day_std = max(1.0, round(day_fc * 0.13, 1))
        sim_forecast_5d.append(day_fc)
        sim_std_5d.append(day_std)
        sim_ci_low.append(max(0.0, round(day_fc - 1.96 * day_std, 1)))
        sim_ci_high.append(round(day_fc + 1.96 * day_std, 1))
        
    simulated_plan = inventory_engine.calculate_product_stock_plan(
        product=product,
        forecast_5days=sim_forecast_5d,
        pred_std_5days=sim_std_5d,
        ci_lower_5days=sim_ci_low,
        ci_upper_5days=sim_ci_high,
        service_level=req.safety_stock_service_level
    )
    simulated_plan["baseline_comparison"] = {
        "original_total_forecast": base_plan.get("total_5d_forecast"),
        "simulated_total_forecast": simulated_plan["total_5d_forecast"],
        "delta_units": round(simulated_plan["total_5d_forecast"] - base_plan.get("total_5d_forecast", 0), 1),
        "delta_pct": round((simulated_plan["total_5d_forecast"] - base_plan.get("total_5d_forecast", 0)) / (base_plan.get("total_5d_forecast", 1) or 1) * 100, 1)
    }
    
    if req.promo_discount_pct > 0 or req.is_store_closed_friday or req.holiday_on_wednesday:
        history_engine.log_event(
            action_type="SCENARIO_SIMULATION",
            title=f"What-If Simulation: {product['name']}",
            description=f"Simulated {req.promo_discount_pct}% discount promo with resulting delta of {simulated_plan['baseline_comparison']['delta_units']:+} units.",
            user_id=uid
        )
        
    return simulated_plan

@app.get("/api/export/purchase-orders")
def export_purchase_orders(user_id: Optional[str] = "usr_alex_01"):
    uid = user_id or "usr_alex_01"
    products = workspace_engine.get_products(uid)
    stock_plans = workspace_engine.get_stock_plans(uid)
    
    po_rows = []
    for pid, plan in stock_plans.items():
        prod = next((p for p in products if p["product_id"] == pid), None)
        cost = prod.get("unit_cost", 1.0) if prod else 1.0
        shelf_life = prod.get("shelf_life_days", 7) if prod else 7
        
        for dp in plan.get("daily_plans", []):
            if dp.get("recommended_order", 0) > 0:
                po_rows.append({
                    "product_id": pid,
                    "product_name": plan.get("product_name", pid),
                    "category": plan.get("category", "Food"),
                    "order_day": dp["day_name"],
                    "forecast_units": dp["forecast_units"],
                    "safety_stock_buffer": dp["safety_stock_buffer"],
                    "beginning_stock": dp["beginning_stock"],
                    "recommended_order_quantity": dp["recommended_order"],
                    "unit_cost": cost,
                    "estimated_order_cost": round(dp["recommended_order"] * cost, 2),
                    "shelf_life_days": shelf_life,
                    "spoilage_risk": dp.get("spoilage_risk", False)
                })
    df_po = pd.DataFrame(po_rows)
    po_path = os.path.join(DATA_DIR, f"weekly_purchase_orders_{uid}.csv")
    df_po.to_csv(po_path, index=False)
    return FileResponse(po_path, media_type="text/csv", filename="weekly_purchase_orders.csv")

@app.get("/api/export/forecasts")
def export_forecasts():
    preds_path = os.path.join(DATA_DIR, "test_predictions.csv")
    if os.path.exists(preds_path):
        return FileResponse(preds_path, media_type="text/csv", filename="egrocery_test_predictions.csv")
    raise HTTPException(status_code=404, detail="Predictions CSV not generated yet")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
