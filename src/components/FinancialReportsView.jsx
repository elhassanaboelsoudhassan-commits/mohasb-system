import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Scale, 
  TrendingUp, 
  Landmark, 
  Users, 
  FileText, 
  Printer, 
  CheckCircle2, 
  Calendar, 
  CalendarDays,
  Building2, 
  AlertCircle,
  ShoppingCart,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Receipt
} from 'lucide-react';
import { safeFetch } from '../api/client';

export default function FinancialReportsView({ branches = [], selectedBranch = 'all' }) {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getFirstDayOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  };

  const [reportTab, setReportTab] = useState('smart_date_report'); // 'smart_date_report', 'trial_balance', 'pnl', 'balance_sheet', 'vat_return', 'ar_ap'
  
  // Smart Date Range Filters
  const [fromDate, setFromDate] = useState(getFirstDayOfMonth);
  const [toDate, setToDate] = useState(getTodayStr);
  const [datePreset, setDatePreset] = useState('this_month');
  const [filterType, setFilterType] = useState('all'); // 'all', 'sales', 'purchases', 'expenses'
  const [searchTerm, setSearchTerm] = useState('');

  // Data States
  const [salesPurchasesData, setSalesPurchasesData] = useState(null);
  const [trialData, setTrialData] = useState(null);
  const [pnlData, setPnlData] = useState(null);
  const [balanceSheetData, setBalanceSheetData] = useState(null);
  const [vatReturnData, setVatReturnData] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [contactStatement, setContactStatement] = useState(null);
  const [loading, setLoading] = useState(false);

  // Apply Quick Date Presets
  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setFromDate(today);
      setToDate(today);
    } else if (preset === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
      setFromDate(startOfWeek.toISOString().split('T')[0]);
      setToDate(today);
    } else if (preset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setFromDate(first);
      setToDate(today);
    } else if (preset === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const first = new Date(now.getFullYear(), qMonth, 1).toISOString().split('T')[0];
      setFromDate(first);
      setToDate(today);
    } else if (preset === 'this_year') {
      const first = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      setFromDate(first);
      setToDate(today);
    } else if (preset === 'all') {
      setFromDate('2020-01-01');
      setToDate(today);
    }
  };

  useEffect(() => {
    if (reportTab === 'smart_date_report') {
      fetchSalesPurchasesReport();
    } else {
      fetchReportData();
    }
  }, [reportTab, selectedBranch, fromDate, toDate]);

  const fetchSalesPurchasesReport = async () => {
    setLoading(true);
    try {
      const branchParam = selectedBranch !== 'all' ? `&branchId=${selectedBranch}` : '';
      const res = await safeFetch(`/api/reports/sales-purchases?fromDate=${fromDate}&toDate=${toDate}${branchParam}`);
      if (res && res.success && res.data) {
        setSalesPurchasesData(res.data);
      }
    } catch (err) {
      console.error('Error fetching sales-purchases report:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const branchParam = selectedBranch !== 'all' ? `?branchId=${selectedBranch}` : '';

      if (reportTab === 'trial_balance') {
        const data = await safeFetch(`/api/reports/trial-balance${branchParam}`);
        if (data.success) setTrialData(data.data);
      } else if (reportTab === 'pnl') {
        const data = await safeFetch(`/api/reports/profit-loss${branchParam}`);
        if (data.success) setPnlData(data.data);
      } else if (reportTab === 'balance_sheet') {
        const data = await safeFetch(`/api/reports/balance-sheet${branchParam}`);
        if (data.success) setBalanceSheetData(data.data);
      } else if (reportTab === 'vat_return') {
        const data = await safeFetch(`/api/reports/vat-return${branchParam}`);
        if (data.success) setVatReturnData(data.data);
      } else if (reportTab === 'ar_ap') {
        const data = await safeFetch('/api/contacts');
        if (data.success) {
          setContacts(data.data);
          if (data.data.length > 0 && !selectedContactId) {
            setSelectedContactId(data.data[0].id);
            fetchContactStatement(data.data[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContactStatement = async (contactId) => {
    try {
      const data = await safeFetch(`/api/reports/contact-statement/${contactId}`);
      if (data.success) setContactStatement(data.data);
    } catch (err) {
      console.error('Error fetching statement:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtered transactions for the smart report
  const transactions = [];
  if (salesPurchasesData) {
    if (salesPurchasesData.sales && (filterType === 'all' || filterType === 'sales')) {
      salesPurchasesData.sales.forEach(s => {
        transactions.push({
          id: 'sale_' + (s.id || s.invoice_number),
          doc_number: s.invoice_number || 'INV-2026',
          date: s.issue_date || s.created_at?.split('T')[0] || fromDate,
          type: 'فاتورة مبيعات (ZATCA)',
          category_type: 'sales',
          party: s.customer_name || 'عميل نقدي عام',
          payment_method: s.payment_method === 'credit' ? 'آجل' : s.payment_method === 'card' ? 'شبكة / مدى' : 'نقداً',
          subtotal: Number(s.subtotal) || 0,
          vat: Number(s.vat_total || s.vat_amount) || 0,
          grand: Number(s.grand_total || s.total_amount) || 0,
          status: 'معتمد'
        });
      });
    }
    if (salesPurchasesData.purchases && (filterType === 'all' || filterType === 'purchases')) {
      salesPurchasesData.purchases.forEach(p => {
        transactions.push({
          id: 'pur_' + (p.id || p.invoice_number),
          doc_number: p.invoice_number || 'BILL-2026',
          date: p.invoice_date || p.date || fromDate,
          type: 'فاتورة مشتريات مورد',
          category_type: 'purchases',
          party: p.supplier_name || 'مورد زراعي',
          payment_method: p.payment_status || 'سداد معتمد',
          subtotal: Number(p.subtotal) || 0,
          vat: Number(p.vat_total || p.vat_amount) || 0,
          grand: Number(p.grand_total) || 0,
          status: 'مورد'
        });
      });
    }
    if (salesPurchasesData.expenses && (filterType === 'all' || filterType === 'expenses')) {
      salesPurchasesData.expenses.forEach(e => {
        transactions.push({
          id: 'exp_' + (e.id || e.expense_number),
          doc_number: e.expense_number || 'EXP-2026',
          date: e.date || fromDate,
          type: 'سند مصروف تشغيلي',
          category_type: 'expenses',
          party: e.category || 'مصروفات عامة',
          payment_method: e.payment_method || 'نقداً',
          subtotal: Number(e.amount) || 0,
          vat: Number(e.vat_amount) || 0,
          grand: (Number(e.amount) || 0) + (Number(e.vat_amount) || 0),
          status: 'مصروف'
        });
      });
    }
  }

  // Sort descending by date
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredTransactions = transactions.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.doc_number.toLowerCase().includes(term) ||
      t.party.toLowerCase().includes(term) ||
      t.type.toLowerCase().includes(term)
    );
  });

  const sumSubtotal = filteredTransactions.reduce((acc, t) => acc + (t.category_type === 'sales' ? t.subtotal : -t.subtotal), 0);
  const sumVat = filteredTransactions.reduce((acc, t) => acc + (t.category_type === 'sales' ? t.vat : -t.vat), 0);
  const sumGrand = filteredTransactions.reduce((acc, t) => acc + (t.category_type === 'sales' ? t.grand : -t.grand), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Report Selector Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.35rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '12px', flexWrap: 'wrap', border: '1px solid #e2e8f0' }}>
          <button
            onClick={() => setReportTab('smart_date_report')}
            className={`btn ${reportTab === 'smart_date_report' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 800 }}
          >
            <CalendarDays size={16} />
            <span>تقارير ذكية بالتواريخ (المبيعات والمشتريات)</span>
          </button>

          <button
            onClick={() => setReportTab('trial_balance')}
            className={`btn ${reportTab === 'trial_balance' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            <Scale size={15} />
            <span>ميزان المراجعة</span>
          </button>

          <button
            onClick={() => setReportTab('pnl')}
            className={`btn ${reportTab === 'pnl' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            <TrendingUp size={15} />
            <span>قائمة الدخل (P&L)</span>
          </button>

          <button
            onClick={() => setReportTab('balance_sheet')}
            className={`btn ${reportTab === 'balance_sheet' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            <Landmark size={15} />
            <span>الميزانية العمومية</span>
          </button>

          <button
            onClick={() => setReportTab('vat_return')}
            className={`btn ${reportTab === 'vat_return' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            <FileText size={15} />
            <span>إقرار ضريبة ZATCA</span>
          </button>

          <button
            onClick={() => setReportTab('ar_ap')}
            className={`btn ${reportTab === 'ar_ap' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            <Users size={15} />
            <span>كشوف حسابات العملاء والموردين</span>
          </button>
        </div>

        <button onClick={handlePrint} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
          <Printer size={16} />
          <span>طباعة التقرير</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3.5rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <RefreshCw size={36} className="spin" style={{ color: '#047857', margin: '0 auto 0.75rem' }} />
          <h4 style={{ fontWeight: 800, color: '#334155' }}>جاري استخراج وتحليل البيانات المالية...</h4>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>يتم احتساب الإيرادات والمشتريات وتصفية القيود والضريبة تلقائياً</p>
        </div>
      ) : (
        <>
          {/* ============================================================ */}
          {/* 1. تقارير ذكية بالتواريخ (المبيعات والمشتريات وصافي الأرباح) */}
          {/* ============================================================ */}
          {reportTab === 'smart_date_report' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Date Filter Controls Card */}
              <div className="card" style={{ padding: '1.25rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ background: '#ecfdf5', color: '#047857', padding: '8px', borderRadius: '10px' }}>
                      <CalendarDays size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a' }}>
                        استخراج تقرير الأرباح والمبيعات والمشتريات بالفترة الزمنية
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        حدد المدة الزمنية بدقة لاستخراج إجمالي الإيرادات، تكاليف المشتريات، ضريبة القيمة المضافة (15%)، وصافي الأرباح
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {[
                      { id: 'today', label: 'اليوم' },
                      { id: 'this_week', label: 'هذا الأسبوع' },
                      { id: 'this_month', label: 'هذا الشهر' },
                      { id: 'this_quarter', label: 'الربع الحالي' },
                      { id: 'this_year', label: 'هذا العام' },
                      { id: 'all', label: 'كافة الفترات' }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyDatePreset(p.id)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'flex-end', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      📅 من تاريخ (تاريخ البداية):
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ width: '100%', fontSize: '0.9rem', padding: '0.5rem' }}
                      value={fromDate}
                      onChange={e => {
                        setFromDate(e.target.value);
                        setDatePreset('custom');
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      📅 إلى تاريخ (تاريخ النهاية):
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ width: '100%', fontSize: '0.9rem', padding: '0.5rem' }}
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
                      onClick={fetchSalesPurchasesReport}
                      className="btn btn-primary"
                      style={{ flex: 1, padding: '0.55rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                      <RefreshCw size={15} />
                      <span>تحديث الحسابات</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Executive KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                {/* 1. إيرادات المبيعات */}
                <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)', color: '#ffffff', borderRadius: '14px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a7f3d0' }}>إجمالي إيرادات المبيعات (Gross Sales)</span>
                    <ShoppingCart size={22} style={{ color: '#6ee7b7' }} />
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.85rem', fontWeight: 900, marginBottom: '0.35rem' }}>
                    {(salesPurchasesData?.summary?.total_sales_revenue || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} <span style={{ fontSize: '0.95rem' }}>ر.س</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#d1fae5', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.5rem' }}>
                    <span>شامل الضريبة: {(salesPurchasesData?.summary?.total_sales_grand || 0).toFixed(2)} ر.س</span>
                    <span>{salesPurchasesData?.summary?.sales_count || 0} فاتورة</span>
                  </div>
                </div>

                {/* 2. تكلفة المشتريات والمصروفات */}
                <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', color: '#ffffff', borderRadius: '14px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1' }}>المشتريات والتكاليف التشغيلية</span>
                    <ArrowDownRight size={22} style={{ color: '#f87171' }} />
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.85rem', fontWeight: 900, marginBottom: '0.35rem' }}>
                    {((salesPurchasesData?.summary?.total_purchases_cost || 0) + (salesPurchasesData?.summary?.total_expenses_cost || 0)).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} <span style={{ fontSize: '0.95rem' }}>ر.س</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.5rem' }}>
                    <span>مشتريات: {(salesPurchasesData?.summary?.total_purchases_cost || 0).toFixed(2)} ر.س</span>
                    <span>مصاريف: {(salesPurchasesData?.summary?.total_expenses_cost || 0).toFixed(2)} ر.س</span>
                  </div>
                </div>

                {/* 3. ضريبة القيمة المضافة 15% */}
                <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #4338ca 0%, #3730a3 100%)', color: '#ffffff', borderRadius: '14px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c7d2fe' }}>صافي ضريبة ZATCA (15%)</span>
                    <Receipt size={22} style={{ color: '#a5b4fc' }} />
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.85rem', fontWeight: 900, marginBottom: '0.35rem' }}>
                    {(salesPurchasesData?.summary?.net_vat_due || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} <span style={{ fontSize: '0.95rem' }}>ر.س</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#e0e7ff', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.5rem' }}>
                    <span>مخرجات: {(salesPurchasesData?.summary?.total_output_vat || 0).toFixed(2)} ر.س</span>
                    <span>مدخلات: {(salesPurchasesData?.summary?.total_input_vat || 0).toFixed(2)} ر.س</span>
                  </div>
                </div>

                {/* 4. صافي الأرباح المحققة */}
                <div className="card" style={{ padding: '1.25rem', background: (salesPurchasesData?.summary?.net_profit || 0) >= 0 ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)', color: '#ffffff', borderRadius: '14px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#d1fae5' }}>صافي الربح المحقق (Net Profit)</span>
                    <TrendingUp size={22} style={{ color: '#ffffff' }} />
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.85rem', fontWeight: 900, marginBottom: '0.35rem' }}>
                    {(salesPurchasesData?.summary?.net_profit || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} <span style={{ fontSize: '0.95rem' }}>ر.س</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#ecfdf5', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.5rem' }}>
                    <span>هامش الربح: {salesPurchasesData?.summary?.profit_margin_percent || 0}%</span>
                    <span>{(salesPurchasesData?.summary?.net_profit || 0) >= 0 ? '✅ ربح تشغيلي' : '⚠️ عجز'}</span>
                  </div>
                </div>
              </div>

              {/* Transactions Table & Filters */}
              <div className="card" style={{ padding: '1.25rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileSpreadsheet size={20} style={{ color: '#047857' }} />
                    <h4 style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                      تفاصيل الحركات والفواتير خلال الفترة ({filteredTransactions.length} حركة)
                    </h4>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="بحث برقم الفاتورة أو الطرف..."
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', width: '200px' }}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />

                    <div style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '2px', borderRadius: '8px' }}>
                      {[
                        { id: 'all', label: 'الكل' },
                        { id: 'sales', label: 'فواتير المبيعات' },
                        { id: 'purchases', label: 'المشتريات' },
                        { id: 'expenses', label: 'المصروفات' }
                      ].map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFilterType(f.id)}
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: 'none',
                            background: filterType === f.id ? '#ffffff' : 'transparent',
                            color: filterType === f.id ? '#047857' : '#64748b',
                            boxShadow: filterType === f.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.65rem' }}>رقم المستند</th>
                        <th style={{ padding: '0.65rem' }}>التاريخ</th>
                        <th style={{ padding: '0.65rem' }}>نوع الحركة</th>
                        <th style={{ padding: '0.65rem' }}>الطرف المعني / الحساب</th>
                        <th style={{ padding: '0.65rem' }}>طريقة الدفع</th>
                        <th style={{ padding: '0.65rem' }}>المبلغ بدون ضريبة</th>
                        <th style={{ padding: '0.65rem' }}>الضريبة 15%</th>
                        <th style={{ padding: '0.65rem' }}>الإجمالي النهائي</th>
                        <th style={{ padding: '0.65rem' }}>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                            لا توجد حركات أو فواتير مسجلة في هذه الفترة المحددة
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map(t => (
                          <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td className="font-mono" style={{ fontWeight: 800, color: t.category_type === 'sales' ? '#047857' : t.category_type === 'purchases' ? '#1e293b' : '#be123c', padding: '0.65rem' }}>
                              {t.doc_number}
                            </td>
                            <td style={{ padding: '0.65rem', fontSize: '0.85rem' }}>{t.date}</td>
                            <td style={{ padding: '0.65rem' }}>
                              <span style={{
                                fontSize: '0.75rem',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                background: t.category_type === 'sales' ? '#ecfdf5' : t.category_type === 'purchases' ? '#eff6ff' : '#fff1f2',
                                color: t.category_type === 'sales' ? '#047857' : t.category_type === 'purchases' ? '#1d4ed8' : '#be123c'
                              }}>
                                {t.type}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem', fontWeight: 600 }}>{t.party}</td>
                            <td style={{ padding: '0.65rem', fontSize: '0.85rem' }}>{t.payment_method}</td>
                            <td className="font-mono" style={{ padding: '0.65rem', fontWeight: 700 }}>
                              {t.subtotal.toFixed(2)} ر.س
                            </td>
                            <td className="font-mono" style={{ padding: '0.65rem', color: '#d97706', fontWeight: 700 }}>
                              {t.vat.toFixed(2)} ر.س
                            </td>
                            <td className="font-mono" style={{ padding: '0.65rem', fontWeight: 800, color: t.category_type === 'sales' ? '#047857' : '#0f172a' }}>
                              {t.grand.toFixed(2)} ر.س
                            </td>
                            <td style={{ padding: '0.65rem' }}>
                              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{t.status}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredTransactions.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#f8fafc', fontWeight: 900, borderTop: '2px solid #cbd5e1' }}>
                          <td colSpan="5" style={{ padding: '0.75rem' }}>
                            صافي إجمالي الحركات المحددة:
                          </td>
                          <td className="font-mono" style={{ padding: '0.75rem', color: sumSubtotal >= 0 ? '#047857' : '#be123c' }}>
                            {sumSubtotal.toFixed(2)} ر.س
                          </td>
                          <td className="font-mono" style={{ padding: '0.75rem', color: '#d97706' }}>
                            {sumVat.toFixed(2)} ر.س
                          </td>
                          <td className="font-mono" style={{ padding: '0.75rem', color: sumGrand >= 0 ? '#047857' : '#be123c' }}>
                            {sumGrand.toFixed(2)} ر.س
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 2. ميزان المراجعة (Trial Balance) */}
          {/* ============================================================ */}
          {reportTab === 'trial_balance' && (
            <div className="card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.15rem' }}>ميزان المراجعة للأرصدة والحسابات</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>مطابقة أرصدة الأستاذ العام المدينة والدائنة للفترة المالية</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-success">متزن محاسبياً</span>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>رمز الحساب</th>
                      <th>اسم الحساب المحاسبي</th>
                      <th>نوع الحساب</th>
                      <th style={{ textAlign: 'left' }}>الرصيد المدين</th>
                      <th style={{ textAlign: 'left' }}>الرصيد الدائن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialData?.accounts ? (
                      trialData.accounts.map(acc => (
                        <tr key={acc.code}>
                          <td className="font-mono" style={{ fontWeight: 700 }}>{acc.code}</td>
                          <td style={{ fontWeight: 600 }}>{acc.name}</td>
                          <td><span className="badge badge-secondary">{acc.type}</span></td>
                          <td className="font-mono" style={{ textAlign: 'left' }}>{acc.debit > 0 ? acc.debit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}</td>
                          <td className="font-mono" style={{ textAlign: 'left' }}>{acc.credit > 0 ? acc.credit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>لا توجد بيانات</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 900, borderTop: '2px solid #cbd5e1' }}>
                      <td colSpan="3" style={{ textAlign: 'right', padding: '0.85rem' }}>المجموع المتوازن للميزان:</td>
                      <td className="font-mono" style={{ textAlign: 'left', color: '#047857' }}>
                        {trialData?.totals?.total_debit?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                      </td>
                      <td className="font-mono" style={{ textAlign: 'left', color: '#047857' }}>
                        {trialData?.totals?.total_credit?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 3. قائمة الدخل (Profit & Loss) */}
          {/* ============================================================ */}
          {reportTab === 'pnl' && (
            <div className="card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.15rem' }}>قائمة الأرباح والخسائر (Income Statement)</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>تقرير الأداء المالي وصافي الربح التشغيلي</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h4 style={{ fontWeight: 800, color: '#047857', borderBottom: '2px solid #a7f3d0', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                    1. إيرادات النشاط والمبيعات
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span>إجمالي مبيعات المشاتل والزهور</span>
                    <span className="font-mono" style={{ fontWeight: 700 }}>{pnlData?.revenues?.total?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontWeight: 800, color: '#be123c', borderBottom: '2px solid #fecdd3', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                    2. المصروفات التشغيلية والعمومية
                  </h4>
                  {pnlData?.expenses?.items?.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span>{item.name}</span>
                      <span className="font-mono">{item.amount?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0', fontWeight: 800, color: '#be123c' }}>
                    <span>إجمالي المصروفات</span>
                    <span className="font-mono">{pnlData?.expenses?.total?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                </div>

                <div style={{ background: '#ecfdf5', padding: '1.25rem', borderRadius: '12px', border: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontWeight: 900, color: '#065f46', fontSize: '1.1rem' }}>صافي الأرباح التشغيلية (Net Profit)</h3>
                    <p style={{ fontSize: '0.8rem', color: '#047857' }}>الفائض المحاسبي بعد خصم كافة التكاليف</p>
                  </div>
                  <div className="font-mono" style={{ fontWeight: 900, fontSize: '1.5rem', color: '#047857' }}>
                    {pnlData?.net_profit?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 4. الميزانية العمومية (Balance Sheet) */}
          {/* ============================================================ */}
          {reportTab === 'balance_sheet' && (
            <div className="card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.15rem' }}>الميزانية العمومية (Balance Sheet)</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>المركز المالي الشامل (الأصول = الخصوم + حقوق الملكية)</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontWeight: 800, color: '#047857', borderBottom: '2px solid #a7f3d0', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                    الأصول (Assets)
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                    <span>الأصول المتداولة (النقد والمخزون والمدينون)</span>
                    <span className="font-mono" style={{ fontWeight: 700 }}>{balanceSheetData?.assets?.current?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                    <span>الأصول الثابتة (المشاتل والسيارات والمعدات)</span>
                    <span className="font-mono" style={{ fontWeight: 700 }}>{balanceSheetData?.assets?.fixed?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #cbd5e1', paddingTop: '0.75rem', marginTop: '0.5rem', fontWeight: 900, color: '#047857' }}>
                    <span>إجمالي الأصول</span>
                    <span className="font-mono">{balanceSheetData?.assets?.total?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontWeight: 800, color: '#1e293b', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                    الخصوم وحقوق الملكية (Liabilities & Equity)
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                    <span>الخصوم والالتزامات (الموردين والضريبة)</span>
                    <span className="font-mono" style={{ fontWeight: 700 }}>{balanceSheetData?.liabilities?.total?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                    <span>حقوق الملكية ورأس المال والأرباح المبقاة</span>
                    <span className="font-mono" style={{ fontWeight: 700 }}>{balanceSheetData?.equity?.total?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #cbd5e1', paddingTop: '0.75rem', marginTop: '0.5rem', fontWeight: 900, color: '#1e293b' }}>
                    <span>إجمالي الخصوم وحقوق الملكية</span>
                    <span className="font-mono">{((balanceSheetData?.liabilities?.total || 0) + (balanceSheetData?.equity?.total || 0)).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 5. إقرار ضريبة ZATCA */}
          {/* ============================================================ */}
          {reportTab === 'vat_return' && (
            <div className="card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.15rem' }}>مسودة إقرار ضريبة القيمة المضافة (ZATCA VAT Return)</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>إجمالي المبيعات والمشتريات الخاضعة لنسبة 15% وحساب صافي الضريبة الواجب سدادها</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontWeight: 800, color: '#047857', marginBottom: '0.75rem' }}>المبيعات الخاضعة للضريبة بالنسبة الأساسية 15%</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                    <span>المبلغ الخاضع للضريبة:</span>
                    <span className="font-mono" style={{ fontWeight: 700 }}>{vatReturnData?.sales_taxable?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                    <span>مبلغ الضريبة (15%):</span>
                    <span className="font-mono" style={{ fontWeight: 700, color: '#047857' }}>{vatReturnData?.sales_vat?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontWeight: 800, color: '#be123c', marginBottom: '0.75rem' }}>المشتريات الخاضعة للضريبة بالنسبة الأساسية 15%</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                    <span>المبلغ الخاضع للضريبة:</span>
                    <span className="font-mono" style={{ fontWeight: 700 }}>{vatReturnData?.purchases_taxable?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                    <span>مبلغ الضريبة القابل للاسترداد (15%):</span>
                    <span className="font-mono" style={{ fontWeight: 700, color: '#be123c' }}>{vatReturnData?.purchases_vat?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                </div>

                <div style={{ background: '#ecfdf5', padding: '1.25rem', borderRadius: '12px', border: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontWeight: 900, color: '#065f46', fontSize: '1.1rem' }}>صافي الضريبة المستحقة السداد للهيئة</h3>
                    <p style={{ fontSize: '0.8rem', color: '#047857' }}>ضريبة المخرجات ناقصاً ضريبة المدخلات المستردة</p>
                  </div>
                  <div className="font-mono" style={{ fontWeight: 900, fontSize: '1.5rem', color: '#047857' }}>
                    {vatReturnData?.net_vat_due?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 6. كشوف حسابات العملاء والموردين (AR / AP) */}
          {/* ============================================================ */}
          {reportTab === 'ar_ap' && (
            <div className="card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.15rem' }}>كشف حساب تفصيلي للعميل / المورد</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>متابعة الذمم المدينة والدائنة وحركات الفواتير</p>
                </div>

                <div style={{ minWidth: '240px' }}>
                  <select
                    className="form-select"
                    style={{ width: '100%', padding: '0.5rem' }}
                    value={selectedContactId}
                    onChange={e => {
                      setSelectedContactId(e.target.value);
                      fetchContactStatement(e.target.value);
                    }}
                  >
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type === 'customer' ? 'عميل' : 'مورد'}) - رصيد: {c.balance} ر.س
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {contactStatement && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>الرقم الضريبي:</span>
                      <div className="font-mono">{contactStatement.contact.vat_number || '—'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>السجل التجاري:</span>
                      <div className="font-mono">{contactStatement.contact.cr_number || '—'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>الرصيد المستحق الحالي:</span>
                      <div className="font-mono" style={{ fontWeight: 800, fontSize: '1.1rem', color: contactStatement.contact.balance >= 0 ? '#047857' : '#be123c' }}>
                        {contactStatement.contact.balance?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                      </div>
                    </div>
                  </div>

                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>رقم المستند</th>
                          <th>التاريخ</th>
                          <th>طريقة السداد</th>
                          <th>المبلغ بدون ضريبة</th>
                          <th>الضريبة 15%</th>
                          <th>إجمالي المستند</th>
                          <th>الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contactStatement.invoices && contactStatement.invoices.length > 0 ? (
                          contactStatement.invoices.map(inv => (
                            <tr key={inv.id}>
                              <td className="font-mono" style={{ fontWeight: 800, color: '#047857' }}>{inv.invoice_number}</td>
                              <td>{inv.issue_date || inv.invoice_date}</td>
                              <td>{inv.payment_method === 'credit' ? 'آجل' : 'نقداً'}</td>
                              <td className="font-mono">{inv.subtotal?.toFixed(2)} ر.س</td>
                              <td className="font-mono" style={{ color: '#d97706' }}>{inv.vat_total?.toFixed(2)} ر.س</td>
                              <td className="font-mono" style={{ fontWeight: 800 }}>{inv.grand_total?.toFixed(2)} ر.س</td>
                              <td><span className="badge badge-success">معتمد</span></td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                              لا توجد حركات مسجلة لهذا الحساب
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
