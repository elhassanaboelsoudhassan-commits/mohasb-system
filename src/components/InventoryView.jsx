import React, { useState } from 'react';
import { 
  Boxes, 
  ArrowRightLeft, 
  AlertOctagon, 
  Plus, 
  PackageCheck, 
  Warehouse, 
  Search,
  CheckCircle2,
  Edit3,
  Scale,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { safeFetch } from '../api/client';

export default function InventoryView({ 
  products = [], 
  branches = [], 
  selectedBranch, 
  currentUser,
  onRefreshProducts, 
  onOpenTransfer,
  onOpenDamage 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Direct Stock Inventory Adjustment State for Admin
  const [adjustModalProduct, setAdjustModalProduct] = useState(null);
  const [newStockQty, setNewStockQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('جرد دوري فعلي للمستودع');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(1);
  const [adjustingStock, setAdjustingStock] = useState(false);
  const [adjustSuccess, setAdjustSuccess] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'owner' || !currentUser?.role;

  const [productForm, setProductForm] = useState({
    sku: '',
    barcode: '',
    name_ar: '',
    name_en: '',
    category: 'أجهزة نقاط البيع',
    unit: 'جهاز',
    cost_price: '',
    selling_price: '',
    initial_qty: 10,
    branch_id: 1,
    warehouse_id: 1
  });

  const filteredProducts = products.filter(p => {
    if (searchTerm) {
      const matchName = p.name_ar.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSku = p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchName && !matchSku) return false;
    }
    return true;
  });

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowAddProductModal(false);
        setProductForm({
          sku: '', barcode: '', name_ar: '', name_en: '', category: 'أجهزة نقاط البيع',
          unit: 'جهاز', cost_price: '', selling_price: '', initial_qty: 10, branch_id: 1, warehouse_id: 1
        });
        onRefreshProducts();
      } else {
        alert('حدث خطأ: ' + data.error);
      }
    } catch (err) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={18} style={{ position: 'absolute', right: '12px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="بحث بالاسم أو الباركود أو SKU..."
            className="form-input"
            style={{ paddingRight: '2.5rem', width: '100%' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onOpenTransfer} className="btn btn-secondary">
            <ArrowRightLeft size={16} />
            <span>مناقلة مخزون بين الفروع</span>
          </button>

          <button onClick={onOpenDamage} className="btn btn-secondary" style={{ color: '#be123c' }}>
            <AlertOctagon size={16} />
            <span>تسجيل إتلاف مخزني</span>
          </button>

          <button onClick={() => setShowAddProductModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>إضافة صنف جديد</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              دليل الأصناف والمخزون السلعي ({filteredProducts.length})
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              تتبع لحظي للكميات المتوفرة لكل مستودع وفرع، ومتوسط أسعار التكلفة وهامش الربح.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>رمز الصنف (SKU)</th>
                <th>اسم الصنف</th>
                <th>التصنيف</th>
                <th>الوحدة</th>
                <th>سعر التكلفة</th>
                <th>سعر البيع (بدون ضريبة)</th>
                <th>شامل الضريبة 15%</th>
                <th>الرصيد الإجمالي</th>
                <th>توزيع المستودعات</th>
                <th style={{ textAlign: 'center' }}>إجراءات الجرد والتعديل</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => {
                const priceWithVat = p.selling_price * 1.15;
                const currentQty = p.stock !== undefined ? p.stock : (p.total_stock !== undefined ? p.total_stock : 0);
                return (
                  <tr key={p.id}>
                    <td className="font-mono" style={{ fontWeight: 800, color: '#047857' }}>
                      {p.sku}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{p.name_ar}</div>
                      {p.name_en && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.name_en}</div>}
                    </td>
                    <td>
                      <span className="badge badge-secondary">{p.category}</span>
                    </td>
                    <td>{p.unit}</td>
                    <td className="font-mono">{p.cost_price?.toFixed(2)} ر.س</td>
                    <td className="font-mono" style={{ fontWeight: 700 }}>{p.selling_price?.toFixed(2)} ر.س</td>
                    <td className="font-mono" style={{ color: '#047857', fontWeight: 800 }}>{priceWithVat.toFixed(2)} ر.س</td>
                    <td>
                      <span className={`badge ${currentQty > 10 ? 'badge-success' : currentQty > 0 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.85rem' }}>
                        {currentQty} {p.unit}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxWidth: '280px' }}>
                        {p.levels && p.levels.map((lvl, i) => (
                          <span key={i} style={{ fontSize: '0.725rem', background: '#f1f5f9', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                            {lvl.warehouse_name}: <strong className="font-mono">{lvl.quantity}</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          setAdjustModalProduct(p);
                          setNewStockQty(currentQty);
                          setAdjustReason('جرد دوري فعلي للمستودع');
                          setSelectedWarehouseId(1);
                        }}
                        className="btn btn-secondary"
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.78rem',
                          color: '#047857',
                          borderColor: '#10b981',
                          background: 'rgba(16, 185, 129, 0.08)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                        title="تعديل كمية الصنف وجرد المستودع مباشرة بصلاحية المسؤول ومزامنتها مع Firebase"
                      >
                        <Edit3 size={13} />
                        <span>تعديل الرصيد / جرد</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Direct Stock & Warehouse Inventory Adjustment Modal (Admin Privilege) */}
      {adjustModalProduct && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="modal-content" style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
              padding: '1.25rem 1.5rem',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Scale size={22} />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0 }}>
                    تعديل كميات الأصناف وجرد المستودع مباشرة
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#a7f3d0', margin: '0.2rem 0 0 0' }}>
                    صلاحية المسؤول المطلق (Admin) لتسوية الأرصدة وتثبيتها سحابياً في Firebase
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdjustModalProduct(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setAdjustingStock(true);
              try {
                const res = await safeFetch('/api/inventory/products/adjust-stock', {
                  method: 'POST',
                  body: JSON.stringify({
                    product_id: adjustModalProduct.id,
                    new_stock: Number(newStockQty),
                    reason: adjustReason,
                    warehouse_id: selectedWarehouseId
                  })
                });

                if (res && res.success) {
                  setAdjustSuccess(true);
                  setTimeout(() => {
                    setAdjustSuccess(false);
                    setAdjustModalProduct(null);
                    onRefreshProducts();
                  }, 1200);
                } else {
                  alert('فشل التعديل: ' + (res?.error || 'خطأ غير متوقع'));
                }
              } catch (err) {
                alert('خطأ: ' + err.message);
              } finally {
                setAdjustingStock(false);
              }
            }}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {adjustSuccess && (
                  <div style={{
                    background: '#ecfdf5',
                    border: '1px solid #10b981',
                    color: '#065f46',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span>✅ تم تعديل رصيد المخزون وجرد المستودع بنجاح وتثبيته سحابياً في Firebase!</span>
                  </div>
                )}

                {/* Product Info Box */}
                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>الصنف المختار:</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{adjustModalProduct.name_ar}</div>
                  <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '0.2rem' }} className="font-mono">
                    SKU: {adjustModalProduct.sku} | الوحدة: {adjustModalProduct.unit || 'شتلة/قطعة'}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginTop: '0.4rem' }}>
                    الرصيد الدفتري الحالي المسجل: <strong className="font-mono" style={{ color: '#047857' }}>{adjustModalProduct.stock !== undefined ? adjustModalProduct.stock : 0} {adjustModalProduct.unit}</strong>
                  </div>
                </div>

                {/* New Stock Input */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800, color: '#0f172a' }}>
                    الكمية الفعلية الجديدة في المستودع (الرصيد بعد الجرد)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    className="form-input font-mono"
                    style={{ fontSize: '1.15rem', fontWeight: 800, padding: '0.6rem 0.8rem' }}
                    value={newStockQty}
                    onChange={e => setNewStockQty(e.target.value)}
                  />
                  {newStockQty !== '' && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', fontWeight: 800 }}>
                      {(() => {
                        const current = Number(adjustModalProduct.stock !== undefined ? adjustModalProduct.stock : 0);
                        const next = Number(newStockQty);
                        const diff = next - current;
                        if (diff > 0) {
                          return <span style={{ color: '#059669' }}>🟢 تسوية بالزيادة: (+{diff} {adjustModalProduct.unit}) ستضاف للرصيد</span>;
                        } else if (diff < 0) {
                          return <span style={{ color: '#dc2626' }}>🔴 تسوية بالعجز: ({diff} {adjustModalProduct.unit}) ستخصم من الرصيد</span>;
                        } else {
                          return <span style={{ color: '#64748b' }}>⚪ الرصيد مطابق لا يوجد فرق</span>;
                        }
                      })()}
                    </div>
                  )}
                </div>

                {/* Warehouse Target */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>المستودع المستهدف للجرد</label>
                  <select
                    className="form-select"
                    value={selectedWarehouseId}
                    onChange={e => setSelectedWarehouseId(Number(e.target.value))}
                  >
                    <option value="1">المستودع المركزي - صالة العرض</option>
                    <option value="2">مستودع البيوت المحمية والمشاتل الشمالية</option>
                    <option value="3">مستودع جدة الرئيسي</option>
                    <option value="4">مستودع المنطقة الشرقية اللوجستي</option>
                  </select>
                </div>

                {/* Reason */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>سبب التعديل والتسوية</label>
                  <select
                    className="form-select"
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                  >
                    <option value="جرد دوري فعلي للمستودع">جرد دوري فعلي للمستودع</option>
                    <option value="تسوية عجز جرد مخزني">تسوية عجز جرد مخزني</option>
                    <option value="تسوية فائض مخزني غير مسجل">تسوية فائض مخزني غير مسجل</option>
                    <option value="تعديل إداري معتمد من المشرف">تعديل إداري معتمد من المشرف</option>
                    <option value="تصحيح خطأ إدخال سابق">تصحيح خطأ إدخال سابق</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setAdjustModalProduct(null)}
                  className="btn btn-secondary"
                  disabled={adjustingStock}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={adjustingStock}
                  className="btn btn-primary"
                  style={{ background: '#047857', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem' }}
                >
                  <RefreshCw size={15} className={adjustingStock ? 'animate-spin' : ''} />
                  <span>{adjustingStock ? 'جاري التعديل والمزامنة...' : 'تثبيت الرصيد وجرد المستودع'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontWeight: 800, fontSize: '1.15rem' }}>تعريف صنف جديد بالمخزون</h3>
              <button onClick={() => setShowAddProductModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <form onSubmit={handleCreateProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">رمز الصنف (SKU)</label>
                    <input required type="text" placeholder="مثال: SKU-1006" className="form-input font-mono" value={productForm.sku} onChange={e => setProductForm({ ...productForm, sku: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">الباركود الدولي (Barcode)</label>
                    <input type="text" placeholder="628100xxxx" className="form-input font-mono" value={productForm.barcode} onChange={e => setProductForm({ ...productForm, barcode: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">اسم المنتج (عربي)</label>
                    <input required type="text" placeholder="جهاز عداد نقود إلكتروني فائق السرعة" className="form-input" value={productForm.name_ar} onChange={e => setProductForm({ ...productForm, name_ar: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">الوحدة</label>
                    <input type="text" placeholder="حبة / طقم / كرتون" className="form-input" value={productForm.unit} onChange={e => setProductForm({ ...productForm, unit: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">سعر التكلفة (بدون ضريبة)</label>
                    <input required type="number" step="0.01" placeholder="350.00" className="form-input font-mono" value={productForm.cost_price} onChange={e => setProductForm({ ...productForm, cost_price: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">سعر البيع (بدون ضريبة)</label>
                    <input required type="number" step="0.01" placeholder="580.00" className="form-input font-mono" value={productForm.selling_price} onChange={e => setProductForm({ ...productForm, selling_price: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">الرصيد الأولي</label>
                    <input type="number" placeholder="20" className="form-input font-mono" value={productForm.initial_qty} onChange={e => setProductForm({ ...productForm, initial_qty: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">إيداع في فرع</label>
                    <select className="form-select" value={productForm.branch_id} onChange={e => setProductForm({ ...productForm, branch_id: Number(e.target.value) })}>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name_ar}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">المستودع</label>
                    <select className="form-select" value={productForm.warehouse_id} onChange={e => setProductForm({ ...productForm, warehouse_id: Number(e.target.value) })}>
                      <option value="1">المستودع المركزي - الرياض</option>
                      <option value="2">مستودع المعرض - العليا</option>
                      <option value="3">مستودع جدة الرئيسي</option>
                      <option value="4">مستودع الدمام اللوجستي</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddProductModal(false)} className="btn btn-secondary">إلغاء</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'جاري الإضافة...' : 'إضافة وتخزين بالدليل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
