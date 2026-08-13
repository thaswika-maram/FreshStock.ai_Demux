import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp, ShieldAlert, Sparkles, Calendar, Layers, Activity, Clock, CheckCircle, Database, AlertTriangle, Ban } from 'lucide-react';
import { Product, StockPlan, UserProfile } from '../types';
import { api } from '../api';
import { useTranslation } from '../i18n/LanguageContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ForecastExplorerProps {
  products: Product[];
  selectedProduct?: Product | null;
  currentUser?: UserProfile;
  onSelectProduct: (p: Product) => void;
  onNavigateToDataHub?: () => void;
}

export const ForecastExplorer: React.FC<ForecastExplorerProps> = ({
  products,
  selectedProduct,
  currentUser,
  onSelectProduct,
  onNavigateToDataHub
}) => {
  const { t } = useTranslation();
  const [stockPlan, setStockPlan] = useState<StockPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState('');

  // Baseline toggles
  const [showMedian, setShowMedian] = useState(true);
  const [showExpSmooth, setShowExpSmooth] = useState(false);
  const [showLastWeek, setShowLastWeek] = useState(false);
  const [showConfidenceBands, setShowConfidenceBands] = useState(true);

  useEffect(() => {
    if (!selectedProduct) {
      setStockPlan(null);
      setLoading(false);
      return;
    }
    let isMounted = true;
    setLoading(true);
    api.getProductForecast(selectedProduct.product_id, currentUser?.user_id).then(plan => {
      if (isMounted) {
        setStockPlan(plan);
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [selectedProduct?.product_id, currentUser?.user_id]);

  if (!selectedProduct || products.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <TrendingUp size={44} color="#10b981" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>
            No Product Demand Forecasts Available
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 20 }}>
            Upload a CSV dataset in Data Hub to visualize 5-day neural demand predictions, confidence intervals, and comparison against historical baselines.
          </p>
          {onNavigateToDataHub && (
            <button className="btn btn-primary" onClick={onNavigateToDataHub}>
              Go to Data Hub & Ingest CSV
            </button>
          )}
        </div>
      </div>
    );
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.product_id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Prepare Chart.js datasets
  const historyDates = stockPlan?.recent_history?.dates || ['Day -5', 'Day -4', 'Day -3', 'Day -2', 'Day -1'];
  const historyDemand = stockPlan?.recent_history?.demand || [120, 140, 110, 135, 150];

  const forecastDays = ['Mon (Fc)', 'Tue (Fc)', 'Wed (Fc)', 'Thu (Fc)', 'Fri (Fc)'];
  const allLabels = [...historyDates, ...forecastDays];

  const numHist = historyDates.length;

  // History line (null for forecast days)
  const historySeries = [...historyDemand, ...Array(5).fill(null)];

  // LSTM Forecast line (starts from last history point)
  const lastHistVal = historyDemand[historyDemand.length - 1];
  const lstmFc = stockPlan?.daily_plans.map(d => d.forecast_units) || [145, 130, 128, 150, 175];
  const lstmSeries = [...Array(numHist - 1).fill(null), lastHistVal, ...lstmFc];

  // 95% Confidence Bounds (Upper & Lower)
  const ciLow = stockPlan?.daily_plans.map(d => d.ci_lower) || [115, 105, 100, 120, 140];
  const ciHigh = stockPlan?.daily_plans.map(d => d.ci_upper) || [175, 155, 156, 180, 210];

  const ciLowSeries = [...Array(numHist - 1).fill(null), lastHistVal, ...ciLow];
  const ciHighSeries = [...Array(numHist - 1).fill(null), lastHistVal, ...ciHigh];

  // Baseline lines
  const medianFc = stockPlan?.baselines?.median_4w || [140, 125, 120, 142, 168];
  const expSmoothFc = stockPlan?.baselines?.exp_smoothing || [138, 138, 138, 138, 138];
  const lastWeekFc = stockPlan?.baselines?.last_week || [142, 130, 126, 145, 172];

  const medianSeries = [...Array(numHist - 1).fill(null), lastHistVal, ...medianFc];
  const expSmoothSeries = [...Array(numHist - 1).fill(null), lastHistVal, ...expSmoothFc];
  const lastWeekSeries = [...Array(numHist - 1).fill(null), lastHistVal, ...lastWeekFc];

  const datasets: any[] = [
    {
      label: 'Actual Past Sales (Past 15 Days)',
      data: historySeries,
      borderColor: '#94a3b8',
      backgroundColor: 'rgba(148, 163, 184, 0.1)',
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.3
    },
    {
      label: 'AI Sales Forecast (Next 5 Days)',
      data: lstmSeries,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      borderWidth: 3.5,
      pointRadius: 6,
      pointBackgroundColor: '#10b981',
      tension: 0.3
    }
  ];

  if (showConfidenceBands) {
    datasets.push(
      {
        label: 'Best Case Sales (+95% Upper)',
        data: ciHighSeries,
        borderColor: 'rgba(6, 182, 212, 0.5)',
        backgroundColor: 'rgba(6, 182, 212, 0.12)',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: '+1', // Fill down to lower bound
        tension: 0.3
      },
      {
        label: 'Worst Case Sales (-95% Lower)',
        data: ciLowSeries,
        borderColor: 'rgba(6, 182, 212, 0.5)',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        tension: 0.3
      }
    );
  }

  if (showMedian) {
    datasets.push({
      label: '4-Week Past Average',
      data: medianSeries,
      borderColor: '#f59e0b',
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 3,
      pointBackgroundColor: '#f59e0b',
      tension: 0.2
    });
  }

  if (showExpSmooth) {
    datasets.push({
      label: 'Simple Trend Average',
      data: expSmoothSeries,
      borderColor: '#ec4899',
      borderWidth: 2,
      borderDash: [3, 3],
      pointRadius: 2,
      tension: 0.1
    });
  }

  if (showLastWeek) {
    datasets.push({
      label: 'Same Day Last Week',
      data: lastWeekSeries,
      borderColor: '#8b5cf6',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 2,
      tension: 0.2
    });
  }

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#cbd5e1',
          font: { family: 'Outfit', size: 12 },
          usePointStyle: true,
          boxWidth: 8
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#ffffff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 11 } }
      }
    }
  };

  const getDayChipClass = (dayName: string) => {
    const d = dayName.toLowerCase();
    if (d.includes('mon')) return 'day-chip-mon';
    if (d.includes('tue')) return 'day-chip-tue';
    if (d.includes('wed')) return 'day-chip-wed';
    if (d.includes('thu')) return 'day-chip-thu';
    return 'day-chip-fri';
  };

  return (
    <div className="forecast-layout">
      {/* Product Selector Sidebar */}
      <div className="card" style={{ height: 'fit-content' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          🏷️ Select Product ({products.length})
        </h3>

        <div style={{ marginBottom: 14 }}>
          <input
            type="text"
            className="search-input"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              width: '100%'
            }}
            placeholder="Search items..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
          />
        </div>

        <div className="product-selector-list">
          {filteredProducts.map(p => {
            const isSelected = p.product_id === selectedProduct.product_id;
            return (
              <div
                key={p.product_id}
                className={`product-item-card ${isSelected ? 'selected' : ''}`}
                style={{
                  borderLeft: isSelected ? '3px solid #10b981' : undefined
                }}
                onClick={() => onSelectProduct(p)}
              >
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: isSelected ? '#ffffff' : '#e2e8f0' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    {p.product_id} • {p.category === 'Food' ? '🥗 Food' : '🥤 Drink'}
                  </div>
                </div>
                <span className={`pill ${p.category === 'Food' ? 'pill-food' : 'pill-beverage'}`}>
                  {p.current_stock} in stock
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Forecast Explorer Chart & Daily Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Product Profile Banner */}
        <div className="card" style={{ padding: '22px 24px', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(16, 185, 129, 0.08))', borderColor: 'rgba(6, 182, 212, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff' }}>{selectedProduct.name}</h2>
                <span className={`pill ${selectedProduct.category === 'Food' ? 'pill-food' : 'pill-beverage'}`}>
                  {selectedProduct.category === 'Food' ? t('freshFood') : t('drinks')}
                </span>
                {selectedProduct.shelf_life_days <= 4 && (
                  <span className="pill pill-warning" style={{ fontWeight: 600 }}>
                    <ShieldAlert size={13} /> {t('freshShortLife')} ({selectedProduct.shelf_life_days} {t('days')})
                  </span>
                )}
              </div>
              <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: 6 }}>
                {t('sellingPrice')} <strong style={{ color: '#ffffff' }}>₹{selectedProduct.unit_price.toFixed(2)}</strong> • {t('wholesaleCost')} <strong style={{ color: '#ffffff' }}>₹{selectedProduct.unit_cost.toFixed(2)}</strong> • {t('profitMargin')} <strong style={{ color: '#10b981' }}>{selectedProduct.margin_pct}%</strong>
              </p>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>{t('stockInStore')}</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff' }}>{selectedProduct.current_stock} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#94a3b8' }}>{t('units')}</span></div>
              </div>
              <div style={{ textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.12)', paddingLeft: 16 }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>{t('suggested5DayOrder')}</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981' }}>{stockPlan?.total_recommended_order || 0} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#a7f3d0' }}>{t('units')}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Alert Callout Banner if item is Low Stock or Do Not Buy */}
        {(() => {
          const dailyDemand = (selectedProduct.weekly_forecast ? selectedProduct.weekly_forecast / 5.0 : selectedProduct.base_demand) || 10;
          const daysOfStock = Number((selectedProduct.days_of_stock_remaining ?? (selectedProduct.current_stock / Math.max(1, dailyDemand))).toFixed(1));
          const isLowStock = selectedProduct.stockout_warning || selectedProduct.stock_alert_status === 'CRITICAL_LOW' || selectedProduct.stock_alert_status === 'OUT_OF_STOCK' || daysOfStock <= 2.0 || ((stockPlan?.total_recommended_order || 0) > 0 && selectedProduct.current_stock < dailyDemand * 2);
          const isDoNotBuy = selectedProduct.do_not_buy_warning || selectedProduct.stock_alert_status === 'OVERSTOCK_DO_NOT_BUY' || daysOfStock >= 7.0 || (selectedProduct.shelf_life_days <= 4 && selectedProduct.current_stock > dailyDemand * 4 && (stockPlan?.total_recommended_order || 0) === 0);

          if (isDoNotBuy) {
            return (
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(244, 63, 94, 0.10))',
                border: '1px solid rgba(245, 158, 11, 0.45)',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14
              }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', flexShrink: 0 }}>
                  <Ban size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '0.95rem' }}>
                    {t('storeAdviceDoNotBuy')}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: 2 }}>
                    {t('storeAdviceDoNotBuyDesc', { demand: Math.round(dailyDemand), stock: selectedProduct.current_stock, days: daysOfStock })}
                  </div>
                </div>
              </div>
            );
          }

          if (isLowStock) {
            return (
              <div style={{
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.16), rgba(239, 68, 68, 0.08))',
                border: '1px solid rgba(244, 63, 94, 0.45)',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14
              }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(244, 63, 94, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fb7185', flexShrink: 0 }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: '#fb7185', fontSize: '0.95rem' }}>
                    {t('lowStockWarningTitle')}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: 2 }}>
                    {t('lowStockWarningDesc', { stock: selectedProduct.current_stock, demand: Math.round(dailyDemand), days: daysOfStock, order: stockPlan?.total_recommended_order || selectedProduct.moq || 20 })}
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })()}

        {/* Chart View */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={20} color="#10b981" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('dailyDemandForecastTitle')}</h3>
            </div>

            {/* Baseline Toggles */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                className={`btn btn-sm ${showConfidenceBands ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  background: showConfidenceBands ? 'linear-gradient(135deg, #06b6d4, #3b82f6)' : undefined,
                  borderColor: 'rgba(6, 182, 212, 0.4)'
                }}
                onClick={() => setShowConfidenceBands(!showConfidenceBands)}
              >
                🔵 {t('bestWorstRange')}
              </button>
              <button
                className={`btn btn-sm ${showMedian ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  background: showMedian ? 'linear-gradient(135deg, #f59e0b, #d97706)' : undefined,
                  borderColor: 'rgba(245, 158, 11, 0.4)'
                }}
                onClick={() => setShowMedian(!showMedian)}
              >
                🟡 {t('fourWeekAverage')}
              </button>
              <button
                className={`btn btn-sm ${showLastWeek ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  background: showLastWeek ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : undefined,
                  borderColor: 'rgba(139, 92, 246, 0.4)'
                }}
                onClick={() => setShowLastWeek(!showLastWeek)}
              >
                🟣 {t('lastWeek')}
              </button>
              <button
                className={`btn btn-sm ${showExpSmooth ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  background: showExpSmooth ? 'linear-gradient(135deg, #ec4899, #be185d)' : undefined,
                  borderColor: 'rgba(236, 72, 153, 0.4)'
                }}
                onClick={() => setShowExpSmooth(!showExpSmooth)}
              >
                🌸 {t('simpleTrend')}
              </button>
            </div>
          </div>

          <div style={{ height: '360px', width: '100%', position: 'relative' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                Calculating AI demand predictions...
              </div>
            ) : (
              <Line data={{ labels: allLabels, datasets }} options={chartOptions} />
            )}
          </div>

          {/* Daily Breakdown Cards (Mon-Fri) with vibrant colors */}
          <div className="daily-breakdown-grid" style={{ marginTop: 20 }}>
            {stockPlan?.daily_plans.map((dp, idx) => {
              const dayNameKey = dp.day_name.toLowerCase();
              const translatedDay = t(dayNameKey) || dp.day_name;
              return (
                <div key={idx} className="daily-card" style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '16px 14px',
                  transition: 'transform 0.15s, border-color 0.15s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span className={`day-chip ${getDayChipClass(dp.day_name)}`}>
                      {translatedDay}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Day {idx + 1}</span>
                  </div>

                  <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: 2 }}>{t('expectedSalesCard')}:</div>
                  <div className="daily-card-fc" style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: 800, marginBottom: 4 }}>
                    {Math.round(dp.forecast_units)} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#38bdf8' }}>{t('units')}</span>
                  </div>

                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: 4 }}>
                    Safe Range: <strong style={{ color: '#cbd5e1' }}>{dp.confidence_range}</strong>
                  </div>

                  <div style={{ fontSize: '0.74rem', color: '#c084fc', marginBottom: 8 }}>
                    {t('safetyStockBuffer')}: <strong>+{dp.safety_stock_buffer} {t('units')}</strong>
                  </div>

                  <div className="daily-card-order" style={{
                    background: dp.recommended_order > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: dp.recommended_order > 0 ? '#10b981' : '#94a3b8',
                    border: dp.recommended_order > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}>
                    {dp.recommended_order > 0 ? `🛒 ${t('orderNow')}: ${dp.recommended_order} ${t('units')}` : t('sufficientStock')}
                  </div>

                  {dp.spoilage_risk && (
                    <div style={{ fontSize: '0.7rem', color: '#fbbf24', marginTop: 6, fontWeight: 600 }}>
                      ⚠️ {t('wasteTrimmed')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature Impact Context Card */}
        <div className="card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="#06b6d4" /> Factors Influencing Customer Sales for this Item
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '14px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.76rem', color: '#a7f3d0' }}>Store Open Status</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginTop: 2 }}>Open (Normal Shopping Day)</div>
            </div>
            <div style={{ background: 'rgba(6, 182, 212, 0.06)', border: '1px solid rgba(6, 182, 212, 0.2)', padding: '14px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.76rem', color: '#bae6fd' }}>Public Holiday Effect</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginTop: 2 }}>No major holiday in next 48h</div>
            </div>
            <div style={{ background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '14px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.76rem', color: '#ddd6fe' }}>Active Special Promo</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginTop: 2 }}>Standard Retail Price</div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '14px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.76rem', color: '#fde68a' }}>Weather & Temperature</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginTop: 2 }}>22°C (Pleasant / Regular)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
