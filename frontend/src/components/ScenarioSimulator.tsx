import React, { useState, useEffect } from 'react';
import { Sliders, Sparkles, TrendingUp, AlertCircle, ArrowRight, RotateCcw } from 'lucide-react';
import { Product, StockPlan, UserProfile } from '../types';
import { api } from '../api';
import { useTranslation } from '../i18n/LanguageContext';

interface ScenarioSimulatorProps {
  products: Product[];
  selectedProduct?: Product | null;
  currentUser?: UserProfile;
  onSelectProduct: (p: Product) => void;
  onNavigateToDataHub?: () => void;
}

export const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({
  products,
  selectedProduct,
  currentUser,
  onSelectProduct,
  onNavigateToDataHub
}) => {
  const { t } = useTranslation();
  const [promoDiscount, setPromoDiscount] = useState<number>(20);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [storeClosedFriday, setStoreClosedFriday] = useState<boolean>(false);
  const [holidayWednesday, setHolidayWednesday] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<number>(25);
  const [weatherRain, setWeatherRain] = useState<boolean>(false);
  const [serviceLevel, setServiceLevel] = useState<number>(0.95);

  const [simulatedPlan, setSimulatedPlan] = useState<StockPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const runSimulation = () => {
    if (!selectedProduct) return;
    setLoading(true);
    api.simulateScenario({
      product_id: selectedProduct.product_id,
      promo_discount_pct: promoDiscount,
      is_store_closed_friday: storeClosedFriday,
      holiday_on_wednesday: holidayWednesday,
      price_change_pct: priceChange,
      weather_temp_celsius: temperature,
      weather_rain: weatherRain,
      safety_stock_service_level: serviceLevel
    }, currentUser?.user_id).then(res => {
      setSimulatedPlan(res);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!selectedProduct) {
      setSimulatedPlan(null);
      return;
    }
    runSimulation();
  }, [selectedProduct?.product_id, currentUser?.user_id, promoDiscount, priceChange, storeClosedFriday, holidayWednesday, temperature, weatherRain, serviceLevel]);

  if (!selectedProduct || products.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <Sliders size={44} color="#10b981" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>
            No Product Selected for Simulation
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 20 }}>
            {t('emptyWorkspaceDesc')}
          </p>
          {onNavigateToDataHub && (
            <button className="btn btn-primary" onClick={onNavigateToDataHub}>
              {t('uploadSalesCsv')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const handleReset = () => {
    setPromoDiscount(0);
    setPriceChange(0);
    setStoreClosedFriday(false);
    setHolidayWednesday(false);
    setTemperature(22);
    setWeatherRain(false);
    setServiceLevel(0.95);
  };

  const deltaUnits = simulatedPlan?.baseline_comparison?.delta_units || 0;
  const deltaPct = simulatedPlan?.baseline_comparison?.delta_pct || 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
      {/* Simulation Controls Panel */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={20} color="#10b981" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('storeScenarioControls')}</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleReset} title="Reset all sliders to normal">
            <RotateCcw size={13} /> {t('resetToNormal')}
          </button>
        </div>

        {/* Product Selector */}
        <div className="form-group" style={{ marginBottom: 18 }}>
          <label className="form-label">{t('selectItemToTest')}</label>
          <select
            className="form-select"
            value={selectedProduct.product_id}
            onChange={e => {
              const p = products.find(prod => prod.product_id === e.target.value);
              if (p) onSelectProduct(p);
            }}
          >
            {products.map(p => (
              <option key={p.product_id} value={p.product_id}>
                {p.name} ({p.category === 'Food' ? t('freshFood') : t('drinks')})
              </option>
            ))}
          </select>
        </div>

        {/* Promo Discount Slider */}
        <div className="slider-group">
          <div className="slider-header">
            <span style={{ color: '#cbd5e1' }}>🏷️ Tuesday Special Discount Sale</span>
            <span style={{ color: '#38bdf8', fontWeight: 800 }}>{promoDiscount}% OFF</span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="5"
            className="range-slider"
            value={promoDiscount}
            onChange={e => setPromoDiscount(parseInt(e.target.value))}
          />
          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
            Simulates customer buying rush from running a Tuesday discount deal
          </span>
        </div>

        {/* Price Adjustment Slider */}
        <div className="slider-group">
          <div className="slider-header">
            <span style={{ color: '#cbd5e1' }}>💵 Change Regular Selling Price</span>
            <span style={{ color: priceChange > 0 ? '#fb7185' : (priceChange < 0 ? '#10b981' : '#ffffff'), fontWeight: 800 }}>
              {priceChange > 0 ? `+${priceChange}% (Price Hike)` : (priceChange < 0 ? `${priceChange}% (Discount)` : '0% (Standard)')}
            </span>
          </div>
          <input
            type="range"
            min="-30"
            max="30"
            step="5"
            className="range-slider"
            value={priceChange}
            onChange={e => setPriceChange(parseInt(e.target.value))}
          />
          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
            Higher prices reduce demand slightly; lower prices increase volume
          </span>
        </div>

        {/* Temperature Slider */}
        <div className="slider-group">
          <div className="slider-header">
            <span style={{ color: '#cbd5e1' }}>☀️ Weather Temperature</span>
            <span style={{ color: '#f59e0b', fontWeight: 800 }}>{temperature}°C</span>
          </div>
          <input
            type="range"
            min="10"
            max="38"
            step="1"
            className="range-slider"
            value={temperature}
            onChange={e => setTemperature(parseInt(e.target.value))}
          />
          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
            Hotter days boost cold drink & beverage sales by +20%
          </span>
        </div>

        {/* Store Closed on Friday Toggle */}
        <div className="toggle-row">
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff' }}>🚪 Store Closed on Friday</div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Customers shop more on Thursday rush</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={storeClosedFriday}
              onChange={e => setStoreClosedFriday(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {/* Holiday on Wednesday Toggle */}
        <div className="toggle-row">
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff' }}>🏖️ Public Holiday on Wednesday</div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Increases grocery shopping before the holiday</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={holidayWednesday}
              onChange={e => setHolidayWednesday(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {/* Rainy Weather Toggle */}
        <div className="toggle-row">
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff' }}>🌧️ Heavy Rain Forecasted</div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Boosts comfort food & delivery orders</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={weatherRain}
              onChange={e => setWeatherRain(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      {/* Simulation Results View */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Simulation Impact Banner */}
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(139, 92, 246, 0.12))', borderColor: 'rgba(6, 182, 212, 0.35)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <span className="pill pill-beverage" style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={13} /> Simulation Results
              </span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
                {selectedProduct.name} — Test Outcome
              </h2>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginTop: 4 }}>
                {promoDiscount > 0 && `Running ${promoDiscount}% discount promotion. `}
                {storeClosedFriday && `Friday closure active. `}
                {holidayWednesday && `Wednesday holiday surge active. `}
                {priceChange !== 0 && `Price shifted by ${priceChange}%. `}
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Sales Impact vs Normal</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: deltaUnits >= 0 ? '#10b981' : '#fb7185' }}>
                {deltaUnits >= 0 ? `+${deltaUnits}` : deltaUnits} units ({deltaPct >= 0 ? `+${deltaPct}%` : `${deltaPct}%`})
              </div>
            </div>
          </div>
        </div>

        {/* 3 Quick Impact Metric Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div className="kpi-card kpi-cyan" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Total 5-Day Expected Demand</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
              {Math.round(simulatedPlan?.total_5d_forecast || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: '#38bdf8' }}>units</span>
            </div>
          </div>

          <div className="kpi-card kpi-emerald" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Adjusted Supplier Order</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: 4 }}>
              {Math.round(simulatedPlan?.total_recommended_order || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: '#a7f3d0' }}>units</span>
            </div>
          </div>

          <div className="kpi-card kpi-violet" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Projected Store Revenue</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c084fc', marginTop: 4 }}>
              ₹{Math.round(simulatedPlan?.projected_revenue || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Daily Simulated Plan Table */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
            📅 Simulated Daily Restock Plan
          </h3>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Customer Demand</th>
                  <th>Safe Range (Low - High)</th>
                  <th>Extra Buffer</th>
                  <th>Opening Stock</th>
                  <th>Suggested Order to Buy</th>
                  <th>Stock Status</th>
                </tr>
              </thead>
              <tbody>
                {simulatedPlan?.daily_plans.map((dp, idx) => (
                  <tr key={idx}>
                    <td>
                      <span style={{ fontWeight: 700, color: '#ffffff' }}>{dp.day_name}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8' }}>
                        {Math.round(dp.forecast_units)}
                      </span> <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>units</span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#cbd5e1', fontSize: '0.85rem' }}>
                        {dp.confidence_range}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#c084fc', fontWeight: 700 }}>+{dp.safety_stock_buffer}</span>
                    </td>
                    <td>
                      <span>{dp.beginning_stock} units</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: dp.recommended_order > 0 ? '#10b981' : '#64748b' }}>
                        {dp.recommended_order > 0 ? `${dp.recommended_order} units` : '0 (Sufficient)'}
                      </span>
                    </td>
                    <td>
                      {dp.spoilage_risk ? (
                        <span className="pill pill-warning">⚠️ Trimmed for Freshness</span>
                      ) : (
                        <span className="badge-instock">✓ Balanced</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
