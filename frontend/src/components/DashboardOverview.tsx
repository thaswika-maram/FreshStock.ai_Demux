import React from 'react';
import { Package, DollarSign, AlertTriangle, ShieldCheck, TrendingUp, Sparkles, Upload, ArrowRight, Database } from 'lucide-react';
import { Product, BusinessImpact, EvaluationReport } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface DashboardOverviewProps {
  products: Product[];
  businessImpact?: BusinessImpact;
  evaluation?: EvaluationReport;
  selectedProduct?: Product;
  onNavigateToDataHub?: () => void;
  onOpenAlerts?: () => void;
  onFilterLowStock?: () => void;
  onFilterDoNotBuy?: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  products,
  businessImpact,
  evaluation,
  selectedProduct,
  onNavigateToDataHub,
  onOpenAlerts,
  onFilterLowStock,
  onFilterDoNotBuy
}) => {
  const { t } = useTranslation();

  // Aggregate KPIs
  const totalWeeklyForecast = products.reduce((acc, p) => acc + (p.weekly_forecast || 0), 0);
  const totalReorderUnits = products.reduce((acc, p) => acc + (p.weekly_reorder_units || 0), 0);
  const totalProcurementCost = products.reduce((acc, p) => acc + ((p.weekly_reorder_units || 0) * p.unit_cost), 0);
  
  // Compute smart alerts
  const lowStockItems = products.filter(p => {
    const dailyDemand = (p.weekly_forecast ? p.weekly_forecast / 5.0 : p.base_demand) || 10;
    const daysLeft = p.days_of_stock_remaining ?? (p.current_stock / Math.max(1, dailyDemand));
    return p.stockout_warning || p.stock_alert_status === 'CRITICAL_LOW' || p.stock_alert_status === 'OUT_OF_STOCK' || daysLeft <= 2.0 || ((p.weekly_reorder_units || 0) > 0 && p.current_stock < dailyDemand * 2);
  });

  const doNotBuyItems = products.filter(p => {
    const dailyDemand = (p.weekly_forecast ? p.weekly_forecast / 5.0 : p.base_demand) || 10;
    const daysLeft = p.days_of_stock_remaining ?? (p.current_stock / Math.max(1, dailyDemand));
    return p.do_not_buy_warning || p.stock_alert_status === 'OVERSTOCK_DO_NOT_BUY' || daysLeft >= 7.0 || (p.shelf_life_days <= 4 && p.current_stock > dailyDemand * 4 && (p.weekly_reorder_units || 0) === 0);
  });

  const spoilageAlertCount = products.filter(p => p.spoilage_alert || (p.shelf_life_days <= 4 && p.current_stock > 100)).length;
  const stockoutRiskCount = lowStockItems.length;
  const doNotBuyCount = doNotBuyItems.length;
  
  const weeklySavings = businessImpact?.weekly_total_savings || 0;
  const lstmMape = evaluation?.overall?.lstm?.mape || 14.79;
  const baselineMape = evaluation?.overall?.median_4w?.mape || 20.28;
  const mapeGain = evaluation?.overall_mape_gain_pct || 27.1;

  // Plain-English advice for shopkeeper
  const activeAdvice = selectedProduct?.headline_advice || 
    (products.length > 0 ? products[0].headline_advice : t('emptyWorkspaceDesc'));

  // Category counts
  const foodCount = products.filter(p => p.category === 'Food').length;
  const bevCount = products.filter(p => p.category === 'Beverage').length;
  const inStockCount = products.length - lowStockItems.length;

  return (
    <div>
      {/* Empty State Banner if no dataset uploaded */}
      {products.length === 0 ? (
        <div className="card" style={{ 
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.10))', 
          borderColor: 'rgba(16, 185, 129, 0.35)',
          padding: '36px 30px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ maxWidth: '640px' }}>
              <div className="pill pill-food" style={{ marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                <Database size={14} color="#10b981" /> {t('catalogOverview')}
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginBottom: 8 }}>
                {t('emptyWorkspaceTitle')}
              </h2>
              <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                {t('emptyWorkspaceDesc')}
              </p>
            </div>
            {onNavigateToDataHub && (
              <button 
                className="btn btn-primary" 
                style={{ padding: '14px 24px', fontSize: '0.98rem', fontWeight: 600, gap: 10 }}
                onClick={onNavigateToDataHub}
              >
                <Upload size={18} />
                <span>{t('uploadSalesCsv')}</span>
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Shopkeeper Plain-English Recommendation Banner */
        <div className="advice-banner" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(6, 182, 212, 0.12))', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
          <div className="advice-content">
            <div className="advice-icon" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
              <Sparkles size={24} color="#ffffff" />
            </div>
            <div>
              <div className="advice-tag" style={{ color: '#34d399', fontWeight: 700 }}>{t('smartWeeklyAdvice')}</div>
              <div className="advice-text" style={{ fontSize: '1.02rem', fontWeight: 500 }}>{activeAdvice}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('estimatedMoneySaved')}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
              +₹{Math.round(weeklySavings).toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#94a3b8' }}>{t('perWeek')}</span>
            </div>
          </div>
        </div>
      )}

      {/* 4 Richly Colored KPI Analytics Cards */}
      <div className="kpi-grid">
        {/* Card 1: Expected 5-Day Sales (Emerald Green) */}
        <div className="kpi-card kpi-emerald">
          <div className="kpi-header">
            <span className="kpi-title" style={{ color: '#a7f3d0' }}>{t('expected5DaySales')}</span>
            <div className="kpi-icon emerald">
              <Package size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#ffffff' }}>
            {Math.round(totalWeeklyForecast).toLocaleString()}{' '}
            <span style={{ fontSize: '1rem', fontWeight: 500, color: '#a7f3d0' }}>{t('units')}</span>
          </div>
          <div className="kpi-subtext">
            <span style={{ color: '#cbd5e1' }}>{t('predictedCustomerDemand')} <strong>{products.length}</strong> {t('items')}</span>
          </div>
        </div>

        {/* Card 2: Suggested Orders to Buy (Cyan Blue) */}
        <div className="kpi-card kpi-cyan">
          <div className="kpi-header">
            <span className="kpi-title" style={{ color: '#bae6fd' }}>{t('suggestedOrdersToday')}</span>
            <div className="kpi-icon cyan">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#38bdf8' }}>
            {Math.round(totalReorderUnits).toLocaleString()}{' '}
            <span style={{ fontSize: '1rem', fontWeight: 500, color: '#bae6fd' }}>{t('units')}</span>
          </div>
          <div className="kpi-subtext">
            <span style={{ color: '#cbd5e1' }}>
              {t('estPurchaseCost')} <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>₹{Math.round(totalProcurementCost).toLocaleString()}</strong>
            </span>
          </div>
        </div>

        {/* Card 3: AI Prediction Accuracy (Violet Purple) */}
        <div className="kpi-card kpi-violet">
          <div className="kpi-header">
            <span className="kpi-title" style={{ color: '#ddd6fe' }}>{t('aiForecastAccuracy')}</span>
            <div className="kpi-icon violet">
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#c084fc' }}>
            {Math.round(100 - lstmMape)}% <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#ddd6fe' }}>{t('matchError', { val: lstmMape })}</span>
          </div>
          <div className="kpi-subtext">
            <span className="kpi-badge-gain" style={{ background: 'rgba(139, 92, 246, 0.25)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.4)' }}>
              {t('betterThanGuesswork', { val: mapeGain })}
            </span>
          </div>
        </div>

        {/* Card 4: Inventory Alerts (Rose / Amber) */}
        <div 
          className="kpi-card kpi-rose"
          onClick={onOpenAlerts}
          style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
          title={t('smartStoreStockAlerts')}
        >
          <div className="kpi-header">
            <span className="kpi-title" style={{ color: '#fecdd3' }}>{t('storeStockAlerts')}</span>
            <div className="kpi-icon rose">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: stockoutRiskCount > 0 ? '#fb7185' : '#10b981', fontSize: '1.45rem' }}>
            {stockoutRiskCount > 0 ? `${stockoutRiskCount} ${t('lowStockTitle')}` : `0 ${t('lowStockTitle')}`}
          </div>
          <div className="kpi-subtext" style={{ justifyContent: 'space-between', width: '100%', marginTop: 4 }}>
            <span style={{ color: doNotBuyCount > 0 ? '#fbbf24' : '#a7f3d0', fontWeight: 700 }}>
              {doNotBuyCount > 0 ? t('doNotBuyAlerts', { count: doNotBuyCount }) : t('healthyInventory')}
            </span>
            <span style={{ fontSize: '0.72rem', color: '#38bdf8', textDecoration: 'underline' }}>{t('viewAlerts')}</span>
          </div>
        </div>
      </div>

      {/* Smart Store Alerts Action Banner (When low stock or do-not-buy items exist) */}
      {products.length > 0 && (stockoutRiskCount > 0 || doNotBuyCount > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
          {/* Alert Pillar 1: Low Stock / Out of Stock */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.14), rgba(255, 255, 255, 0.02))',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge-outofstock">🚨 {stockoutRiskCount} {t('itemsRunningLow')}</span>
              </div>
              <p style={{ fontSize: '0.84rem', color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                {t('lowStockBannerDesc')}
              </p>
            </div>
            {onFilterLowStock && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ borderColor: 'rgba(244, 63, 94, 0.4)', color: '#fb7185', whiteSpace: 'nowrap', padding: '8px 14px' }}
                onClick={onFilterLowStock}
              >
                {t('viewLowStock')}
              </button>
            )}
          </div>

          {/* Alert Pillar 2: Slow Movers / Do Not Buy */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(255, 255, 255, 0.02))',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge-donotbuy">🛑 {doNotBuyCount} {t('slowMoversDoNotBuy')}</span>
              </div>
              <p style={{ fontSize: '0.84rem', color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                {t('doNotBuyBannerDesc')}
              </p>
            </div>
            {onFilterDoNotBuy && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24', whiteSpace: 'nowrap', padding: '8px 14px' }}
                onClick={onFilterDoNotBuy}
              >
                {t('viewDoNotBuy')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Visual Quick Status Bar if products are loaded */}
      {products.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: 16,
          background: 'rgba(255, 255, 255, 0.03)', 
          border: '1px solid var(--border-subtle)', 
          borderRadius: 'var(--radius-md)', 
          padding: '12px 20px',
          marginTop: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>{t('catalogOverview')}</span>
            <span className="pill pill-food" style={{ fontSize: '0.78rem' }}>{t('freshFoodItems', { count: foodCount })}</span>
            <span className="pill pill-beverage" style={{ fontSize: '0.78rem' }}>{t('drinksBeverages', { count: bevCount })}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="badge-instock">{t('healthyStock', { count: inStockCount })}</span>
            {stockoutRiskCount > 0 && <span className="badge-lowstock">{t('lowStockBadge', { count: stockoutRiskCount })}</span>}
            {doNotBuyCount > 0 && <span className="badge-donotbuy">{t('doNotBuyBadge', { count: doNotBuyCount })}</span>}
            {spoilageAlertCount > 0 && <span className="badge-warning">{t('spoilageWatch', { count: spoilageAlertCount })}</span>}
          </div>
        </div>
      )}
    </div>
  );
};
