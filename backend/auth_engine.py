"""
User Authentication and Multi-Tenant Store Workspace Engine
Manages user profiles, credentials, multi-user store workspaces, and operational stats.
"""

import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

USERS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "users_db.json")

class AuthEngine:
    def __init__(self, storage_path: str = USERS_FILE):
        self.storage_path = storage_path
        self._ensure_storage()

    def _ensure_storage(self):
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        if not os.path.exists(self.storage_path):
            initial_users = [
                {
                    "user_id": "usr_alex_01",
                    "email": "alex.morgan@freshstock.ai",
                    "name": "Alex Morgan",
                    "store_name": "FreshMart Supermarket #04",
                    "role": "Store Inventory & Procurement Manager",
                    "phone": "+1 (555) 234-5678",
                    "location": "Austin, Texas, USA",
                    "timezone": "America/Chicago (CST)",
                    "currency": "INR (₹)",
                    "avatar_url": "",
                    "created_at": "2025-11-15",
                    "theme_preference": "dark",
                    "service_level_default": 0.95,
                    "holding_cost_annual_pct": 22.0,
                    "stats": {
                        "reorders_placed": 0,
                        "csv_uploads": 0,
                        "skus_managed": 0
                    }
                },
                {
                    "user_id": "usr_sarah_02",
                    "email": "sarah.j@greengrocer.com",
                    "name": "Sarah Jenkins",
                    "store_name": "Organic Green Grocery Co.",
                    "role": "Head of Fresh Produce Buying",
                    "phone": "+1 (555) 890-1234",
                    "location": "Portland, Oregon, USA",
                    "timezone": "America/Los_Angeles (PST)",
                    "currency": "INR (₹)",
                    "avatar_url": "",
                    "created_at": "2026-01-10",
                    "theme_preference": "dark",
                    "service_level_default": 0.98,
                    "holding_cost_annual_pct": 20.0,
                    "stats": {
                        "reorders_placed": 0,
                        "csv_uploads": 0,
                        "skus_managed": 0
                    }
                }
            ]
            with open(self.storage_path, "w") as f:
                json.dump(initial_users, f, indent=2)

    def _load_all(self) -> List[Dict[str, Any]]:
        try:
            if os.path.exists(self.storage_path):
                with open(self.storage_path, "r") as f:
                    return json.load(f)
        except Exception as e:
            print(f"Failed to load users from {self.storage_path}: {e}")
        return []

    def _save_all(self, users: List[Dict[str, Any]]):
        try:
            with open(self.storage_path, "w") as f:
                json.dump(users, f, indent=2)
        except Exception as e:
            print(f"Failed to save users: {e}")

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        users = self._load_all()
        for u in users:
            if u.get("user_id") == user_id:
                return u
        return None

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        if not email:
            return None
        users = self._load_all()
        email_clean = email.strip().lower()
        for u in users:
            if u.get("email", "").strip().lower() == email_clean:
                return u
        return None

    def login_or_demo(self, email: str) -> Dict[str, Any]:
        """
        Logs in user by email. If not found, automatically creates a demo store workspace.
        """
        user = self.get_user_by_email(email)
        if user:
            return user
        
        # Auto-create demo user for smooth testing
        clean_email = email.strip().lower() if email else "demo@freshstock.ai"
        name_part = clean_email.split("@")[0].replace(".", " ").title()
        return self.register_user(
            name=name_part,
            email=clean_email,
            store_name=f"{name_part}'s Retail Mart",
            role="Store Manager"
        )

    def register_user(
        self,
        name: str,
        email: str,
        store_name: str = "My Retail Grocery Store",
        role: str = "Store Manager",
        phone: str = "",
        location: str = ""
    ) -> Dict[str, Any]:
        users = self._load_all()
        email_clean = email.strip().lower()

        # Check existing
        for u in users:
            if u.get("email", "").strip().lower() == email_clean:
                u["name"] = name
                u["store_name"] = store_name or u.get("store_name", "My Retail Grocery Store")
                u["role"] = role or u.get("role", "Store Manager")
                if phone:
                    u["phone"] = phone
                if location:
                    u["location"] = location
                self._save_all(users)
                return u

        new_user = {
            "user_id": f"usr_{uuid.uuid4().hex[:8]}",
            "email": email_clean,
            "name": name,
            "store_name": store_name or "My Retail Grocery Store",
            "role": role or "Store Manager",
            "phone": phone or "",
            "location": location or "",
            "timezone": "America/New_York (EST)",
            "currency": "INR (₹)",
            "avatar_url": "",
            "created_at": datetime.now().strftime("%Y-%m-%d"),
            "theme_preference": "dark",
            "service_level_default": 0.95,
            "holding_cost_annual_pct": 22.0,
            "stats": {
                "reorders_placed": 0,
                "csv_uploads": 0,
                "skus_managed": 0
            }
        }
        users.append(new_user)
        self._save_all(users)
        return new_user

    def update_profile(self, user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        users = self._load_all()
        target_user = None
        for u in users:
            if u.get("user_id") == user_id:
                target_user = u
                break

        if not target_user:
            # Fallback to first user if user_id not matched
            if users:
                target_user = users[0]
            else:
                return None

        # Update allowed fields
        for key, val in updates.items():
            if val is not None and key != "user_id":
                if key == "stats" and isinstance(val, dict):
                    target_user.setdefault("stats", {}).update(val)
                else:
                    target_user[key] = val

        self._save_all(users)
        return target_user

    def list_all_users(self) -> List[Dict[str, Any]]:
        return self._load_all()

    def increment_user_stat(self, user_id: str, stat_name: str, amount: int = 1) -> bool:
        users = self._load_all()
        updated = False
        for u in users:
            if u.get("user_id") == user_id:
                stats = u.setdefault("stats", {"reorders_placed": 0, "csv_uploads": 0, "skus_managed": 0})
                stats[stat_name] = stats.get(stat_name, 0) + amount
                updated = True
                break

        if updated:
            self._save_all(users)
        return updated

auth_engine = AuthEngine()
