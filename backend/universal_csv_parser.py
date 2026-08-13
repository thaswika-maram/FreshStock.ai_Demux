"""
Universal CSV and Data Ingestion Parser
Intelligently ingests ANY CSV or tabular sales format by:
- Fuzzy matching & auto-detecting column names (Product, Item, SKU, Sales, Quantity, Demand, Date, Price, Cost, Category, etc.)
- Auto-generating missing IDs or metadata (inferring Food vs. Beverage category from product names)
- Auto-estimating reasonable unit prices, costs, shelf life, lead times, and MOQs if not provided
- Building clean historical demand sequences and computing instantaneous 5-day forecasts, confidence bounds, and stock plans
"""

import re
import io
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Any

# Keyword maps for flexible column matching
COLUMN_SYNONYMS = {
    "product_id": ["product_id", "productid", "prod_id", "sku", "item_id", "itemid", "id", "code", "product_code", "item_code", "barcode"],
    "name": ["name", "product_name", "product", "item_name", "item", "description", "title", "product_desc", "product_title"],
    "demand": ["demand", "sales", "quantity", "units", "qty", "units_sold", "volume", "order_qty", "orders", "amount_sold", "sold", "count", "daily_sales"],
    "date": ["date", "order_date", "sale_date", "day", "timestamp", "datetime", "time", "invoice_date", "transaction_date", "period"],
    "category": ["category", "cat", "department", "dept", "section", "group", "type", "product_category"],
    "subcategory": ["subcategory", "sub_category", "subcat", "segment", "sub_dept"],
    "unit_price": ["unit_price", "price", "retail_price", "sale_price", "selling_price", "mrp", "rate", "unit_selling_price"],
    "unit_cost": ["unit_cost", "cost", "cost_price", "purchase_cost", "wholesale_price", "buy_price", "cogs"],
    "current_stock": ["current_stock", "stock", "inventory", "on_hand", "stock_on_hand", "available_qty", "inventory_level", "stock_qty"],
    "shelf_life_days": ["shelf_life_days", "shelf_life", "expiry_days", "shelf_life_in_days", "shelf life", "shelf_days", "expiration_days"],
    "lead_time_days": ["lead_time_days", "lead_time", "supplier_lead_time", "delivery_days", "lead_days"],
    "moq": ["moq", "min_order_qty", "minimum_order", "pack_size", "batch_size", "case_size"]
}

BEVERAGE_KEYWORDS = [
    "water", "drink", "juice", "soda", "coffee", "tea", "cola", "beverage", "milk", "kombucha", 
    "smoothie", "cider", "lemonade", "shake", "energy", "latte", "espresso", "tonic", "nectar", "brew"
]

def find_matching_column(df_columns: List[str], target_key: str) -> str | None:
    """Finds the best matching column name in the DataFrame using case-insensitive substring and exact matches."""
    cleaned_cols = {col: re.sub(r'[^a-z0-9_]', '', col.lower().strip().replace(' ', '_')) for col in df_columns}
    synonyms = COLUMN_SYNONYMS.get(target_key, [])
    
    # 1. Exact match
    for orig_col, clean_col in cleaned_cols.items():
        if clean_col in synonyms:
            return orig_col
            
    # 2. Substring match
    for orig_col, clean_col in cleaned_cols.items():
        for syn in synonyms:
            if syn in clean_col or clean_col in syn:
                return orig_col
                
    return None

def infer_category(product_name: str) -> str:
    """Infers whether an item is Food or Beverage based on its name."""
    name_lower = str(product_name).lower()
    for kw in BEVERAGE_KEYWORDS:
        if kw in name_lower:
            return "Beverage"
    return "Food"

def parse_flexible_csv(contents: bytes, filename: str = "uploaded.csv") -> Tuple[pd.DataFrame, List[Dict[str, Any]], Dict[str, Any]]:
    """
    Parses any arbitrary CSV or tabular sales file, normalizes columns,
    extracts or estimates missing fields, and builds ready-to-forecast structures.
    """
    # Try different encodings
    df = None
    for enc in ["utf-8", "latin1", "utf-8-sig", "cp1252"]:
        try:
            df = pd.read_csv(io.BytesIO(contents), encoding=enc)
            break
        except Exception:
            continue
            
    if df is None or len(df) == 0:
        raise ValueError("Could not parse CSV file or the file is empty.")
        
    cols = list(df.columns)
    
    # Match standard columns
    col_map = {}
    for target_key in COLUMN_SYNONYMS.keys():
        matched = find_matching_column(cols, target_key)
        if matched:
            col_map[target_key] = matched
            
    # If no demand column found, check for the first numeric column
    if "demand" not in col_map:
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 0:
            col_map["demand"] = numeric_cols[0]
        else:
            # Create synthetic default demand of 50 units
            df["demand"] = 50
            col_map["demand"] = "demand"
            
    # If no product name/id column found, check for first string column
    if "name" not in col_map and "product_id" not in col_map:
        str_cols = df.select_dtypes(include=['object']).columns
        if len(str_cols) > 0:
            col_map["name"] = str_cols[0]
        else:
            df["product_name"] = "Imported Item"
            col_map["name"] = "product_name"
            
    # Extract date or create sequence
    if "date" in col_map:
        try:
            df["parsed_date"] = pd.to_datetime(df[col_map["date"]], errors='coerce')
            df["parsed_date"] = df["parsed_date"].fillna(datetime.now())
        except Exception:
            df["parsed_date"] = [datetime.now() - timedelta(days=len(df) - i) for i in range(len(df))]
    else:
        df["parsed_date"] = [datetime.now() - timedelta(days=len(df) - i) for i in range(len(df))]
        
    # Standardize product identification
    if "name" in col_map and "product_id" not in col_map:
        df["product_id"] = "PROD_" + df[col_map["name"]].astype(str).str.slice(0, 10).str.upper().str.replace(r'[^A-Z0-9]', '', regex=True)
        # Ensure unique IDs
        unique_names = {n: f"PROD_{i+1:03d}" for i, n in enumerate(df[col_map["name"]].unique())}
        df["product_id"] = df[col_map["name"]].map(unique_names)
        col_map["product_id"] = "product_id"
    elif "product_id" in col_map and "name" not in col_map:
        df["product_name"] = df[col_map["product_id"]].astype(str)
        col_map["name"] = "product_name"
        
    df["clean_product_id"] = df[col_map["product_id"]].astype(str)
    df["clean_name"] = df[col_map["name"]].astype(str)
    df["clean_demand"] = pd.to_numeric(df[col_map["demand"]], errors='coerce').fillna(1.0).clip(lower=0)
    
    # Build unique products master list
    products_master = []
    
    for pid, group in df.groupby("clean_product_id"):
        pname = group["clean_name"].iloc[0]
        avg_demand = max(10, float(group["clean_demand"].mean()))
        
        # Category
        if "category" in col_map:
            cat_val = str(group[col_map["category"]].iloc[0]).capitalize()
            cat = "Beverage" if "bev" in cat_val.lower() or "drink" in cat_val.lower() else "Food"
        else:
            cat = infer_category(pname)
            
        subcat = str(group[col_map["subcategory"]].iloc[0]) if "subcategory" in col_map else ("Drinks" if cat == "Beverage" else "Produce")
        
        # Price and Cost
        if "unit_price" in col_map:
            price = float(pd.to_numeric(group[col_map["unit_price"]], errors='coerce').dropna().mean() or 3.99)
        else:
            price = round(float(np.random.uniform(2.5, 6.5)), 2)
            
        if "unit_cost" in col_map:
            cost = float(pd.to_numeric(group[col_map["unit_cost"]], errors='coerce').dropna().mean() or (price * 0.55))
        else:
            cost = round(price * float(np.random.uniform(0.45, 0.60)), 2)
            
        # Shelf life
        if "shelf_life_days" in col_map:
            shelf_life = int(pd.to_numeric(group[col_map["shelf_life_days"]], errors='coerce').dropna().median() or (5 if cat == "Food" else 90))
        else:
            shelf_life = 5 if cat == "Food" else 90
            
        # Lead time
        if "lead_time_days" in col_map:
            lead_time = int(pd.to_numeric(group[col_map["lead_time_days"]], errors='coerce').dropna().median() or 1)
        else:
            lead_time = 1 if cat == "Food" else 2
            
        # MOQ
        if "moq" in col_map:
            moq = int(pd.to_numeric(group[col_map["moq"]], errors='coerce').dropna().median() or 10)
        else:
            moq = max(5, int(round(avg_demand * 0.15 / 5) * 5))
            
        # Stock
        if "current_stock" in col_map:
            stock = int(pd.to_numeric(group[col_map["current_stock"]], errors='coerce').dropna().iloc[-1] or int(avg_demand * 1.5))
        else:
            stock = int(avg_demand * float(np.random.uniform(0.8, 1.8)))
            
        margin = round(price - cost, 2)
        margin_pct = round((margin / price) * 100, 1) if price > 0 else 50.0
        
        products_master.append({
            "product_id": pid,
            "name": pname,
            "category": cat,
            "subcategory": subcat,
            "base_demand": round(avg_demand, 1),
            "shelf_life_days": shelf_life,
            "unit_price": round(price, 2),
            "unit_cost": round(cost, 2),
            "margin": margin,
            "margin_pct": margin_pct,
            "lead_time_days": lead_time,
            "moq": moq,
            "current_stock": stock,
            "service_level": 0.95
        })
        
    stats_summary = {
        "filename": filename,
        "total_rows": len(df),
        "unique_products": len(products_master),
        "detected_columns": {k: col_map[k] for k in col_map if k in col_map},
        "food_count": sum(1 for p in products_master if p["category"] == "Food"),
        "beverage_count": sum(1 for p in products_master if p["category"] == "Beverage")
    }
    
    return df, products_master, stats_summary
