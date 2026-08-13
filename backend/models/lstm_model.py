"""
PyTorch Multivariate LSTM Demand Forecasting Model
Paper Reference: Gołąbek et al. (2020) — "Demand Forecasting using Long Short-Term Memory Neural Networks"
Features:
- Category-tuned LSTM architecture (Food vs Beverage)
- Monte Carlo Dropout for 95% confidence intervals (prediction intervals)
- Product-level adaptive forecasting
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
import numpy as np
import os

class MultivariateLSTMPredictor(nn.Module):
    def __init__(self, input_dim, hidden_dim=48, num_layers=1, output_dim=5, dropout_rate=0.25):
        super(MultivariateLSTMPredictor, self).__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.output_dim = output_dim
        self.dropout_rate = dropout_rate
        
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout_rate if num_layers > 1 else 0.0
        )
        
        self.dropout = nn.Dropout(dropout_rate)
        self.fc1 = nn.Linear(hidden_dim, 32)
        self.relu = nn.ReLU()
        self.fc_out = nn.Linear(32, output_dim)
        
    def forward(self, x):
        # x shape: (batch_size, seq_len=36, input_dim)
        lstm_out, (h_n, c_n) = self.lstm(x)
        # Take the last hidden state
        last_hidden = lstm_out[:, -1, :] # (batch_size, hidden_dim)
        
        out = self.dropout(last_hidden)
        out = self.relu(self.fc1(out))
        out = self.dropout(out)
        forecast = self.fc_out(out) # (batch_size, 5)
        return forecast

class CategoryLSTMManager:
    """
    Manages separate tuned LSTM models for Food and Beverage categories.
    """
    def __init__(self, input_dim=19, output_dim=5):
        self.input_dim = input_dim
        self.output_dim = output_dim
        
        # Category specific hyperparameters (Paper insight: Food vs Beverage behave differently)
        self.models = {
            "Food": MultivariateLSTMPredictor(
                input_dim=input_dim,
                hidden_dim=48,
                num_layers=1,
                output_dim=output_dim,
                dropout_rate=0.20
            ),
            "Beverage": MultivariateLSTMPredictor(
                input_dim=input_dim,
                hidden_dim=64, # Higher capacity for price/promo elasticity
                num_layers=1,
                output_dim=output_dim,
                dropout_rate=0.25
            )
        }
        
        # Track residual std dev per product for confidence bounds
        self.product_residual_std = {}

    def train_category_model(self, category, X_train, y_train, X_val, y_val, epochs=45, batch_size=32, lr=0.003):
        model = self.models[category]
        criterion = nn.MSELoss()
        optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=5)
        
        train_dataset = TensorDataset(torch.tensor(X_train, dtype=torch.float32), torch.tensor(y_train, dtype=torch.float32))
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
        
        val_X_t = torch.tensor(X_val, dtype=torch.float32)
        val_y_t = torch.tensor(y_val, dtype=torch.float32)
        
        best_val_loss = float("inf")
        best_weights = None
        
        model.train()
        for epoch in range(epochs):
            running_loss = 0.0
            for batch_X, batch_y in train_loader:
                optimizer.zero_grad()
                preds = model(batch_X)
                loss = criterion(preds, batch_y)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                running_loss += loss.item() * batch_X.size(0)
                
            train_loss = running_loss / len(train_dataset)
            
            # Validation
            model.eval()
            with torch.no_grad():
                val_preds = model(val_X_t)
                val_loss = criterion(val_preds, val_y_t).item()
                scheduler.step(val_loss)
                
                if val_loss < best_val_loss:
                    best_val_loss = val_loss
                    best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}
                    
            model.train()
            
        if best_weights is not None:
            model.load_state_dict(best_weights)
            
        print(f"[{category} LSTM] Trained for {epochs} epochs. Best Val Loss: {best_val_loss:.5f}")
        return best_val_loss

    def predict_with_confidence_interval(self, category, X_seq, product_id, data_processor, n_mc_samples=30):
        """
        Runs forward passes with Monte Carlo Dropout enabled to compute:
        - Point forecast (mean prediction)
        - 95% Confidence Interval lower and upper bounds (1.96 * std or empirical 2.5% & 97.5% quantiles)
        """
        model = self.models[category]
        model.train() # Keep dropout active for MC sampling
        
        if len(X_seq.shape) == 2:
            X_seq = np.expand_dims(X_seq, axis=0) # (1, 36, feat_dim)
            
        X_t = torch.tensor(X_seq, dtype=torch.float32)
        
        mc_predictions = []
        with torch.no_grad():
            for _ in range(n_mc_samples):
                preds = model(X_t).cpu().numpy()[0] # shape (5,)
                unscaled = data_processor.inverse_transform_demand(product_id, preds)
                mc_predictions.append(unscaled)
                
        mc_predictions = np.array(mc_predictions) # shape (n_mc_samples, 5)
        
        # Mean point forecast
        mean_forecast = np.round(np.mean(mc_predictions, axis=0), 1)
        
        # Standard deviation across samples + product baseline variance
        base_std = self.product_residual_std.get(product_id, np.mean(mean_forecast) * 0.12)
        pred_std = np.std(mc_predictions, axis=0) + (base_std * 0.4)
        
        # 95% Confidence bounds (mean ± 1.96 * total_std)
        ci_lower = np.maximum(0, np.round(mean_forecast - 1.96 * pred_std, 1))
        ci_upper = np.round(mean_forecast + 1.96 * pred_std, 1)
        
        return {
            "forecast": mean_forecast.tolist(),
            "ci_lower": ci_lower.tolist(),
            "ci_upper": ci_upper.tolist(),
            "pred_std": np.round(pred_std, 2).tolist()
        }

    def save_weights(self, dir_path="models"):
        os.makedirs(dir_path, exist_ok=True)
        for cat, model in self.models.items():
            torch.save(model.state_dict(), os.path.join(dir_path, f"lstm_{cat.lower()}.pth"))
            
    def load_weights(self, dir_path="models"):
        for cat, model in self.models.items():
            path = os.path.join(dir_path, f"lstm_{cat.lower()}.pth")
            if os.path.exists(path):
                model.load_state_dict(torch.load(path, map_location="cpu", weights_only=True))
                model.eval()
