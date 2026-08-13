import React, { useState, useRef, useEffect } from 'react';
import { ShoppingBag, TrendingUp, Sparkles, Sliders, BarChart3, DollarSign, Database, Plus, Upload, Download, User, History, Bell, Globe, ChevronDown, Check } from 'lucide-react';
import { UserProfile } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  productCount: number;
  alertsCount?: number;
  currentUser?: UserProfile;
  onAddProduct: () => void;
  onUploadData: () => void;
  onExportPO: () => void;
  onOpenProfile: () => void;
  onOpenAlerts: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  productCount,
  alertsCount = 0,
  currentUser,
  onAddProduct,
  onUploadData,
  onExportPO,
  onOpenProfile,
  onOpenAlerts
}) => {
  const { t, language, setLanguage, languages, currentLanguageOption } = useTranslation();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tabs = [
    { id: 'dashboard', label: t('orderSuggestions'), icon: ShoppingBag, color: '#10b981' },
    { id: 'forecast', label: t('salesForecasts'), icon: TrendingUp, color: '#06b6d4' },
    { id: 'simulator', label: t('pricePromoTester'), icon: Sliders, color: '#8b5cf6' },
    { id: 'evaluation', label: t('aiAccuracyTest'), icon: BarChart3, color: '#f59e0b' },
    { id: 'roi', label: t('moneySavedRoi'), icon: DollarSign, color: '#10b981' },
    { id: 'data', label: t('uploadSalesData'), icon: Database, color: '#38bdf8' }
  ];

  const userName = currentUser?.name || 'Alex Morgan';
  const storeName = currentUser?.store_name || 'FreshMart Supermarket';

  return (
    <header className="navbar">
      <div className="brand-logo">
        <div className="logo-icon">
          <Sparkles size={24} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="brand-name">FreshStock<span style={{ color: '#10b981' }}>.ai</span></span>
            <span className="brand-badge">{productCount} {productCount === 1 ? t('item') : t('items')}</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
            {storeName}
          </p>
        </div>
      </div>

      <nav className="nav-tabs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`nav-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} color={isActive ? '#10b981' : tab.color} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="nav-actions">
        {/* Language Selector Dropdown */}
        <div className="lang-dropdown-wrapper" ref={langRef}>
          <button
            className="lang-selector-btn"
            onClick={() => setIsLangOpen(!isLangOpen)}
            title={t('selectLanguage')}
          >
            <Globe size={15} color="#38bdf8" />
            <span>{currentLanguageOption.nativeName}</span>
            <ChevronDown size={12} color="#94a3b8" />
          </button>

          {isLangOpen && (
            <div className="lang-dropdown-menu">
              <div style={{ padding: '6px 10px', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {t('selectLanguage')}
              </div>
              {languages.map(lang => (
                <button
                  key={lang.code}
                  className={`lang-menu-item ${language === lang.code ? 'active' : ''}`}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsLangOpen(false);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: 8 }}>{lang.flag}</span>
                    <span className="lang-item-native">{lang.nativeName}</span>
                    <span className="lang-item-english">({lang.name})</span>
                  </div>
                  {language === lang.code && <Check size={14} color="#10b981" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button 
          className="btn btn-secondary btn-sm" 
          style={{ borderColor: 'rgba(16, 185, 129, 0.35)', color: '#34d399' }}
          onClick={onUploadData} 
          title="Upload sales spreadsheet or CSV"
        >
          <Upload size={15} color="#10b981" />
          <span>{t('uploadFile')}</span>
        </button>
        <button 
          className="btn btn-secondary btn-sm" 
          style={{ borderColor: 'rgba(6, 182, 212, 0.35)', color: '#38bdf8' }}
          onClick={onExportPO} 
          title="Download Supplier Purchase Orders CSV"
        >
          <Download size={15} color="#06b6d4" />
          <span>{t('exportOrderList')}</span>
        </button>

        {/* Stock Alerts & Notifications Bell */}
        <button
          className="notification-bell-btn"
          onClick={onOpenAlerts}
          title="View Stockout Alerts & Do-Not-Buy Warnings"
        >
          <Bell size={18} />
          {alertsCount > 0 && (
            <span className="notification-pill-badge">
              {alertsCount > 9 ? '9+' : alertsCount}
            </span>
          )}
        </button>

        <button className="btn btn-primary btn-sm" onClick={onAddProduct}>
          <Plus size={16} />
          <span>{t('addItem')}</span>
        </button>

        {/* User Profile & History Button */}
        <button
          className="btn btn-secondary btn-sm"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(16,185,129,0.08))',
            borderColor: 'rgba(16, 185, 129, 0.3)'
          }}
          onClick={onOpenProfile}
          title="Open User Profile & Data Change History"
        >
          <div style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #06b6d4)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            {userName.charAt(0)}
          </div>
          <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{userName.split(' ')[0]}</span>
          <History size={14} color="#06b6d4" />
        </button>
      </div>
    </header>
  );
};
