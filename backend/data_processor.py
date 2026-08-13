"""
Data Processor and Feature Engineering Pipeline
Constructs multivariate time-series sequences (36 input steps -> 5 output steps)
for PyTorch LSTM training and statistical baseline evaluation.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import pickle
import os

class EGroceryDataProcessor:
    def __init__(self, input_window=36, output_window=5):
        self.input_window = input_window
        self.output_window = output_window
        self.scalers = {} # product_id -> MinMaxScaler for demand
        self.feature_columns = [
            "demand_scaled",
            "pre_orders_scaled",
            "lag_1_scaled",
            "lag_5_scaled",
            "rolling_7_mean_scaled",
            "rolling_7_std_scaled",
            "dow_0", "dow_1", "dow_2", "dow_3", "dow_4", # Mon-Fri
            "store_open_tomorrow",
            "store_open_day_after",
            "holiday_tomorrow",
            "holiday_day_after",
            "is_promo",
            "price_ratio",
            "weather_temp_scaled",
            "weather_rain"
        ]
        
    def prepare_features(self, df_sales):
        """
        Takes raw sales DataFrame and enriches it with time series features per product.
        """
        df = df_sales.copy()
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values(by=["product_id", "date"]).reset_index(drop=True)
        
        # One-hot encode day of week
        for d in range(5):
            df[f"dow_{d}"] = (df["day_of_week"] == d).astype(float)
            
        enriched_dfs = []
        
        for pid, group in df.groupby("product_id"):
            group = group.copy()
            
            # Lag and rolling features
            group["lag_1"] = group["demand"].shift(1).bfill()
            group["lag_5"] = group["demand"].shift(5).bfill()
            group["rolling_7_mean"] = group["demand"].shift(1).rolling(window=7, min_periods=1).mean().bfill()
            group["rolling_7_std"] = group["demand"].shift(1).rolling(window=7, min_periods=1).std().fillna(0)
            
            # Price ratio
            base_price = group["unit_price"].median()
            group["price_ratio"] = group["unit_price"] / (base_price if base_price > 0 else 1.0)
            
            # Scaler per product for demand & pre_orders
            if pid not in self.scalers:
                scaler = MinMaxScaler(feature_range=(0.01, 0.99))
                # Fit on demand
                scaler.fit(group[["demand"]])
                self.scalers[pid] = scaler
            else:
                scaler = self.scalers[pid]
                
            group["demand_scaled"] = scaler.transform(group[["demand"]])
            
            # Scale other numerical columns using the same scaler bounds or fixed scales
            max_d = scaler.data_max_[0] if scaler.data_max_[0] > 0 else 1.0
            group["pre_orders_scaled"] = group["pre_orders"] / max_d
            group["lag_1_scaled"] = group["lag_1"] / max_d
            group["lag_5_scaled"] = group["lag_5"] / max_d
            group["rolling_7_mean_scaled"] = group["rolling_7_mean"] / max_d
            group["rolling_7_std_scaled"] = group["rolling_7_std"] / max_d
            group["weather_temp_scaled"] = (group["weather_temp"] - 10.0) / 30.0 # 10C to 40C normalized
            
            enriched_dfs.append(group)
            
        full_df = pd.concat(enriched_dfs, ignore_index=True)
        return full_df

    def create_sequences(self, df_enriched, split_type="all"):
        """
        Creates (X, y) sliding window sequences:
        X shape: (N, 36, num_features)
        y shape: (N, 5) -> 5 future actual demand values (unscaled or scaled)
        y_scaled shape: (N, 5)
        metadata: list of dicts with product_id, category, target_dates, history_dates
        """
        X_list = []
        y_scaled_list = []
        y_raw_list = []
        meta_list = []
        
        num_features = len(self.feature_columns)
        
        for pid, group in df_enriched.groupby("product_id"):
            group = group.sort_values(by="date").reset_index(drop=True)
            n_rows = len(group)
            
            scaler = self.scalers[pid]
            
            feat_matrix = group[self.feature_columns].values
            demand_raw = group["demand"].values
            demand_scaled = group["demand_scaled"].values
            dates = group["date"].dt.strftime("%Y-%m-%d").values
            category = group["category"].iloc[0]
            prod_name = group["product_name"].iloc[0]
            
            # Sliding window over the timeline
            # Train: indices up to 70% of days
            # Val: next 15%
            # Test: final 15% (at least 5 steps)
            
            train_cutoff = int(n_rows * 0.70)
            val_cutoff = int(n_rows * 0.85)
            
            for i in range(n_rows - self.input_window - self.output_window + 1):
                end_in = i + self.input_window
                end_out = end_in + self.output_window
                
                # Check split criteria based on forecast start index (end_in)
                if split_type == "train" and end_in >= train_cutoff:
                    continue
                elif split_type == "val" and (end_in < train_cutoff or end_in >= val_cutoff):
                    continue
                elif split_type == "test" and end_in < val_cutoff:
                    continue
                    
                X_seq = feat_matrix[i:end_in]
                y_seq_scaled = demand_scaled[end_in:end_out]
                y_seq_raw = demand_raw[end_in:end_out]
                
                hist_dates = dates[i:end_in].tolist()
                target_dates = dates[end_in:end_out].tolist()
                
                X_list.append(X_seq)
                y_scaled_list.append(y_seq_scaled)
                y_raw_list.append(y_seq_raw)
                meta_list.append({
                    "product_id": pid,
                    "product_name": prod_name,
                    "category": category,
                    "history_start": hist_dates[0],
                    "history_end": hist_dates[-1],
                    "target_dates": target_dates,
                    "forecast_start_idx": end_in,
                    "shelf_life_days": group["shelf_life_days"].iloc[0],
                    "lead_time_days": group["lead_time_days"].iloc[0],
                    "moq": group["moq"].iloc[0],
                    "unit_cost": group["unit_cost"].iloc[0],
                    "unit_price": group["unit_price"].iloc[0]
                })
                
        return np.array(X_list, dtype=np.float32), np.array(y_scaled_list, dtype=np.float32), np.array(y_raw_list, dtype=np.float32), meta_list

    def inverse_transform_demand(self, product_id, scaled_demand_array):
        """
        Converts scaled demand back to raw positive units.
        """
        scaler = self.scalers.get(product_id)
        if scaler is None:
            return np.maximum(0, scaled_demand_array)
        
        orig_shape = scaled_demand_array.shape
        flat = scaled_demand_array.reshape(-1, 1)
        unscaled = scaler.inverse_transform(flat).reshape(orig_shape)
        return np.maximum(0, np.round(unscaled, 1))

    def save(self, filepath="data/data_processor.pkl"):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "wb") as f:
            pickle.dump(self, f)
            
    @classmethod
    def load(cls, filepath="data/data_processor.pkl"):
        with open(filepath, "rb") as f:
            return pickle.load(f)
