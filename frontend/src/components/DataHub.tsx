import React, { useState } from 'react';
import { Upload, Download, FileText, CheckCircle2, AlertCircle, Database, Table, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';
import { api } from '../api';
import { UserProfile } from '../types';

interface DataHubProps {
  currentUser?: UserProfile;
  onRefreshData: () => Promise<void>;
  onNavigateToDashboard: () => void;
}

export const DataHub: React.FC<DataHubProps> = ({ currentUser, onRefreshData, onNavigateToDashboard }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
      setUploadError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadResult(null);
      setUploadError(null);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await api.uploadSalesCsv(selectedFile, currentUser?.user_id);
      setUploadResult(res);
      // Immediately refresh all products, forecasts, KPIs, and history!
      await onRefreshData();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleResetBenchmark = async () => {
    setResetting(true);
    setUploadError(null);
    try {
      const res = await api.resetDataset(currentUser?.user_id);
      setUploadResult({
        message: res.message,
        stats: {
          total_rows: 16000,
          unique_products: res.products_count,
          food_count: 50,
          beverage_count: 50
        }
      });
      await onRefreshData();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to restore benchmark dataset');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24 }}>
      {/* Upload CSV Section */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <Upload size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Upload Sales Data</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>Import files from any POS, Cash Register, or Excel spreadsheet</p>
          </div>
        </div>
        <p style={{ fontSize: '0.88rem', color: '#cbd5e1', marginBottom: 18, lineHeight: 1.5 }}>
          Upload any sales file or product spreadsheet. Our smart system automatically matches product names, sales dates, quantities, and prices, and instantly calculates your 5-day sales predictions and order plans!
        </p>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? '#10b981' : 'rgba(16, 185, 129, 0.35)'}`,
            borderRadius: '16px',
            padding: '40px 24px',
            textAlign: 'center',
            background: dragOver ? 'rgba(16, 185, 129, 0.12)' : 'linear-gradient(180deg, rgba(16, 185, 129, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: 20
          }}
          onClick={() => document.getElementById('csvFileInput')?.click()}
        >
          <input
            id="csvFileInput"
            type="file"
            accept=".csv, .txt"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
            <FileText size={32} color="#10b981" />
          </div>
          {selectedFile ? (
            <div>
              <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.05rem' }}>{selectedFile.name}</div>
              <div style={{ fontSize: '0.82rem', color: '#34d399', marginTop: 4, fontWeight: 600 }}>
                ✓ Ready to process ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '1.05rem' }}>Drag & Drop your CSV file here, or click to browse</div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 6 }}>
                Works with Square, Shopify, WooCommerce, POS exports, or standard Excel CSVs
              </div>
            </div>
          )}
        </div>

        {uploadError && (
          <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244,63,94,0.35)', padding: '12px 16px', borderRadius: '10px', color: '#fda4af', fontSize: '0.88rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={18} color="#fb7185" /> {uploadError}
          </div>
        )}

        {uploadResult && (
          <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.12))', border: '1px solid rgba(16,185,129,0.4)', padding: '18px', borderRadius: '14px', color: '#ffffff', fontSize: '0.9rem', marginBottom: 18 }}>
            <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', marginBottom: 6, fontSize: '1.05rem' }}>
              <CheckCircle2 size={20} /> Successfully Uploaded & Forecasted!
            </div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              Processed <strong>{uploadResult.stats?.total_rows?.toLocaleString()}</strong> sales lines across <strong>{uploadResult.stats?.unique_products}</strong> store items ({uploadResult.stats?.food_count} Fresh Food, {uploadResult.stats?.beverage_count} Drinks).
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary btn-sm" style={{ padding: '8px 16px', gap: 8 }} onClick={onNavigateToDashboard}>
                <span>View My Store Order Plan</span> <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700, gap: 10 }}
          disabled={!selectedFile || uploading}
          onClick={handleUploadSubmit}
        >
          <Upload size={18} /> {uploading ? 'Processing File & Calculating AI Predictions...' : 'Upload & Generate Store Forecasts'}
        </button>
      </div>

      {/* Export Center & Column Mapping Guide */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Export Center */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(6, 182, 212, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
              <Download size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Download Reports</h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>Export purchase orders and prediction files</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <a
              href={api.getExportPurchaseOrdersUrl(currentUser?.user_id)}
              download="weekly_purchase_orders.csv"
              className="product-item-card"
              style={{ textDecoration: 'none', color: 'inherit', padding: '14px 18px' }}
            >
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.95rem' }}>📥 Supplier Order List (CSV)</div>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: 2 }}>
                  Ready-to-send supplier order sheet with recommended units and costs
                </div>
              </div>
              <Download size={18} color="#10b981" />
            </a>

            <a
              href={api.getExportForecastsUrl(currentUser?.user_id)}
              download="egrocery_test_predictions.csv"
              className="product-item-card"
              style={{ textDecoration: 'none', color: 'inherit', padding: '14px 18px' }}
            >
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.95rem' }}>📊 5-Day Sales Predictions (CSV)</div>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: 2 }}>
                  Daily demand predictions, expected ranges, and past sales numbers
                </div>
              </div>
              <Download size={18} color="#06b6d4" />
            </a>

            <div
              onClick={handleResetBenchmark}
              className="product-item-card"
              style={{
                cursor: 'pointer',
                borderColor: 'rgba(245, 158, 11, 0.35)',
                background: 'rgba(245, 158, 11, 0.06)',
                padding: '14px 18px'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.95rem' }}>
                  <RotateCcw size={16} /> Load Demo 100-Product Grocery Catalog
                </div>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: 2 }}>
                  Explore FreshStock AI with our curated 100-item grocery store benchmark dataset
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}
                disabled={resetting}
              >
                {resetting ? 'Loading...' : 'Load Demo'}
              </button>
            </div>
          </div>
        </div>

        {/* Flexible Column Recognition Engine */}
        <div className="card" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="#10b981" /> Smart Column Recognition
          </h4>
          <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.6 }}>
            Our smart system understands standard columns automatically:
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '8px' }}>
                <strong style={{ color: '#ffffff' }}>Item Name:</strong> <code>Product</code>, <code>Item</code>, <code>SKU</code>, <code>Description</code>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '8px' }}>
                <strong style={{ color: '#ffffff' }}>Quantity:</strong> <code>Sales</code>, <code>Demand</code>, <code>Qty</code>, <code>Units</code>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '8px' }}>
                <strong style={{ color: '#ffffff' }}>Date:</strong> <code>Date</code>, <code>Order_Date</code>, <code>Day</code>, <code>Timestamp</code>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '8px' }}>
                <strong style={{ color: '#ffffff' }}>Category:</strong> <code>Food</code> vs <code>Beverage</code> (auto-detected)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
