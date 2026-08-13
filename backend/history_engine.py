"""
Activity History and Audit Trail Engine
Logs and tracks all user data changes, uploads, product edits, and purchase orders.
"""

import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

HISTORY_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "activity_history.json")

class HistoryEngine:
    def __init__(self, storage_path=HISTORY_FILE):
        self.storage_path = storage_path
        self._ensure_storage()

    def _ensure_storage(self):
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        if not os.path.exists(self.storage_path):
            # Seed with initial realistic events
            initial_history = [
                {
                    "id": str(uuid.uuid4()),
                    "user_id": "default_user",
                    "timestamp": (datetime.now()).strftime("%Y-%m-%d %H:%M:%S"),
                    "action_type": "DATASET_INIT",
                    "title": "Initial E-Grocery Catalog Loaded",
                    "description": "Pre-loaded 100 benchmark products (Food & Beverages) with 6 months historical sequence data.",
                    "badge_color": "emerald",
                    "metadata": {"products_count": 100, "categories": ["Food", "Beverage"]}
                }
            ]
            with open(self.storage_path, "w") as f:
                json.dump(initial_history, f, indent=2)

    def _load_all(self) -> List[Dict[str, Any]]:
        try:
            if os.path.exists(self.storage_path):
                with open(self.storage_path, "r") as f:
                    return json.load(f)
        except Exception:
            pass
        return []

    def _save_all(self, events: List[Dict[str, Any]]):
        try:
            with open(self.storage_path, "w") as f:
                json.dump(events, f, indent=2)
        except Exception as e:
            print(f"Failed to save history: {e}")

    def log_event(
        self,
        action_type: str, # "CSV_UPLOAD" | "PRODUCT_CREATE" | "PRODUCT_UPDATE" | "PRODUCT_DELETE" | "PURCHASE_ORDER" | "SCENARIO_SIMULATION"
        title: str,
        description: str,
        user_id: str = "default_user",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        events = self._load_all()
        
        color_map = {
            "CSV_UPLOAD": "cyan",
            "PRODUCT_CREATE": "emerald",
            "PRODUCT_UPDATE": "violet",
            "PRODUCT_DELETE": "rose",
            "PURCHASE_ORDER": "amber",
            "SCENARIO_SIMULATION": "blue",
            "DATASET_RESET": "rose"
        }
        
        new_event = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "action_type": action_type,
            "title": title,
            "description": description,
            "badge_color": color_map.get(action_type, "emerald"),
            "metadata": metadata or {}
        }
        
        # Prepend latest event
        events.insert(0, new_event)
        
        # Keep maximum 500 records
        if len(events) > 500:
            events = events[:500]
            
        self._save_all(events)
        return new_event

    def get_history(self, user_id: str = "default_user", action_type: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        events = self._load_all()
        filtered = [e for e in events if e.get("user_id", "default_user") == user_id or user_id == "all"]
        if action_type and action_type.upper() != "ALL":
            filtered = [e for e in filtered if e.get("action_type") == action_type.upper()]
        return filtered[:limit]

    def clear_history(self, user_id: str = "default_user") -> bool:
        events = self._load_all()
        events = [e for e in events if e.get("user_id") != user_id]
        self._save_all(events)
        return True

history_engine = HistoryEngine()
