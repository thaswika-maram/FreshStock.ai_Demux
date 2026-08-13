import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, CheckCircle2 } from 'lucide-react';
import { Product } from '../types';

interface ProductManagerProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  onSaveProduct: (productData: Partial<Product>, isEdit: boolean) => Promise<void>;
  onDeleteProduct?: (productId: string) => Promise<void>;
}

export const ProductManager: React.FC<ProductManagerProps> = ({
  isOpen,
  onClose,
  productToEdit,
  onSaveProduct,
  onDeleteProduct
}) => {
  const isEdit = !!productToEdit;

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    category: 'Food',
    subcategory: 'Produce',
    base_demand: 120,
    shelf_life_days: 5,
    unit_price: 3.49,
    unit_cost: 1.80,
    lead_time_days: 1,
    moq: 15,
    current_stock: 60,
    service_level: 0.95
  });

  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (productToEdit) {
      setFormData(productToEdit);
    } else {
      setFormData({
        name: '',
        category: 'Food',
        subcategory: 'Produce',
        base_demand: 120,
        shelf_life_days: 5,
        unit_price: 3.49,
        unit_cost: 1.80,
        lead_time_days: 1,
        moq: 15,
        current_stock: 60,
        service_level: 0.95
      });
    }
    setDeleteConfirm(false);
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;
    setSaving(true);
    try {
      await onSaveProduct(formData, isEdit);
      onClose();
    } catch (err) {
      console.error('Failed to save product:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (productToEdit && onDeleteProduct) {
      setSaving(true);
      try {
        await onDeleteProduct(productToEdit.product_id);
        onClose();
      } catch (err) {
        console.error('Failed to delete product:', err);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              {isEdit ? <Edit3 size={20} /> : <Plus size={20} />}
            </div>
            <div>
              <h3 className="modal-title">
                {isEdit ? `Edit Item — ${productToEdit?.name}` : 'Add New Store Item'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>Configure inventory parameters & AI forecasting bounds</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Item / Product Name *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. Fresh Organic Bananas (1kg)"
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Department / Category *</label>
              <select
                className="form-select"
                value={formData.category || 'Food'}
                onChange={e => setFormData({ ...formData, category: e.target.value as 'Food' | 'Beverage' })}
              >
                <option value="Food">🥗 Food & Perishables</option>
                <option value="Beverage">🥤 Drinks & Beverages</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Subcategory</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Fresh Produce, Dairy, Soda"
                value={formData.subcategory || ''}
                onChange={e => setFormData({ ...formData, subcategory: e.target.value })}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Average Daily Sales (Units)</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={formData.base_demand || 100}
                onChange={e => setFormData({ ...formData, base_demand: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Freshness / Shelf Life (Days) *</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={formData.shelf_life_days || 7}
                onChange={e => setFormData({ ...formData, shelf_life_days: parseInt(e.target.value) || 1 })}
              />
              {Number(formData.shelf_life_days) <= 4 && (
                <span style={{ fontSize: '0.74rem', color: '#fbbf24', display: 'block', marginTop: 3 }}>
                  ⚠️ Fresh perishable: AI will auto-adjust orders to avoid spoilage waste.
                </span>
              )}
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Selling Price (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                className="form-input"
                value={formData.unit_price || 0}
                onChange={e => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Supplier Wholesale Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0.05"
                className="form-input"
                value={formData.unit_cost || 0}
                onChange={e => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Current Stock in Store (Units)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={formData.current_stock ?? 50}
                onChange={e => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Supplier Delivery Time (Days)</label>
              <input
                type="number"
                min="1"
                max="14"
                className="form-input"
                value={formData.lead_time_days || 1}
                onChange={e => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Supplier Minimum Pack Size (Units)</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={formData.moq || 10}
                onChange={e => setFormData({ ...formData, moq: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Customer In-Stock Target</label>
              <select
                className="form-select"
                value={formData.service_level || 0.95}
                onChange={e => setFormData({ ...formData, service_level: parseFloat(e.target.value) })}
              >
                <option value={0.90}>90% (Leaner Stock / Lower Cost)</option>
                <option value={0.95}>95% (Recommended Balanced)</option>
                <option value={0.99}>99% (Maximum Protection / Never Out of Stock)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            {isEdit && onDeleteProduct ? (
              deleteConfirm ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#fb7185' }}>Delete this item?</span>
                  <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete}>
                    Yes, Delete
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(true)}>
                  <Trash2 size={14} /> Delete Item
                </button>
              )
            ) : <div />}

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <CheckCircle2 size={16} /> {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Item')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
