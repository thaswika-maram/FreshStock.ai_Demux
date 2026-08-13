"""
Inventory Optimization and Financial ROI Engine
Calculates:
- Dynamic Safety Stock buffer per product (based on forecast error variance & lead time)
- Recommended Daily & Weekly Reorder Quantities (accounting for current on-hand stock, MOQ, and shelf life)
- Spoilage and Stockout Risk Detectors
- Financial Business Impact Statement (Weekly / Annual cost savings vs. Naive baseline)
"""

import numpy as np

Z_TABLE = {
    0.90: 1.282,
    0.95: 1.645,
    0.98: 2.054,
    0.99: 2.326
}

class InventoryOptimizationEngine:
    def __init__(self, holding_cost_rate_annual=0.22):
        self.holding_cost_rate_annual = holding_cost_rate_annual
        self.holding_cost_rate_weekly = holding_cost_rate_annual / 52.0

    def calculate_product_stock_plan(
        self,
        product,
        forecast_5days,
        pred_std_5days,
        ci_lower_5days,
        ci_upper_5days,
        service_level=0.95
    ):
        """
        Calculates actionable stock planning advice for a single product over the 5 working days (Mon-Fri).
        """
        z = Z_TABLE.get(service_level, 1.645)
        lead_time = max(1, product.get("lead_time_days", 1))
        shelf_life = product.get("shelf_life_days", 7)
        curr_stock = product.get("current_stock", 0)
        moq = product.get("moq", 10)
        cost = product.get("unit_cost", 1.0)
        price = product.get("unit_price", 2.0)
        margin = price - cost
        
        # Total forecasted demand across the 5 days
        total_forecast_5d = float(np.sum(forecast_5days))
        avg_daily_forecast = total_forecast_5d / 5.0
        
        # Average forecast error std dev across horizon
        avg_std = float(np.mean(pred_std_5days))
        
        # Safety Stock formula: Z * sigma * sqrt(LeadTime)
        base_safety_stock = z * avg_std * np.sqrt(lead_time)
        
        # Perishable buffer adjustment: For short shelf life (< 5 days), reduce safety stock to avoid spoilage!
        if shelf_life <= 4:
            safety_stock = int(np.clip(base_safety_stock * 0.75, 5, avg_daily_forecast * 0.8))
        else:
            safety_stock = int(np.clip(base_safety_stock, 8, avg_daily_forecast * 1.5))
            
        # Daily recommendations
        daily_plans = []
        simulated_stock = curr_stock
        total_recommended_order = 0
        
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        
        for d in range(5):
            day_fc = forecast_5days[d]
            day_std = pred_std_5days[d]
            day_ci_low = ci_lower_5days[d]
            day_ci_high = ci_upper_5days[d]
            
            # Daily safety buffer target
            daily_ss = int(z * day_std * np.sqrt(lead_time))
            
            # Net requirement for this day
            target_stock = day_fc + daily_ss
            
            if simulated_stock < target_stock:
                raw_order = int(np.ceil(target_stock - simulated_stock))
                # Enforce MOQ in batches
                order_qty = int(np.ceil(raw_order / moq) * moq) if raw_order > 0 else 0
            else:
                order_qty = 0
                
            # Spoilage alert check: if total stock exceeds shelf-life capacity
            spoilage_risk = False
            spoilage_units_at_risk = 0
            max_fresh_capacity = avg_daily_forecast * shelf_life
            
            if (simulated_stock + order_qty) > max_fresh_capacity and shelf_life <= 7:
                spoilage_risk = True
                spoilage_units_at_risk = int((simulated_stock + order_qty) - max_fresh_capacity)
                
            # Stockout risk check
            stockout_risk = simulated_stock < day_fc
            
            daily_plans.append({
                "day_name": day_names[d],
                "day_index": d,
                "forecast_units": round(day_fc, 1),
                "ci_lower": round(day_ci_low, 1),
                "ci_upper": round(day_ci_high, 1),
                "confidence_range": f"{round(day_ci_low)} - {round(day_ci_high)}",
                "safety_stock_buffer": daily_ss,
                "beginning_stock": int(simulated_stock),
                "recommended_order": int(order_qty),
                "spoilage_risk": spoilage_risk,
                "spoilage_units_at_risk": spoilage_units_at_risk,
                "stockout_risk": stockout_risk,
                "explanation": f"For {product['name']} on {day_names[d]}, forecast {round(day_fc)} units (CI: {round(day_ci_low)}–{round(day_ci_high)}). Recommend ordering {order_qty} units."
            })
            
            # Advance simulated stock for next day
            simulated_stock = max(0, simulated_stock + order_qty - day_fc)
            total_recommended_order += order_qty
            
        total_order_cost = round(total_recommended_order * cost, 2)
        total_order_revenue = round(total_recommended_order * price, 2)
        
        # Stockout & Overstock / Do-Not-Buy Alert Intelligence
        daily_avg_demand = round(total_forecast_5d / 5.0, 1)
        days_of_stock = round(curr_stock / max(1.0, daily_avg_demand), 1)
        
        is_out_of_stock = (curr_stock == 0)
        is_critical_low = (curr_stock < daily_avg_demand * 1.5) or (days_of_stock <= 1.5)
        is_overstock_do_not_buy = (days_of_stock >= 7.0) or (shelf_life <= 4 and curr_stock > total_forecast_5d * 0.9 and total_recommended_order == 0)
        
        if is_out_of_stock:
            alert_status = "OUT_OF_STOCK"
            stockout_warn = True
            do_not_buy = False
            alert_msg = f"🚨 Out of Stock Alert: 0 units left on shelf! Daily demand is ~{round(daily_avg_demand)} units. Order {max(moq, total_recommended_order)} units immediately to avoid lost sales."
        elif is_critical_low:
            alert_status = "CRITICAL_LOW"
            stockout_warn = True
            do_not_buy = False
            alert_msg = f"🚨 Low Stock Alert: Only {curr_stock} units left (~{days_of_stock} days of stock). Expected demand is ~{round(daily_avg_demand)} units/day. Order {total_recommended_order} units now to prevent stockouts!"
        elif is_overstock_do_not_buy:
            alert_status = "OVERSTOCK_DO_NOT_BUY"
            stockout_warn = False
            do_not_buy = True
            alert_msg = f"🛑 Do Not Buy Alert (Excess Overstock): Item is moving slowly (~{round(daily_avg_demand)} units/day) with {curr_stock} units sitting in store (~{days_of_stock} days of stock). DO NOT order or buy more from suppliers next time to avoid dead capital and food waste!"
        else:
            alert_status = "HEALTHY"
            stockout_warn = False
            do_not_buy = False
            alert_msg = f"✓ Balanced Stock: {curr_stock} units on hand (~{days_of_stock} days of stock). Inventory is healthy."
            
        return {
            "product_id": product["product_id"],
            "product_name": product["name"],
            "category": product["category"],
            "shelf_life_days": shelf_life,
            "lead_time_days": lead_time,
            "current_stock": curr_stock,
            "daily_avg_demand": daily_avg_demand,
            "days_of_stock_remaining": days_of_stock,
            "stock_alert_status": alert_status,
            "stockout_warning": stockout_warn,
            "do_not_buy_warning": do_not_buy,
            "smart_alert_message": alert_msg,
            "total_5d_forecast": round(total_forecast_5d, 1),
            "total_recommended_order": total_recommended_order,
            "safety_stock_units": safety_stock,
            "total_order_cost": total_order_cost,
            "projected_revenue": total_order_revenue,
            "daily_plans": daily_plans,
            "headline_advice": alert_msg if (stockout_warn or do_not_buy) else f"For {product['name']} on Monday, forecast {round(forecast_5days[0])} units. Confidence range {round(ci_lower_5days[0])}–{round(ci_upper_5days[0])}. Recommend ordering {daily_plans[0]['recommended_order']} units."
        }

    def calculate_business_impact(self, evaluation_results, products_catalog):
        """
        Calculates financial business impact comparing LSTM forecast against Naive baseline:
        1. Safety Stock Reduction & Holding Cost Savings
        2. Spoilage / Waste Cost Reduction
        3. Lost Sales / Stockouts Averted
        4. Net Weekly & Annual Financial Savings + ROI
        """
        prod_map = {p["product_id"]: p for p in products_catalog}
        
        lstm_mape = evaluation_results["overall"]["lstm"]["mape"]
        baseline_mape = evaluation_results["overall"]["median_4w"]["mape"]
        mape_improvement = max(0.01, baseline_mape - lstm_mape)
        
        total_food_waste_saved_weekly = 0.0
        total_lost_sales_averted_weekly = 0.0
        total_holding_cost_saved_weekly = 0.0
        total_revenue_weekly = 0.0
        
        breakdown_by_category = {
            "Food": {"spoilage_saved": 0.0, "lost_sales_saved": 0.0, "holding_saved": 0.0},
            "Beverage": {"spoilage_saved": 0.0, "lost_sales_saved": 0.0, "holding_saved": 0.0}
        }
        
        for p in products_catalog:
            pid = p["product_id"]
            cat = p["category"]
            base_d = p.get("base_demand", 100)
            cost = p.get("unit_cost", 2.0)
            price = p.get("unit_price", 3.5)
            margin = price - cost
            shelf_life = p.get("shelf_life_days", 7)
            
            weekly_demand = base_d * 5
            weekly_rev = weekly_demand * price
            total_revenue_weekly += weekly_rev
            
            # Baseline forecast error leads to both overstocking (spoilage) and understocking (lost sales)
            # Higher error on baseline -> larger safety stock required
            
            # 1. Spoilage Reduction (Perishables in Food)
            if cat == "Food":
                # With baseline (higher error), shopkeeper over-orders ~8-12% perishables that expire
                baseline_spoilage_rate = 0.08 + (0.04 * (baseline_mape / 30.0))
                # With LSTM, spoilage is cut proportionally to MAPE reduction
                lstm_spoilage_rate = max(0.02, baseline_spoilage_rate * (1.0 - (mape_improvement / baseline_mape * 0.85)))
                
                spoilage_units_saved = weekly_demand * (baseline_spoilage_rate - lstm_spoilage_rate)
                spoilage_cost_saved = spoilage_units_saved * cost
                total_food_waste_saved_weekly += spoilage_cost_saved
                breakdown_by_category["Food"]["spoilage_saved"] += spoilage_cost_saved
            else:
                # Beverages rarely spoil, but dead stock has clearance cost
                spoilage_cost_saved = weekly_demand * 0.005 * cost
                total_food_waste_saved_weekly += spoilage_cost_saved
                breakdown_by_category["Beverage"]["spoilage_saved"] += spoilage_cost_saved
                
            # 2. Lost Sales Averted (Stockouts)
            # Baseline under-forecasts during promo surges or high days -> stockouts
            baseline_stockout_rate = 0.06 + (0.03 * (baseline_mape / 30.0))
            lstm_stockout_rate = max(0.015, baseline_stockout_rate * (1.0 - (mape_improvement / baseline_mape * 0.80)))
            
            lost_units_averted = weekly_demand * (baseline_stockout_rate - lstm_stockout_rate)
            lost_sales_margin_protected = lost_units_averted * margin
            total_lost_sales_averted_weekly += lost_sales_margin_protected
            breakdown_by_category[cat]["lost_sales_saved"] += lost_sales_margin_protected
            
            # 3. Holding Cost Reduction (Optimized Safety Stock)
            # Higher forecast precision allows reducing safety buffer by ~20-30%
            baseline_ss_units = base_d * 1.8
            lstm_ss_units = base_d * 1.3
            ss_units_reduced = baseline_ss_units - lstm_ss_units
            holding_cost_saved = ss_units_reduced * cost * self.holding_cost_rate_weekly
            total_holding_cost_saved_weekly += holding_cost_saved
            breakdown_by_category[cat]["holding_saved"] += holding_cost_saved
            
        net_weekly_savings = total_food_waste_saved_weekly + total_lost_sales_averted_weekly + total_holding_cost_saved_weekly
        annual_projected_savings = net_weekly_savings * 52.0
        
        # Operational ML Cost estimation (Paper reality check: Cloud compute / server cost)
        ml_system_cost_annual = 1800.0 # ~$150/month AWS/GCP inference & retraining
        net_annual_roi = annual_projected_savings - ml_system_cost_annual
        roi_percentage = (net_annual_roi / ml_system_cost_annual) * 100.0
        
        return {
            "weekly_total_savings": round(net_weekly_savings, 2),
            "annual_projected_savings": round(annual_projected_savings, 2),
            "weekly_spoilage_saved": round(total_food_waste_saved_weekly, 2),
            "weekly_lost_sales_protected": round(total_lost_sales_averted_weekly, 2),
            "weekly_holding_cost_saved": round(total_holding_cost_saved_weekly, 2),
            "annual_ml_system_cost": ml_system_cost_annual,
            "net_annual_roi_dollars": round(net_annual_roi, 2),
            "roi_multiple": round(annual_projected_savings / ml_system_cost_annual, 1),
            "roi_percentage": round(roi_percentage, 1),
            "category_breakdown": {
                "Food": {k: round(v, 2) for k, v in breakdown_by_category["Food"].items()},
                "Beverage": {k: round(v, 2) for k, v in breakdown_by_category["Beverage"].items()}
            },
            "summary_statement": f"With the AI Demand Forecasting model vs. naive baseline, this e-grocery retailer saves approximately ₹{round(net_weekly_savings):,} per week (₹{round(annual_projected_savings):,} / year), achieving a {round(roi_percentage):,}% ROI."
        }
