"""
Statistical and Naive Baseline Forecasting Models
Implements:
1. Median of Last 4 Weeks (matched by day of week)
2. Exponential Smoothing (Holt's / Simple Exponential Smoothing via statsmodels or recursive formula)
3. Last Week's Demand (Lag-5 Naive)
4. 14-Day Moving Average Baseline
"""

import numpy as np
import pandas as pd
try:
    from statsmodels.tsa.holtwinters import SimpleExpSmoothing, ExponentialSmoothing
    HAS_STATSMODELS = True
except ImportError:
    HAS_STATSMODELS = False

class BaselineForecaster:
    def __init__(self):
        pass

    def predict_last_week_naive(self, history_demand_36):
        """
        Naive baseline: repeats the demand of the last 5 working days (Mon-Fri).
        """
        arr = np.array(history_demand_36, dtype=float)
        if len(arr) < 5:
            val = float(np.mean(arr)) if len(arr) > 0 else 0.0
            return [val] * 5
        return np.round(arr[-5:], 1).tolist()

    def predict_median_4weeks(self, history_demand_36):
        """
        Takes the median for each day of week (Monday through Friday) across the last 4 weeks (20 days).
        """
        arr = np.array(history_demand_36, dtype=float)
        recent_20 = arr[-20:]
        if len(recent_20) < 5:
            return self.predict_last_week_naive(arr)
        
        # Reshape into weeks of 5 working days
        num_full_weeks = len(recent_20) // 5
        reshaped = recent_20[-num_full_weeks*5:].reshape((num_full_weeks, 5))
        median_dow = np.median(reshaped, axis=0)
        return np.round(median_dow, 1).tolist()

    def predict_moving_average_14(self, history_demand_36):
        """
        14-day moving average replicated for the next 5 days.
        """
        arr = np.array(history_demand_36, dtype=float)
        recent_14 = arr[-14:]
        avg = float(np.mean(recent_14)) if len(recent_14) > 0 else 0.0
        return [round(avg, 1)] * 5

    def predict_exponential_smoothing(self, history_demand_36, alpha=0.35):
        """
        Exponential Smoothing baseline.
        Uses statsmodels SimpleExpSmoothing if available, otherwise optimized exponential smoothing recurrence.
        """
        arr = np.array(history_demand_36, dtype=float)
        if len(arr) < 5:
            return self.predict_last_week_naive(history_demand_36)
            
        if HAS_STATSMODELS and len(arr) >= 10:
            try:
                model = SimpleExpSmoothing(arr, initialization_method="estimated").fit(
                    smoothing_level=alpha,
                    optimized=False
                )
                forecast = model.forecast(5)
                return np.maximum(0, np.round(forecast, 1)).tolist()
            except Exception:
                pass
                
        # Recursive exponential smoothing fallback
        s = arr[0]
        for val in arr[1:]:
            s = alpha * val + (1 - alpha) * s
        return [round(float(s), 1)] * 5

    def predict_all_baselines(self, history_demand_36):
        """
        Computes all baseline forecasts for a 5-day horizon.
        """
        return {
            "median_4w": self.predict_median_4weeks(history_demand_36),
            "exp_smoothing": self.predict_exponential_smoothing(history_demand_36),
            "last_week": self.predict_last_week_naive(history_demand_36),
            "moving_avg_14": self.predict_moving_average_14(history_demand_36)
        }
