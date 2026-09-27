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
  AlertTriangle,
  Building,
  PlusCircle,
  Edit3,
  Phone,
  Check,
  X
} from 'lucide-react';
import { safeFetch, LocalSaaSStorage } from '../api/client';
import { 
  saveCashierPermissionsToFirebase, 
  fetchCashierPermissionsFromFirebase,
  saveCashierAccountToFirebase,
  fetchCashierAccountsFromFirebase,
  deleteCashierAccountFromFirebase,
  subscribeToLiveCashiers
} from '../firebase';
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

  const [activeTab, setActiveTab] = useState('accounts'); // 'accounts', 'permissions', 'sales_audit'

  // ==========================================
  // 1. حسابات الكاشيرية وتوليد المستخدمين بالفروع
  // ==========================================
  const [cashierList, setCashierList] = useState([]);
  const [loadingCashiers, setLoadingCashiers] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCashier, setEditingCashier] = useState(null);
  const [savingCashier, setSavingCashier] = useState(false);
  const [cashierForm, setCashierForm] = useState({
    name_ar: '',
    username: '',
    password: '',
    pin: '1234',
    phone: '',
    branch_id: 1,
    status: 'active',
    can_create_sales: true,
    can_view_own_reports: true,
    allow_discount: true,
    max_discount_percent: 15,
    allow_delete_items: false,
    allow_price_override: false,
    allow_credit_sales: false
  });

  // ==========================================
  // 2. لوحة التحكم الصارمة في الصلاحيات
  // ==========================================
  const [selectedCashierForPerms, setSelectedCashierForPerms] = useState('GLOBAL'); // 'GLOBAL' or cashier ID
  const [permissions, setPermissions] = useState({
    can_create_sales: true, // ⚡ صلاحية تسجيل المبيعات والفواتير
    can_view_own_reports: true, // ⚡ صلاحية استخراج التقارير اليومية والشهرية الشخصية فقط
    view_own_sales_only: true, // مشاهدة مبيعاته الشخصية فقط
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

  // ==========================================
  // 3. تدقيق مبيعات وفواتير الفروع بالتواريخ
  // ==========================================
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const [auditPreset, setAuditPreset] = useState('today');
  const [auditFromDate, setAuditFromDate] = useState(todayStr);
  const [auditToDate, setAuditToDate] = useState(todayStr);
  const [auditBranchId, setAuditBranchId] = useState('all');
  const [auditCashierId, setAuditCashierId] = useState('all');
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditInvoices, setAuditInvoices] = useState([]);
  const [summary, setSummary] = useState({
    total_sales_revenue: 0,
    total_sales_vat: 0,
    total_sales_grand: 0,
    sales_count: 0,
    cash_total: 0,
    card_total: 0,
    average_sale: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState(null);

  // تحميل البيانات عند التحميل
  useEffect(() => {
    if (isAdmin) {
      loadCashiers();
      loadCashierPermissions();
      fetchAuditReport();

      // اشتراك حي في Firebase
      const unsubscribe = subscribeToLiveCashiers((liveCashiers) => {
        if (liveCashiers && liveCashiers.length > 0) {
          setCashierList(liveCashiers);
        }
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchAuditReport();
    }
  }, [isAdmin, auditCashierId, auditBranchId, auditFromDate, auditToDate]);

  // جلب الكاشيرات من Firestore و LocalStorage
  const loadCashiers = async () => {
    setLoadingCashiers(true);
    try {
      // 1. محاولة الجلب السحابي من Firestore
      const fbCashiers = await fetchCashierAccountsFromFirebase();
      if (fbCashiers && fbCashiers.length > 0) {
        setCashierList(fbCashiers);
        LocalSaaSStorage.set('cashiers', fbCashiers);
      } else {
        // 2. الاسترجاع من التخزين المحلي
        const localCashiers = LocalSaaSStorage.getCashiers('all');
        setCashierList(localCashiers);
      }
    } catch (e) {
      console.warn('Notice loading cashiers:', e);
      setCashierList(LocalSaaSStorage.getCashiers('all'));
    } finally {
      setLoadingCashiers(false);
    }
  };

  // جلب الصلاحيات العامة
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

  // عند تغيير الكاشير المحدد في تبويب الصلاحيات
  const handleSelectCashierForPerms = (cashierId) => {
    setSelectedCashierForPerms(cashierId);
    if (cashierId === 'GLOBAL') {
      loadCashierPermissions();
    } else {
      const target = cashierList.find(c => String(c.id) === String(cashierId) || c.username === cashierId);
      if (target && target.permissions) {
        setPermissions(prev => ({
          ...prev,
          ...target.permissions,
          supervisor_pin: target.pin || target.permissions.supervisor_pin || '1234'
        }));
      }
    }
  };

  // حفظ الصلاحيات (سواء عامة أو لكاشير محدد)
  const handleSavePermissions = async (e) => {
    e.preventDefault();
    setSavingPermissions(true);
    try {
      if (selectedCashierForPerms === 'GLOBAL') {
        // 1. الحفظ السحابي العام
        await saveCashierPermissionsToFirebase(permissions);
        LocalSaaSStorage.setCashierPermissions(permissions);
        await safeFetch('/api/cashier-permissions', {
          method: 'POST',
          body: JSON.stringify(permissions)
        });
      } else {
        // 2. الحفظ الفردي لكاشير محدد
        const target = cashierList.find(c => String(c.id) === String(selectedCashierForPerms) || c.username === selectedCashierForPerms);
        if (target) {
          const updatedCashier = {
            ...target,
            permissions: { ...permissions }
          };
          // حفظ في فايربيز
          await saveCashierAccountToFirebase(updatedCashier);
          // حفظ محلي
          LocalSaaSStorage.saveCashier(updatedCashier);
          loadCashiers();
        }
      }

      setPermissionSuccess(true);
      setTimeout(() => setPermissionSuccess(false), 3000);
    } catch (err) {
      alert('خطأ أثناء حفظ الصلاحيات: ' + err.message);
    } finally {
      setSavingPermissions(false);
    }
  };

  // إنشاء أو تعديل حساب كاشير
  const handleSaveCashierAccount = async (e) => {
    e.preventDefault();
    if (!cashierForm.name_ar || !cashierForm.username || !cashierForm.password) {
      alert('يرجى تعبئة كافة الحقول المطلوبة (الاسم، اسم المستخدم، كلمة المرور)');
      return;
    }

    setSavingCashier(true);
    try {
      const selectedBranchObj = branches.find(b => b.id == cashierForm.branch_id) || branches[0] || {
        id: 1,
        name_ar: 'الفرع الرئيسي'
      };

      const payload = {
        ...(editingCashier || {}),
        name_ar: cashierForm.name_ar,
        username: cashierForm.username.trim(),
        password: cashierForm.password,
        pin: cashierForm.pin || '1234',
        phone: cashierForm.phone || '',
        branch_id: Number(cashierForm.branch_id),
        branch_name: selectedBranchObj.name_ar || selectedBranchObj.name || 'الفرع الرئيسي',
        status: cashierForm.status,
        permissions: {
          can_create_sales: cashierForm.can_create_sales,
          can_view_own_reports: cashierForm.can_view_own_reports,
          allow_discount: cashierForm.allow_discount,
          max_discount_percent: Number(cashierForm.max_discount_percent),
          allow_delete_items: cashierForm.allow_delete_items,
          allow_price_override: cashierForm.allow_price_override,
          allow_credit_sales: cashierForm.allow_credit_sales,
          allow_reprint_invoice: true,
          allow_shift_close: true,
          supervisor_pin: '1234'
        }
      };

      // 1. الحفظ السحابي في Firebase Firestore
      await saveCashierAccountToFirebase(payload);

      // 2. الحفظ المحلي
      LocalSaaSStorage.saveCashier(payload);

      alert(editingCashier ? '✅ تم تحديث بيانات الكاشير بنجاح!' : '✅ تم توليد وإنشاء حساب الكاشير وربطه بالفرع بنجاح!');
      setShowAddModal(false);
      setEditingCashier(null);
      resetCashierForm();
      loadCashiers();
    } catch (err) {
      alert('حدث خطأ أثناء حفظ حساب الكاشير: ' + err.message);
    } finally {
      setSavingCashier(false);
    }
  };

  const resetCashierForm = () => {
    setCashierForm({
      name_ar: '',
      username: '',
      password: '',
      pin: '1234',
      phone: '',
      branch_id: branches[0]?.id || 1,
      status: 'active',
      can_create_sales: true,
      can_view_own_reports: true,
      allow_discount: true,
      max_discount_percent: 15,
      allow_delete_items: false,
      allow_price_override: false,
      allow_credit_sales: false
    });
  };

  const handleEditClick = (cashier) => {
    setEditingCashier(cashier);
    setCashierForm({
      name_ar: cashier.name_ar || cashier.name || '',
      username: cashier.username || '',
      password: cashier.password || '',
      pin: cashier.pin || '1234',
      phone: cashier.phone || '',
      branch_id: cashier.branch_id || branches[0]?.id || 1,
      status: cashier.status || 'active',
      can_create_sales: cashier.permissions?.can_create_sales !== false,
      can_view_own_reports: cashier.permissions?.can_view_own_reports !== false,
      allow_discount: cashier.permissions?.allow_discount !== false,
      max_discount_percent: cashier.permissions?.max_discount_percent ?? 15,
      allow_delete_items: !!cashier.permissions?.allow_delete_items,
      allow_price_override: !!cashier.permissions?.allow_price_override,
      allow_credit_sales: !!cashier.permissions?.allow_credit_sales
    });
    setShowAddModal(true);
  };

  const handleDeleteCashier = async (cashier) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف أو إلغاء حساب الكاشير (${cashier.name_ar || cashier.username})؟`)) {
      return;
    }
    try {
      if (cashier.id) {
        await deleteCashierAccountFromFirebase(cashier.id);
      }
      LocalSaaSStorage.deleteCashier(cashier.id || cashier.username);
      loadCashiers();
      alert('✅ تم حذف حساب الكاشير بنجاح');
    } catch (e) {
      alert('خطأ في الحذف: ' + e.message);
    }
  };

  // تبديل سريع لصلاحية محددة لكاشير من الجدول مباشرة
  const handleQuickTogglePermission = async (cashier, permKey) => {
    try {
      const currentVal = cashier.permissions?.[permKey] !== false;
      const updated = {
        ...cashier,
        permissions: {
          ...(cashier.permissions || {}),
          [permKey]: !currentVal
        }
      };
      await saveCashierAccountToFirebase(updated);
      LocalSaaSStorage.saveCashier(updated);
      loadCashiers();
    } catch (e) {
      console.warn('Toggle permission error:', e);
    }
  };

  // ==========================================
  // دوال تقرير التدقيق بالتواريخ والفروع (Admin)
  // ==========================================
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
      setAuditFromDate('');
      setAuditToDate('');
    }
  };

  const fetchAuditReport = async () => {
    setLoadingAudit(true);
    try {
      const params = new URLSearchParams();
      if (auditFromDate) params.append('fromDate', auditFromDate);
      if (auditToDate) params.append('toDate', auditToDate);
      if (auditBranchId && auditBranchId !== 'all') params.append('branchId', auditBranchId);
      if (auditCashierId && auditCashierId !== 'all') params.append('cashierId', auditCashierId);

      const url = `/api/reports/sales-purchases?${params.toString()}`;
      const res = await safeFetch(url);

      if (res && res.success && res.data) {
        setAuditInvoices(res.data.sales || []);
        setSummary({
          total_sales_revenue: res.data.summary?.total_sales_revenue || 0,
          total_sales_vat: res.data.summary?.total_sales_vat || 0,
          total_sales_grand: res.data.summary?.total_sales_grand || 0,
          sales_count: res.data.summary?.sales_count || 0,
          average_sale: res.data.summary?.average_sale || 0,
          cash_total: (res.data.sales || []).filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + (Number(s.grand_total || s.total_amount) || 0), 0),
          card_total: (res.data.sales || []).filter(s => s.payment_method !== 'cash').reduce((sum, s) => sum + (Number(s.grand_total || s.total_amount) || 0), 0)
        });
      }
    } catch (err) {
      console.warn('Error fetching audit report:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const filteredInvoices = auditInvoices.filter(inv => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const invNum = (inv.invoice_number || inv.invoiceNumber || '').toLowerCase();
    const cust = (inv.customer_name || '').toLowerCase();
    const cashier = (inv.cashier_name || '').toLowerCase();
    return invNum.includes(term) || cust.includes(term) || cashier.includes(term);
  });

  // 🛡️ الحظر الأمني إذا لم يكن مسؤولاً
  if (!isAdmin) {
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
          <ShieldAlert size={36} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#991b1b', marginBottom: '0.75rem' }}>
          منطقة محظورة - وصول المسؤولين فقط (Admin-Only Privilege)
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.7', maxWidth: '550px', margin: '0 auto 1.5rem auto' }}>
          عذراً، شاشة إدارة حسابات وصلاحيات الكاشير مخصصة فقط للمسؤولين المشرفين والمحاسب الرئيسي (role: "admin"). حسابك الحالي لا يمتلك الصلاحية الكافية.
        </p>
        <button
          onClick={onClose}
          className="btn btn-secondary"
          style={{ padding: '0.6rem 1.75rem', fontWeight: 700 }}
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #064e3b 100%)',
        padding: '1.75rem 2rem',
        borderRadius: '16px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.25rem',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <span style={{
              background: '#10b981',
              color: '#ffffff',
              padding: '0.2rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 800
            }}>
              🛡️ صلاحية المسؤول المطلق (Admin-Only)
            </span>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              المسؤول: {currentUser?.name || currentUser?.email || 'المحاسب الرئيسي'}
            </span>
          </div>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>
            نظام إدارة الصلاحيات وتوليد حسابات الكاشيرية متعددة الفروع
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: '0.4rem 0 0 0', maxWidth: '750px' }}>
            توليد حسابات المستخدمين الجدد للكاشيرية، تعيين كلمات المرور والـ PIN، ربط كل كاشير بفرع محدد، التحكم في صلاحيات إصدار الفواتير، وتقييد استخراج التقارير بالتواريخ مع الاحتفاظ بالحق المطلق للمسؤول.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => { resetCashierForm(); setEditingCashier(null); setShowAddModal(true); }}
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              padding: '0.65rem 1.25rem',
              fontWeight: 800,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
            }}
          >
            <PlusCircle size={18} />
            <span>➕ توليد حساب كاشير جديد</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        background: '#ffffff',
        padding: '0.5rem',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflowX: 'auto'
      }}>
        {[
          { id: 'accounts', label: '👥 شاشة توليد وحسابات الكاشيرية بالفروع', count: cashierList.length },
          { id: 'permissions', label: '🛡️ لوحة التحكم الصارمة في الصلاحيات', badge: 'تحكم فردي وعام' },
          { id: 'sales_audit', label: '📊 تدقيق مبيعات وتقارير جميع الفروع (الحق المطلق)', badge: 'فوري' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
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
            {tab.count !== undefined && (
              <span style={{
                background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: activeTab === tab.id ? '#ffffff' : '#1e293b',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                fontSize: '0.75rem',
                fontFamily: 'monospace'
              }}>
                {tab.count}
              </span>
            )}
            {tab.badge && (
              <span style={{
                background: activeTab === tab.id ? '#10b981' : '#ecfdf5',
                color: activeTab === tab.id ? '#ffffff' : '#047857',
                padding: '0.1rem 0.45rem',
                borderRadius: '6px',
                fontSize: '0.7rem'
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: شاشة توليد حسابات الكاشيرية والربط بالفروع         */}
      {/* ======================================================== */}
      {activeTab === 'accounts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  دليل حسابات موظفي الكاشير بالفروع ({cashierList.length} كاشير مسجل)
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                  يمكنك إضافة كاشير جديد، تعديل بيانات الدخول (Username/Password)، ربطه بالفرع، وضبط صلاحياته الفردية فوراً.
                </p>
              </div>

              <button
                onClick={() => { resetCashierForm(); setEditingCashier(null); setShowAddModal(true); }}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #047857, #065f46)',
                  padding: '0.5rem 1rem',
                  fontSize: '0.825rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <PlusCircle size={16} />
                <span>إضافة كاشير جديد</span>
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '0.75rem' }}>اسم الكاشير</th>
                    <th style={{ padding: '0.75rem' }}>اسم المستخدم (Username)</th>
                    <th style={{ padding: '0.75rem' }}>الفرع المخصص</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>صلاحية المبيعات والفواتير</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>صلاحية استخراج التقارير</th>
                    <th style={{ padding: '0.75rem' }}>الحالة والوردية</th>
                    <th style={{ padding: '0.75rem' }}>رمز PIN</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>إجراءات المسؤول</th>
                  </tr>
                </thead>
                <tbody>
                  {cashierList.map((cashier, idx) => {
                    const branchName = branches.find(b => b.id == cashier.branch_id)?.name_ar || cashier.branch_name || 'الفرع الرئيسي';
                    const canSales = cashier.permissions?.can_create_sales !== false;
                    const canReports = cashier.permissions?.can_view_own_reports !== false;

                    return (
                      <tr key={cashier.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{cashier.name_ar || cashier.name}</div>
                          {cashier.phone && (
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>📞 {cashier.phone}</div>
                          )}
                        </td>
                        <td className="font-mono" style={{ padding: '0.75rem', color: '#0284c7', fontWeight: 700 }}>
                          {cashier.username}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}>
                            <Building size={12} />
                            <span>{branchName}</span>
                          </span>
                        </td>
                        {/* زر تبديل سريع لصلاحية تسجيل المبيعات */}
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleQuickTogglePermission(cashier, 'can_create_sales')}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              border: 'none',
                              background: canSales ? '#ecfdf5' : '#fee2e2',
                              color: canSales ? '#047857' : '#b91c1c'
                            }}
                            title="اضغط للتبديل الفوري"
                          >
                            {canSales ? '✅ مفعلة' : '🚫 معطلة'}
                          </button>
                        </td>
                        {/* زر تبديل سريع لصلاحية التقارير الشخصية */}
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleQuickTogglePermission(cashier, 'can_view_own_reports')}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              border: 'none',
                              background: canReports ? '#eff6ff' : '#fee2e2',
                              color: canReports ? '#1d4ed8' : '#b91c1c'
                            }}
                            title="اضغط للتبديل الفوري"
                          >
                            {canReports ? '📊 مسموح بالتقارير' : '🔒 محظور التقارير'}
                          </button>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              width: 'fit-content',
                              background: cashier.status === 'active' ? '#ecfdf5' : '#fee2e2',
                              color: cashier.status === 'active' ? '#047857' : '#b91c1c'
                            }}>
                              {cashier.status === 'active' ? 'نشط' : 'موقوف'}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              وردية: {cashier.shift_status === 'open' ? '🟢 مفتوحة' : '⚪ مغلقة'}
                            </span>
                          </div>
                        </td>
                        <td className="font-mono" style={{ padding: '0.75rem', fontWeight: 700 }}>
                          {cashier.pin || '1234'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <button
                              onClick={() => {
                                handleSelectCashierForPerms(cashier.id || cashier.username);
                                setActiveTab('permissions');
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              title="تخصيص الصلاحيات الفردية بالتفصيل"
                            >
                              <Sliders size={13} />
                              <span>الصلاحيات</span>
                            </button>
                            <button
                              onClick={() => handleEditClick(cashier)}
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              title="تعديل بيانات الحساب والفرع وكلمة المرور"
                            >
                              <Edit3 size={13} />
                              <span>تعديل</span>
                            </button>
                            <button
                              onClick={() => handleDeleteCashier(cashier)}
                              className="btn"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px' }}
                              title="حذف حساب الكاشير"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: لوحة التحكم الصارمة في الصلاحيات                   */}
      {/* ======================================================== */}
      {activeTab === 'permissions' && (
        <form onSubmit={handleSavePermissions} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  تخصيص صلاحيات الكاشير ونقاط البيع (Granular Permissions Control)
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                  حدد ما إذا كنت تريد تعديل الصلاحيات العامة للنظام، أو اختيار كاشير معين لفرض قيود خاصة عليه.
                </p>
              </div>

              {/* قائمة اختيار الهدف (عام أو كاشير محدد) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 800, color: '#334155' }}>تطبيق الصلاحيات على:</span>
                <select
                  value={selectedCashierForPerms}
                  onChange={e => handleSelectCashierForPerms(e.target.value)}
                  className="form-input font-bold"
                  style={{ minWidth: '220px', padding: '0.45rem', fontSize: '0.85rem', borderColor: '#047857' }}
                >
                  <option value="GLOBAL">🌐 الإعدادات العامة الافتراضية (لكافة الكاشيرية)</option>
                  {cashierList.map(c => (
                    <option key={c.id || c.username} value={c.id || c.username}>
                      👤 كاشير: {c.name_ar || c.name} ({c.username})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {permissionSuccess && (
              <div style={{
                background: '#ecfdf5',
                color: '#065f46',
                padding: '0.85rem',
                borderRadius: '10px',
                border: '1px solid #a7f3d0',
                fontWeight: 800,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem'
              }}>
                <CheckCircle2 size={18} />
                <span>تم حفظ وتحديث الصلاحيات بنجاح ومزامنتها لحظياً في Firebase Firestore!</span>
              </div>
            )}

            {/* شبكة الصلاحيات الصارمة */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              {/* الصلاحية 1: تسجيل المبيعات والفواتير */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.1rem',
                borderRadius: '12px',
                background: permissions.can_create_sales ? '#f0fdf4' : '#fff1f2',
                border: `1.5px solid ${permissions.can_create_sales ? '#bbf7d0' : '#fecdd3'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    background: permissions.can_create_sales ? '#dcfce7' : '#fee2e2',
                    padding: '0.6rem',
                    borderRadius: '10px',
                    color: permissions.can_create_sales ? '#059669' : '#dc2626'
                  }}>
                    <Store size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                      صلاحية تسجيل المبيعات والفواتير (POS Invoicing)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      {permissions.can_create_sales ? '✅ الكاشير مخول بإصدار فواتير البيع واحتساب القيمة' : '⛔ معطلة: يمنع الكاشير من إتمام أي عملية بيع في POS'}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.can_create_sales}
                  onChange={e => setPermissions({ ...permissions, can_create_sales: e.target.checked })}
                  style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#047857' }}
                />
              </div>

              {/* الصلاحية 2: استخراج التقارير اليومية والشهرية الشخصية فقط */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.1rem',
                borderRadius: '12px',
                background: permissions.can_view_own_reports ? '#eff6ff' : '#fff1f2',
                border: `1.5px solid ${permissions.can_view_own_reports ? '#bfdbfe' : '#fecdd3'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    background: permissions.can_view_own_reports ? '#dbeafe' : '#fee2e2',
                    padding: '0.6rem',
                    borderRadius: '10px',
                    color: permissions.can_view_own_reports ? '#1d4ed8' : '#dc2626'
                  }}>
                    <FileText size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                      صلاحية استخراج التقارير الشخصية (Daily & Monthly)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      {permissions.can_view_own_reports ? '✅ مسموح باستخراج مبيعاته وفواتيره الشخصية فقط بالتواريخ' : '🔒 معطلة: لا يستطيع الكاشير رؤية أو طباعة أي تقارير'}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.can_view_own_reports}
                  onChange={e => setPermissions({ ...permissions, can_view_own_reports: e.target.checked })}
                  style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#047857' }}
                />
              </div>

              {/* الصلاحية 3: إعطاء الخصم ونسبته */}
              <div style={{
                padding: '1.1rem',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: '#fef3c7', padding: '0.6rem', borderRadius: '10px', color: '#d97706' }}>
                      <Percent size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                        السماح بمنح خصم للعميل
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                        تمكين الكاشير من إدخال خصم مباشر في شاشة POS
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
                {permissions.allow_discount && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '2.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 700 }}>الحد الأقصى لنسبة الخصم:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={permissions.max_discount_percent}
                        onChange={e => setPermissions({ ...permissions, max_discount_percent: Number(e.target.value) })}
                        className="form-input font-mono"
                        style={{ width: '70px', padding: '0.3rem 0.5rem', textAlign: 'center' }}
                      />
                      <span style={{ fontWeight: 800, color: '#64748b' }}>%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* الصلاحية 4: السماح بحذف بنود من السلة */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.1rem',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: '#fee2e2', padding: '0.6rem', borderRadius: '10px', color: '#ef4444' }}>
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                      السماح بحذف أصناف من السلة مباشرة
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      {permissions.allow_delete_items ? '⚠️ مسموح للكاشير بحذف الأصناف دون إذن المشرف' : '🔒 مقيد: يتطلب إدخال رمز المشرف (PIN)'}
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

              {/* الصلاحية 5: السماح بتعديل سعر البيع يدوياً */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.1rem',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: '#dcfce7', padding: '0.6rem', borderRadius: '10px', color: '#059669' }}>
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
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

              {/* الصلاحية 6: السماح بالبيع الآجل */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.1rem',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: '#fef3c7', padding: '0.6rem', borderRadius: '10px', color: '#b45309' }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
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
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                type="submit"
                disabled={savingPermissions}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #047857, #065f46)',
                  padding: '0.75rem 2rem',
                  fontSize: '0.925rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(4, 120, 87, 0.3)'
                }}
              >
                <Save size={18} />
                <span>{savingPermissions ? 'جاري حفظ الصلاحيات في Firebase...' : 'حفظ واعتماد الصلاحيات فوراً'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* TAB 3: تدقيق مبيعات وتقارير جميع الفروع (الحق المطلق)    */}
      {/* ======================================================== */}
      {activeTab === 'sales_audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Controls Bar: Multi-Branch, Multi-Cashier, Date Presets */}
          <div className="card" style={{ padding: '1.25rem', borderRadius: '16px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Branch Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 800, color: '#334155' }}>🏢 الفرع:</span>
                <select
                  value={auditBranchId}
                  onChange={e => setAuditBranchId(e.target.value)}
                  className="form-input"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.825rem', minWidth: '170px' }}
                >
                  <option value="all">🏢 كافة الفروع مجمعة</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name_ar || b.name}</option>
                  ))}
                </select>
              </div>

              {/* Cashier Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 800, color: '#334155' }}>👤 الكاشير:</span>
                <select
                  value={auditCashierId}
                  onChange={e => setAuditCashierId(e.target.value)}
                  className="form-input"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.825rem', minWidth: '170px' }}
                >
                  <option value="all">👥 جميع الكاشيرية</option>
                  {cashierList.map(c => (
                    <option key={c.id || c.username} value={c.name_ar || c.username}>
                      {c.name_ar || c.username}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Presets */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'today', label: 'اليوم' },
                  { id: 'yesterday', label: 'أمس' },
                  { id: 'last_7_days', label: 'آخر 7 أيام' },
                  { id: 'this_month', label: 'هذا الشهر' },
                  { id: 'all', label: 'كل الفترات' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => applyAuditPreset(p.id)}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      border: auditPreset === p.id ? '2px solid #047857' : '1px solid #cbd5e1',
                      background: auditPreset === p.id ? '#ecfdf5' : '#ffffff',
                      color: auditPreset === p.id ? '#047857' : '#475569',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Range */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="date"
                  value={auditFromDate}
                  onChange={e => { setAuditFromDate(e.target.value); setAuditPreset('custom'); }}
                  className="form-input font-mono"
                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>إلى</span>
                <input
                  type="date"
                  value={auditToDate}
                  onChange={e => { setAuditToDate(e.target.value); setAuditPreset('custom'); }}
                  className="form-input font-mono"
                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                />
                <button
                  onClick={fetchAuditReport}
                  disabled={loadingAudit}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <RefreshCw size={13} className={loadingAudit ? 'animate-spin' : ''} />
                  <span>تحديث</span>
                </button>
              </div>
            </div>
          </div>

          {/* Aggregate KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ borderTop: '4px solid #047857', padding: '1.25rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>إجمالي مبيعات الفروع المجمعة</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#047857', marginTop: '0.25rem' }} className="font-mono">
                {(summary.total_sales_grand || 0).toFixed(2)} <span style={{ fontSize: '0.8rem' }}>ر.س</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                بدون ضريبة: {(summary.total_sales_revenue || 0).toFixed(2)} ر.س
              </div>
            </div>

            <div className="card" style={{ borderTop: '4px solid #d97706', padding: '1.25rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>ضريبة القيمة المضافة 15%</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#d97706', marginTop: '0.25rem' }} className="font-mono">
                {(summary.total_sales_vat || 0).toFixed(2)} <span style={{ fontSize: '0.8rem' }}>ر.س</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                محقونة في رمز الاستجابة السريع ZATCA
              </div>
            </div>

            <div className="card" style={{ borderTop: '4px solid #0284c7', padding: '1.25rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>إجمالي عدد الفواتير الصادرة</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0284c7', marginTop: '0.25rem' }} className="font-mono">
                {summary.sales_count || 0} <span style={{ fontSize: '0.8rem' }}>فاتورة</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                متوسط الفاتورة: {(summary.average_sale || 0).toFixed(2)} ر.س
              </div>
            </div>

            <div className="card" style={{ borderTop: '4px solid #8b5cf6', padding: '1.25rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>مطابقة الصندوق والشبكة</div>
              <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
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
                سجل فواتير الفروع والكاشيرات بالفترة المحددة ({filteredInvoices.length} فاتورة)
              </div>
              <div style={{ position: 'relative', width: '250px' }}>
                <Search size={15} style={{ position: 'absolute', right: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="بحث برقم الفاتورة أو العميل أو الكاشير..."
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

      {/* ======================================================== */}
      {/* MODAL: توليد / تعديل حساب كاشير جديد                       */}
      {/* ======================================================== */}
      {showAddModal && (
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
            maxWidth: '600px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #047857, #065f46)',
              color: '#ffffff',
              padding: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PlusCircle size={22} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  {editingCashier ? 'تعديل بيانات حساب الكاشير والفرع' : 'توليد حساب كاشير جديد للمنظومة'}
                </h3>
              </div>
              <button
                onClick={() => { setShowAddModal(false); setEditingCashier(null); }}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCashierAccount} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800 }}>اسم الكاشير الثلاثي *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: سعود محمد الشمري"
                    className="form-input"
                    value={cashierForm.name_ar}
                    onChange={e => setCashierForm({ ...cashierForm, name_ar: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800 }}>الفرع المخصص *</label>
                  <select
                    className="form-input"
                    value={cashierForm.branch_id}
                    onChange={e => setCashierForm({ ...cashierForm, branch_id: Number(e.target.value) })}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name_ar || b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800 }}>اسم المستخدم (Username) *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: cashier_saud"
                    className="form-input font-mono"
                    value={cashierForm.username}
                    onChange={e => setCashierForm({ ...cashierForm, username: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800 }}>كلمة المرور (Password) *</label>
                  <input
                    type="text"
                    required
                    placeholder="كلمة مرور الدخول..."
                    className="form-input font-mono"
                    value={cashierForm.password}
                    onChange={e => setCashierForm({ ...cashierForm, password: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800 }}>رمز الدخول السريع (PIN 4 أرقام)</label>
                  <input
                    type="text"
                    maxLength="4"
                    placeholder="1234"
                    className="form-input font-mono text-center"
                    value={cashierForm.pin}
                    onChange={e => setCashierForm({ ...cashierForm, pin: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">رقم الجوال (اختياري)</label>
                  <input
                    type="text"
                    placeholder="05XXXXXXXX"
                    className="form-input font-mono"
                    value={cashierForm.phone}
                    onChange={e => setCashierForm({ ...cashierForm, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* الصلاحيات المبدئية */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b', marginBottom: '0.2rem' }}>
                  الصلاحيات المبدئية للكاشير:
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cashierForm.can_create_sales}
                    onChange={e => setCashierForm({ ...cashierForm, can_create_sales: e.target.checked })}
                    style={{ accentColor: '#047857' }}
                  />
                  <span>صلاحية تسجيل المبيعات والفواتير (POS Invoicing)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cashierForm.can_view_own_reports}
                    onChange={e => setCashierForm({ ...cashierForm, can_view_own_reports: e.target.checked })}
                    style={{ accentColor: '#047857' }}
                  />
                  <span>صلاحية استخراج التقارير اليومية والشهرية الشخصية فقط</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingCashier(null); }}
                  className="btn btn-secondary"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingCashier}
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #047857, #065f46)',
                    fontWeight: 800,
                    padding: '0.6rem 1.5rem'
                  }}
                >
                  {savingCashier ? 'جاري الحفظ والربط في Firebase...' : editingCashier ? 'حفظ التعديلات' : 'توليد الحساب والربط بالفرع'}
                </button>
              </div>
            </form>
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
