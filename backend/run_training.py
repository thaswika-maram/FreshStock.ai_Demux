"""
End-to-End Model Training, Evaluation, and Forecast Pre-computation Script
Executes:
1. Data generation & sequence preprocessing
2. PyTorch LSTM Category training (Food vs Beverage)
3. Baselines generation on test set
4. Comprehensive evaluation and benchmarking
5. Purchase orders & forecast export
"""

import os
import sys
import json
import numpy as np
import pandas as pd

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

from data_generator import generate_egrocery_data
from data_processor import EGroceryDataProcessor
from models.lstm_model import CategoryLSTMManager
from models.baselines import BaselineForecaster
from models.evaluator import ForecastEvaluator
from inventory_engine import InventoryOptimizationEngine

def run_pipeline(data_dir="data", models_dir="models", epochs=40):
    print("=" * 60)
    print("AI-POWERED STOCK PLANNING FOR E-GROCERY: TRAINING PIPELINE")
    print("=" * 60)
    
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)
    
    # 1. Generate / Load Data
    sales_csv = os.path.join(data_dir, "egrocery_sales_history.csv")
    products_json = os.path.join(data_dir, "products_catalog.json")
    
    if not os.path.exists(sales_csv) or not os.path.exists(products_json):
        print("Generating 100-product e-grocery dataset...")
        df_sales, df_products = generate_egrocery_data(num_working_days=160, output_dir=data_dir)
        with open(products_json, "r") as f:
            products_list = json.load(f)
    else:
        print("Loading existing e-grocery dataset...")
        df_sales = pd.read_csv(sales_csv)
        with open(products_json, "r") as f:
            products_list = json.load(f)
            
    print(f"Total sales records: {len(df_sales)}, Products: {len(products_list)}")
    
    # 2. Feature Engineering & Preprocessing
    print("\nExtracting multivariate features and scaling...")
    processor = EGroceryDataProcessor(input_window=36, output_window=5)
    df_enriched = processor.prepare_features(df_sales)
    
    # Train, Validation, Test Sequences
    print("Creating sliding window sequences (36 input steps -> 5 output steps)...")
    X_train, y_train_s, y_train_raw, meta_train = processor.create_sequences(df_enriched, split_type="train")
    X_val, y_val_s, y_val_raw, meta_val = processor.create_sequences(df_enriched, split_type="val")
    X_test, y_test_s, y_test_raw, meta_test = processor.create_sequences(df_enriched, split_type="test")
    
    print(f"Dataset Splits: Train={len(X_train)} seqs, Val={len(X_val)} seqs, Test={len(X_test)} seqs")
    
    # 3. Separate Training for Food vs Beverage
    print("\nTraining Category-Aware PyTorch LSTM Models...")
    food_train_idx = [i for i, m in enumerate(meta_train) if m["category"] == "Food"]
    bev_train_idx = [i for i, m in enumerate(meta_train) if m["category"] == "Beverage"]
    
    food_val_idx = [i for i, m in enumerate(meta_val) if m["category"] == "Food"]
    bev_val_idx = [i for i, m in enumerate(meta_val) if m["category"] == "Beverage"]
    
    manager = CategoryLSTMManager(input_dim=len(processor.feature_columns), output_dim=5)
    
    print(f"--> Training Food LSTM Model ({len(food_train_idx)} train samples)...")
    manager.train_category_model(
        "Food",
        X_train[food_train_idx], y_train_s[food_train_idx],
        X_val[food_val_idx], y_val_s[food_val_idx],
        epochs=epochs, batch_size=32, lr=0.003
    )
    
    print(f"--> Training Beverage LSTM Model ({len(bev_train_idx)} train samples)...")
    manager.train_category_model(
        "Beverage",
        X_train[bev_train_idx], y_train_s[bev_train_idx],
        X_val[bev_val_idx], y_val_s[bev_val_idx],
        epochs=epochs, batch_size=32, lr=0.003
    )
    
    # Save weights & processor
    manager.save_weights(models_dir)
    processor.save(os.path.join(data_dir, "data_processor.pkl"))
    print("Saved LSTM weights and DataProcessor state.")
    
    # 4. Baselines Evaluation on Test Set
    print("\nEvaluating LSTM vs. Classical Baselines on Unseen Test Set...")
    baseline_forecaster = BaselineForecaster()
    
    test_eval_records = []
    export_pred_rows = []
    
    # For each product, evaluate on the most recent test window
    for i, meta in enumerate(meta_test):
        pid = meta["product_id"]
        pname = meta["product_name"]
        cat = meta["category"]
        X_seq = X_test[i]
        act_5d = y_test_raw[i]
        
        # Get raw historical demand from X_seq
        unscaled_hist = processor.inverse_transform_demand(pid, X_seq[:, 0]) # demand_scaled is at index 0
        
        # 1. LSTM Prediction with 95% Confidence Intervals
        lstm_res = manager.predict_with_confidence_interval(cat, X_seq, pid, processor, n_mc_samples=25)
        lstm_pred = lstm_res["forecast"]
        ci_low = lstm_res["ci_lower"]
        ci_high = lstm_res["ci_upper"]
        
        # 2. Baselines
        baselines = baseline_forecaster.predict_all_baselines(unscaled_hist)
        
        test_eval_records.append({
            "product_id": pid,
            "product_name": pname,
            "category": cat,
            "actual": act_5d.tolist(),
            "lstm_pred": lstm_pred,
            "median_4w_pred": baselines["median_4w"],
            "exp_smoothing_pred": baselines["exp_smoothing"],
            "last_week_pred": baselines["last_week"],
            "moving_avg_pred": baselines["moving_avg_14"]
        })
        
        # Build CSV export rows
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        for d in range(5):
            t_date = meta["target_dates"][d] if d < len(meta["target_dates"]) else f"Day_{d+1}"
            export_pred_rows.append({
                "product_id": pid,
                "product_name": pname,
                "category": cat,
                "day_name": day_names[d],
                "target_date": t_date,
                "actual_demand": round(float(act_5d[d]), 1),
                "lstm_forecast": round(float(lstm_pred[d]), 1),
                "ci_95_lower": round(float(ci_low[d]), 1),
                "ci_95_upper": round(float(ci_high[d]), 1),
                "baseline_median_4w": round(float(baselines["median_4w"][d]), 1),
                "baseline_exp_smooth": round(float(baselines["exp_smoothing"][d]), 1),
                "baseline_last_week": round(float(baselines["last_week"][d]), 1),
                "lstm_abs_error": round(abs(float(act_5d[d]) - float(lstm_pred[d])), 1),
                "baseline_abs_error": round(abs(float(act_5d[d]) - float(baselines["median_4w"][d])), 1)
            })
            
    evaluator = ForecastEvaluator()
    eval_results = evaluator.evaluate_test_predictions(test_eval_records)
    
    print("\n" + "=" * 60)
    print("BENCHMARK RESULTS (TEST SET):")
    print(f"Overall LSTM MAPE:          {eval_results['overall']['lstm']['mape']}%  (MAE: {eval_results['overall']['lstm']['mae']} units)")
    print(f"Overall Median 4W MAPE:     {eval_results['overall']['median_4w']['mape']}%  (MAE: {eval_results['overall']['median_4w']['mae']} units)")
    print(f"Overall Exp Smoothing MAPE: {eval_results['overall']['exp_smoothing']['mape']}%  (MAE: {eval_results['overall']['exp_smoothing']['mae']} units)")
    print(f"Overall Last Week MAPE:     {eval_results['overall']['last_week']['mape']}%  (MAE: {eval_results['overall']['last_week']['mae']} units)")
    print(f"-> LSTM Relative Accuracy Gain vs Baseline: +{eval_results['overall_mape_gain_pct']}%")
    print("-" * 60)
    print(f"Food Category LSTM MAPE:     {eval_results['food']['lstm']['mape']}% vs Baseline {eval_results['food']['median_4w']['mape']}%")
    print(f"Beverage Category LSTM MAPE: {eval_results['beverage']['lstm']['mape']}% vs Baseline {eval_results['beverage']['median_4w']['mape']}%")
    print("=" * 60)
    
    # 5. Compute Shopkeeper Stock Plans for Next 5 Days (All 100 Products)
    print("\nComputing Shopkeeper Stock Plans and Weekly Purchase Orders...")
    inventory_engine = InventoryOptimizationEngine()
    
    product_stock_plans = {}
    purchase_orders_rows = []
    
    # Get the latest 36-day history per product for live forward forecasting
    for prod in products_list:
        pid = prod["product_id"]
        cat = prod["category"]
        p_group = df_enriched[df_enriched["product_id"] == pid].sort_values(by="date")
        
        # Take last 36 rows
        recent_36 = p_group.iloc[-36:]
        feat_matrix_36 = recent_36[processor.feature_columns].values
        
        # Predict 5 days ahead
        pred_res = manager.predict_with_confidence_interval(cat, feat_matrix_36, pid, processor, n_mc_samples=25)
        
        # Generate stock plan
        plan = inventory_engine.calculate_product_stock_plan(
            product=prod,
            forecast_5days=pred_res["forecast"],
            pred_std_5days=pred_res["pred_std"],
            ci_lower_5days=pred_res["ci_lower"],
            ci_upper_5days=pred_res["ci_upper"],
            service_level=0.95
        )
        
        # Merge baseline predictions for UI comparisons
        unscaled_recent_d = recent_36["demand"].values
        plan["baselines"] = baseline_forecaster.predict_all_baselines(unscaled_recent_d)
        plan["recent_history"] = {
            "dates": recent_36["date"].dt.strftime("%Y-%m-%d").tolist()[-15:], # Last 15 days history for chart
            "demand": recent_36["demand"].tolist()[-15:]
        }
        plan["features_active"] = {
            "is_promo": int(recent_36["is_promo"].iloc[-1]),
            "store_open_tomorrow": int(recent_36["store_open_tomorrow"].iloc[-1]),
            "holiday_tomorrow": int(recent_36["holiday_tomorrow"].iloc[-1]),
            "weather_temp": float(recent_36["weather_temp"].iloc[-1])
        }
        
        product_stock_plans[pid] = plan
        
        # Add to purchase orders export
        for dp in plan["daily_plans"]:
            if dp["recommended_order"] > 0:
                purchase_orders_rows.append({
                    "product_id": pid,
                    "product_name": prod["name"],
                    "category": cat,
                    "order_day": dp["day_name"],
                    "forecast_units": dp["forecast_units"],
                    "safety_stock_buffer": dp["safety_stock_buffer"],
                    "beginning_stock": dp["beginning_stock"],
                    "recommended_order_quantity": dp["recommended_order"],
                    "unit_cost": prod["unit_cost"],
                    "estimated_order_cost": round(dp["recommended_order"] * prod["unit_cost"], 2),
                    "shelf_life_days": prod["shelf_life_days"],
                    "spoilage_risk": dp["spoilage_risk"]
                })
                
    # 6. Business Impact Calculation
    impact_statement = inventory_engine.calculate_business_impact(eval_results, products_list)
    print(f"\n{impact_statement['summary_statement']}")
    
    # 7. Save outputs
    # Save test predictions CSV
    df_export_preds = pd.DataFrame(export_pred_rows)
    df_export_preds.to_csv(os.path.join(data_dir, "test_predictions.csv"), index=False)
    
    # Save purchase orders CSV
    df_po = pd.DataFrame(purchase_orders_rows)
    df_po.to_csv(os.path.join(data_dir, "weekly_purchase_orders.csv"), index=False)
    
    # Save evaluation report JSON
    with open(os.path.join(data_dir, "model_evaluation_report.json"), "w") as f:
        json.dump(eval_results, f, indent=2)
        
    # Save precomputed plans JSON
    with open(os.path.join(data_dir, "product_stock_plans.json"), "w") as f:
        json.dump(product_stock_plans, f, indent=2)
        
    # Save business impact JSON
    with open(os.path.join(data_dir, "business_impact.json"), "w") as f:
        json.dump(impact_statement, f, indent=2)
        
    # Save product catalog state
    with open(os.path.join(data_dir, "products_state.json"), "w") as f:
        json.dump(products_list, f, indent=2)
        
    print("\nPipeline execution complete! All artifacts and datasets successfully generated.")
    return eval_results, impact_statement

if __name__ == "__main__":
    run_pipeline(data_dir="data", models_dir="models", epochs=35)
