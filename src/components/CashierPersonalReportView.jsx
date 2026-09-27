import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Receipt, 
  CreditCard, 
  Banknote, 
  Clock, 
  UserCheck, 
  Search, 
  RefreshCw, 
  TrendingUp, 
  CheckCircle2, 
  Eye, 
  Printer,
  CalendarDays,
  ShieldAlert,
  Lock,
  Building,
  DollarSign,
  AlertTriangle,
  Award,
  FileSpreadsheet
} from 'lucide-react';
import { safeFetch, LocalSaaSStorage } from '../api/client';
import PrintableInvoiceModal from './PrintableInvoiceModal';

export default function CashierPersonalReportView({ 
  currentUser,
  currentTenant,
  branches = []
}) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [datePreset, setDatePreset] = useState('today'); // 'today', 'yesterday', 'this_month', 'last_month', 'custom'
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState(null);

  // حالة الوردية الحالية للكاشير
  const [currentShift, setCurrentShift] = useState(null);
  const [showShiftClosingModal, setShowShiftClosingModal] = useState(false);
  const [closingActualCash, setClosingActualCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [closingSuccess, setClosingSuccess] = useState(false);

  // مبيعات الكاشير الشخصية
  const [salesData, setSalesData] = useState({
    invoices: [],
    summary: {
      total_revenue: 0,
      total_vat: 0,
      total_grand: 0,
      sales_count: 0,
      cash_total: 0,
      card_total: 0,
      credit_total: 0,
      average_sale: 0
    }
  });

  // فحص صلاحية استخراج التقارير للكاشير
  const cashierPermissions = (() => {
    try {
      const allCashiers = LocalSaaSStorage.getCashiers('all');
      const found = allCashiers.find(c => c.id == currentUser?.id || c.username == currentUser?.username);
      if (found && found.permissions) return found.permissions;
      return LocalSaaSStorage.getCashierPermissions();
    } catch {
      return { can_view_own_reports: true };
    }
  })();

  const canViewReports = cashierPermissions.can_view_own_reports !== false;

  useEffect(() => {
    fetchMySales();
    fetchCurrentShift();
  }, [fromDate, toDate, currentUser]);

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
    } else if (preset === 'this_month') {
      const first = new Date(curr.getFullYear(), curr.getMonth(), 1).toISOString().split('T')[0];
      setFromDate(first);
      setToDate(today);
    } else if (preset === 'last_month') {
      const firstLastMonth = new Date(curr.getFullYear(), curr.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDayLastMonth = new Date(curr.getFullYear(), curr.getMonth(), 0).toISOString().split('T')[0];
      setFromDate(firstLastMonth);
      setToDate(lastDayLastMonth);
    }
  };

  const fetchMySales = async () => {
    setLoading(true);
    try {
      const cashierId = currentUser?.id || currentUser?.username || '1';
      const cashierName = currentUser?.name || currentUser?.name_ar || currentUser?.user_name || '';
      const url = `/api/cashier/my-sales?cashierId=${encodeURIComponent(cashierId)}&cashierName=${encodeURIComponent(cashierName)}&fromDate=${fromDate}&toDate=${toDate}`;
      const res = await safeFetch(url);
      if (res && res.success && res.data) {
        setSalesData(res.data);
      }
    } catch (err) {
      console.warn('Error fetching personal sales:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentShift = () => {
    try {
      const shift = LocalSaaSStorage.getCurrentShift(currentUser?.tenant_id || 1);
      setCurrentShift(shift);
      if (shift) setClosingActualCash(shift.closing_amount || '');
    } catch {
      setCurrentShift(null);
    }
  };

  const handleCloseShift = (e) => {
    e.preventDefault();
    if (!closingActualCash) {
      alert('يرجى إدخال مبلغ النقدية الفعلي في الصندوق');
      return;
    }

    try {
      const expectedCash = salesData.summary.cash_total || 0;
      const actual = Number(closingActualCash);
      const diff = actual - expectedCash;

      const updatedShift = {
        ...(currentShift || {}),
        shift_number: currentShift?.shift_number || `SH-${Date.now().toString().slice(-4)}`,
        cashier_name: currentUser?.name || currentUser?.user_name || 'الكاشير',
        status: 'closed',
        end_time: new Date().toISOString(),
        expected_cash: expectedCash,
        actual_cash: actual,
        difference: diff,
        cash_sales: expectedCash,
        card_sales: salesData.summary.card_total || 0,
        total_sales: salesData.summary.total_grand || 0,
        invoices_count: salesData.summary.sales_count || 0,
        notes: closingNotes || `تم إقفال الوردية ${diff === 0 ? 'بمطابقة تامة' : diff > 0 ? `بزيادة ${diff.toFixed(2)} ر.س` : `بعجز ${Math.abs(diff).toFixed(2)} ر.س`}`
      };

      // حفظ الوردية في التخزين
      const shifts = LocalSaaSStorage.getShifts(currentUser?.tenant_id || 1);
      const idx = shifts.findIndex(s => s.id === updatedShift.id);
      if (idx !== -1) shifts[idx] = updatedShift;
      else shifts.unshift(updatedShift);
      LocalSaaSStorage.set('shifts', shifts);

      setCurrentShift(updatedShift);
      setClosingSuccess(true);
      setTimeout(() => {
        setClosingSuccess(false);
        setShowShiftClosingModal(false);
      }, 2500);
    } catch (err) {
      alert('حدث خطأ أثناء إقفال الوردية: ' + err.message);
    }
  };

  // فلترة الفواتير المعروضة بالبحث
  const filteredInvoices = (salesData.invoices || []).filter(inv => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const invNum = (inv.invoice_number || inv.invoiceNumber || '').toLowerCase();
    const cust = (inv.customer_name || '').toLowerCase();
    return invNum.includes(term) || cust.includes(term);
  });

  const assignedBranch = branches.find(b => b.id == currentUser?.branch_id) || {
    id: currentUser?.branch_id || 1,
    name_ar: currentUser?.branch_name || 'فرع الصالة الرئيسي'
  };

  // 🔒 إذا عطل المسؤول صلاحية استخراج التقارير لهذا الكاشير
  if (!canViewReports) {
    return (
      <div style={{
        maxWidth: '800px',
        margin: '3rem auto',
        padding: '2.5rem',
        background: '#ffffff',
        borderRadius: '16px',
        border: '2px solid #fecaca',
        textAlign: 'center',
        boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.1)'
      }}>
        <div style={{
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: '#fee2e2',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem auto'
        }}>
          <Lock size={36} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#991b1b', marginBottom: '0.75rem' }}>
          صلاحية استخراج التقارير معطلة لحسابك
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.7', maxWidth: '550px', margin: '0 auto 1.5rem auto' }}>
          عذراً، قام المحاسب الرئيسي / مدير النظام بتعطيل صلاحية استخراج التقارير والاطلاع على المبيعات لهذا الحساب. يرجى مراجعة إدارة الفرع لتفعيل الصلاحية لك.
        </p>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1.25rem',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          fontSize: '0.85rem',
          color: '#475569'
        }}>
          <UserCheck size={16} />
          <span>المستخدم: <strong>{currentUser?.name || currentUser?.username}</strong></span>
          <span style={{ margin: '0 0.5rem' }}>|</span>
          <Building size={16} />
          <span>الفرع: <strong>{assignedBranch.name_ar}</strong></span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* رأس شاشة تقرير الكاشير الشخصي مع شارة الحماية */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #065f46 100%)',
        padding: '1.75rem 2rem',
        borderRadius: '16px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.25rem',
        boxShadow: '0 10px 25px -5px rgba(4, 120, 87, 0.25)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <span style={{
              background: '#ecfdf5',
              color: '#065f46',
              padding: '0.2rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 800
            }}>
              🔒 تقرير شخصي مقيد (مبيعاتك فقط)
            </span>
            <span style={{ fontSize: '0.85rem', color: '#a7f3d0' }}>
              الفرع المخصص: {assignedBranch.name_ar}
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0 }}>
            تقرير المبيعات الشخصية وإنتاجية الوردية
          </h2>
          <p style={{ color: '#d1fae5', fontSize: '0.875rem', margin: '0.4rem 0 0 0' }}>
            الكاشير: <strong>{currentUser?.name || currentUser?.user_name || 'كاشير الصالة'}</strong> ({currentUser?.username || 'user'}) — متابعة الفواتير المحصلة وإقفال الصندوق بدقة.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* زر إقفال الوردية وجرد الصندوق */}
          <button
            onClick={() => setShowShiftClosingModal(true)}
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              color: '#ffffff',
              border: 'none',
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)'
            }}
          >
            <Clock size={18} />
            <span>إقفال الوردية وجرد الصندوق</span>
          </button>

          {/* زر طباعة التقرير الكامل */}
          <button
            onClick={() => window.print()}
            className="btn"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Printer size={18} />
            <span>طباعة تقرير الإنتاجية</span>
          </button>
        </div>
      </div>

      {/* شريط فلترة التواريخ (يومي / شهري / مخصص) */}
      <div className="card" style={{
        padding: '1.25rem',
        borderRadius: '14px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* أزرار الفلترة السريعة (يومي وشهري) */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'today', label: '📅 مبيعات اليوم', sub: 'اليومي' },
            { id: 'yesterday', label: '📅 مبيعات الأمس', sub: 'الوردية السابقة' },
            { id: 'this_month', label: '📆 هذا الشهر', sub: 'الإنتاجية الشهرية' },
            { id: 'last_month', label: '📆 الشهر الماضي', sub: 'شهري سابق' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: datePreset === p.id ? '2px solid #047857' : '1px solid #cbd5e1',
                background: datePreset === p.id ? '#ecfdf5' : '#ffffff',
                color: datePreset === p.id ? '#047857' : '#475569',
                fontWeight: 800,
                fontSize: '0.825rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.15rem'
              }}
            >
              <span>{p.label}</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({p.sub})</span>
            </button>
          ))}
        </div>

        {/* حقول اختيار التاريخ المخصص (من / إلى) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>من:</span>
            <input
              type="date"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setDatePreset('custom'); }}
              className="form-input font-mono"
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>إلى:</span>
            <input
              type="date"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setDatePreset('custom'); }}
              className="form-input font-mono"
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
            />
          </div>
          <button
            onClick={fetchMySales}
            disabled={loading}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* كروت المؤشرات المالية والإنتاجية (KPIs) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* إجمالي المبيعات المحصلة */}
        <div className="card" style={{ borderTop: '4px solid #047857', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>
            <span>إجمالي مبيعاتك المحصلة</span>
            <DollarSign size={18} style={{ color: '#047857' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#047857', marginTop: '0.4rem' }} className="font-mono">
            {(salesData.summary.total_grand || 0).toFixed(2)} <span style={{ fontSize: '0.85rem' }}>ر.س</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
            المبلغ بدون ضريبة: {(salesData.summary.total_revenue || 0).toFixed(2)} ر.س
          </div>
        </div>

        {/* ضريبة القيمة المضافة */}
        <div className="card" style={{ borderTop: '4px solid #d97706', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>
            <span>ضريبة القيمة المضافة 15%</span>
            <Receipt size={18} style={{ color: '#d97706' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#d97706', marginTop: '0.4rem' }} className="font-mono">
            {(salesData.summary.total_vat || 0).toFixed(2)} <span style={{ fontSize: '0.85rem' }}>ر.س</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
            مطابقة ومحقونة في مشفر ZATCA QR
          </div>
        </div>

        {/* عدد الفواتير ومتوسط الفاتورة */}
        <div className="card" style={{ borderTop: '4px solid #0284c7', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>
            <span>إنتاجية الفواتير</span>
            <Award size={18} style={{ color: '#0284c7' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#0284c7', marginTop: '0.4rem' }} className="font-mono">
            {salesData.summary.sales_count || 0} <span style={{ fontSize: '0.85rem' }}>فاتورة</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
            متوسط قيمة الفاتورة: {(salesData.summary.average_sale || 0).toFixed(2)} ر.س
          </div>
        </div>

        {/* تفصيل طرق التحصيل (نقد مقابل شبكة) */}
        <div className="card" style={{ borderTop: '4px solid #8b5cf6', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>
            <span>مطابقة الصندوق (النقد والشبكة)</span>
            <Banknote size={18} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Banknote size={14} /> نقداً (الكاش):
              </span>
              <strong className="font-mono">{(salesData.summary.cash_total || 0).toFixed(2)} ر.س</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CreditCard size={14} /> مدى وشبكة:
              </span>
              <strong className="font-mono">{(salesData.summary.card_total || 0).toFixed(2)} ر.س</strong>
            </div>
          </div>
        </div>
      </div>

      {/* جدول فواتير الكاشير الشخصية */}
      <div className="card" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{
          padding: '1rem 1.25rem',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>
              سجل فواتيرك الصادرة ({filteredInvoices.length} فاتورة)
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: '0.5rem' }}>
              (الفترة من {fromDate} إلى {toDate})
            </span>
          </div>

          <div style={{ position: 'relative', width: '250px' }}>
            <Search size={15} style={{ position: 'absolute', right: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="بحث برقم الفاتورة أو العميل..."
              className="form-input"
              style={{ width: '100%', padding: '0.4rem 2rem 0.4rem 0.6rem', fontSize: '0.825rem' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>
                <th style={{ padding: '0.75rem' }}>رقم الفاتورة</th>
                <th style={{ padding: '0.75rem' }}>التاريخ والوقت</th>
                <th style={{ padding: '0.75rem' }}>العميل</th>
                <th style={{ padding: '0.75rem' }}>طريقة الدفع</th>
                <th style={{ padding: '0.75rem' }}>المبلغ بدون ضريبة</th>
                <th style={{ padding: '0.75rem' }}>الضريبة 15%</th>
                <th style={{ padding: '0.75rem' }}>الإجمالي النهائي</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>معاينة وطباعة</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    لا توجد فواتير كاشير صادرة بحسابك خلال هذه الفترة المحددة
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, idx) => (
                  <tr key={inv.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="font-mono" style={{ fontWeight: 800, color: '#047857', padding: '0.75rem' }}>
                      {inv.invoice_number || inv.invoiceNumber || 'INV-2026'}
                    </td>
                    <td style={{ padding: '0.75rem', color: '#64748b' }}>
                      {inv.issue_date || inv.date || fromDate} {inv.issue_time ? `• ${inv.issue_time}` : ''}
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                      {inv.customer_name || 'عميل نقدي عام'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: inv.payment_method === 'card' ? '#eff6ff' : inv.payment_method === 'credit' ? '#fef3c7' : '#ecfdf5',
                        color: inv.payment_method === 'card' ? '#1d4ed8' : inv.payment_method === 'credit' ? '#b45309' : '#047857'
                      }}>
                        {inv.payment_method === 'card' ? 'مدى / شبكة' : inv.payment_method === 'credit' ? 'آجل' : 'نقداً'}
                      </span>
                    </td>
                    <td className="font-mono" style={{ padding: '0.75rem', fontWeight: 600 }}>
                      {(Number(inv.subtotal) || 0).toFixed(2)} ر.س
                    </td>
                    <td className="font-mono" style={{ padding: '0.75rem', color: '#d97706', fontWeight: 600 }}>
                      {(Number(inv.vat_total || inv.vat_amount) || 0).toFixed(2)} ر.س
                    </td>
                    <td className="font-mono" style={{ padding: '0.75rem', fontWeight: 800, color: '#0f172a' }}>
                      {(Number(inv.grand_total || inv.total_amount) || 0).toFixed(2)} ر.س
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceForPrint(inv)}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        title="معاينة وطباعة الفاتورة الفورية"
                      >
                        <Printer size={13} />
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

      {/* نافذة إقفال الوردية وجرد الصندوق (Shift Closing Modal) */}
      {showShiftClosingModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="modal-content" style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              color: '#ffffff',
              padding: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={22} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  إقفال الوردية ومطابقة رصيد الصندوق (Z-Report)
                </h3>
              </div>
              <button
                onClick={() => setShowShiftClosingModal(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCloseShift} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {closingSuccess && (
                <div style={{
                  background: '#ecfdf5',
                  color: '#065f46',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <CheckCircle2 size={18} />
                  <span>تم إقفال الوردية ومطابقة النقدية بنجاح 100%!</span>
                </div>
              )}

              {/* ملخص المبيعات المتوقعة في الصندوق */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>النقد المتوقع بالصندوق (Cash):</span>
                  <strong className="font-mono" style={{ color: '#047857' }}>
                    {(salesData.summary.cash_total || 0).toFixed(2)} ر.س
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>إجمالي الشبكة ومدى (Mada):</span>
                  <strong className="font-mono" style={{ color: '#0284c7' }}>
                    {(salesData.summary.card_total || 0).toFixed(2)} ر.س
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.4rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>إجمالي مبيعات الوردية:</span>
                  <strong className="font-mono" style={{ color: '#0f172a' }}>
                    {(salesData.summary.total_grand || 0).toFixed(2)} ر.س
                  </strong>
                </div>
              </div>

              {/* إدخال النقدية الفعلية */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 800 }}>
                  المبلغ النقدي الفعلي بعد الجرد في الدرج (ر.س) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="أدخل المبلغ النقدي الفعلي المحسوب..."
                  className="form-input font-mono"
                  style={{ fontSize: '1.1rem', fontWeight: 800, padding: '0.6rem' }}
                  value={closingActualCash}
                  onChange={e => setClosingActualCash(e.target.value)}
                />
              </div>

              {/* حساب الفرق تلقائياً */}
              {closingActualCash !== '' && (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: Number(closingActualCash) === (salesData.summary.cash_total || 0) ? '#ecfdf5' : '#fffbeb',
                  border: `1px solid ${Number(closingActualCash) === (salesData.summary.cash_total || 0) ? '#a7f3d0' : '#fde68a'}`,
                  fontSize: '0.85rem'
                }}>
                  {Number(closingActualCash) === (salesData.summary.cash_total || 0) ? (
                    <span style={{ color: '#065f46', fontWeight: 800 }}>
                      ✅ مطابقة تامة: لا يوجد عجز أو زيادة في الصندوق.
                    </span>
                  ) : Number(closingActualCash) > (salesData.summary.cash_total || 0) ? (
                    <span style={{ color: '#047857', fontWeight: 800 }}>
                      📈 يوجد زيادة بمقدار: {(Number(closingActualCash) - (salesData.summary.cash_total || 0)).toFixed(2)} ر.س
                    </span>
                  ) : (
                    <span style={{ color: '#b91c1c', fontWeight: 800 }}>
                      ⚠️ يوجد عجز بمقدار: {((salesData.summary.cash_total || 0) - Number(closingActualCash)).toFixed(2)} ر.س
                    </span>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">ملاحظات الإقفال والتسليم للمشرف</label>
                <textarea
                  className="form-input"
                  rows="2"
                  placeholder="أي ملاحظات حول الوردية أو تسليم النقد للمشرف..."
                  value={closingNotes}
                  onChange={e => setClosingNotes(e.target.value)}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowShiftClosingModal(false)}
                  className="btn btn-secondary"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{
                    background: 'linear-gradient(135deg, #d97706, #b45309)',
                    color: '#ffffff',
                    padding: '0.6rem 1.5rem',
                    fontWeight: 800,
                    borderRadius: '8px'
                  }}
                >
                  تأكيد إقفال الوردية وطباعة Z-Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة طباعة ومعاينة الفاتورة الفورية */}
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
