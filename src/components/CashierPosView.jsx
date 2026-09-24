import React, { useState, useEffect } from 'react';
import { 
  Store, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CheckCircle2, 
  Receipt, 
  Printer, 
  Search, 
  User, 
  Tag, 
  CreditCard, 
  Banknote, 
  Sprout,
  AlertTriangle,
  Lock,
  Percent,
  X
} from 'lucide-react';
import { safeFetch, LocalSaaSStorage } from '../api/client';
import PrintableInvoiceModal from './PrintableInvoiceModal';

export default function CashierPosView({ 
  products = [], 
  branches = [], 
  currentUser, 
  currentTenant,
  contacts = [], 
  onSaleSuccess,
  onSaleCompleted
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceTier, setPriceTier] = useState('retail'); // 'retail' (تجزئة) or 'wholesale' (جملة)
  const [cart, setCart] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);

  // Cashier Permissions State
  const [cashierPermissions, setCashierPermissions] = useState(() => {
    try {
      return LocalSaaSStorage.getCashierPermissions();
    } catch {
      return {
        allow_discount: true,
        max_discount_percent: 15,
        allow_delete_items: true,
        allow_price_override: false,
        allow_credit_sales: true,
        supervisor_pin: '1234'
      };
    }
  });

  useEffect(() => {
    safeFetch('/api/cashier-permissions').then(res => {
      if (res && res.success && res.data) {
        setCashierPermissions(res.data);
      }
    }).catch(() => {});
  }, []);

  const activeBranchId = currentUser?.branch_id || branches[0]?.id || 1;
  const currentBranch = branches.find(b => b.id == activeBranchId) || branches[0];
  const currentWarehouseId = currentBranch?.warehouses?.[0]?.id || 1;

  // استخراج فئات الأصناف الزراعية المتاحة
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (searchTerm) {
      const matchName = p.name_ar.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSku = p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchBarcode = p.barcode?.includes(searchTerm);
      if (!matchName && !matchSku && !matchBarcode) return false;
    }
    return true;
  });

  // التحقق من الرقم السري للمشرف عند حذف أصناف إذا كانت الصلاحية مقيدة
  const verifySupervisorPin = () => {
    const isRestricted = currentUser?.role === 'cashier' || (!currentUser?.role?.includes('admin'));
    if (!cashierPermissions.allow_delete_items && isRestricted) {
      const pin = window.prompt('🔒 تنبيه: حذف الأصناف مقيد. يرجى إدخال الرقم السري للمشرف للمتابعة:');
      if (!pin || pin.trim() !== String(cashierPermissions.supervisor_pin || '1234').trim()) {
        alert('❌ الرقم السري للمشرف غير صحيح! تم إلغاء عملية الحذف.');
        return false;
      }
    }
    return true;
  };

  // إضافة صنف إلى السلة
  const addToCart = (product) => {
    const price = priceTier === 'wholesale' ? (product.wholesale_price || product.selling_price) : (product.retail_price || product.selling_price);
    const existingIndex = cart.findIndex(it => it.product_id === product.id);

    if (existingIndex > -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          sku: product.sku,
          name_ar: product.name_ar,
          unit: product.unit,
          unit_price: Number(price),
          quantity: 1
        }
      ]);
    }
  };

  const updateQuantity = (index, delta) => {
    const newCart = [...cart];
    if (newCart[index].quantity + delta <= 0) {
      if (!verifySupervisorPin()) return;
      newCart.splice(index, 1);
    } else {
      newCart[index].quantity += delta;
    }
    setCart(newCart);
  };

  const removeFromCart = (index) => {
    if (!verifySupervisorPin()) return;
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (!verifySupervisorPin()) return;
    if (window.confirm('هل أنت متأكد من إفراغ السلة؟')) {
      setCart([]);
      setDiscountPercent(0);
    }
  };

  // تبديل فئة السعر (تجزئة / جملة) وتحديث السلة
  const handlePriceTierChange = (tier) => {
    setPriceTier(tier);
    const updatedCart = cart.map(item => {
      const prod = products.find(p => p.id === item.product_id);
      if (!prod) return item;
      const newPrice = tier === 'wholesale' ? (prod.wholesale_price || prod.selling_price) : (prod.retail_price || prod.selling_price);
      return { ...item, unit_price: Number(newPrice) };
    });
    setCart(updatedCart);
  };

  const rawSubtotal = cart.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
  const discountAmount = cashierPermissions.allow_discount ? (rawSubtotal * (Number(discountPercent) || 0) / 100) : 0;
  const subtotal = Math.max(0, rawSubtotal - discountAmount);
  const vatTotal = subtotal * 0.15;
  const grandTotal = subtotal + vatTotal;

  // إتمام البيع
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const data = await safeFetch('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          invoice_type: 'simplified_invoice',
          branch_id: Number(activeBranchId),
          warehouse_id: Number(currentWarehouseId),
          customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
          cashier_id: currentUser?.id || null,
          payment_method: paymentMethod,
          price_tier: priceTier,
          items: cart.map(it => ({
            product_id: it.product_id,
            name_ar: it.name_ar,
            item_name: it.name_ar,
            quantity: it.quantity,
            unit_price: it.unit_price
          })),
          notes: `مبيعات كاشير (${currentUser?.name || 'كاشير'}) - صالة المشتل`
        })
      });

      if (data.success) {
        setLastInvoice({
          invoice_number: data.invoiceNumber || data.data?.invoice_number || 'INV-2026-00001',
          journal_entry_number: data.journalEntryNumber || data.data?.journal_entry_number || 'JE-2026-0001',
          zatca_qr: data.zatcaQr || data.data?.zatca_qr,
          zatca_xml: data.zatcaXml || data.data?.zatca_xml,
          zatca_hash: data.zatcaHash || data.data?.zatca_hash,
          cryptographic_stamp: data.cryptographicStamp || data.data?.cryptographic_stamp,
          grand_total: grandTotal,
          subtotal: subtotal,
          vat_total: vatTotal,
          items: [...cart],
          issue_date: new Date().toISOString().split('T')[0],
          issue_time: new Date().toLocaleTimeString('ar-SA'),
          payment_method: paymentMethod
        });
        setCart([]);
        if (typeof onSaleCompleted === 'function') onSaleCompleted();
        if (typeof onSaleSuccess === 'function') onSaleSuccess();
      } else {
        alert('حدث خطأ أثناء إتمام البيع: ' + (data.error || 'يرجى مراجعة البيانات'));
      }
    } catch (err) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', height: 'calc(100vh - 120px)' }}>
      {/* Products & Catalog Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        {/* Top Control Bar */}
        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Price Tier Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#e2e8f0', padding: '0.25rem', borderRadius: '10px' }}>
            <button
              onClick={() => handlePriceTierChange('retail')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: priceTier === 'retail' ? '#047857' : 'transparent',
                color: priceTier === 'retail' ? '#ffffff' : '#475569',
                fontWeight: 800,
                fontSize: '0.825rem',
                cursor: 'pointer'
              }}
            >
              🏷️ بيع تجزئة (Retail)
            </button>
            <button
              onClick={() => handlePriceTierChange('wholesale')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: priceTier === 'wholesale' ? '#047857' : 'transparent',
                color: priceTier === 'wholesale' ? '#ffffff' : '#475569',
                fontWeight: 800,
                fontSize: '0.825rem',
                cursor: 'pointer'
              }}
            >
              📦 بيع جملة ومقاولات (Wholesale)
            </button>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', right: '12px', top: '12px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="بحث باسم الشتلة أو الباركود..."
              className="form-input"
              style={{ paddingRight: '2.4rem', width: '100%', fontSize: '0.85rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Categories Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '9999px',
                border: selectedCategory === cat ? '2px solid #047857' : '1px solid #cbd5e1',
                background: selectedCategory === cat ? '#ecfdf5' : '#ffffff',
                color: selectedCategory === cat ? '#065f46' : '#475569',
                fontWeight: 700,
                fontSize: '0.825rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {cat === 'all' ? '🌿 كافة الأصناف' : cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
          {filteredProducts.map(p => {
            const currentPrice = priceTier === 'wholesale' ? (p.wholesale_price || p.selling_price) : (p.retail_price || p.selling_price);
            const priceWithVat = currentPrice * 1.15;
            const inStock = p.stock > 0;

            return (
              <div
                key={p.id}
                onClick={() => inStock && addToCart(p)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: inStock ? 'pointer' : 'not-allowed',
                  opacity: inStock ? 1 : 0.6,
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.category}</span>
                    <span className={`badge ${p.stock > 10 ? 'badge-success' : p.stock > 0 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                      {p.stock} {p.unit}
                    </span>
                  </div>

                  {p.stock <= 10 && p.stock > 0 && (
                    <div style={{ fontSize: '0.675rem', color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700, marginBottom: '4px' }}>
                      <AlertTriangle size={11} />
                      <span>أوشك على النفاد</span>
                    </div>
                  )}

                  <h5 style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.3, marginBottom: '0.5rem', minHeight: '38px' }}>
                    {p.name_ar}
                  </h5>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div className="font-mono" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#047857' }}>
                      {priceWithVat.toFixed(2)} <span style={{ fontSize: '0.7rem' }}>ر.س</span>
                    </div>
                    <div style={{ fontSize: '0.675rem', color: '#94a3b8' }}>
                      بدون ضريبة: {currentPrice.toFixed(2)}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!inStock}
                    style={{
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      color: '#065f46',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cashier Cart & Checkout Column */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', height: '100%', position: 'sticky', top: '90px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={20} style={{ color: '#047857' }} />
            <h4 style={{ fontWeight: 800, fontSize: '1.05rem' }}>سلة البيع ({cart.length})</h4>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} style={{ background: 'none', border: 'none', color: '#be123c', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
              إفراغ السلة
            </button>
          )}
        </div>

        {/* Customer select */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>العميل:</label>
          <select
            className="form-select"
            style={{ width: '100%', fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
            value={selectedCustomerId}
            onChange={e => setSelectedCustomerId(e.target.value)}
          >
            <option value="">عميل نقدي عام (تجزئة)</option>
            {contacts.filter(c => c.type === 'customer').map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Cart Items List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
              <Sprout size={36} style={{ margin: '0 auto 0.5rem', color: '#cbd5e1' }} />
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>السلة فارغة</div>
              <div style={{ fontSize: '0.75rem' }}>انقر على أي شتلة أو منتج لإضافته للبيع</div>
            </div>
          ) : (
            cart.map((it, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ flex: 1, minWidth: 0, paddingLeft: '0.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.825rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {it.name_ar}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {it.unit_price.toFixed(2)} ر.س × {it.quantity}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button onClick={() => updateQuantity(idx, -1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Minus size={12} />
                  </button>
                  <span className="font-mono" style={{ fontWeight: 800, fontSize: '0.85rem', width: '20px', textAlign: 'center' }}>
                    {it.quantity}
                  </span>
                  <button onClick={() => updateQuantity(idx, 1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Plus size={12} />
                  </button>
                  <button onClick={() => removeFromCart(idx)} style={{ background: 'none', border: 'none', color: '#be123c', cursor: 'pointer', padding: '0 0.2rem' }} title="حذف الصنف">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Discount Selector (Protected by Cashier Permissions) */}
        {cart.length > 0 && (
          <div style={{ background: '#f8fafc', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Percent size={13} style={{ color: '#047857' }} />
                <span>خصم الكاشير:</span>
              </span>
              {!cashierPermissions.allow_discount ? (
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Lock size={11} /> غير مصرح
                </span>
              ) : (
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  الحد الأقصى المسموح: {cashierPermissions.max_discount_percent || 15}%
                </span>
              )}
            </div>

            {cashierPermissions.allow_discount ? (
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                {[0, 5, 10, 15].filter(p => p <= (cashierPermissions.max_discount_percent || 100)).map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDiscountPercent(pct)}
                    style={{
                      flex: 1,
                      padding: '3px 0',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: discountPercent === pct ? '1px solid #047857' : '1px solid #cbd5e1',
                      background: discountPercent === pct ? '#047857' : '#ffffff',
                      color: discountPercent === pct ? '#ffffff' : '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    {pct === 0 ? 'بدون' : `${pct}%`}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.725rem', color: '#b45309', background: '#fef3c7', padding: '3px 6px', borderRadius: '4px' }}>
                🔒 تم قفل صلاحية الخصم من قِبل إدارة النظام
              </div>
            )}
          </div>
        )}

        {/* Payment Methods */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '0.75rem' }}>
          <button
            onClick={() => setPaymentMethod('cash')}
            style={{
              padding: '0.4rem',
              borderRadius: '8px',
              border: paymentMethod === 'cash' ? '2px solid #047857' : '1px solid #e2e8f0',
              background: paymentMethod === 'cash' ? '#ecfdf5' : '#f8fafc',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
              color: paymentMethod === 'cash' ? '#047857' : '#475569'
            }}
          >
            💵 نقداً
          </button>
          <button
            onClick={() => setPaymentMethod('card')}
            style={{
              padding: '0.4rem',
              borderRadius: '8px',
              border: paymentMethod === 'card' ? '2px solid #047857' : '1px solid #e2e8f0',
              background: paymentMethod === 'card' ? '#ecfdf5' : '#f8fafc',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
              color: paymentMethod === 'card' ? '#047857' : '#475569'
            }}
          >
            💳 مدى / شبكة
          </button>
          <button
            onClick={() => {
              if (!cashierPermissions.allow_credit_sales && currentUser?.role === 'cashier') {
                alert('🔒 البيع الآجل غير مصرح لحساب الكاشير!');
                return;
              }
              setPaymentMethod('credit');
            }}
            disabled={!cashierPermissions.allow_credit_sales && currentUser?.role === 'cashier'}
            style={{
              padding: '0.4rem',
              borderRadius: '8px',
              border: paymentMethod === 'credit' ? '2px solid #047857' : '1px solid #e2e8f0',
              background: (!cashierPermissions.allow_credit_sales && currentUser?.role === 'cashier') ? '#f1f5f9' : paymentMethod === 'credit' ? '#ecfdf5' : '#f8fafc',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: (!cashierPermissions.allow_credit_sales && currentUser?.role === 'cashier') ? 'not-allowed' : 'pointer',
              color: (!cashierPermissions.allow_credit_sales && currentUser?.role === 'cashier') ? '#94a3b8' : paymentMethod === 'credit' ? '#047857' : '#475569',
              opacity: (!cashierPermissions.allow_credit_sales && currentUser?.role === 'cashier') ? 0.6 : 1
            }}
          >
            📝 آجل {(!cashierPermissions.allow_credit_sales && currentUser?.role === 'cashier') ? '🔒' : ''}
          </button>
        </div>

        {/* Totals Summary */}
        <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
            <span>المبلغ قبل الضريبة:</span>
            <span className="font-mono">{subtotal.toFixed(2)} ر.س</span>
          </div>
          {discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#be123c' }}>
              <span>قيمة الخصم ({discountPercent}%):</span>
              <span className="font-mono">-{discountAmount.toFixed(2)} ر.س</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#d97706' }}>
            <span>ضريبة القيمة المضافة 15%:</span>
            <span className="font-mono">{vatTotal.toFixed(2)} ر.س</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 900, color: '#047857', borderTop: '1px solid #e2e8f0', paddingTop: '0.35rem' }}>
            <span>الإجمالي النهائي:</span>
            <span className="font-mono">{grandTotal.toFixed(2)} ر.س</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleCheckout}
          disabled={cart.length === 0 || checkoutLoading}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.75rem', fontWeight: 800, background: '#047857' }}
        >
          {checkoutLoading ? 'جاري خصم المخزون والفوترة...' : 'إتمام البيع وطباعة الفاتورة (ZATCA)'}
        </button>
      </div>

      {/* Modal: Printable Tax Invoice & ZATCA QR PDF */}
      {lastInvoice && (
        <PrintableInvoiceModal 
          invoice={lastInvoice}
          tenant={currentTenant}
          branch={currentBranch}
          currentUser={currentUser}
          onClose={() => setLastInvoice(null)}
        />
      )}
    </div>
  );
}
