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
  Sparkles
} from 'lucide-react';
import { safeFetch } from '../api/client';

export default function FinancialReportsView({ branches = [], selectedBranch = 'all' }) {
  const [reportTab, setReportTab] = useState('smart_date_report'); // 'smart_date_report', 'trial_balance', 'pnl', 'balance_sheet', 'vat_return', 'ar_ap'
  
  // Smart Date Range Report States
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [smartReportData, setSmartReportData] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all', 'sales', 'purchases', 'expenses'
  const [branchFilter, setBranchFilter] = useState(selectedBranch || 'all');

  const [trialData, setTrialData] = useState(null);
  const [pnlData, setPnlData] = useState(null);
  const [balanceSheetData, setBalanceSheetData] = useState(null);
  const [vatReturnData, setVatReturnData] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [contactStatement, setContactStatement] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setBranchFilter(selectedBranch || 'all');
  }, [selectedBranch]);

  useEffect(() => {
    fetchReportData();
  }, [reportTab, branchFilter, fromDate, toDate]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const branchParam = branchFilter !== 'all' ? `?branchId=${branchFilter}` : '';

      if (reportTab === 'smart_date_report') {
        const queryParams = new URLSearchParams();
        if (fromDate) queryParams.set('fromDate', fromDate);
        if (toDate) queryParams.set('toDate', toDate);
        if (branchFilter && branchFilter !== 'all') queryParams.set('branchId', branchFilter);
        const res = await safeFetch(`/api/reports/sales-purchases?${queryParams.toString()}`);
        if (res && res.success) {
          setSmartReportData(res.data);
        }
      } else if (reportTab === 'trial_balance') {
        const res = await fetch(`/api/reports/trial-balance${branchParam}`);
        const data = await res.json();
        if (data.success) setTrialData(data.data);
      } else if (reportTab === 'pnl') {
        const res = await fetch(`/api/reports/profit-loss${branchParam}`);
        const data = await res.json();
        if (data.success) setPnlData(data.data);
      } else if (reportTab === 'balance_sheet') {
        const res = await fetch(`/api/reports/balance-sheet${branchParam}`);
        const data = await res.json();
        if (data.success) setBalanceSheetData(data.data);
      } else if (reportTab === 'vat_return') {
        const res = await fetch(`/api/reports/vat-return${branchParam}`);
        const data = await res.json();
        if (data.success) setVatReturnData(data.data);
      } else if (reportTab === 'ar_ap') {
        const res = await fetch('/api/contacts');
        const data = await res.json();
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
      const res = await fetch(`/api/reports/contact-statement/${contactId}`);
      const data = await res.json();
      if (data.success) setContactStatement(data.data);
    } catch (err) {
      console.error('Error fetching statement:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Report Switcher & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', background: '#e2e8f0', padding: '0.3rem', borderRadius: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setReportTab('smart_date_report')}
            className={`btn ${reportTab === 'smart_date_report' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', fontWeight: 800, background: reportTab === 'smart_date_report' ? 'linear-gradient(135deg, #047857, #10b981)' : undefined }}
          >
            <CalendarDays size={16} />
            <span>📊 التقارير الذكية بالتواريخ</span>
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

        <button onClick={handlePrint} className="btn btn-secondary">
          <Printer size={16} />
          <span>طباعة التقرير المالي</span>
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          جاري استخراج وتجميع الحسابات والقوائم المالية...
        </div>
      ) : (
        <>
          {/* ===================== 0. التقارير الذكية بالتواريخ ===================== */}
          {reportTab === 'smart_date_report' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Filter Control Box */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ background: '#ecfdf5', color: '#047857', padding: '0.45rem', borderRadius: '8px' }}>
                      <CalendarDays size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                        تقرير المبيعات والمشتريات الذكي محدد بالتواريخ
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                        استخراج فوري للإيرادات، تكاليف المشتريات، ضريبة القيمة المضافة 15%، وصافي الأرباح المحققة خلال الفترة.
                      </p>
                    </div>
                  </div>

                  {/* Quick Date Presets */}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {[
                      { label: 'اليوم', getDates: () => { const t = new Date().toISOString().split('T')[0]; return [t, t]; } },
                      { label: 'هذا الأسبوع', getDates: () => { const now = new Date(); const d = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0]; return [d, new Date().toISOString().split('T')[0]]; } },
                      { label: 'هذا الشهر', getDates: () => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; return [start, new Date().toISOString().split('T')[0]]; } },
                      { label: 'الربع السنوي', getDates: () => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0]; return [start, new Date().toISOString().split('T')[0]]; } },
                      { label: 'هذا العام (2026)', getDates: () => ['2026-01-01', new Date().toISOString().split('T')[0]] },
                      { label: 'كافة الفترات', getDates: () => ['2020-01-01', new Date().toISOString().split('T')[0]] }
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const [start, end] = preset.getDates();
                          setFromDate(start);
                          setToDate(end);
                        }}
                        style={{
                          padding: '0.3rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Inputs & Branch Selector */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      📅 من تاريخ (From Date)
                    </label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={e => setFromDate(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '0.45rem 0.65rem', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      📅 إلى تاريخ (To Date)
                    </label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={e => setToDate(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '0.45rem 0.65rem', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      🏢 الفرع المستهدف
                    </label>
                    <select
                      value={branchFilter}
                      onChange={e => setBranchFilter(e.target.value)}
                      className="form-select"
                      style={{ width: '100%', padding: '0.45rem 0.65rem', fontWeight: 700 }}
                    >
                      <option value="all">🏢 كافة الفروع والمشاتل</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>📍 {b.name_ar}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={fetchReportData}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: '#047857' }}
                    >
                      <RefreshCw size={15} />
                      <span>تحديث واستخراج التقرير</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Financial Summary KPI Cards */}
              {smartReportData?.summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                  {/* Card 1: Gross Sales / Revenue */}
                  <div className="card" style={{ borderTop: '4px solid #047857', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b' }}>إجمالي الإيرادات والمبيعات</span>
                      <div style={{ background: '#ecfdf5', color: '#047857', padding: '0.35rem', borderRadius: '8px' }}>
                        <TrendingUp size={18} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#047857' }} className="font-mono">
                      {smartReportData.summary.total_sales_revenue.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                      <span style={{ fontSize: '0.85rem', marginRight: '0.35rem' }}>ر.س</span>
                    </div>
                    <div style={{ marginTop: '0.65rem', fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.2rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>ضريبة مبيعات 15%:</span>
                        <strong className="font-mono" style={{ color: '#d97706' }}>{smartReportData.summary.total_sales_vat.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>الإجمالي شامل الضريبة:</span>
                        <strong className="font-mono" style={{ color: '#0f172a' }}>{smartReportData.summary.total_sales_grand.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                        <span>فواتير المبيعات:</span>
                        <strong>{smartReportData.summary.sales_count} فاتورة (متوسط: {smartReportData.summary.average_sale.toFixed(2)} ر.س)</strong>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Purchases & Cost */}
                  <div className="card" style={{ borderTop: '4px solid #0284c7', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b' }}>إجمالي المشتريات والتكاليف</span>
                      <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '0.35rem', borderRadius: '8px' }}>
                        <ShoppingCart size={18} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0284c7' }} className="font-mono">
                      {smartReportData.summary.total_purchases_cost.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                      <span style={{ fontSize: '0.85rem', marginRight: '0.35rem' }}>ر.س</span>
                    </div>
                    <div style={{ marginTop: '0.65rem', fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.2rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>ضريبة مشتريات (مدخلات):</span>
                        <strong className="font-mono" style={{ color: '#d97706' }}>{smartReportData.summary.total_purchases_vat.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>المصروفات التشغيلية:</span>
                        <strong className="font-mono" style={{ color: '#475569' }}>{smartReportData.summary.total_expenses_cost.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                        <span>فواتير المشتريات:</span>
                        <strong>{smartReportData.summary.purchases_count} فاتورة شراء</strong>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: VAT 15% (ZATCA) */}
                  <div className="card" style={{ borderTop: '4px solid #d97706', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b' }}>ضريبة القيمة المضافة (ZATCA 15%)</span>
                      <div style={{ background: '#fef3c7', color: '#d97706', padding: '0.35rem', borderRadius: '8px' }}>
                        <FileText size={18} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: smartReportData.summary.net_vat_due >= 0 ? '#b45309' : '#059669' }} className="font-mono">
                      {Math.abs(smartReportData.summary.net_vat_due).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                      <span style={{ fontSize: '0.85rem', marginRight: '0.35rem' }}>ر.س</span>
                    </div>
                    <div style={{ marginTop: '0.65rem', fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.2rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>ضريبة المخرجات (المبيعات):</span>
                        <strong className="font-mono" style={{ color: '#047857' }}>+{smartReportData.summary.total_output_vat.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>ضريبة المدخلات (المشتريات):</span>
                        <strong className="font-mono" style={{ color: '#dc2626' }}>-{smartReportData.summary.total_input_vat.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: smartReportData.summary.net_vat_due >= 0 ? '#92400e' : '#047857' }}>
                        <span>الحالة الزكوية:</span>
                        <span>{smartReportData.summary.net_vat_due >= 0 ? 'مستحق السداد للهيئة' : 'رصيد مسترد للمنشأة'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Net Profit */}
                  <div className="card" style={{ borderTop: `4px solid ${smartReportData.summary.is_profitable ? '#059669' : '#dc2626'}`, padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b' }}>صافي الأرباح المحققة (Net Profit)</span>
                      <div style={{ background: smartReportData.summary.is_profitable ? '#d1fae5' : '#fee2e2', color: smartReportData.summary.is_profitable ? '#059669' : '#dc2626', padding: '0.35rem', borderRadius: '8px' }}>
                        <Scale size={18} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: smartReportData.summary.is_profitable ? '#059669' : '#dc2626' }} className="font-mono">
                      {smartReportData.summary.net_profit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                      <span style={{ fontSize: '0.85rem', marginRight: '0.35rem' }}>ر.س</span>
                    </div>
                    <div style={{ marginTop: '0.65rem', fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.2rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>هامش صافي الربح:</span>
                        <strong className="font-mono" style={{ color: smartReportData.summary.is_profitable ? '#059669' : '#dc2626' }}>
                          {smartReportData.summary.profit_margin_percent}%
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>الوعاء الربحي:</span>
                        <span>المبيعات - المشتريات - المصاريف</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: smartReportData.summary.is_profitable ? '#047857' : '#dc2626' }}>
                        <span>مؤشر الأداء:</span>
                        <span>{smartReportData.summary.is_profitable ? '🟢 أرباح تشغيلية ممتازة' : '🔴 عجز في الهامش الربحي'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Detail Breakdown Transactions Table */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      سجل الحركات التفصيلي خلال الفترة ({fromDate} إلى {toDate})
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                      بيانات كافة فواتير المبيعات الصادرة، فواتير الشراء، وسندات المصروفات.
                    </p>
                  </div>

                  {/* Filter by Category */}
                  <div style={{ display: 'flex', gap: '0.35rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
                    {[
                      { id: 'all', label: 'كافة الحركات' },
                      { id: 'sales', label: `المبيعات (${smartReportData?.sales?.length || 0})` },
                      { id: 'purchases', label: `المشتريات (${smartReportData?.purchases?.length || 0})` },
                      { id: 'expenses', label: `المصروفات (${smartReportData?.expenses?.length || 0})` }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFilterType(f.id)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: 'none',
                          background: filterType === f.id ? '#047857' : 'transparent',
                          color: filterType === f.id ? '#ffffff' : '#475569',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table */}
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>رقم المستند</th>
                        <th>النوع</th>
                        <th>التاريخ</th>
                        <th>الطرف / العميل / المورد</th>
                        <th>الفرع</th>
                        <th>المبلغ الخاضع للضريبة</th>
                        <th>ضريبة 15%</th>
                        <th>الإجمالي شامل الضريبة</th>
                        <th>طريقة الدفع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Render Rows Based on Filter */}
                      {(() => {
                        const rows = [];
                        if (filterType === 'all' || filterType === 'sales') {
                          (smartReportData?.sales || []).forEach(s => rows.push({
                            id: 'sale-' + s.id,
                            docNo: s.invoice_number || s.invoiceNumber,
                            type: 'sales',
                            typeLabel: 'فاتورة مبيعات',
                            date: s.issue_date || s.created_at?.split('T')[0],
                            party: s.customer_name || 'عميل نقدي عام',
                            branch: s.branch_name || 'الفرع الرئيسي',
                            subtotal: Number(s.subtotal || 0),
                            vat: Number(s.vat_total || s.vat_amount || 0),
                            grand: Number(s.grand_total || s.total_amount || 0),
                            method: s.payment_method === 'cash' ? 'نقداً' : s.payment_method === 'card' ? 'شبكة / مدى' : s.payment_method === 'credit' ? 'آجل' : 'تحويل بنكي'
                          }));
                        }
                        if (filterType === 'all' || filterType === 'purchases') {
                          (smartReportData?.purchases || []).forEach(p => rows.push({
                            id: 'pur-' + p.id,
                            docNo: p.invoice_number,
                            type: 'purchase',
                            typeLabel: 'فاتورة مشتريات',
                            date: p.invoice_date || p.date,
                            party: p.vendor_name || 'مورد بضائع وشتلات',
                            branch: p.branch_name || 'الفرع الرئيسي',
                            subtotal: Number(p.subtotal || 0),
                            vat: Number(p.vat_total || p.vat_amount || 0),
                            grand: Number(p.grand_total || 0),
                            method: p.payment_method === 'cash' ? 'نقداً' : 'تحويل بنكي'
                          }));
                        }
                        if (filterType === 'all' || filterType === 'expenses') {
                          (smartReportData?.expenses || []).forEach(e => rows.push({
                            id: 'exp-' + e.id,
                            docNo: 'EXP-' + e.id,
                            type: 'expense',
                            typeLabel: 'سند مصروف',
                            date: e.date,
                            party: e.description || e.category,
                            branch: e.branch_name || 'الفرع الرئيسي',
                            subtotal: Number(e.amount || 0),
                            vat: Number(e.vat_amount || 0),
                            grand: Number((e.amount || 0) + (e.vat_amount || 0)),
                            method: 'نقداً'
                          }));
                        }

                        if (rows.length === 0) {
                          return (
                            <tr>
                              <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                                لا توجد فواتير أو حركات مسجلة ضمن المدة المحددة ({fromDate} إلى {toDate})
                              </td>
                            </tr>
                          );
                        }

                        return rows.map(r => (
                          <tr key={r.id}>
                            <td className="font-mono" style={{ fontWeight: 800, color: r.type === 'sales' ? '#047857' : r.type === 'purchase' ? '#0284c7' : '#9333ea' }}>
                              {r.docNo}
                            </td>
                            <td>
                              <span className={`badge ${r.type === 'sales' ? 'badge-success' : r.type === 'purchase' ? 'badge-info' : 'badge-warning'}`}>
                                {r.typeLabel}
                              </span>
                            </td>
                            <td>{r.date}</td>
                            <td style={{ fontWeight: 700 }}>{r.party}</td>
                            <td><span className="badge badge-secondary">{r.branch}</span></td>
                            <td className="font-mono">{r.subtotal.toFixed(2)} ر.س</td>
                            <td className="font-mono" style={{ color: '#d97706', fontWeight: 700 }}>{r.vat.toFixed(2)} ر.س</td>
                            <td className="font-mono" style={{ fontWeight: 800, color: '#0f172a' }}>{r.grand.toFixed(2)} ر.س</td>
                            <td><span className="badge badge-secondary">{r.method}</span></td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===================== 1. ميزان المراجعة ===================== */}�لمالية...
        </div>
      ) : (
        <>
          {/* ===================== 1. ميزان المراجعة ===================== */}
          {reportTab === 'trial_balance' && trialData && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    ميزان المراجعة بالمجاميع والأرصدة (Trial Balance)
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    {selectedBranch === 'all' ? 'المركز المالي الموحد لكافة الفروع' : `مفلتر لـ ${branches.find(b => b.id == selectedBranch)?.name_ar || ''}`}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`badge ${trialData.summary.is_balanced ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                    {trialData.summary.is_balanced ? '✅ ميزان المراجعة موزون بدقة 100%' : '⚠️ غير متوازن'}
                  </span>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>كود الحساب</th>
                      <th>اسم الحساب</th>
                      <th>النوع</th>
                      <th style={{ textAlign: 'center' }}>مجموع المدين</th>
                      <th style={{ textAlign: 'center' }}>مجموع الدائن</th>
                      <th style={{ textAlign: 'center' }}>رصيد مدين</th>
                      <th style={{ textAlign: 'center' }}>رصيد دائن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialData.accounts.map(acc => (
                      <tr key={acc.id}>
                        <td className="font-mono" style={{ fontWeight: 800, color: '#047857' }}>{acc.code}</td>
                        <td style={{ fontWeight: 700 }}>{acc.name_ar}</td>
                        <td>
                          <span style={{ fontSize: '0.75rem' }} className="badge badge-secondary">
                            {acc.type === 'asset' ? 'أصول' :
                             acc.type === 'liability' ? 'خصوم' :
                             acc.type === 'equity' ? 'حقوق ملكية' :
                             acc.type === 'revenue' ? 'إيرادات' : 'مصروفات'}
                          </span>
                        </td>
                        <td className="font-mono" style={{ textAlign: 'center' }}>
                          {acc.total_debit > 0 ? acc.total_debit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}
                        </td>
                        <td className="font-mono" style={{ textAlign: 'center' }}>
                          {acc.total_credit > 0 ? acc.total_credit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}
                        </td>
                        <td className="font-mono" style={{ textAlign: 'center', fontWeight: acc.balance_debit > 0 ? 800 : 400, color: acc.balance_debit > 0 ? '#047857' : undefined }}>
                          {acc.balance_debit > 0 ? acc.balance_debit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}
                        </td>
                        <td className="font-mono" style={{ textAlign: 'center', fontWeight: acc.balance_credit > 0 ? 800 : 400, color: acc.balance_credit > 0 ? '#0284c7' : undefined }}>
                          {acc.balance_credit > 0 ? acc.balance_credit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 800, fontSize: '0.95rem' }}>
                      <td colSpan="3" style={{ textAlign: 'left' }}>الإجمالي الموزون العام:</td>
                      <td className="font-mono" style={{ textAlign: 'center', color: '#047857' }}>
                        {trialData.summary.total_debit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                      </td>
                      <td className="font-mono" style={{ textAlign: 'center', color: '#047857' }}>
                        {trialData.summary.total_credit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                      </td>
                      <td colSpan="2" style={{ textAlign: 'center' }}>
                        <span className="badge badge-success">متطابق</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ===================== 2. قائمة الدخل P&L ===================== */}
          {reportTab === 'pnl' && pnlData && (
            <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                  قائمة الدخل والأرباح والخسائر (Income Statement)
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  عن الفترة المالية الحالية • شركة الصويان ومخازن للتجارة
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* 1. الإيرادات */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: '1.05rem', color: '#047857' }}>
                    <span>1. إيرادات النشاط والمبيعات</span>
                    <span className="font-mono">{pnlData.revenue.total.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                  {pnlData.revenue.items.map((it, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 1rem', fontSize: '0.9rem', color: '#475569' }}>
                      <span>• {it.name_ar}</span>
                      <span className="font-mono">{it.amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                    </div>
                  ))}
                </div>

                {/* 2. تكلفة المبيعات */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: '1.05rem', color: '#be123c' }}>
                    <span>2. يخصم: تكلفة البضاعة المباعة (COGS)</span>
                    <span className="font-mono">({pnlData.cogs.total.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}) ر.س</span>
                  </div>
                </div>

                {/* مجمل الربح */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#ecfdf5', borderRadius: '8px', fontWeight: 800, fontSize: '1.1rem', color: '#065f46' }}>
                  <span>= مجمل الربح (Gross Profit)</span>
                  <span className="font-mono">{pnlData.gross_profit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                </div>

                {/* 3. المصروفات التشغيلية */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: '1.05rem', color: '#d97706' }}>
                    <span>3. يخصم: المصروفات التشغيلية والإدارية</span>
                    <span className="font-mono">({pnlData.total_expenses.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}) ر.س</span>
                  </div>
                  {pnlData.operating_expenses.items.map((it, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 1rem', fontSize: '0.9rem', color: '#475569' }}>
                      <span>• {it.name_ar} (تشغيلي)</span>
                      <span className="font-mono">{it.amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                    </div>
                  ))}
                  {pnlData.admin_expenses.items.map((it, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 1rem', fontSize: '0.9rem', color: '#475569' }}>
                      <span>• {it.name_ar} (إداري وعمومي)</span>
                      <span className="font-mono">{it.amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                    </div>
                  ))}
                </div>

                {/* صافي الربح النهائي */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#0f172a', borderRadius: '10px', fontWeight: 900, fontSize: '1.25rem', color: '#34d399' }}>
                  <span>صافي أرباح الفترة المالية (Net Income):</span>
                  <span className="font-mono">{pnlData.net_profit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                </div>
              </div>
            </div>
          )}

          {/* ===================== 3. الميزانية العمومية ===================== */}
          {reportTab === 'balance_sheet' && balanceSheetData && (
            <div className="card" style={{ maxWidth: '950px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                  قائمة المركز المالي / الميزانية العمومية (Balance Sheet)
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  كما في التاريخ الحالي • متطابقة مع المعادلة المحاسبية: الأصول = الخصوم + حقوق الملكية
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* الأصول */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: '#ecfdf5', padding: '0.75rem 1rem', borderRadius: '8px', borderRight: '4px solid #047857' }}>
                    <h4 style={{ fontWeight: 800, color: '#065f46', fontSize: '1.1rem' }}>الأصول (Assets)</h4>
                  </div>

                  {/* متداولة */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155', marginBottom: '0.4rem' }}>
                      الأصول المتداولة:
                    </div>
                    {balanceSheetData.assets.current.items.map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}>
                        <span>{it.name_ar}</span>
                        <span className="font-mono">{it.amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                      </div>
                    ))}
                  </div>

                  {/* ثابتة */}
                  {balanceSheetData.assets.fixed.items.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155', marginBottom: '0.4rem' }}>
                        الأصول الثابتة:
                      </div>
                      {balanceSheetData.assets.fixed.items.map((it, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}>
                          <span>{it.name_ar}</span>
                          <span className="font-mono">{it.amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f1f5f9', borderRadius: '8px', fontWeight: 800, color: '#047857', marginTop: 'auto' }}>
                    <span>إجمالي الأصول:</span>
                    <span className="font-mono">{balanceSheetData.assets.total.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                </div>

                {/* الخصوم وحقوق الملكية */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: '#fef3c7', padding: '0.75rem 1rem', borderRadius: '8px', borderRight: '4px solid #d97706' }}>
                    <h4 style={{ fontWeight: 800, color: '#92400e', fontSize: '1.1rem' }}>الخصوم وحقوق الملكية (Liabilities & Equity)</h4>
                  </div>

                  {/* خصوم */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155', marginBottom: '0.4rem' }}>
                      الخصوم والالتزامات المتداولة:
                    </div>
                    {balanceSheetData.liabilities.current.items.map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}>
                        <span>{it.name_ar}</span>
                        <span className="font-mono">{it.amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                      </div>
                    ))}
                  </div>

                  {/* حقوق الملكية */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155', marginBottom: '0.4rem' }}>
                      حقوق الملكية ورأس المال:
                    </div>
                    {balanceSheetData.equity.items.map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}>
                        <span>{it.name_ar}</span>
                        <span className="font-mono">{it.amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.5rem', fontSize: '0.875rem', color: '#047857', fontWeight: 700 }}>
                      <span>صافي ربح الفترة الحالية (من قائمة الدخل):</span>
                      <span className="font-mono">{balanceSheetData.equity.current_period_profit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f1f5f9', borderRadius: '8px', fontWeight: 800, color: '#0369a1', marginTop: 'auto' }}>
                    <span>إجمالي الخصوم وحقوق الملكية:</span>
                    <span className="font-mono">{balanceSheetData.total_liabilities_and_equity.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <span className="badge badge-success" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
                  ✅ الميزانية متطابقة بالكامل (إجمالي الأصول = إجمالي الخصوم وحقوق الملكية)
                </span>
              </div>
            </div>
          )}

          {/* ===================== 4. إقرار ضريبة القيمة المضافة ===================== */}
          {reportTab === 'vat_return' && vatReturnData && (
            <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                  نموذج الإقرار الضريبي لضريبة القيمة المضافة (ZATCA VAT Return Form)
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  وفق معايير هيئة الزكاة والضريبة والجمارك بالمملكة العربية السعودية (النسبة الأساسية 15%)
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* 1. المخرجات */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', fontWeight: 800, borderBottom: '1px solid #e2e8f0' }}>
                    أولاً: المبيعات والمخرجات الخاضعة لضريبة القيمة المضافة (Output VAT)
                  </div>
                  <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>المبيعات الخاضعة للنسبة الأساسية 15%</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>إجمالي المبيعات المفوترة عبر الفروع الصادرة بفواتير ZATCA</div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div className="font-mono">{vatReturnData.sales.standard_rated_sales.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س (القيمة)</div>
                      <div className="font-mono" style={{ color: '#047857', fontWeight: 800 }}>{vatReturnData.sales.output_vat_amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س (الضريبة 15%)</div>
                    </div>
                  </div>
                </div>

                {/* 2. المدخلات */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', fontWeight: 800, borderBottom: '1px solid #e2e8f0' }}>
                    ثانياً: المشتريات والمصروفات القابلة للخصم (Input VAT)
                  </div>
                  <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>المشتريات والمصروفات التشغيلية 15%</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>فواتير التوريد وسندات المصاريف الرسمية المدعمة ضريبياً</div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div className="font-mono">{vatReturnData.purchases_and_expenses.total_taxable_inputs.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س (القيمة)</div>
                      <div className="font-mono" style={{ color: '#d97706', fontWeight: 800 }}>{vatReturnData.purchases_and_expenses.input_vat_amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س (الضريبة 15%)</div>
                    </div>
                  </div>
                </div>

                {/* صافي الضريبة المستحقة */}
                <div style={{
                  background: '#047857',
                  color: '#ffffff',
                  padding: '1.25rem 1.5rem',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <h4 style={{ fontWeight: 800, fontSize: '1.2rem' }}>صافي الضريبة المستحقة لهيئة الزكاة والضريبة:</h4>
                    <span style={{ fontSize: '0.85rem', color: '#a7f3d0' }}>({vatReturnData.status})</span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900 }}>
                    {vatReturnData.net_vat_due.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================== 5. كشف حساب عميل أو مورد ===================== */}
          {reportTab === 'ar_ap' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    كشف حساب تفصيلي للعملاء والموردين (AR / AP Ledger)
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    تتبع تفاصيل الفواتير، السدادات، والأرصدة المستحقة.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>اختر جهة التعامل:</label>
                  <select
                    className="form-select"
                    value={selectedContactId}
                    onChange={e => {
                      setSelectedContactId(e.target.value);
                      fetchContactStatement(e.target.value);
                    }}
                    style={{ minWidth: '240px' }}
                  >
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.type === 'customer' ? '👤 عميل: ' : '🏢 مورد: '} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {contactStatement && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Contact Summary Box */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>الاسم:</span>
                      <div style={{ fontWeight: 800, fontSize: '1rem' }}>{contactStatement.contact.name}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>الرقم الضريبي:</span>
                      <div className="font-mono" style={{ fontWeight: 700 }}>{contactStatement.contact.vat_number || 'غير مسجل ضريبياً'}</div>
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

                  {/* Movements Table */}
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
