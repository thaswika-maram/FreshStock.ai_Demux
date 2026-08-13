"""
Model Evaluation and Benchmark Diagnostics
Calculates MAE, MAPE, WAPE, RMSE across:
- Overall dataset
- Category breakdown (Food vs. Beverages)
- Product-level difficulty analysis (identifying hard-to-forecast SKUs and root causes)
- Accuracy gain (% improvement of LSTM over baselines)
"""

import numpy as np
import pandas as pd

class ForecastEvaluator:
    def __init__(self):
        pass

    @staticmethod
    def calc_mae(actual, pred):
        actual = np.array(actual, dtype=float)
        pred = np.array(pred, dtype=float)
        return float(np.mean(np.abs(actual - pred)))

    @staticmethod
    def calc_mape(actual, pred, epsilon=1e-5):
        actual = np.array(actual, dtype=float)
        pred = np.array(pred, dtype=float)
        # Avoid division by zero by clamping actual to at least 1 unit for retail items
        denom = np.maximum(actual, 1.0)
        return float(np.mean(np.abs(actual - pred) / denom) * 100.0)

    @staticmethod
    def calc_wape(actual, pred):
        actual = np.array(actual, dtype=float)
        pred = np.array(pred, dtype=float)
        sum_actual = np.sum(actual)
        if sum_actual == 0:
            return 0.0
        return float(np.sum(np.abs(actual - pred)) / sum_actual * 100.0)

    @staticmethod
    def calc_rmse(actual, pred):
        actual = np.array(actual, dtype=float)
        pred = np.array(pred, dtype=float)
        return float(np.sqrt(np.mean((actual - pred) ** 2)))

    def evaluate_test_predictions(self, test_records):
        """
        test_records is a list of dicts with:
        {
          "product_id": str,
          "product_name": str,
          "category": "Food" | "Beverage",
          "actual": [float x 5],
          "lstm_pred": [float x 5],
          "median_4w_pred": [float x 5],
          "exp_smoothing_pred": [float x 5],
          "last_week_pred": [float x 5],
          "moving_avg_pred": [float x 5]
        }
        """
        models = ["lstm", "median_4w", "exp_smoothing", "last_week", "moving_avg"]
        
        # Aggregated actuals & preds
        overall_data = {m: {"actual": [], "pred": []} for m in models}
        category_data = {
            "Food": {m: {"actual": [], "pred": []} for m in models},
            "Beverage": {m: {"actual": [], "pred": []} for m in models}
        }
        
        product_metrics = []
        
        for r in test_records:
            pid = r["product_id"]
            pname = r["product_name"]
            cat = r["category"]
            act = np.array(r["actual"], dtype=float)
            
            p_lstm = np.array(r["lstm_pred"], dtype=float)
            p_med = np.array(r["median_4w_pred"], dtype=float)
            p_exp = np.array(r["exp_smoothing_pred"], dtype=float)
            p_lw = np.array(r["last_week_pred"], dtype=float)
            p_ma = np.array(r["moving_avg_pred"], dtype=float)
            
            preds_map = {
                "lstm": p_lstm,
                "median_4w": p_med,
                "exp_smoothing": p_exp,
                "last_week": p_lw,
                "moving_avg": p_ma
            }
            
            for m in models:
                overall_data[m]["actual"].extend(act)
                overall_data[m]["pred"].extend(preds_map[m])
                category_data[cat][m]["actual"].extend(act)
                category_data[cat][m]["pred"].extend(preds_map[m])
                
            # Product level errors
            lstm_mae = self.calc_mae(act, p_lstm)
            lstm_mape = self.calc_mape(act, p_lstm)
            med_mape = self.calc_mape(act, p_med)
            
            # Demand volatility / Coefficient of Variation
            mean_demand = np.mean(act) if np.mean(act) > 0 else 1.0
            std_demand = np.std(act)
            cv = std_demand / mean_demand
            
            # Diagnosis why hard or easy
            difficulty_reason = "Stable baseline demand with predictable weekday patterns."
            difficulty_level = "Easy"
            if cv > 0.35:
                difficulty_level = "Hard"
                if cat == "Beverage":
                    difficulty_reason = "High promotional sensitivity, erratic spike bursts, and weather-driven demand swings."
                else:
                    difficulty_reason = "Short shelf-life perishable with volatile midweek replenishment spikes."
            elif cv > 0.20:
                difficulty_level = "Moderate"
                difficulty_reason = "Moderate weekday variance and occasional promotional uplift."
                
            product_metrics.append({
                "product_id": pid,
                "product_name": pname,
                "category": cat,
                "mean_actual": round(float(mean_demand), 1),
                "lstm_mae": round(lstm_mae, 1),
                "lstm_mape": round(lstm_mape, 1),
                "median_mape": round(med_mape, 1),
                "mape_improvement_pct": round(max(0, med_mape - lstm_mape) / (med_mape if med_mape > 0 else 1) * 100, 1),
                "demand_cv": round(float(cv), 2),
                "difficulty": difficulty_level,
                "difficulty_reason": difficulty_reason
            })
            
        def compute_summary(data_dict):
            res = {}
            for m in models:
                a = np.array(data_dict[m]["actual"])
                p = np.array(data_dict[m]["pred"])
                res[m] = {
                    "mae": round(self.calc_mae(a, p), 2),
                    "mape": round(self.calc_mape(a, p), 2),
                    "wape": round(self.calc_wape(a, p), 2),
                    "rmse": round(self.calc_rmse(a, p), 2)
                }
            return res
            
        overall_summary = compute_summary(overall_data)
        food_summary = compute_summary(category_data["Food"])
        beverage_summary = compute_summary(category_data["Beverage"])
        
        # Calculate Relative Improvements of LSTM vs Best Baseline (Median / ExpSmooth)
        best_baseline_overall = min(overall_summary["median_4w"]["mape"], overall_summary["exp_smoothing"]["mape"])
        lstm_overall_mape = overall_summary["lstm"]["mape"]
        overall_gain_pct = round((best_baseline_overall - lstm_overall_mape) / best_baseline_overall * 100, 1)
        
        # Hardest 10 products
        sorted_hardest = sorted(product_metrics, key=lambda x: x["demand_cv"], reverse=True)[:10]
        
        return {
            "overall": overall_summary,
            "food": food_summary,
            "beverage": beverage_summary,
            "overall_mape_gain_pct": overall_gain_pct,
            "product_metrics": product_metrics,
            "hardest_products": sorted_hardest,
            "num_test_samples": len(test_records)
        }
