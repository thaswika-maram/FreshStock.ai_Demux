import React, { useState } from 'react';
import { Search, Filter, AlertTriangle, ArrowUpRight, Edit2, ShoppingCart, CheckCircle2, Clock } from 'lucide-react';
import { Product } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface ReorderTableProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onPlaceOrder: (product: Product, quantity: number) => void;
}

export const ReorderTable: React.FC<ReorderTableProps> = ({
  products,
  onSelectProduct,
  onEditProduct,
  onPlaceOrder
}) => {
  const { t } = useTranslation();
  const [stockFilter, setStockFilter] = useState<'ALL' | 'FOOD' | 'BEVERAGE' | 'LOW_STOCK' | 'DO_NOT_BUY'>('ALL');
  const [filterRiskOnly, setFilterRiskOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderModalProduct, setOrderModalProduct] = useState<Product | null>(null);
  const [customOrderQty, setCustomOrderQty] = useState<number>(0);
  const [orderedSuccessPid, setOrderedSuccessPid] = useState<string | null>(null);

  // Compute alert counts
  const lowStockCount = products.filter(p => {
    const dailyDemand = (p.weekly_forecast ? p.weekly_forecast / 5.0 : p.base_demand) || 10;
    const daysLeft = p.days_of_stock_remaining ?? (p.current_stock / Math.max(1, dailyDemand));
    return p.stockout_warning || p.stock_alert_status === 'CRITICAL_LOW' || p.stock_alert_status === 'OUT_OF_STOCK' || daysLeft <= 2.0 || ((p.weekly_reorder_units || 0) > 0 && p.current_stock < dailyDemand * 2);
  }).length;

  const doNotBuyCount = products.filter(p => {
    const dailyDemand = (p.weekly_forecast ? p.weekly_forecast / 5.0 : p.base_demand) || 10;
    const daysLeft = p.days_of_stock_remaining ?? (p.current_stock / Math.max(1, dailyDemand));
    return p.do_not_buy_warning || p.stock_alert_status === 'OVERSTOCK_DO_NOT_BUY' || daysLeft >= 7.0 || (p.shelf_life_days <= 4 && p.current_stock > dailyDemand * 4 && (p.weekly_reorder_units || 0) === 0);
  }).length;

  const filtered = products.filter(p => {
    const dailyDemand = (p.weekly_forecast ? p.weekly_forecast / 5.0 : p.base_demand) || 10;
    const daysLeft = p.days_of_stock_remaining ?? (p.current_stock / Math.max(1, dailyDemand));
    const isLow = p.stockout_warning || p.stock_alert_status === 'CRITICAL_LOW' || p.stock_alert_status === 'OUT_OF_STOCK' || daysLeft <= 2.0 || ((p.weekly_reorder_units || 0) > 0 && p.current_stock < dailyDemand * 2);
    const isDoNotBuy = p.do_not_buy_warning || p.stock_alert_status === 'OVERSTOCK_DO_NOT_BUY' || daysLeft >= 7.0 || (p.shelf_life_days <= 4 && p.current_stock > dailyDemand * 4 && (p.weekly_reorder_units || 0) === 0);

    if (stockFilter === 'FOOD' && p.category !== 'Food') return false;
    if (stockFilter === 'BEVERAGE' && p.category !== 'Beverage') return false;
    if (stockFilter === 'LOW_STOCK' && !isLow) return false;
    if (stockFilter === 'DO_NOT_BUY' && !isDoNotBuy) return false;

    if (filterRiskOnly && (p.weekly_reorder_units || 0) <= 0) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.product_id.toLowerCase().includes(q) || p.subcategory.toLowerCase().includes(q);
    }
    return true;
  });

  const handleOpenOrder = (e: React.MouseEvent, p: Product) => {
    e.stopPropagation();
    setOrderModalProduct(p);
    setCustomOrderQty(p.weekly_reorder_units || p.moq || 10);
  };

  const handleConfirmOrder = () => {
    if (orderModalProduct) {
      onPlaceOrder(orderModalProduct, customOrderQty);
      setOrderedSuccessPid(orderModalProduct.product_id);
      setTimeout(() => setOrderedSuccessPid(null), 3000);
      setOrderModalProduct(null);
    }
  };

  return (
    <div className="card">
      {/* Toolbar */}
      <div className="toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Filter Pills */}
          <div className="filter-group" style={{ flexWrap: 'wrap' }}>
            <button
              className={`filter-btn ${stockFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStockFilter('ALL')}
            >
              {t('allItems')} ({products.length})
            </button>
            <button
              className={`filter-btn ${stockFilter === 'LOW_STOCK' ? 'active' : ''}`}
              style={{ color: stockFilter === 'LOW_STOCK' ? '#ffffff' : '#fb7185', fontWeight: 700 }}
              onClick={() => setStockFilter('LOW_STOCK')}
            >
              {t('runningOutOfStock')} ({lowStockCount})
            </button>
            <button
              className={`filter-btn ${stockFilter === 'DO_NOT_BUY' ? 'active' : ''}`}
              style={{ color: stockFilter === 'DO_NOT_BUY' ? '#ffffff' : '#fbbf24', fontWeight: 700 }}
              onClick={() => setStockFilter('DO_NOT_BUY')}
            >
              {t('doNotBuyNextTime')} ({doNotBuyCount})
            </button>
            <button
              className={`filter-btn ${stockFilter === 'FOOD' ? 'active' : ''}`}
              onClick={() => setStockFilter('FOOD')}
            >
              {t('freshFood')}
            </button>
            <button
              className={`filter-btn ${stockFilter === 'BEVERAGE' ? 'active' : ''}`}
              onClick={() => setStockFilter('BEVERAGE')}
            >
              {t('drinks')}
            </button>
          </div>

          <button
            className={`btn btn-sm ${filterRiskOnly ? 'btn-primary' : 'btn-secondary'}`}
            style={{ 
              background: filterRiskOnly ? 'linear-gradient(135deg, #06b6d4, #3b82f6)' : undefined,
              borderColor: filterRiskOnly ? 'transparent' : 'rgba(6, 182, 212, 0.4)',
              color: filterRiskOnly ? '#ffffff' : '#38bdf8'
            }}
            onClick={() => setFilterRiskOnly(!filterRiskOnly)}
          >
            <Filter size={14} />
            <span>{t('ordersNeededOnly')}</span>
          </button>
        </div>

        {/* Search */}
        <div className="search-box">
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            className="search-input"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>{t('productAndCode')}</th>
              <th>{t('categoryCol')}</th>
              <th>{t('freshnessExpiry')}</th>
              <th>{t('stockOnHand')}</th>
              <th>{t('expected5DaySalesCol')}</th>
              <th>{t('safetyBuffer')}</th>
              <th>{t('suggestedOrderCol')}</th>
              <th>{t('totalCostCol')}</th>
              <th style={{ textAlign: 'right' }}>{t('actionCol')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                  {t('noActiveAlertsTitle')}
                </td>
              </tr>
            ) : (
              filtered.map(p => {
                const reorderQty = p.weekly_reorder_units || 0;
                const estCost = Math.round(reorderQty * p.unit_cost);
                const isOrdered = orderedSuccessPid === p.product_id;
                
                const dailyDemand = (p.weekly_forecast ? p.weekly_forecast / 5.0 : p.base_demand) || 10;
                const daysLeft = (p.days_of_stock_remaining ?? (p.current_stock / Math.max(1, dailyDemand))).toFixed(1);
                
                const isLowStock = p.stockout_warning || p.stock_alert_status === 'CRITICAL_LOW' || p.stock_alert_status === 'OUT_OF_STOCK' || Number(daysLeft) <= 2.0 || (reorderQty > 0 && p.current_stock < dailyDemand * 2);
                const isDoNotBuy = p.do_not_buy_warning || p.stock_alert_status === 'OVERSTOCK_DO_NOT_BUY' || Number(daysLeft) >= 7.0 || (p.shelf_life_days <= 4 && p.current_stock > dailyDemand * 4 && reorderQty === 0);

                return (
                  <tr
                    key={p.product_id}
                    onClick={() => onSelectProduct(p)}
                    style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                  >
                    <td>
                      <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.95rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                        {p.product_id} • <span style={{ color: '#cbd5e1' }}>{p.subcategory}</span>
                      </div>
                    </td>

                    <td>
                      <span className={`pill ${p.category === 'Food' ? 'pill-food' : 'pill-beverage'}`}>
                        {p.category === 'Food' ? t('freshFood') : t('drinks')}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={14} color={p.shelf_life_days <= 4 ? '#fbbf24' : '#10b981'} />
                        <span style={{ fontWeight: 600, color: p.shelf_life_days <= 4 ? '#fbbf24' : '#cbd5e1' }}>
                          {p.shelf_life_days} {t('days')}
                        </span>
                      </div>
                      {p.shelf_life_days <= 4 && (
                        <div style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 600 }}>{t('freshShortLife')}</div>
                      )}
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, color: isLowStock ? '#fb7185' : '#ffffff' }}>
                        {p.current_stock} {t('units')}
                      </div>
                      {isLowStock ? (
                        <div className="badge-outofstock" style={{ display: 'inline-flex', marginTop: 2 }}>
                          {t('lowStockStatus', { days: daysLeft })}
                        </div>
                      ) : isDoNotBuy ? (
                        <div className="badge-donotbuy" style={{ display: 'inline-flex', marginTop: 2 }}>
                          {t('doNotBuyStatus', { days: daysLeft })}
                        </div>
                      ) : (
                        <div className="badge-instock" style={{ display: 'inline-flex', marginTop: 2 }}>
                          {t('inStockStatus', { days: daysLeft })}
                        </div>
                      )}
                    </td>

                    <td>
                      <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '1rem' }}>
                        {p.weekly_forecast || Math.round((p.base_demand || 100) * 5)}
                      </span>{' '}
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t('units')}</span>
                    </td>

                    <td>
                      <span style={{ color: '#c084fc', fontWeight: 700 }}>+{p.safety_stock || 20}</span>{' '}
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{t('backup')}</span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ 
                            fontSize: '1.05rem', 
                            fontWeight: 800, 
                            color: isDoNotBuy ? '#94a3b8' : (reorderQty > 0 ? '#10b981' : '#64748b') 
                          }}>
                            {isDoNotBuy ? `0 ${t('units')}` : (reorderQty > 0 ? `${reorderQty} ${t('units')}` : t('sufficientStock'))}
                          </span>
                          {p.spoilage_alert && (
                            <span className="pill pill-warning" title="Perishable alert: Order adjusted to prevent food waste">
                              <AlertTriangle size={12} /> {t('wasteTrimmed')}
                            </span>
                          )}
                        </div>

                        {isDoNotBuy ? (
                          <span style={{ fontSize: '0.72rem', color: '#fda4af', fontWeight: 700 }}>
                            {t('stopBuyingExcess')}
                          </span>
                        ) : isLowStock && reorderQty > 0 ? (
                          <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700 }}>
                            {t('urgentlyNeeded')}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td>
                      <span style={{ fontWeight: 700, color: estCost > 0 ? '#38bdf8' : '#64748b' }}>
                        ₹{estCost.toLocaleString()}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onEditProduct(p)}
                          title="Edit product stock or details"
                        >
                          <Edit2 size={13} />
                        </button>
                        
                        <button
                          className={`btn btn-sm ${isOrdered ? 'btn-secondary' : (reorderQty > 0 ? 'btn-primary' : 'btn-secondary')}`}
                          style={{
                            background: isOrdered ? undefined : (reorderQty > 0 ? 'linear-gradient(135deg, #10b981, #06b6d4)' : undefined)
                          }}
                          onClick={e => handleOpenOrder(e, p)}
                        >
                          {isOrdered ? (
                            <>
                              <CheckCircle2 size={14} color="#10b981" />
                              <span style={{ color: '#10b981' }}>{t('ordered')}</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart size={14} />
                              <span>{reorderQty > 0 ? t('orderNow') : t('quickOrder')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Order Modal */}
      {orderModalProduct && (
        <div className="modal-backdrop" onClick={() => setOrderModalProduct(null)}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{t('confirmOrderTitle')}</h3>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>Restock inventory for your store</p>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '10px', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '1rem' }}>{orderModalProduct.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 2 }}>
                  {t('currentStockInStore')}: <strong>{orderModalProduct.current_stock} {t('units')}</strong> • {t('wholesaleCost')}: <strong>₹{orderModalProduct.unit_cost.toFixed(2)}/{t('unit')}</strong>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('orderQtyLabel')}</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}
                  value={customOrderQty}
                  onChange={e => setCustomOrderQty(Math.max(1, parseInt(e.target.value) || 0))}
                />
                <span style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: 4, display: 'block' }}>
                  AI Suggested Quantity: <strong style={{ color: '#38bdf8' }}>{orderModalProduct.weekly_reorder_units || 0} {t('units')}</strong> ({t('minOrderQty')}: {orderModalProduct.moq || 10} {t('units')})
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border-subtle)', marginTop: 14 }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('totalEstInvoice')}</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>
                  ₹{(customOrderQty * orderModalProduct.unit_cost).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setOrderModalProduct(null)}>
                {t('cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleConfirmOrder}>
                {t('placePurchaseOrder')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

