"""
Multi-Tenant User Workspace Store Engine
Isolates products, stock plans, uploaded CSV datasets, and business impacts per user account.
"""

import os
import json
import copy
from typing import List, Dict, Any, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
WORKSPACES_DIR = os.path.join(DATA_DIR, "workspaces")
CATALOG_FILE = os.path.join(DATA_DIR, "products_catalog.json")

class WorkspaceEngine:
    def __init__(self, storage_dir: str = WORKSPACES_DIR):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)
        self._workspaces_cache: Dict[str, Dict[str, Any]] = {}

    def _get_file_path(self, user_id: str) -> str:
        safe_id = "".join(c for c in user_id if c.isalnum() or c in ("_", "-"))
        if not safe_id:
            safe_id = "default_user"
        return os.path.join(self.storage_dir, f"{safe_id}.json")

    def get_user_workspace(self, user_id: Optional[str]) -> Dict[str, Any]:
        uid = user_id or "usr_alex_01"
        if uid in self._workspaces_cache:
            return self._workspaces_cache[uid]

        file_path = self._get_file_path(uid)
        if os.path.exists(file_path):
            try:
                with open(file_path, "r") as f:
                    ws = json.load(f)
                    self._workspaces_cache[uid] = ws
                    return ws
            except Exception as e:
                print(f"Error loading workspace for {uid}: {e}")

        # New user or user with no data yet -> starts completely clean and empty
        empty_ws = {
            "user_id": uid,
            "products": [],
            "stock_plans": {},
            "metadata": {
                "has_uploaded": False,
                "uploaded_filename": None,
                "total_rows": 0
            }
        }
        self._workspaces_cache[uid] = empty_ws
        return empty_ws

    def save_user_workspace(
        self,
        user_id: str,
        products: List[Dict[str, Any]],
        stock_plans: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        uid = user_id or "usr_alex_01"
        file_path = self._get_file_path(uid)
        ws = {
            "user_id": uid,
            "products": products,
            "stock_plans": stock_plans,
            "metadata": metadata or {"has_uploaded": len(products) > 0}
        }
        self._workspaces_cache[uid] = ws
        try:
            with open(file_path, "w") as f:
                json.dump(ws, f, indent=2)
        except Exception as e:
            print(f"Error saving workspace for {uid}: {e}")
        return ws

    def get_products(self, user_id: Optional[str]) -> List[Dict[str, Any]]:
        ws = self.get_user_workspace(user_id)
        return ws.get("products", [])

    def get_stock_plans(self, user_id: Optional[str]) -> Dict[str, Any]:
        ws = self.get_user_workspace(user_id)
        return ws.get("stock_plans", {})

    def set_user_dataset(
        self,
        user_id: str,
        products: List[Dict[str, Any]],
        stock_plans: Dict[str, Any],
        filename: str,
        stats: Dict[str, Any]
    ):
        metadata = {
            "has_uploaded": True,
            "uploaded_filename": filename,
            "uploaded_stats": stats
        }
        self.save_user_workspace(user_id, products, stock_plans, metadata)

    def reset_user_to_benchmark(self, user_id: str) -> List[Dict[str, Any]]:
        if os.path.exists(CATALOG_FILE):
            with open(CATALOG_FILE, "r") as f:
                bench_prods = json.load(f)
        else:
            bench_prods = []
        self.save_user_workspace(
            user_id=user_id,
            products=bench_prods,
            stock_plans={},
            metadata={"source": "Benchmark Catalog (100 SKUs)", "has_uploaded": False}
        )
        return bench_prods

    def clear_user_workspace(self, user_id: str):
        self.save_user_workspace(
            user_id=user_id,
            products=[],
            stock_plans={},
            metadata={"has_uploaded": False}
        )

# Global singleton
workspace_engine = WorkspaceEngine()
