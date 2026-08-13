import React, { useState } from 'react';
import { AlertTriangle, Bell, Ban, ShoppingCart, TrendingUp, Package, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Product } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface AlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onOrderProduct: (product: Product) => void;
  onViewForecast: (product: Product) => void;
}

export const AlertsModal: React.FC<AlertsModalProps> = ({
  isOpen,
  onClose,
  products,
  onOrderProduct,
  onViewForecast
}) => {
  const { t } = useTranslation();
  const [filterType, setFilterType] = useState<'ALL' | 'LOW_STOCK' | 'DO_NOT_BUY'>('ALL');

  if (!isOpen) return null;

  // Filter low stock and slow mover / do-not-buy items
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

  const totalAlertsCount = lowStockItems.length + doNotBuyItems.length;

  const displayList = filterType === 'LOW_STOCK' 
    ? lowStockItems 
    : filterType === 'DO_NOT_BUY' 
      ? doNotBuyItems 
      : [...lowStockItems, ...doNotBuyItems.filter(d => !lowStockItems.some(l => l.product_id === d.product_id))];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(245, 158, 11, 0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f43f5e'
            }}>
              <Bell size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  {t('smartStoreStockAlerts')}
                </h3>
                <span style={{
                  background: 'rgba(244, 63, 94, 0.2)',
                  color: '#fb7185',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid rgba(244, 63, 94, 0.4)'
                }}>
                  {totalAlertsCount} {t('actionableAlerts')}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                {t('alertsSubtitle')}
              </p>
            </div>
          </div>

          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Quick Filter Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            className={`filter-btn ${filterType === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterType('ALL')}
          >
            {t('allAlerts')} ({totalAlertsCount})
          </button>
          <button
            className={`filter-btn ${filterType === 'LOW_STOCK' ? 'active' : ''}`}
            style={{ color: filterType === 'LOW_STOCK' ? '#ffffff' : '#fb7185' }}
            onClick={() => setFilterType('LOW_STOCK')}
          >
            {t('runningOutOfStock')} ({lowStockItems.length})
          </button>
          <button
            className={`filter-btn ${filterType === 'DO_NOT_BUY' ? 'active' : ''}`}
            style={{ color: filterType === 'DO_NOT_BUY' ? '#ffffff' : '#fbbf24' }}
            onClick={() => setFilterType('DO_NOT_BUY')}
          >
            {t('doNotBuyNextTime')} ({doNotBuyItems.length})
          </button>
        </div>

        {/* Alert List */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4, flex: 1 }}>
          {displayList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <CheckCircle2 size={24} color="#10b981" />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>{t('noActiveAlertsTitle')}</div>
              <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                {t('noActiveAlertsDesc')}
              </div>
            </div>
          ) : (
            displayList.map(item => {
              const isLowStock = lowStockItems.some(l => l.product_id === item.product_id);
              const dailyDemand = (item.weekly_forecast ? item.weekly_forecast / 5.0 : item.base_demand) || 10;
              const daysOfStock = (item.days_of_stock_remaining ?? (item.current_stock / Math.max(1, dailyDemand))).toFixed(1);

              return (
                <div
                  key={item.product_id}
                  className={`alert-item-card ${isLowStock ? 'low-stock' : 'do-not-buy'}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: '#ffffff' }}>
                        {item.name}
                      </span>
                      <span className={`pill ${item.category === 'Food' ? 'pill-food' : 'pill-beverage'}`}>
                        {item.category === 'Food' ? t('freshFood') : t('drinks')}
                      </span>
                      {isLowStock ? (
                        <span className="badge-outofstock">
                          {t('lowStockStatus', { days: daysOfStock })}
                        </span>
                      ) : (
                        <span className="badge-donotbuy">
                          {t('doNotBuyNextTime')}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                      {isLowStock ? (
                        <span>
                          {t('lowStockCardMessage', { stock: item.current_stock, demand: Math.round(dailyDemand), days: daysOfStock })}
                        </span>
                      ) : (
                        <span>
                          {t('doNotBuyCardMessage', { demand: Math.round(dailyDemand), stock: item.current_stock, days: daysOfStock })}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: 6, display: 'flex', gap: 16 }}>
                      <span>{t('wholesaleCost')} <strong>₹{item.unit_cost.toFixed(2)}</strong></span>
                      <span>{t('sellingPrice')} <strong>₹{item.unit_price.toFixed(2)}</strong></span>
                      <span>{t('shelfLife')} <strong>{item.shelf_life_days} {t('days')}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    {isLowStock ? (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ padding: '8px 14px', whiteSpace: 'nowrap', gap: 6 }}
                        onClick={() => {
                          onClose();
                          onOrderProduct(item);
                        }}
                      >
                        <ShoppingCart size={14} />
                        <span>{t('orderRestock')}</span>
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{
                          padding: '8px 14px',
                          whiteSpace: 'nowrap',
                          gap: 6,
                          borderColor: 'rgba(245, 158, 11, 0.4)',
                          color: '#fbbf24'
                        }}
                        onClick={() => {
                          onClose();
                          onViewForecast(item);
                        }}
                      >
                        <TrendingUp size={14} />
                        <span>{t('viewSalesTrend')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            {t('alertsTip')}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
