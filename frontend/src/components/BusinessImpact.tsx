import React, { useState, useEffect } from 'react';
import { DollarSign, Trash2, ShoppingCart, Percent, TrendingUp, CheckCircle, HelpCircle, Upload, ArrowRight, Database } from 'lucide-react';
import { BusinessImpact as BusinessImpactType, Product, UserProfile } from '../types';
import { api } from '../api';

interface BusinessImpactProps {
  currentUser?: UserProfile;
  products?: Product[];
  onNavigateToDataHub?: () => void;
}

export const BusinessImpact: React.FC<BusinessImpactProps> = ({
  currentUser,
  products = [],
  onNavigateToDataHub
}) => {
  const [impact, setImpact] = useState<BusinessImpactType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Custom simulation variables for interactive ROI testing
  const [storeMultiplier, setStoreMultiplier] = useState<number>(1.0);
  const [holdingCostRate, setHoldingCostRate] = useState<number>(currentUser?.holding_cost_annual_pct || 22);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    api.getBusinessImpact(currentUser?.user_id).then(res => {
      if (isMounted) {
        setImpact(res);
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [currentUser?.user_id]);

  if (loading || !impact) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
        Calculating financial ROI and business impact...
      </div>
    );
  }

  if (products.length === 0 || impact.weekly_total_savings === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <DollarSign size={48} color="#10b981" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginBottom: 8 }}>
            No Financial ROI Data Available
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: 24 }}>
            Business impact, waste reduction, and projected savings are calculated based on your store's uploaded product catalog and demand history. Upload your sales CSV to unlock detailed financial projections.
          </p>
          {onNavigateToDataHub && (
            <button className="btn btn-primary" onClick={onNavigateToDataHub}>
              <Upload size={16} />
              <span>Go to Data Hub & Upload CSV</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Adjust values based on interactive sliders
  const weeklySpoilage = Math.round(impact.weekly_spoilage_saved * storeMultiplier);
  const weeklyLostSales = Math.round(impact.weekly_lost_sales_protected * storeMultiplier);
  const weeklyHolding = Math.round(impact.weekly_holding_cost_saved * storeMultiplier * (holdingCostRate / 22.0));
  const weeklyTotal = weeklySpoilage + weeklyLostSales + weeklyHolding;
  const annualTotal = weeklyTotal * 52;
  const annualMlCost = Math.round(impact.annual_ml_system_cost * (storeMultiplier > 3 ? 1.5 : 1.0));
  const netAnnualProfit = annualTotal - annualMlCost;
  const roiPct = Math.round((netAnnualProfit / annualMlCost) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Executive Financial Statement Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.14))', borderColor: 'rgba(16, 185, 129, 0.45)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ maxWidth: '800px' }}>
            <div className="pill pill-food" style={{ marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              💰 Store Profit & Savings Summary
            </div>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.3 }}>
              Total Weekly Money Saved: <span style={{ color: '#10b981' }}>+₹{weeklyTotal.toLocaleString()} / week</span>
            </h2>
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginTop: 8, lineHeight: 1.6 }}>
              By replacing human guesswork with smart AI order recommendations, your store recovers <strong>₹{annualTotal.toLocaleString()} every year</strong> from stopped food spoilage, extra sales captured, and lower storage costs!
            </p>
          </div>

          <div style={{ textAlign: 'right', background: 'rgba(0,0,0,0.35)', padding: '18px 26px', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Projected Annual Profit</div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#10b981' }}>
              +₹{netAnnualProfit.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 700, marginTop: 2 }}>
              {roiPct.toLocaleString()}% Return on Investment (ROI)
            </div>
          </div>
        </div>
      </div>

      {/* 3 Core Value Pillars Grid */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-emerald">
          <div className="kpi-header">
            <span className="kpi-title" style={{ color: '#a7f3d0' }}>1. Food Waste & Spoilage Saved</span>
            <div className="kpi-icon emerald"><Trash2 size={20} /></div>
          </div>
          <div className="kpi-value" style={{ color: '#10b981' }}>+₹{weeklySpoilage.toLocaleString()} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>/ wk</span></div>
          <div className="kpi-subtext">
            <span style={{ color: '#cbd5e1' }}>Stops over-ordering short-life items (produce, dairy, bakery) so food doesn't rot on shelves</span>
          </div>
        </div>

        <div className="kpi-card kpi-cyan">
          <div className="kpi-header">
            <span className="kpi-title" style={{ color: '#bae6fd' }}>2. Extra Sales Captured</span>
            <div className="kpi-icon cyan"><ShoppingCart size={20} /></div>
          </div>
          <div className="kpi-value" style={{ color: '#38bdf8' }}>+₹{weeklyLostSales.toLocaleString()} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>/ wk</span></div>
          <div className="kpi-subtext">
            <span style={{ color: '#cbd5e1' }}>Eliminates empty shelves by anticipating weekend rushes and promotional demand spikes</span>
          </div>
        </div>

        <div className="kpi-card kpi-violet">
          <div className="kpi-header">
            <span className="kpi-title" style={{ color: '#ddd6fe' }}>3. Warehouse & Storage Saved</span>
            <div className="kpi-icon violet"><Percent size={20} /></div>
          </div>
          <div className="kpi-value" style={{ color: '#c084fc' }}>+₹{weeklyHolding.toLocaleString()} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>/ wk</span></div>
          <div className="kpi-subtext">
            <span style={{ color: '#cbd5e1' }}>Accurate demand forecasts free up ~25% backroom storage space and working cash</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown & ROI Calculator */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Category Contribution Table */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
            📊 Savings Breakdown by Department
          </h3>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Spoilage Saved</th>
                  <th>Extra Sales</th>
                  <th>Storage Saved</th>
                  <th>Total Weekly Profit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="pill pill-food">🥗 Fresh Food</span>
                  </td>
                  <td style={{ color: '#10b981', fontWeight: 700 }}>+₹{Math.round(impact.category_breakdown.Food.spoilage_saved * storeMultiplier).toLocaleString()}</td>
                  <td style={{ color: '#38bdf8', fontWeight: 600 }}>+₹{Math.round(impact.category_breakdown.Food.lost_sales_saved * storeMultiplier).toLocaleString()}</td>
                  <td>+₹{Math.round(impact.category_breakdown.Food.holding_saved * storeMultiplier).toLocaleString()}</td>
                  <td style={{ fontWeight: 800, color: '#10b981', fontSize: '1.05rem' }}>
                    +₹{Math.round((impact.category_breakdown.Food.spoilage_saved + impact.category_breakdown.Food.lost_sales_saved + impact.category_breakdown.Food.holding_saved) * storeMultiplier).toLocaleString()}
                  </td>
                </tr>

                <tr>
                  <td>
                    <span className="pill pill-beverage">🥤 Drinks & Beverages</span>
                  </td>
                  <td style={{ color: '#10b981', fontWeight: 700 }}>+₹{Math.round(impact.category_breakdown.Beverage.spoilage_saved * storeMultiplier).toLocaleString()}</td>
                  <td style={{ color: '#38bdf8', fontWeight: 600 }}>+₹{Math.round(impact.category_breakdown.Beverage.lost_sales_saved * storeMultiplier).toLocaleString()}</td>
                  <td>+₹{Math.round(impact.category_breakdown.Beverage.holding_saved * storeMultiplier).toLocaleString()}</td>
                  <td style={{ fontWeight: 800, color: '#10b981', fontSize: '1.05rem' }}>
                    +₹{Math.round((impact.category_breakdown.Beverage.spoilage_saved + impact.category_breakdown.Beverage.lost_sales_saved + impact.category_breakdown.Beverage.holding_saved) * storeMultiplier).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Interactive Store Multiplier & Holding Rate Slider */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
            🏬 Test Savings for Your Store Size
          </h3>

          <div className="slider-group">
            <div className="slider-header">
              <span style={{ color: '#cbd5e1' }}>Number of Store Locations</span>
              <span style={{ color: '#10b981', fontWeight: 800 }}>
                {storeMultiplier === 1 ? '1 Store (Single Shop)' : `${storeMultiplier} Stores (Chain)`}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              className="range-slider"
              value={storeMultiplier}
              onChange={e => setStoreMultiplier(parseInt(e.target.value))}
            />
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span style={{ color: '#cbd5e1' }}>Storage & Shelf Cost Rate</span>
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>{holdingCostRate}% / year</span>
            </div>
            <input
              type="range"
              min="10"
              max="35"
              step="1"
              className="range-slider"
              value={holdingCostRate}
              onChange={e => setHoldingCostRate(parseInt(e.target.value))}
            />
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', marginTop: 16, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.88rem' }}>
              <span style={{ color: '#94a3b8' }}>AI Cloud System Running Cost:</span>
              <span style={{ color: '#fb7185', fontWeight: 600 }}>-₹{annualMlCost.toLocaleString()} / year</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
              <span style={{ fontWeight: 700 }}>AI Investment Verdict:</span>
              <span style={{ fontWeight: 800, color: '#10b981' }}>✅ Massive Gain ({roiPct}% Net Profit)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
