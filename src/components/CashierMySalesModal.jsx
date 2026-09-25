import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Receipt, 
  DollarSign, 
  CreditCard, 
  Banknote, 
  Clock, 
  UserCheck, 
  Search, 
  RefreshCw, 
  X, 
  TrendingUp, 
  CheckCircle2, 
  Eye, 
  Printer,
  CalendarDays,
  ShieldAlert
} from 'lucide-react';
import { safeFetch } from '../api/client';
import PrintableInvoiceModal from './PrintableInvoiceModal';

export default function CashierMySalesModal({ 
  isOpen, 
  onClose, 
  currentUser,
  currentTenant
}) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [datePreset, setDatePreset] = useState('today');
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState({
    invoices: [],
    summary: {
      total_sales_revenue: 0,
      total_sales_grand: 0,
      total_vat: 0,
      invoices_count: 0,
      cash_total: 0,
      card_total: 0,
      credit_total: 0
    }
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchMySales();
    }
  }, [isOpen, fromDate, toDate]);

  const applyPreset = (preset) => {
    setDatePreset(preset);
    const curr = new Date();
    const today = curr.toISOString().split('T')[0];

    if (preset === 'today') {
      setFromDate(today);
      setToDate(today);
    } else if (preset === 'yesterday') {
      const y = new Date(curr);
      y.setDate(curr.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setFromDate(yStr);
      setToDate(yStr);
    } else if (preset === 'last_7_days') {
      const d7 = new Date(curr);
      d7.setDate(curr.getDate() - 6);
      setFromDate(d7.toISOString().split('T')[0]);
      setToDate(today);
    } else if (preset === 'this_month') {
      const first = new Date(curr.getFullYear(), curr.getMonth(), 1).toISOString().split('T')[0];
      setFromDate(first);
      setToDate(today);
    } else if (preset === 'all') {
      setFromDate('2024-01-01');
      setToDate(today);
    }
  };

  const fetchMySales = async () => {
    setLoading(true);
    try {
      const cashierId = currentUser?.id || currentUser?.username || '1';
      const url = `/api/cashier/my-sales?cashierId=${encodeURIComponent(cashierId)}&fromDate=${fromDate}&toDate=${toDate}`;
      const res = await safeFetch(url);
      if (res && res.success && res.data) {
        setSalesData(res.data);
      }
    } catch (err) {
      console.warn('Error fetching cashier personal sales:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const invoices = salesData.invoices || [];
  const filteredInvoices = invoices.filter(inv => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (inv.invoice_number && inv.invoice_number.toLowerCase().includes(term)) ||
      (inv.customer_name && inv.customer_name.toLowerCase().includes(term)) ||
      (inv.payment_method && inv.payment_method.toLowerCase().includes(term))
    );
  });

  const summary = salesData.summary || {};

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.78)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1rem',
      backdropFilter: 'blur(5px)'
    }}>
      <div className="modal-content" style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '1000px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
        border: '1px solid rgba(226, 232, 240, 0.8)'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #065f46 0%, #047857 50%, #022c22 100%)',
          padding: '1.25rem 1.75rem',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.18)', padding: '0.65rem', borderRadius: '12px' }}>
              <Receipt size={26} style={{ color: '#a7f3d0' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0 }}>
                  سجل مبيعاتي الشخصية (فواتيري بالتواريخ)
                </h3>
                <span style={{
                  fontSize: '0.72rem',
                  background: 'rgba(255,255,255,0.2)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  fontWeight: 800,
                  color: '#ecfdf5'
                }}>
                  خصوصية تامة للكاشير
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#d1fae5', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span>👤 الكاشير: <strong>{currentUser?.name_ar || currentUser?.name || 'كاشير الفرع'}</strong></span>
                <span>•</span>
                <span>🏢 الفرع: <strong>{currentUser?.branch_name || currentTenant?.name_ar || 'الفرع الرئيسي'}</strong></span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '10px',
              padding: '0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            title="إغلاق النافذة"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Container */}
        <div style={{ padding: '1.25rem 1.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Date Range Selector & Presets */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            {/* Presets buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 800, color: '#334155' }}>
                <CalendarDays size={16} style={{ color: '#047857' }} />
                <span>اختر الفترة الزمنية:</span>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'today', label: 'اليوم' },
                  { id: 'yesterday', label: 'أمس' },
                  { id: 'last_7_days', label: 'آخر 7 أيام' },
                  { id: 'this_month', label: 'هذا الشهر' },
                  { id: 'all', label: 'جميع مبيعاتي' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: datePreset === p.id ? '1px solid #047857' : '1px solid #cbd5e1',
                      background: datePreset === p.id ? '#047857' : '#ffffff',
                      color: datePreset === p.id ? '#ffffff' : '#475569',
                      transition: 'all 0.15s'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                  من تاريخ:
                </label>
                <input
                  type="date"
                  className="form-input font-mono"
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  value={fromDate}
                  onChange={e => {
                    setFromDate(e.target.value);
                    setDatePreset('custom');
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                  إلى تاريخ:
                </label>
                <input
                  type="date"
                  className="form-input font-mono"
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem' }}
                  value={toDate}
                  onChange={e => {
                    setToDate(e.target.value);
                    setDatePreset('custom');
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={fetchMySales}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    padding: '0.5rem 1rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  <span>{loading ? 'جاري الجلب...' : 'تحديث الحسابات'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4 Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            {/* 1. إجمالي مبيعاتي */}
            <div style={{
              background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
              color: '#ffffff',
              padding: '1rem',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#a7f3d0', fontWeight: 700 }}>صافي مبيعاتي للفترة</span>
                <TrendingUp size={18} style={{ color: '#6ee7b7' }} />
              </div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 900 }}>
                {(summary.total_sales_revenue || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} <span style={{ fontSize: '0.8rem' }}>ر.س</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#d1fae5', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.35rem' }}>
                شامل الضريبة: {(summary.total_sales_grand || 0).toFixed(2)} ر.س
              </div>
            </div>

            {/* 2. عدد الفواتير */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '1rem',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700 }}>عدد الفواتير المصدرة</span>
                <Receipt size={18} style={{ color: '#0284c7' }} />
              </div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>
                {summary.invoices_count || 0} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>فاتورة</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '0.35rem' }}>
                متوسط الفاتورة: {summary.invoices_count ? ((summary.total_sales_grand || 0) / summary.invoices_count).toFixed(2) : '0.00'} ر.س
              </div>
            </div>

            {/* 3. ضريبة القيمة المضافة 15% */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '1rem',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700 }}>ضريبة ZATCA (15%)</span>
                <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>15%</span>
              </div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#d97706' }}>
                {(summary.total_vat || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} <span style={{ fontSize: '0.8rem' }}>ر.س</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '0.35rem' }}>
                مسجلة ومعتمدة زكوياً
              </div>
            </div>

            {/* 4. تفصيل طرق الدفع */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '1rem',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}>
              <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700 }}>طرق التحصيل النقدي والشبكة</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.2rem', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Banknote size={12} /> نقداً:
                  </span>
                  <strong className="font-mono">{(summary.cash_total || 0).toFixed(2)} ر.س</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CreditCard size={12} /> مدى / شبكة:
                  </span>
                  <strong className="font-mono">{(summary.card_total || 0).toFixed(2)} ر.س</strong>
                </div>
                {summary.credit_total > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#d97706' }}>آجل:</span>
                    <strong className="font-mono">{(summary.credit_total || 0).toFixed(2)} ر.س</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table Search & Invoices List */}
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '0.85rem 1rem',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>
                قائمة فواتير الفترة ({filteredInvoices.length} فاتورة)
              </div>
              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={14} style={{ position: 'absolute', right: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="بحث برقم الفاتورة أو العميل..."
                  className="form-input"
                  style={{ width: '100%', padding: '0.35rem 1.8rem 0.35rem 0.5rem', fontSize: '0.8rem' }}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>
                    <th style={{ padding: '0.65rem' }}>رقم الفاتورة</th>
                    <th style={{ padding: '0.65rem' }}>التاريخ والوقت</th>
                    <th style={{ padding: '0.65rem' }}>العميل</th>
                    <th style={{ padding: '0.65rem' }}>طريقة الدفع</th>
                    <th style={{ padding: '0.65rem' }}>المبلغ بدون ضريبة</th>
                    <th style={{ padding: '0.65rem' }}>الضريبة 15%</th>
                    <th style={{ padding: '0.65rem' }}>الإجمالي النهائي</th>
                    <th style={{ padding: '0.65rem', textAlign: 'center' }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                        لا توجد فواتير خاصة بك في هذه الفترة المحددة
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv, idx) => (
                      <tr key={inv.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="font-mono" style={{ fontWeight: 800, color: '#047857', padding: '0.65rem' }}>
                          {inv.invoice_number || inv.invoiceNumber || 'INV-2026'}
                        </td>
                        <td style={{ padding: '0.65rem', color: '#64748b' }}>
                          {inv.issue_date || inv.date || fromDate} {inv.issue_time ? `• ${inv.issue_time}` : ''}
                        </td>
                        <td style={{ padding: '0.65rem', fontWeight: 600 }}>
                          {inv.customer_name || 'عميل نقدي عام'}
                        </td>
                        <td style={{ padding: '0.65rem' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: inv.payment_method === 'card' ? '#eff6ff' : inv.payment_method === 'credit' ? '#fef3c7' : '#ecfdf5',
                            color: inv.payment_method === 'card' ? '#1d4ed8' : inv.payment_method === 'credit' ? '#b45309' : '#047857'
                          }}>
                            {inv.payment_method === 'card' ? 'مدى / شبكة' : inv.payment_method === 'credit' ? 'آجل' : 'نقداً'}
                          </span>
                        </td>
                        <td className="font-mono" style={{ padding: '0.65rem', fontWeight: 600 }}>
                          {(Number(inv.subtotal) || 0).toFixed(2)} ر.س
                        </td>
                        <td className="font-mono" style={{ padding: '0.65rem', color: '#d97706', fontWeight: 600 }}>
                          {(Number(inv.vat_total || inv.vat_amount) || 0).toFixed(2)} ر.س
                        </td>
                        <td className="font-mono" style={{ padding: '0.65rem', fontWeight: 800, color: '#0f172a' }}>
                          {(Number(inv.grand_total || inv.total_amount) || 0).toFixed(2)} ر.س
                        </td>
                        <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceForPrint(inv)}
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            title="معاينة وطباعة الفاتورة"
                          >
                            <Printer size={12} />
                            <span>طباعة</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          padding: '0.85rem 1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            🔒 الصلاحية مقيدة: لا يمكن للكاشير استعراض مبيعات الفروع الأخرى أو مبيعات زملاء العمل حفاظاً على الخصوصية.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 1.25rem', fontWeight: 700 }}
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Printable Invoice Modal if clicked */}
      {selectedInvoiceForPrint && (
        <PrintableInvoiceModal
          invoice={selectedInvoiceForPrint}
          tenant={currentTenant}
          onClose={() => setSelectedInvoiceForPrint(null)}
        />
      )}
    </div>
  );
}
