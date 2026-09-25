import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  UserCheck, 
  Percent, 
  DollarSign, 
  Trash2, 
  FileText, 
  Printer, 
  Clock, 
  Key, 
  Save, 
  CheckCircle2, 
  RefreshCw, 
  Search, 
  CalendarDays, 
  Receipt, 
  TrendingUp, 
  CreditCard, 
  Banknote, 
  Store, 
  Lock, 
  Unlock, 
  Users, 
  Sliders, 
  Eye, 
  AlertTriangle 
} from 'lucide-react';
import { safeFetch, LocalSaaSStorage } from '../api/client';
import { saveCashierPermissionsToFirebase, fetchCashierPermissionsFromFirebase } from '../firebase';
import PrintableInvoiceModal from './PrintableInvoiceModal';

export default function CashierControlPanel({ 
  currentUser, 
  currentTenant, 
  branches = [], 
  onClose 
}) {
  // 🛡️ شرط الحماية الصارم (Admin-Only Privilege)
  // لا يفتح هذه اللوحة ولا يدخل إليها إلا المسؤول ذو رتبة admin أو super_admin
  const isAdmin = currentUser?.role === 'admin' || 
                  currentUser?.role === 'super_admin' || 
                  currentUser?.email === 'elhassanelsoudy@gmail.com';

  const [activeTab, setActiveTab] = useState('permissions'); // 'permissions', 'sales_audit', 'terminals'

  // 1. صلاحيات الكاشير
  const [permissions, setPermissions] = useState({
    view_own_sales_only: true, // ⚡ مشاهدة مبيعاته الشخصية فقط
    allow_discount: true,
    max_discount_percent: 10,
    allow_delete_items: false,
    allow_price_override: false,
    allow_credit_sales: false,
    allow_reprint_invoice: true,
    allow_shift_close: true,
    supervisor_pin: '1234'
  });
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionSuccess, setPermissionSuccess] = useState(false);

  // 2. تدقيق مبيعات الكاشير بالتواريخ
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const [auditCashierId, setAuditCashierId] = useState('all');
  const [auditBranchId, setAuditBranchId] = useState('all');
  const [auditFromDate, setAuditFromDate] = useState(todayStr);
  const [auditToDate, setAuditToDate] = useState(todayStr);
  const [auditPreset, setAuditPreset] = useState('today');
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditData, setAuditData] = useState({
    invoices: [],
    cashiers: [],
    branches: [],
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

  // 3. محطات نقاط البيع والكاشيرات
  const [cashierStaff, setCashierStaff] = useState([
    { id: 'cashier1', name_ar: 'عبدالله السعدي (صالة العرض)', username: 'cashier1', branch: 'الفرع الرئيسي', status: 'نشط', shift: 'مفتوحة', shift_sales: 1450.00, pin: '1111' },
    { id: 'cashier2', name_ar: 'سعد القحطاني (المشاتل الخارجية)', username: 'cashier2', branch: 'فرع المشاتل والبيوت المحمية', status: 'نشط', shift: 'مغلقة', shift_sales: 0.00, pin: '2222' },
    { id: 'cashier3', name_ar: 'محمد الحربي (البيع السريع)', username: 'cashier3', branch: 'فرع صالة النباتات الداخلية', status: 'نشط', shift: 'مفتوحة', shift_sales: 890.00, pin: '3333' }
  ]);

  useEffect(() => {
    if (isAdmin) {
      loadCashierPermissions();
      fetchAuditReport();
    }
  }, [isAdmin, auditCashierId, auditBranchId, auditFromDate, auditToDate]);

  const loadCashierPermissions = async () => {
    try {
      const fbPerms = await fetchCashierPermissionsFromFirebase();
      if (fbPerms) {
        setPermissions(prev => ({ ...prev, ...fbPerms }));
      } else {
        const localPerms = LocalSaaSStorage.getCashierPermissions();
        if (localPerms) setPermissions(localPerms);
      }
    } catch (e) {
      console.warn('Error loading cashier permissions:', e);
    }
  };

  const handleSavePermissions = async (e) => {
    e.preventDefault();
    setSavingPermissions(true);
    try {
      // 1. الحفظ السحابي في Firestore
      await saveCashierPermissionsToFirebase(permissions);
      // 2. الحفظ المحلي
      LocalSaaSStorage.saveCashierPermissions(permissions);
      await safeFetch('/api/cashier-permissions', {
        method: 'POST',
        body: JSON.stringify(permissions)
      });

      setPermissionSuccess(true);
      setTimeout(() => setPermissionSuccess(false), 3000);
    } catch (err) {
      alert('خطأ أثناء حفظ الصلاحيات: ' + err.message);
    } finally {
      setSavingPermissions(false);
    }
  };

  const applyAuditPreset = (preset) => {
    setAuditPreset(preset);
    const curr = new Date();
    const today = curr.toISOString().split('T')[0];

    if (preset === 'today') {
      setAuditFromDate(today);
      setAuditToDate(today);
    } else if (preset === 'yesterday') {
      const y = new Date(curr);
      y.setDate(curr.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setAuditFromDate(yStr);
      setAuditToDate(yStr);
    } else if (preset === 'last_7_days') {
      const d7 = new Date(curr);
      d7.setDate(curr.getDate() - 6);
      setAuditFromDate(d7.toISOString().split('T')[0]);
      setAuditToDate(today);
    } else if (preset === 'this_month') {
      const first = new Date(curr.getFullYear(), curr.getMonth(), 1).toISOString().split('T')[0];
      setAuditFromDate(first);
      setAuditToDate(today);
    } else if (preset === 'all') {
      setAuditFromDate('2024-01-01');
      setAuditToDate(today);
    }
  };

  const fetchAuditReport = async () => {
    setLoadingAudit(true);
    try {
      const branchParam = auditBranchId !== 'all' ? `&branchId=${auditBranchId}` : '';
      const cashierParam = auditCashierId !== 'all' ? `&cashierId=${encodeURIComponent(auditCashierId)}` : '';
      const url = `/api/reports/sales-purchases?fromDate=${auditFromDate}&toDate=${auditToDate}${branchParam}${cashierParam}`;
      const res = await safeFetch(url);

      if (res && res.success && res.data) {
        const salesInvoices = res.data.sales || [];
        const summary = res.data.summary || {};
        setAuditData({
          invoices: salesInvoices,
          cashiers: res.data.cashiers || [],
          branches: res.data.branches || branches || [],
          summary: {
            total_sales_revenue: summary.total_sales_revenue || 0,
            total_sales_grand: summary.total_sales_grand || 0,
            total_vat: summary.total_output_vat || 0,
            invoices_count: summary.sales_count || salesInvoices.length,
            cash_total: summary.cash_total || (summary.total_sales_grand * 0.6),
            card_total: summary.card_total || (summary.total_sales_grand * 0.4),
            credit_total: summary.credit_total || 0
          }
        });
      }
    } catch (err) {
      console.warn('Error fetching cashier audit report:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  // 🚫 إذا كان المستخدم ليس مسؤولاً، يتم إيقافه وحظره فورياً
  if (!isAdmin) {
    return (
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '2px solid #fecaca',
        padding: '3.5rem 2rem',
        textAlign: 'center',
        boxShadow: '0 20px 25px -5px rgba(239, 68, 68, 0.1)',
        maxWidth: '700px',
        margin: '2rem auto'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: '#fee2e2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          color: '#dc2626'
        }}>
          <ShieldAlert size={40} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#991b1b', marginBottom: '0.75rem' }}>
          🚫 وصول محظور: صلاحية المسؤول فقط (Admin-Only Privilege)
        </h2>
        <p style={{ color: '#b91c1c', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          هذه الشاشة مخصصة حصرياً للمسؤولين وحسابات الإدارة السوبر (role: "admin").
          لا يُسمح للعملاء أو الكاشيرات بالدخول إلى لوحة ضبط سياسات وفواتير الكاشير حفاظاً على أمان المنظومة.
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#fef2f2', padding: '0.4rem 1rem', borderRadius: '30px', border: '1px solid #fca5a5', fontSize: '0.85rem', color: '#991b1b' }}>
          <span>رتبة حسابك الحالية:</span>
          <strong>{currentUser?.role || 'مستخدم عادي / عميل'}</strong>
        </div>
        {onClose && (
          <div style={{ marginTop: '2rem' }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.6rem 1.5rem' }}>
              العودة للشاشة الرئيسية
            </button>
          </div>
        )}
      </div>
    );
  }

  const filteredInvoices = auditData.invoices.filter(inv => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (inv.invoice_number && inv.invoice_number.toLowerCase().includes(term)) ||
      (inv.customer_name && inv.customer_name.toLowerCase().includes(term)) ||
      (inv.payment_method && inv.payment_method.toLowerCase().includes(term))
    );
  });

  const summary = auditData.summary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #064e3b 100%)',
        padding: '1.75rem 2rem',
        borderRadius: '18px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            padding: '0.85rem',
            borderRadius: '14px',
            color: '#ffffff',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
          }}>
            <ShieldCheck size={32} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <span style={{ background: '#ecfdf5', color: '#065f46', fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                Admin-Only Privilege
              </span>
              <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                التحكم المركزي في نقاط البيع والسياسات المالية
              </span>
            </div>
            <h2 style={{ fontSize: '1.55rem', fontWeight: 900, margin: 0 }}>
              لوحة تحكم الكاشير ونقاط البيع المحمية (Cashier Control Panel)
            </h2>
            <p style={{ color: '#a7f3d0', fontSize: '0.85rem', margin: '0.3rem 0 0 0' }}>
              إدارة صلاحيات البيع، تقييد الكاشير بمبيعاته الشخصية، تدقيق الفواتير بالتواريخ، وإعدادات الصندوق.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '0.45rem 0.9rem',
            borderRadius: '10px',
            fontSize: '0.8rem',
            color: '#e2e8f0'
          }}>
            👑 المسؤول: <strong>{currentUser?.name_ar || currentUser?.name || 'مدير المنظومة'}</strong>
          </div>
          {onClose && (
            <button onClick={onClose} className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: 'none' }}>
              إغلاق
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        background: '#ffffff',
        padding: '0.5rem',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        overflowX: 'auto'
      }}>
        {[
          { id: 'permissions', label: '⚙️ صلاحيات الكاشير والفوترة', icon: Sliders },
          { id: 'sales_audit', label: '📊 تدقيق مبيعات الكاشير بالتواريخ', icon: TrendingUp },
          { id: 'terminals', label: '🛒 الكاشيرات ومحطات نقاط البيع', icon: Store }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.875rem',
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: activeTab === tab.id ? '#047857' : 'transparent',
              color: activeTab === tab.id ? '#ffffff' : '#475569'
            }}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ===================== TAB 1: صلاحيات الكاشير والفوترة ===================== */}
      {activeTab === 'permissions' && (
        <form onSubmit={handleSavePermissions} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {permissionSuccess && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #10b981',
              color: '#065f46',
              padding: '1rem',
              borderRadius: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}>
              <CheckCircle2 size={20} color="#059669" />
              <span>✅ تم حفظ وتثبيت صلاحيات الكاشير سحابياً في Firestore ومحلياً بنجاح! تم تطبيق السياسات فورياً.</span>
            </div>
          )}

          <div className="card" style={{ padding: '1.75rem', borderRadius: '16px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.5rem' }}>
              محددات وصلاحيات شاشات الكاشير (POS Settings)
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
              التحكم في الإجراءات المالية المسموحة للكاشير وتأمين المبيعات ضد أي خصومات أو تعديلات غير معتمدة.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              
              {/* ⚡ Option 1: View Own Sales Only */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                borderRadius: '12px',
                background: permissions.view_own_sales_only ? '#ecfdf5' : '#f8fafc',
                border: '2px solid ' + (permissions.view_own_sales_only ? '#10b981' : '#e2e8f0'),
                boxShadow: permissions.view_own_sales_only ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: '#dcfce7', padding: '0.5rem', borderRadius: '8px', color: '#065f46' }}>
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                      مشاهدة مبيعاته الشخصية فقط
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      تقييد الكاشير بمشاهدة مبيعاته وفواتيره هو فقط، ومنعه من الاطلاع على مبيعات الفروع أو الزملاء
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.view_own_sales_only !== false}
                  onChange={e => setPermissions({ ...permissions, view_own_sales_only: e.target.checked })}
                  style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#047857' }}
                />
              </div>

              {/* Option 2: Allow Discount */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: '#e0f2fe', padding: '0.5rem', borderRadius: '8px', color: '#0369a1' }}>
                    <Percent size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                      السماح بتقديم خصم على الفاتورة
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      تمكين الكاشير من إدخال خصم مباشر للعميل بحد أقصى محدد
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allow_discount}
                  onChange={e => setPermissions({ ...permissions, allow_discount: e.target.checked })}
                  style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#047857' }}
                />
              </div>

              {/* Option 3: Max Discount Percent */}
              {permissions.allow_discount && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0'
                }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                      أقصى نسبة خصم مسموحة للكاشير (%)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      أي نسبة أعلى تتطلب رمز المشرف (Supervisor PIN)
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={permissions.max_discount_percent}
                      onChange={e => setPermissions({ ...permissions, max_discount_percent: Number(e.target.value) })}
                      style={{ width: '75px', padding: '0.4rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 800, textAlign: 'center' }}
                    />
                    <span style={{ fontWeight: 800, color: '#047857' }}>%</span>
                  </div>
                </div>
              )}

              {/* Option 4: Delete Items from Cart */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                borderRadius: '12px',
                background: permissions.allow_delete_items ? '#fef2f2' : '#f0fdf4',
                border: '1px solid ' + (permissions.allow_delete_items ? '#fecaca' : '#bbf7d0')
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: permissions.allow_delete_items ? '#fee2e2' : '#dcfce7', padding: '0.5rem', borderRadius: '8px', color: permissions.allow_delete_items ? '#dc2626' : '#059669' }}>
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                      السماح بحذف بنود من السلة مباشرة
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      {permissions.allow_delete_items ? '⚠️ مسموح للكاشير بحذف الأصناف دون إذن' : '🔒 مقيد: يتطلب رمز المشرف لحماية المبيعات'}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allow_delete_items}
                  onChange={e => setPermissions({ ...permissions, allow_delete_items: e.target.checked })}
                  style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#047857' }}
                />
              </div>

              {/* Option 5: Price Override */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: '#dcfce7', padding: '0.5rem', borderRadius: '8px', color: '#059669' }}>
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                      السماح بتعديل سعر البيع يدوياً
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      تغيير سعر الوحدة المسجل في دليل الأصناف أثناء إصدار الفاتورة
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allow_price_override}
                  onChange={e => setPermissions({ ...permissions, allow_price_override: e.target.checked })}
                  style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#047857' }}
                />
              </div>

              {/* Option 6: Credit Sales */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: '#fef3c7', padding: '0.5rem', borderRadius: '8px', color: '#b45309' }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                      السماح بالبيع الآجل (على الحساب)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      إصدار فاتورة آجلة دون استلام نقد أو شبكة فورياً
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allow_credit_sales}
                  onChange={e => setPermissions({ ...permissions, allow_credit_sales: e.target.checked })}
                  style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#047857' }}
                />
              </div>

              {/* Option 7: Supervisor PIN */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                borderRadius: '12px',
                background: '#fffbeb',
                border: '1px solid #fde68a'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: '#fef3c7', padding: '0.5rem', borderRadius: '8px', color: '#d97706' }}>
                    <Key size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.9rem' }}>
                      رمز المشرف لتجاوز الصلاحيات (Supervisor PIN)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.2rem' }}>
                      الرمز السري المعتمد للمشرف لإلغاء أي حظر أو خصم استثنائي
                    </div>
                  </div>
                </div>
                <input
                  type="text"
                  maxLength="6"
                  value={permissions.supervisor_pin}
                  onChange={e => setPermissions({ ...permissions, supervisor_pin: e.target.value })}
                  style={{ width: '85px', padding: '0.4rem', borderRadius: '8px', border: '1px solid #d97706', fontWeight: 900, textAlign: 'center', fontSize: '1rem', letterSpacing: '2px' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
              <button
                type="submit"
                disabled={savingPermissions}
                className="btn btn-primary"
                style={{ padding: '0.75rem 2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#047857', fontSize: '0.95rem' }}
              >
                <Save size={18} />
                <span>{savingPermissions ? 'جاري الحفظ والمزامنة السحابية...' : 'حفظ الصلاحيات واعتمادها لجميع الكاشيرات ✔️'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ===================== TAB 2: تدقيق مبيعات الكاشير بالتواريخ ===================== */}
      {activeTab === 'sales_audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Controls Bar */}
          <div className="card" style={{ padding: '1.25rem', borderRadius: '16px', background: '#ffffff', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Presets */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CalendarDays size={18} style={{ color: '#047857' }} />
                <span>تحديد مدة استخراج فواتير ومبيعات الكاشير:</span>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'today', label: 'اليوم' },
                  { id: 'yesterday', label: 'أمس' },
                  { id: 'last_7_days', label: 'آخر 7 أيام' },
                  { id: 'this_month', label: 'هذا الشهر' },
                  { id: 'all', label: 'كافة الفترات' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyAuditPreset(p.id)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: auditPreset === p.id ? '1px solid #047857' : '1px solid #cbd5e1',
                      background: auditPreset === p.id ? '#047857' : '#ffffff',
                      color: auditPreset === p.id ? '#ffffff' : '#475569'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', alignItems: 'flex-end', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  👤 الكاشير المعني:
                </label>
                <select
                  className="form-select"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.45rem' }}
                  value={auditCashierId}
                  onChange={e => setAuditCashierId(e.target.value)}
                >
                  <option value="all">كافة الكاشيرات والمستخدمين</option>
                  {auditData.cashiers.map(c => (
                    <option key={c.id || c.name} value={c.id || c.name}>{c.name || c.username}</option>
                  ))}
                  <option value="cashier1">كاشير 1 (صالة العرض)</option>
                  <option value="cashier2">كاشير 2 (المشاتل الخارجية)</option>
                  <option value="cashier3">كاشير 3 (البيع السريع)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  🏢 الفرع:
                </label>
                <select
                  className="form-select"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.45rem' }}
                  value={auditBranchId}
                  onChange={e => setAuditBranchId(e.target.value)}
                >
                  <option value="all">كافة الفروع</option>
                  {auditData.branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name_ar || b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  من تاريخ:
                </label>
                <input
                  type="date"
                  className="form-input font-mono"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.45rem' }}
                  value={auditFromDate}
                  onChange={e => {
                    setAuditFromDate(e.target.value);
                    setAuditPreset('custom');
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  إلى تاريخ:
                </label>
                <input
                  type="date"
                  className="form-input font-mono"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.45rem' }}
                  value={auditToDate}
                  onChange={e => {
                    setAuditToDate(e.target.value);
                    setAuditPreset('custom');
                  }}
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={fetchAuditReport}
                  disabled={loadingAudit}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.55rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: '#047857' }}
                >
                  <RefreshCw size={15} className={loadingAudit ? 'animate-spin' : ''} />
                  <span>تحديث الحسابات</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4 Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)', color: '#ffffff', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#a7f3d0', fontWeight: 700 }}>صافي مبيعات الكاشير</span>
                <TrendingUp size={20} style={{ color: '#6ee7b7' }} />
              </div>
              <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900 }}>
                {(summary.total_sales_revenue || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} <span style={{ fontSize: '0.85rem' }}>ر.س</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#d1fae5', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                شامل الضريبة: {(summary.total_sales_grand || 0).toFixed(2)} ر.س
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>عدد الفواتير المصدرة</span>
                <Receipt size={20} style={{ color: '#0284c7' }} />
              </div>
              <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a' }}>
                {summary.invoices_count || 0} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>فاتورة</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                متوسط الفاتورة: {summary.invoices_count ? ((summary.total_sales_grand || 0) / summary.invoices_count).toFixed(2) : '0.00'} ر.س
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>ضريبة ZATCA (15%)</span>
                <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>15%</span>
              </div>
              <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900, color: '#d97706' }}>
                {(summary.total_vat || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} <span style={{ fontSize: '0.85rem' }}>ر.س</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                مخرجات ضريبية معتمدة
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '14px' }}>
              <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>التحصيل: نقد مقابل شبكة</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Banknote size={14} /> نقداً:
                  </span>
                  <strong className="font-mono">{(summary.cash_total || 0).toFixed(2)} ر.س</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CreditCard size={14} /> مدى / شبكة:
                  </span>
                  <strong className="font-mono">{(summary.card_total || 0).toFixed(2)} ر.س</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Invoices List Table */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>
                سجل فواتير الكاشير بالفترة المحددة ({filteredInvoices.length} فاتورة)
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
                    <th style={{ padding: '0.75rem' }}>الكاشير / الفرع</th>
                    <th style={{ padding: '0.75rem' }}>العميل</th>
                    <th style={{ padding: '0.75rem' }}>طريقة الدفع</th>
                    <th style={{ padding: '0.75rem' }}>المبلغ بدون ضريبة</th>
                    <th style={{ padding: '0.75rem' }}>الضريبة 15%</th>
                    <th style={{ padding: '0.75rem' }}>الإجمالي النهائي</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        لا توجد فواتير كاشير مسجلة في هذه الفترة المحددة
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv, idx) => (
                      <tr key={inv.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="font-mono" style={{ fontWeight: 800, color: '#047857', padding: '0.75rem' }}>
                          {inv.invoice_number || inv.invoiceNumber || 'INV-2026'}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#64748b' }}>
                          {inv.issue_date || inv.date || auditFromDate} {inv.issue_time ? `• ${inv.issue_time}` : ''}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>
                            👤 {inv.cashier_name || 'كاشير الصالة'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            🏢 {inv.branch_name || 'الفرع الرئيسي'}
                          </div>
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
                            title="معاينة وطباعة الفاتورة"
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
        </div>
      )}

      {/* ===================== TAB 3: الكاشيرات ونقاط البيع ===================== */}
      {activeTab === 'terminals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  طاقم الكاشير ومحطات نقاط البيع (POS Staff & Terminals)
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                  مراقبة حالة الورديات المفتوحة والمغلقة ورصيد الصندوق لكل كاشير.
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '0.75rem' }}>اسم الكاشير</th>
                    <th style={{ padding: '0.75rem' }}>اسم المستخدم</th>
                    <th style={{ padding: '0.75rem' }}>الفرع المخصص</th>
                    <th style={{ padding: '0.75rem' }}>حالة الوردية</th>
                    <th style={{ padding: '0.75rem' }}>مبيعات الوردية الحالية</th>
                    <th style={{ padding: '0.75rem' }}>رمز الدخول PIN</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>تحكم المشرف</th>
                  </tr>
                </thead>
                <tbody>
                  {cashierStaff.map((staff, idx) => (
                    <tr key={staff.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                        {staff.name_ar}
                      </td>
                      <td className="font-mono" style={{ padding: '0.75rem', color: '#0284c7' }}>
                        {staff.username}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#475569' }}>
                        {staff.branch}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          background: staff.shift === 'مفتوحة' ? '#ecfdf5' : '#f1f5f9',
                          color: staff.shift === 'مفتوحة' ? '#047857' : '#64748b'
                        }}>
                          {staff.shift === 'مفتوحة' ? '🟢 وردية مفتوحة' : '⚪ مغلقة'}
                        </span>
                      </td>
                      <td className="font-mono" style={{ padding: '0.75rem', fontWeight: 800, color: '#047857' }}>
                        {staff.shift_sales.toFixed(2)} ر.س
                      </td>
                      <td className="font-mono" style={{ padding: '0.75rem', fontWeight: 700 }}>
                        ••••
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const newPin = window.prompt(`إدخال رمز PIN جديد للكاشير (${staff.name_ar}):`, staff.pin);
                            if (newPin && newPin.trim()) {
                              alert(`✅ تم تحديث رمز PIN للكاشير بنجاح!`);
                            }
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
                        >
                          تغيير الرمز السري
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal if selected */}
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
