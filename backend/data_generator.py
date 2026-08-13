"""
E-Grocery Synthetic Dataset Generator
Generates realistic daily sales and demand data for 100 products (Food & Beverages)
over 7+ months of working days (Monday-Friday), incorporating:
- Weekly seasonality (Mon/Fri surges, mid-week dips)
- Promotional spikes (50% to 200% surge)
- Holiday surges & Store closure behavior (pre-holiday panic buying, day-after recovery)
- Food vs. Beverage structural differences (perishability, shelf life, price elasticity)
- Pre-orders (known forward orders)
- Weather impact
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import os
import json

np.random.seed(42)

# Catalog of 100 realistic e-grocery items
FOOD_PRODUCTS = [
    {"name": "Roma Tomatoes (1kg)", "base_demand": 145, "shelf_life": 5, "price": 3.49, "cost": 1.80, "subcat": "Produce", "lead_time": 1, "moq": 20},
    {"name": "Organic Whole Milk (1L)", "base_demand": 210, "shelf_life": 7, "price": 2.29, "cost": 1.20, "subcat": "Dairy", "lead_time": 1, "moq": 24},
    {"name": "Artisan Sourdough Loaf", "base_demand": 85, "shelf_life": 3, "price": 4.50, "cost": 2.00, "subcat": "Bakery", "lead_time": 1, "moq": 10},
    {"name": "Hass Avocados (Pack of 4)", "base_demand": 120, "shelf_life": 4, "price": 4.99, "cost": 2.70, "subcat": "Produce", "lead_time": 2, "moq": 15},
    {"name": "Organic Bananas (1kg)", "base_demand": 260, "shelf_life": 4, "price": 1.99, "cost": 0.90, "subcat": "Produce", "lead_time": 1, "moq": 30},
    {"name": "Free-Range Chicken Breast (500g)", "base_demand": 95, "shelf_life": 4, "price": 6.99, "cost": 4.20, "subcat": "Meat", "lead_time": 2, "moq": 12},
    {"name": "Fresh Strawberries (400g)", "base_demand": 110, "shelf_life": 3, "price": 3.99, "cost": 2.10, "subcat": "Produce", "lead_time": 1, "moq": 15},
    {"name": "Authentic Greek Yogurt (500g)", "base_demand": 130, "shelf_life": 12, "price": 3.29, "cost": 1.60, "subcat": "Dairy", "lead_time": 2, "moq": 18},
    {"name": "Baby Spinach (200g)", "base_demand": 140, "shelf_life": 4, "price": 2.49, "cost": 1.10, "subcat": "Produce", "lead_time": 1, "moq": 20},
    {"name": "Pasture-Raised Eggs (Dozen)", "base_demand": 175, "shelf_life": 21, "price": 4.79, "cost": 2.60, "subcat": "Dairy", "lead_time": 2, "moq": 24},
    {"name": "Atlantic Salmon Fillet (400g)", "base_demand": 65, "shelf_life": 3, "price": 9.99, "cost": 6.50, "subcat": "Seafood", "lead_time": 1, "moq": 10},
    {"name": "Aged Cheddar Cheese (250g)", "base_demand": 75, "shelf_life": 30, "price": 4.29, "cost": 2.30, "subcat": "Dairy", "lead_time": 3, "moq": 12},
    {"name": "Red Bell Peppers (3-pack)", "base_demand": 90, "shelf_life": 6, "price": 3.19, "cost": 1.50, "subcat": "Produce", "lead_time": 1, "moq": 15},
    {"name": "Fresh Broccoli Crowns (500g)", "base_demand": 105, "shelf_life": 5, "price": 2.29, "cost": 1.05, "subcat": "Produce", "lead_time": 1, "moq": 15},
    {"name": "Royal Gala Apples (1.5kg)", "base_demand": 155, "shelf_life": 14, "price": 3.99, "cost": 1.95, "subcat": "Produce", "lead_time": 2, "moq": 20},
    {"name": "Salted Butter (250g)", "base_demand": 115, "shelf_life": 45, "price": 2.89, "cost": 1.50, "subcat": "Dairy", "lead_time": 3, "moq": 24},
    {"name": "Whole Grain Sandwich Bread", "base_demand": 135, "shelf_life": 5, "price": 2.69, "cost": 1.15, "subcat": "Bakery", "lead_time": 1, "moq": 20},
    {"name": "Grass-Fed Ground Beef (500g)", "base_demand": 88, "shelf_life": 4, "price": 5.99, "cost": 3.80, "subcat": "Meat", "lead_time": 2, "moq": 12},
    {"name": "Fresh Blueberries (250g)", "base_demand": 92, "shelf_life": 4, "price": 4.49, "cost": 2.40, "subcat": "Produce", "lead_time": 1, "moq": 15},
    {"name": "Seedless Cucumbers (2-pack)", "base_demand": 118, "shelf_life": 6, "price": 2.19, "cost": 0.95, "subcat": "Produce", "lead_time": 1, "moq": 20},
    {"name": "Fresh Mushrooms (300g)", "base_demand": 82, "shelf_life": 4, "price": 2.79, "cost": 1.35, "subcat": "Produce", "lead_time": 1, "moq": 12},
    {"name": "Organic Carrots (1kg)", "base_demand": 125, "shelf_life": 18, "price": 1.79, "cost": 0.75, "subcat": "Produce", "lead_time": 2, "moq": 25},
    {"name": "Fresh Mozzarella Ball (200g)", "base_demand": 70, "shelf_life": 10, "price": 3.49, "cost": 1.90, "subcat": "Dairy", "lead_time": 2, "moq": 12},
    {"name": "Yellow Onions (2kg bag)", "base_demand": 140, "shelf_life": 30, "price": 2.49, "cost": 1.00, "subcat": "Produce", "lead_time": 3, "moq": 20},
    {"name": "Russet Potatoes (2.5kg)", "base_demand": 160, "shelf_life": 25, "price": 3.29, "cost": 1.40, "subcat": "Produce", "lead_time": 3, "moq": 20},
    {"name": "French Baguette", "base_demand": 95, "shelf_life": 2, "price": 2.10, "cost": 0.85, "subcat": "Bakery", "lead_time": 1, "moq": 15},
    {"name": "Lean Pork Chops (400g)", "base_demand": 55, "shelf_life": 4, "price": 5.49, "cost": 3.30, "subcat": "Meat", "lead_time": 2, "moq": 10},
    {"name": "Fresh Raspberries (175g)", "base_demand": 68, "shelf_life": 3, "price": 4.19, "cost": 2.30, "subcat": "Produce", "lead_time": 1, "moq": 12},
    {"name": "Cottage Cheese (400g)", "base_demand": 62, "shelf_life": 14, "price": 2.99, "cost": 1.50, "subcat": "Dairy", "lead_time": 2, "moq": 12},
    {"name": "Fresh Zucchini (1kg)", "base_demand": 74, "shelf_life": 6, "price": 2.59, "cost": 1.15, "subcat": "Produce", "lead_time": 1, "moq": 15},
    {"name": "Organic Tofu Firm (400g)", "base_demand": 58, "shelf_life": 20, "price": 2.69, "cost": 1.25, "subcat": "Plant-Based", "lead_time": 2, "moq": 12},
    {"name": "Gourmet Croissants (4-pack)", "base_demand": 78, "shelf_life": 3, "price": 3.99, "cost": 1.80, "subcat": "Bakery", "lead_time": 1, "moq": 10},
    {"name": "Turkey Breast Slices (200g)", "base_demand": 84, "shelf_life": 10, "price": 3.89, "cost": 2.10, "subcat": "Meat", "lead_time": 2, "moq": 15},
    {"name": "Fresh Cilantro Bunch", "base_demand": 110, "shelf_life": 4, "price": 1.29, "cost": 0.45, "subcat": "Produce", "lead_time": 1, "moq": 25},
    {"name": "Garlic (3-bulb pack)", "base_demand": 130, "shelf_life": 40, "price": 1.59, "cost": 0.60, "subcat": "Produce", "lead_time": 3, "moq": 30},
    {"name": "Fresh Cauliflower Head", "base_demand": 66, "shelf_life": 6, "price": 2.99, "cost": 1.40, "subcat": "Produce", "lead_time": 1, "moq": 12},
    {"name": "Lemon 4-pack", "base_demand": 102, "shelf_life": 14, "price": 2.29, "cost": 0.95, "subcat": "Produce", "lead_time": 2, "moq": 20},
    {"name": "Organic Hummus (250g)", "base_demand": 72, "shelf_life": 12, "price": 3.19, "cost": 1.60, "subcat": "Dips", "lead_time": 2, "moq": 12},
    {"name": "Fresh Asparagus (350g)", "base_demand": 48, "shelf_life": 4, "price": 4.29, "cost": 2.45, "subcat": "Produce", "lead_time": 1, "moq": 10},
    {"name": "Parmesan Wedge (200g)", "base_demand": 52, "shelf_life": 60, "price": 5.49, "cost": 3.10, "subcat": "Dairy", "lead_time": 3, "moq": 10},
    {"name": "Sweet Corn (3-pack)", "base_demand": 80, "shelf_life": 5, "price": 2.79, "cost": 1.20, "subcat": "Produce", "lead_time": 1, "moq": 15},
    {"name": "Smoked Bacon (300g)", "base_demand": 90, "shelf_life": 25, "price": 4.69, "cost": 2.70, "subcat": "Meat", "lead_time": 2, "moq": 15},
    {"name": "Fresh Basil Pot", "base_demand": 45, "shelf_life": 7, "price": 2.49, "cost": 1.05, "subcat": "Produce", "lead_time": 1, "moq": 10},
    {"name": "Roma Lettuce (2-pack)", "base_demand": 98, "shelf_life": 5, "price": 2.59, "cost": 1.15, "subcat": "Produce", "lead_time": 1, "moq": 15},
    {"name": "Organic Chia Pudding (200g)", "base_demand": 42, "shelf_life": 6, "price": 3.49, "cost": 1.70, "subcat": "Dairy", "lead_time": 2, "moq": 10},
    {"name": "Brioche Buns (4-pack)", "base_demand": 64, "shelf_life": 5, "price": 3.29, "cost": 1.45, "subcat": "Bakery", "lead_time": 1, "moq": 12},
    {"name": "Fresh Salmon Poke Bowl", "base_demand": 50, "shelf_life": 2, "price": 8.49, "cost": 5.20, "subcat": "ReadyMeals", "lead_time": 1, "moq": 10},
    {"name": "Greek Kalamata Olives (300g)", "base_demand": 56, "shelf_life": 90, "price": 3.99, "cost": 2.10, "subcat": "Deli", "lead_time": 3, "moq": 10},
    {"name": "Organic Blueberries 500g Jumbo", "base_demand": 76, "shelf_life": 4, "price": 6.99, "cost": 4.10, "subcat": "Produce", "lead_time": 1, "moq": 12},
    {"name": "Fresh Guacamole (200g)", "base_demand": 68, "shelf_life": 4, "price": 3.79, "cost": 1.95, "subcat": "Dips", "lead_time": 1, "moq": 12}
]

BEVERAGE_PRODUCTS = [
    {"name": "Pure Sparkling Mineral Water 1L", "base_demand": 190, "shelf_life": 180, "price": 1.49, "cost": 0.60, "subcat": "Water", "lead_time": 2, "moq": 30},
    {"name": "Cold Brew Coffee 330ml", "base_demand": 115, "shelf_life": 30, "price": 3.29, "cost": 1.50, "subcat": "Coffee", "lead_time": 2, "moq": 20},
    {"name": "Fresh Squeezed Orange Juice 1L", "base_demand": 140, "shelf_life": 10, "price": 3.99, "cost": 2.10, "subcat": "Juice", "lead_time": 1, "moq": 15},
    {"name": "Unsweetened Almond Milk 1L", "base_demand": 165, "shelf_life": 90, "price": 2.59, "cost": 1.25, "subcat": "PlantMilk", "lead_time": 3, "moq": 24},
    {"name": "Organic Kombucha Ginger-Lemon 400ml", "base_demand": 85, "shelf_life": 45, "price": 3.79, "cost": 1.90, "subcat": "Functional", "lead_time": 2, "moq": 15},
    {"name": "Electrolyte Energy Drink 500ml", "base_demand": 130, "shelf_life": 120, "price": 2.49, "cost": 1.10, "subcat": "Energy", "lead_time": 2, "moq": 24},
    {"name": "Sparkling Apple Cider 750ml", "base_demand": 60, "shelf_life": 150, "price": 4.29, "cost": 2.10, "subcat": "Juice", "lead_time": 3, "moq": 12},
    {"name": "Oat Milk Barista Edition 1L", "base_demand": 175, "shelf_life": 90, "price": 2.89, "cost": 1.40, "subcat": "PlantMilk", "lead_time": 2, "moq": 24},
    {"name": "Zero Sugar Cola 1.5L", "base_demand": 220, "shelf_life": 180, "price": 2.19, "cost": 0.90, "subcat": "Soda", "lead_time": 2, "moq": 36},
    {"name": "Green Tea with Honey 500ml", "base_demand": 95, "shelf_life": 120, "price": 2.29, "cost": 1.00, "subcat": "Tea", "lead_time": 2, "moq": 20},
    {"name": "Natural Coconut Water 1L", "base_demand": 110, "shelf_life": 90, "price": 3.49, "cost": 1.75, "subcat": "Functional", "lead_time": 2, "moq": 18},
    {"name": "Iced Matcha Latte 330ml", "base_demand": 78, "shelf_life": 21, "price": 3.89, "cost": 2.00, "subcat": "Coffee", "lead_time": 2, "moq": 15},
    {"name": "Classic Lemonade 1.5L", "base_demand": 125, "shelf_life": 60, "price": 2.79, "cost": 1.20, "subcat": "Juice", "lead_time": 2, "moq": 20},
    {"name": "Still Spring Water 500ml (12-pack)", "base_demand": 240, "shelf_life": 365, "price": 5.49, "cost": 2.30, "subcat": "Water", "lead_time": 3, "moq": 20},
    {"name": "Craft Ginger Beer 330ml (4-pack)", "base_demand": 72, "shelf_life": 120, "price": 5.99, "cost": 3.10, "subcat": "Soda", "lead_time": 2, "moq": 12},
    {"name": "Pomegranate Antioxidant Juice 750ml", "base_demand": 65, "shelf_life": 30, "price": 4.89, "cost": 2.65, "subcat": "Juice", "lead_time": 2, "moq": 12},
    {"name": "Protein Shake Vanilla 330ml", "base_demand": 105, "shelf_life": 60, "price": 3.49, "cost": 1.80, "subcat": "Functional", "lead_time": 2, "moq": 18},
    {"name": "Peach Iced Tea 1L", "base_demand": 118, "shelf_life": 90, "price": 2.39, "cost": 1.05, "subcat": "Tea", "lead_time": 2, "moq": 20},
    {"name": "Vitamin Water Dragonfruit 500ml", "base_demand": 88, "shelf_life": 120, "price": 2.49, "cost": 1.15, "subcat": "Energy", "lead_time": 2, "moq": 20},
    {"name": "Cold-Pressed Green Detox Juice 500ml", "base_demand": 58, "shelf_life": 5, "price": 5.49, "cost": 3.20, "subcat": "Juice", "lead_time": 1, "moq": 10},
    {"name": "Tonic Water 4-pack", "base_demand": 68, "shelf_life": 180, "price": 3.99, "cost": 1.90, "subcat": "Soda", "lead_time": 2, "moq": 15},
    {"name": "Soy Milk Organic Unsweetened 1L", "base_demand": 92, "shelf_life": 90, "price": 2.39, "cost": 1.15, "subcat": "PlantMilk", "lead_time": 2, "moq": 20},
    {"name": "Flavored Sparkling Lime 1L", "base_demand": 145, "shelf_life": 180, "price": 1.69, "cost": 0.70, "subcat": "Water", "lead_time": 2, "moq": 25},
    {"name": "Espresso Double Shot Can 250ml", "base_demand": 82, "shelf_life": 90, "price": 2.79, "cost": 1.30, "subcat": "Coffee", "lead_time": 2, "moq": 20},
    {"name": "Grapefruit Soda 1L", "base_demand": 74, "shelf_life": 150, "price": 2.19, "cost": 0.95, "subcat": "Soda", "lead_time": 2, "moq": 15},
    {"name": "Turmeric Wellness Shot 60ml", "base_demand": 62, "shelf_life": 20, "price": 2.99, "cost": 1.40, "subcat": "Functional", "lead_time": 2, "moq": 15},
    {"name": "Organic Tart Cherry Juice 1L", "base_demand": 45, "shelf_life": 45, "price": 6.29, "cost": 3.60, "subcat": "Juice", "lead_time": 3, "moq": 10},
    {"name": "Nitro Cold Brew Vanilla 330ml", "base_demand": 70, "shelf_life": 30, "price": 3.99, "cost": 2.10, "subcat": "Coffee", "lead_time": 2, "moq": 12},
    {"name": "Club Soda 6-pack cans", "base_demand": 130, "shelf_life": 180, "price": 3.49, "cost": 1.50, "subcat": "Water", "lead_time": 2, "moq": 20},
    {"name": "Kombucha Passionfruit 400ml", "base_demand": 76, "shelf_life": 45, "price": 3.79, "cost": 1.90, "subcat": "Functional", "lead_time": 2, "moq": 12},
    {"name": "Diet Lemon Lime Soda 2L", "base_demand": 155, "shelf_life": 180, "price": 2.39, "cost": 0.95, "subcat": "Soda", "lead_time": 2, "moq": 24},
    {"name": "Chai Tea Latte Concentrated 1L", "base_demand": 52, "shelf_life": 60, "price": 4.49, "cost": 2.30, "subcat": "Tea", "lead_time": 2, "moq": 12},
    {"name": "Cold-Pressed Beet & Carrot Juice 500ml", "base_demand": 40, "shelf_life": 6, "price": 5.29, "cost": 3.10, "subcat": "Juice", "lead_time": 1, "moq": 10},
    {"name": "Sparkling Grapefruit Water 8-pack", "base_demand": 110, "shelf_life": 180, "price": 4.99, "cost": 2.30, "subcat": "Water", "lead_time": 3, "moq": 15},
    {"name": "Hazelnut Iced Coffee 330ml", "base_demand": 66, "shelf_life": 30, "price": 3.29, "cost": 1.60, "subcat": "Coffee", "lead_time": 2, "moq": 15},
    {"name": "Wild Berry Protein Smoothie 330ml", "base_demand": 75, "shelf_life": 14, "price": 3.99, "cost": 2.15, "subcat": "Functional", "lead_time": 1, "moq": 12},
    {"name": "Organic Coconut Milk Beverage 1L", "base_demand": 80, "shelf_life": 90, "price": 2.79, "cost": 1.35, "subcat": "PlantMilk", "lead_time": 2, "moq": 18},
    {"name": "Root Beer Craft 4-pack", "base_demand": 55, "shelf_life": 180, "price": 5.49, "cost": 2.80, "subcat": "Soda", "lead_time": 2, "moq": 12},
    {"name": "Hibiscus Herbal Tea 500ml", "base_demand": 64, "shelf_life": 90, "price": 2.49, "cost": 1.10, "subcat": "Tea", "lead_time": 2, "moq": 15},
    {"name": "Cold-Pressed Pineapple Mint 500ml", "base_demand": 48, "shelf_life": 6, "price": 5.19, "cost": 3.00, "subcat": "Juice", "lead_time": 1, "moq": 10},
    {"name": "Sugar-Free Energy Drink 4-pack", "base_demand": 115, "shelf_life": 120, "price": 7.99, "cost": 4.20, "subcat": "Energy", "lead_time": 2, "moq": 15},
    {"name": "Alkaline Water 1L pH 9.5", "base_demand": 85, "shelf_life": 365, "price": 2.29, "cost": 0.95, "subcat": "Water", "lead_time": 3, "moq": 20},
    {"name": "Creamy Caramel Cold Brew 330ml", "base_demand": 72, "shelf_life": 30, "price": 3.49, "cost": 1.70, "subcat": "Coffee", "lead_time": 2, "moq": 12},
    {"name": "Organic Lemon Ginger Tea 1L", "base_demand": 58, "shelf_life": 90, "price": 2.99, "cost": 1.40, "subcat": "Tea", "lead_time": 2, "moq": 15},
    {"name": "Guava Passion Fruit Nectar 1L", "base_demand": 60, "shelf_life": 60, "price": 3.29, "cost": 1.60, "subcat": "Juice", "lead_time": 2, "moq": 12},
    {"name": "Prebiotic Berry Soda 355ml", "base_demand": 65, "shelf_life": 90, "price": 2.99, "cost": 1.45, "subcat": "Functional", "lead_time": 2, "moq": 15},
    {"name": "Elderberry Immune Boost Shot 60ml", "base_demand": 50, "shelf_life": 30, "price": 3.19, "cost": 1.50, "subcat": "Functional", "lead_time": 2, "moq": 12},
    {"name": "Cascara Coffee Berry Tea 330ml", "base_demand": 38, "shelf_life": 60, "price": 3.49, "cost": 1.70, "subcat": "Tea", "lead_time": 2, "moq": 10},
    {"name": "Sparkling Blood Orange 1L", "base_demand": 90, "shelf_life": 150, "price": 1.99, "cost": 0.85, "subcat": "Water", "lead_time": 2, "moq": 20},
    {"name": "Pure Maple Water 500ml", "base_demand": 35, "shelf_life": 90, "price": 3.89, "cost": 2.00, "subcat": "Functional", "lead_time": 2, "moq": 10}
]

def generate_egrocery_data(num_working_days=160, output_dir="data"):
    """
    Generates 160 working days (approx 32 weeks, Mon-Fri) for 100 products.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    start_date = datetime(2025, 12, 1)
    working_dates = []
    curr = start_date
    while len(working_dates) < num_working_days:
        if curr.weekday() < 5:
            working_dates.append(curr)
        curr += timedelta(days=1)
        
    total_days = len(working_dates)
    
    holiday_indices = {18, 19, 45, 88, 89, 130}
    store_closed_indices = {19, 89}
    
    products_master = []
    all_records = []
    
    product_idx = 1
    
    for category, catalog in [("Food", FOOD_PRODUCTS), ("Beverage", BEVERAGE_PRODUCTS)]:
        for p in catalog:
            pid = f"PROD_{product_idx:03d}"
            product_idx += 1
            
            base_d = p["base_demand"]
            shelf_life = p["shelf_life"]
            price = p["price"]
            cost = p["cost"]
            subcat = p["subcat"]
            lead_time = p["lead_time"]
            moq = p["moq"]
            
            init_stock = int(base_d * np.random.uniform(1.0, 2.2))
            
            products_master.append({
                "product_id": pid,
                "name": p["name"],
                "category": category,
                "subcategory": subcat,
                "base_demand": base_d,
                "shelf_life_days": shelf_life,
                "unit_price": price,
                "unit_cost": cost,
                "margin": round(price - cost, 2),
                "margin_pct": round((price - cost) / price * 100, 1),
                "lead_time_days": lead_time,
                "moq": moq,
                "current_stock": init_stock,
                "service_level": 0.95
            })
            
            if category == "Food":
                dow_mult = [1.18, 0.92, 0.90, 1.05, 1.25]
                noise_scale = 0.12
                promo_freq = 0.08
                promo_boost = np.random.uniform(1.4, 1.8)
                preorder_ratio = 0.25
            else:
                dow_mult = [0.95, 0.90, 0.95, 1.10, 1.35]
                noise_scale = 0.16
                promo_freq = 0.14
                promo_boost = np.random.uniform(1.6, 2.2)
                preorder_ratio = 0.15
            
            growth_trend = np.linspace(0.95, 1.08, total_days)
            
            for t, dt in enumerate(working_dates):
                dow = dt.weekday()
                
                is_store_open_tmrw = 0 if (t + 1) in store_closed_indices else 1
                is_store_open_day_after = 0 if (t + 2) in store_closed_indices else 1
                is_holiday_tmrw = 1 if (t + 1) in holiday_indices else 0
                is_holiday_day_after = 1 if (t + 2) in holiday_indices else 0
                
                is_promo = 1 if (np.sin(t * 0.35 + int(pid[-2:])) > 0.82) and (t not in holiday_indices) else 0
                
                temp = round(16 + 8 * np.sin(t / 25.0) + np.random.normal(0, 2), 1)
                rain = 1 if np.random.rand() < 0.25 else 0
                
                weather_mult = 1.0
                if category == "Beverage" and temp > 22:
                    weather_mult += 0.15
                if category == "Food" and rain == 1:
                    weather_mult += 0.08
                    
                closure_mult = 1.0
                if t in store_closed_indices:
                    closure_mult = 0.0
                elif is_store_open_tmrw == 0:
                    closure_mult = 1.45
                elif t > 0 and (t - 1) in store_closed_indices:
                    closure_mult = 1.30
                    
                holiday_mult = 1.0
                if is_holiday_tmrw == 1:
                    holiday_mult = 1.35
                    
                curr_price = price * (0.80 if is_promo else 1.0)
                
                mean_demand = (
                    base_d 
                    * dow_mult[dow] 
                    * growth_trend[t] 
                    * (promo_boost if is_promo else 1.0)
                    * weather_mult
                    * closure_mult
                    * holiday_mult
                )
                
                actual_demand = max(0, int(np.random.normal(mean_demand, mean_demand * noise_scale)))
                if t in store_closed_indices:
                    actual_demand = 0
                    
                pre_orders = int(actual_demand * preorder_ratio * np.random.uniform(0.8, 1.2))
                
                all_records.append({
                    "date": dt.strftime("%Y-%m-%d"),
                    "day_index": t,
                    "product_id": pid,
                    "product_name": p["name"],
                    "category": category,
                    "subcategory": subcat,
                    "day_of_week": dow,
                    "demand": actual_demand,
                    "pre_orders": pre_orders,
                    "store_open_tomorrow": is_store_open_tmrw,
                    "store_open_day_after": is_store_open_day_after,
                    "holiday_tomorrow": is_holiday_tmrw,
                    "holiday_day_after": is_holiday_day_after,
                    "is_promo": is_promo,
                    "unit_price": round(curr_price, 2),
                    "unit_cost": cost,
                    "weather_temp": temp,
                    "weather_rain": rain,
                    "shelf_life_days": shelf_life,
                    "lead_time_days": lead_time,
                    "moq": moq
                })
                
    df_sales = pd.DataFrame(all_records)
    df_products = pd.DataFrame(products_master)
    
    sales_path = os.path.join(output_dir, "egrocery_sales_history.csv")
    products_path = os.path.join(output_dir, "products_catalog.json")
    
    df_sales.to_csv(sales_path, index=False)
    with open(products_path, "w") as f:
        json.dump(products_master, f, indent=2)
        
    print(f"Generated {len(df_sales)} daily sales records across {len(products_master)} products.")
    return df_sales, df_products

if __name__ == "__main__":
    import sys
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "data"
    generate_egrocery_data(num_working_days=160, output_dir=out_dir)
