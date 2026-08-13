import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { ReorderTable } from './components/ReorderTable';
import { ForecastExplorer } from './components/ForecastExplorer';
import { ProductManager } from './components/ProductManager';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { EvaluationBench } from './components/EvaluationBench';
import { BusinessImpact } from './components/BusinessImpact';
import { DataHub } from './components/DataHub';
import { UserProfileModal } from './components/UserProfileModal';
import { AuthModal } from './components/AuthModal';
import { AlertsModal } from './components/AlertsModal';
import { Product, BusinessImpact as BusinessImpactType, EvaluationReport, UserProfile } from './types';
import { api } from './api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [businessImpact, setBusinessImpact] = useState<BusinessImpactType | undefined>(undefined);
  const [evaluation, setEvaluation] = useState<EvaluationReport | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  // User Auth & Profile states with localStorage persistence
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('freshstock_active_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse saved user:', e);
    }
    return {
      user_id: "usr_alex_01",
      email: "alex.morgan@freshstock.ai",
      name: "Alex Morgan",
      store_name: "FreshMart Supermarket #04",
      role: "Store Inventory & Procurement Manager",
      created_at: "2025-11-15",
      stats: { reorders_placed: 18, csv_uploads: 4, skus_managed: 100 }
    };
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);

  // Modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' }>>([]);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const loadData = async (targetUserId?: string) => {
    const activeUserId = targetUserId || currentUser.user_id;
    try {
      const [prods, impact, evalRep, user] = await Promise.all([
        api.getProducts(undefined, undefined, activeUserId),
        api.getBusinessImpact(activeUserId),
        api.getEvaluation(),
        api.getCurrentUser(activeUserId)
      ]);
      setProducts(prods || []);
      if (prods && prods.length > 0) {
        if (!selectedProduct || !prods.find(p => p.product_id === selectedProduct.product_id)) {
          setSelectedProduct(prods[0]);
        }
      } else {
        setSelectedProduct(null);
      }
      setBusinessImpact(impact);
      setEvaluation(evalRep);
      if (user && user.user_id) {
        setCurrentUser(user);
        try {
          localStorage.setItem('freshstock_active_user', JSON.stringify(user));
        } catch (e) {}
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(currentUser.user_id);
  }, [currentUser.user_id]);

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setActiveTab('forecast');
  };

  const handleOpenAddProduct = () => {
    setProductToEdit(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setProductToEdit(p);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (data: Partial<Product>, isEdit: boolean) => {
    try {
      if (isEdit && productToEdit) {
        const res = await api.updateProduct(productToEdit.product_id, data, currentUser.user_id);
        setProducts(prev => prev.map(p => p.product_id === productToEdit.product_id ? res.product : p));
        if (selectedProduct?.product_id === productToEdit.product_id) {
          setSelectedProduct(res.product);
        }
        addToast(`Updated product "${res.product.name}" successfully!`);
      } else {
        const res = await api.createProduct(data, currentUser.user_id);
        setProducts(prev => [res.product, ...prev]);
        setSelectedProduct(res.product);
        addToast(`Added new product "${res.product.name}" to catalog!`);
      }
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to save product', 'error');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await api.deleteProduct(productId, currentUser.user_id);
      setProducts(prev => prev.filter(p => p.product_id !== productId));
      if (selectedProduct?.product_id === productId) {
        setSelectedProduct(products.find(p => p.product_id !== productId) || null);
      }
      addToast(`Deleted product ${productId}`);
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to delete product', 'error');
    }
  };

  const handlePlaceOrder = async (product: Product, quantity: number) => {
    try {
      await api.placeOrder(product.product_id, quantity, currentUser.user_id);
      setProducts(prev => prev.map(p => {
        if (p.product_id === product.product_id) {
          return {
            ...p,
            current_stock: p.current_stock + quantity,
            weekly_reorder_units: Math.max(0, (p.weekly_reorder_units || 0) - quantity)
          };
        }
        return p;
      }));
      addToast(`Purchase order of ${quantity} units placed for ${product.name}!`);
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to place order', 'error');
    }
  };

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setProducts([]);
    setSelectedProduct(null);
    setBusinessImpact(undefined);
    try {
      localStorage.setItem('freshstock_active_user', JSON.stringify(user));
    } catch (e) {}
    addToast(`Signed in to ${user.store_name} as ${user.name}`);
    loadData(user.user_id);
  };

  // Alert counts
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

  const totalAlertsCount = lowStockCount + doNotBuyCount;

  return (
    <div className="app-container">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        productCount={products.length}
        alertsCount={totalAlertsCount}
        currentUser={currentUser}
        onAddProduct={handleOpenAddProduct}
        onUploadData={() => setActiveTab('data')}
        onExportPO={() => {
          window.location.href = api.getExportPurchaseOrdersUrl(currentUser.user_id);
        }}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
      />

      {/* Main Content based on active tab */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '80px', color: '#94a3b8' }}>
          Initializing Store Workspace & AI Engine...
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <DashboardOverview
                products={products}
                businessImpact={businessImpact}
                evaluation={evaluation}
                selectedProduct={selectedProduct || undefined}
                onNavigateToDataHub={() => setActiveTab('data')}
                onOpenAlerts={() => setIsAlertsOpen(true)}
                onFilterLowStock={() => setActiveTab('dashboard')}
                onFilterDoNotBuy={() => setActiveTab('dashboard')}
              />
              <ReorderTable
                products={products}
                onSelectProduct={handleSelectProduct}
                onEditProduct={handleOpenEditProduct}
                onPlaceOrder={handlePlaceOrder}
              />
            </div>
          )}

          {activeTab === 'forecast' && (
            <ForecastExplorer
              products={products}
              selectedProduct={selectedProduct}
              currentUser={currentUser}
              onSelectProduct={p => setSelectedProduct(p)}
              onNavigateToDataHub={() => setActiveTab('data')}
            />
          )}

          {activeTab === 'simulator' && (
            <ScenarioSimulator
              products={products}
              selectedProduct={selectedProduct}
              currentUser={currentUser}
              onSelectProduct={p => setSelectedProduct(p)}
              onNavigateToDataHub={() => setActiveTab('data')}
            />
          )}

          {activeTab === 'evaluation' && (
            <EvaluationBench />
          )}

          {activeTab === 'roi' && (
            <BusinessImpact
              currentUser={currentUser}
              products={products}
              onNavigateToDataHub={() => setActiveTab('data')}
            />
          )}

          {activeTab === 'data' && (
            <DataHub
              currentUser={currentUser}
              onRefreshData={() => loadData(currentUser.user_id)}
              onNavigateToDashboard={() => setActiveTab('dashboard')}
            />
          )}
        </>
      )}

      {/* Product Manager Modal (Create / Edit) */}
      <ProductManager
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        productToEdit={productToEdit}
        onSaveProduct={handleSaveProduct}
        onDeleteProduct={handleDeleteProduct}
      />

      {/* Smart Alerts & Notification Modal */}
      <AlertsModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        products={products}
        onOrderProduct={p => {
          setSelectedProduct(p);
          setActiveTab('dashboard');
        }}
        onViewForecast={p => {
          setSelectedProduct(p);
          setActiveTab('forecast');
        }}
      />

      {/* User Profile & Audit History Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onUpdateUser={updated => {
          setCurrentUser(updated);
          addToast('Store profile saved successfully!');
        }}
        onSwitchUser={() => {
          setIsProfileModalOpen(false);
          setIsAuthModalOpen(true);
        }}
        onLogout={() => {
          setIsProfileModalOpen(false);
          setIsAuthModalOpen(true);
        }}
      />

      {/* Auth / Switch Workspace Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
export default App;
