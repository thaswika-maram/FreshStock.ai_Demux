import React, { useState, useEffect } from 'react';
import { User, Store, Shield, Clock, History, Edit, Save, Trash2, CheckCircle2, RefreshCw, Upload, ShoppingCart, Tag, Filter, Search, LogOut } from 'lucide-react';
import { UserProfile, ActivityEvent } from '../types';
import { api } from '../api';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
  onSwitchUser: () => void;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  onSwitchUser,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [saving, setSaving] = useState(false);

  // History state
  const [historyEvents, setHistoryEvents] = useState<ActivityEvent[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFormData(currentUser);
    }
  }, [currentUser]);

  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      loadHistory();
    }
  }, [isOpen, activeTab, currentUser.user_id]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const events = await api.getHistory(currentUser.user_id, historyFilter);
      setHistoryEvents(events);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateProfile(currentUser.user_id, formData);
      onUpdateUser(updated);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear your data change history?')) {
      await api.clearHistory(currentUser.user_id);
      setHistoryEvents([]);
    }
  };

  const filteredHistory = historyEvents.filter(ev => {
    if (historyFilter !== 'ALL' && ev.action_type !== historyFilter) return false;
    if (historySearch && !ev.title.toLowerCase().includes(historySearch.toLowerCase()) && !ev.description.toLowerCase().includes(historySearch.toLowerCase())) return false;
    return true;
  });

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'CSV_UPLOAD': return <Upload size={16} color="#06b6d4" />;
      case 'PURCHASE_ORDER': return <ShoppingCart size={16} color="#f59e0b" />;
      case 'PRODUCT_CREATE': return <Tag size={16} color="#10b981" />;
      case 'PRODUCT_UPDATE': return <Edit size={16} color="#8b5cf6" />;
      case 'PRODUCT_DELETE': return <Trash2 size={16} color="#f43f5e" />;
      default: return <Clock size={16} color="#94a3b8" />;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '780px' }} onClick={e => e.stopPropagation()}>
        {/* Modal Header with Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1.2rem',
              color: '#ffffff'
            }}>
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                {currentUser.name}
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {currentUser.store_name} • {currentUser.role}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="filter-group">
                <button
                  className={`filter-btn ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  <User size={14} /> My Profile & Store
                </button>
                <button
                  className={`filter-btn ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  <History size={14} /> Activity & Change History
                </button>
              </div>
              <button className="modal-close" onClick={onClose}>✕</button>
            </div>
          </div>

          {/* Tab 1: Profile View / Edit */}
          {activeTab === 'profile' && (
            <div>
              {/* Quick Stats Grid with Rich Colors */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
                <div className="kpi-card kpi-emerald" style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 600 }}>Active Store Items</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', marginTop: 4 }}>{currentUser.stats?.skus_managed ?? 0}</div>
                </div>
                <div className="kpi-card kpi-amber" style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: '#fde68a', textTransform: 'uppercase', fontWeight: 600 }}>Purchase Orders Placed</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>{currentUser.stats?.reorders_placed ?? 0}</div>
                </div>
                <div className="kpi-card kpi-cyan" style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: '#bae6fd', textTransform: 'uppercase', fontWeight: 600 }}>Sales Files Uploaded</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#06b6d4', marginTop: 4 }}>{currentUser.stats?.csv_uploads ?? 0}</div>
                </div>
              </div>

            {/* Profile Form */}
            <form onSubmit={handleSaveProfile}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    className="form-input"
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    disabled
                    className="form-input"
                    value={currentUser.email}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Grocery Store / Retail Network</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    className="form-input"
                    value={formData.store_name || ''}
                    onChange={e => setFormData({ ...formData, store_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role / Job Title</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    className="form-input"
                    value={formData.role || ''}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    className="form-input"
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Store Location / Warehouse</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    className="form-input"
                    value={formData.location || ''}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Default Target Service Level</label>
                  <select
                    disabled={!isEditing}
                    className="form-select"
                    value={formData.service_level_default || 0.95}
                    onChange={e => setFormData({ ...formData, service_level_default: parseFloat(e.target.value) })}
                  >
                    <option value={0.90}>90% Service Level</option>
                    <option value={0.95}>95% Service Level (Recommended)</option>
                    <option value={0.99}>99% Maximum Protection</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Holding Cost Rate (%/yr)</label>
                  <input
                    type="number"
                    disabled={!isEditing}
                    className="form-input"
                    value={formData.holding_cost_annual_pct || 22}
                    onChange={e => setFormData({ ...formData, holding_cost_annual_pct: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={onSwitchUser}>
                    <RefreshCw size={14} /> Switch Workspace
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={onLogout}>
                    <LogOut size={14} /> Log Out
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  {isEditing ? (
                    <>
                      <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        <Save size={15} /> {saving ? 'Saving...' : 'Save Profile'}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={() => setIsEditing(true)}>
                      <Edit size={15} /> Edit Details
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Activity & Data Change History */}
        {activeTab === 'history' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['ALL', 'CSV_UPLOAD', 'PURCHASE_ORDER', 'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE'].map(filter => (
                  <button
                    key={filter}
                    className={`filter-btn ${historyFilter === filter ? 'active' : ''}`}
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={() => {
                      setHistoryFilter(filter);
                      api.getHistory(currentUser.user_id, filter).then(setHistoryEvents);
                    }}
                  >
                    {filter.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className="search-box" style={{ width: '200px', padding: '4px 10px' }}>
                  <Search size={14} color="#94a3b8" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search history..."
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                  />
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleClearHistory} title="Clear history">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Timeline List */}
            <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  Loading activity log...
                </div>
              ) : filteredHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  No history events recorded yet.
                </div>
              ) : (
                filteredHistory.map(ev => (
                  <div
                    key={ev.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                      transition: 'border-color 0.2s'
                    }}
                  >
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2
                    }}>
                      {getActionIcon(ev.action_type)}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.9rem' }}>
                          {ev.title}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                          {ev.timestamp}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
                        {ev.description}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
