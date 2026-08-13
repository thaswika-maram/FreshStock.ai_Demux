import React, { useState, useEffect } from 'react';
import { User, Store, ShieldCheck, ArrowRight, UserPlus, LogIn, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';
import { api } from '../api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [mode, setMode] = useState<'switch' | 'login' | 'register'>('switch');
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [role, setRole] = useState('Store Manager');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchUsers = () => {
    api.listUsers().then(users => {
      if (users && users.length > 0) {
        setAvailableUsers(users);
      }
    }).catch(err => console.warn('Failed to list users:', err));
  };

  useEffect(() => {
    if (isOpen) {
      setAuthError(null);
      fetchUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectUser = (u: UserProfile) => {
    setAuthError(null);
    onLoginSuccess(u);
    onClose();
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setAuthError(null);
    try {
      const res = await api.login(email);
      if (res && res.user) {
        onLoginSuccess(res.user);
        onClose();
      } else {
        throw new Error('User record not returned');
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    setLoading(true);
    setAuthError(null);
    try {
      const res = await api.register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        store_name: (storeName.trim()) || `${name.trim()}'s Grocery Mart`,
        role: (role.trim()) || 'Store Owner'
      });
      if (res && res.user) {
        onLoginSuccess(res.user);
        onClose();
      } else {
        throw new Error('Could not create user');
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="modal-title" style={{ margin: 0 }}>
                {mode === 'switch' ? 'Select Retail Workspace' : (mode === 'login' ? 'Sign In' : 'Create Personal Space')}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
                Manage store inventory, forecasting, and replenishment
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Mode switcher tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
          <button
            className={`filter-btn ${mode === 'switch' ? 'active' : ''}`}
            onClick={() => setMode('switch')}
          >
            Quick Workspaces
          </button>
          <button
            className={`filter-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Sign In with Email
          </button>
          <button
            className={`filter-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            New Store Account
          </button>
        </div>

        {authError && (
          <div style={{ background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244,63,94,0.3)', padding: '10px 14px', borderRadius: '8px', color: '#fda4af', fontSize: '0.84rem', marginBottom: 16 }}>
            {authError}
          </div>
        )}

        {/* 1. Quick Switch Mode */}
        {mode === 'switch' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 4 }}>
              Choose a pre-configured store workspace:
            </span>

            {availableUsers.map(u => (
              <div
                key={u.user_id}
                onClick={() => handleSelectUser(u)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700
                  }}>
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.92rem' }}>{u.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {u.store_name} • {u.role}
                    </div>
                  </div>
                </div>
                <ArrowRight size={18} color="#10b981" />
              </div>
            ))}
          </div>
        )}

        {/* 2. Login Mode */}
        {mode === 'login' && (
          <form onSubmit={handleCustomLogin}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                className="form-input"
                placeholder="your.email@store.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                defaultValue="password123"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} disabled={loading}>
              <LogIn size={16} /> {loading ? 'Authenticating...' : 'Sign In to Store Workspace'}
            </button>
          </form>
        )}

        {/* 3. Register Mode */}
        {mode === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Your Full Name *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. John Doe"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                required
                className="form-input"
                placeholder="john@mygrocery.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Grocery Store Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Green Valley Fresh Market"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Your Role</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Store Owner, Inventory Lead"
                value={role}
                onChange={e => setRole(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} disabled={loading}>
              <UserPlus size={16} /> {loading ? 'Creating Workspace...' : 'Create Store Account & Workspace'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
