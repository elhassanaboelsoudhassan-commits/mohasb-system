import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Lock, 
  Unlock, 
  Calendar, 
  ShieldCheck, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRightLeft,
  ExternalLink,
  Search,
  Sparkles,
  Settings,
  Package,
  Activity,
  Layers,
  Clock,
  PlusCircle,
  Edit3,
  Phone,
  FileText,
  RefreshCw,
  Check,
  CreditCard,
  Globe,
  Image as ImageIcon,
  Barcode,
  Share2
} from 'lucide-react';
import { safeFetch, LocalSaaSStorage } from '../api/client';
import { subscribeToLiveCompanies } from '../firebase';

export default function SuperAdminDashboard({ onImpersonateTenant }) {
  const [activeTab, setActiveTab] = useState('tenants'); // 'tenants', 'logins', 'central_catalog', 'products', 'inventory'
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Live Logins State
  const [logins, setLogins] = useState([]);
  const [loadingLogins, setLoadingLogins] = useState(false);

  // 5. Central Products Catalog State (إدارة الأصناف المركزية السحابية)
  const [centralProducts, setCentralProducts] = useState([]);
  const [loadingCentral, setLoadingCentral] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [savingCentral, setSavingCentral] = useState(false);
  const [centralForm, setCentralForm] = useState({
    name_ar: '',
    name_en: '',
    code: '',
    category: 'شتلات زهور ومزروعات',
    sale_price: 120,
    cost_price: 60,
    unit: 'شتلة',
    initial_stock: 100,
    image_url: 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=500&q=80'
  });

  // 2. Add Product State
  const [newProduct, setNewProduct] = useState({
    code: '',
    name_ar: '',
    name_en: '',
    category: 'INDOOR',
    purchase_price: 30,
    sale_price: 60,
    initial_stock: 100,
    unit: 'قطعة',
    target_tenant_id: 'ALL' // 'ALL' or specific tenant ID
  });
  const [savingProduct, setSavingProduct] = useState(false);

  // 3. Stock Control State
  const [selectedTenantForStock, setSelectedTenantForStock] = useState('1');
  const [inventoryList, setInventoryList] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [adjustingItemId, setAdjustingItemId] = useState(null);
  const [newQtyVal, setNewQtyVal] = useState('');
  const [adjustReason, setAdjustReason] = useState('جرد دوري من المسؤول');

  // 4. Trial & Invoice Settings Modal State
  const [selectedTenantForEdit, setSelectedTenantForEdit] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({
    name_ar: '',
    name_en: '',
    vat_number: '',
    phone: '',
    cr_number: '',
    bank_account: '3165002243921500013',
    trial_ends_at: ''
  });
  const [savingInvoiceSettings, setSavingInvoiceSettings] = useState(false);

  // ZATCA Modal State
  const [zatcaModalTenant, setZatcaModalTenant] = useState(null);
  const [zatcaOtp, setZatcaOtp] = useState('');
  const [zatcaEnv, setZatcaEnv] = useState('sandbox');
  const [onboardingZatca, setOnboardingZatca] = useState(false);

  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const [newTenantAlert, setNewTenantAlert] = useState(null);

  useEffect(() => {
    fetchSuperAdminData();
    fetchLiveLogins();
    fetchCentralProducts();

    // ⚡ مزامنة حية وفورية كل 3 ثوانٍ (Realtime Live Polling)
    const interval = setInterval(() => {
      fetchSuperAdminData(true);
      fetchLiveLogins(true);
      fetchCentralProducts(true);
      setLastSyncTime(new Date());
    }, 3000);

    const handleTenantRegistered = (e) => {
      const newT = e.detail;
      setNewTenantAlert(`🔔 منشأة جديدة سجلت للتو: ${newT?.name_ar || newT?.company_name_ar || 'شركة جديدة'} - المالك: ${newT?.owner_name || ''}`);
      setTimeout(() => setNewTenantAlert(null), 7000);
      fetchSuperAdminData(true);
      fetchLiveLogins(true);
      fetchCentralProducts(true);
    };

    window.addEventListener('suwayan_tenant_registered', handleTenantRegistered);
    window.addEventListener('suwayan_activity_logged', () => fetchLiveLogins(true));
    window.addEventListener('storage', () => {
      fetchSuperAdminData(true);
      fetchLiveLogins(true);
      fetchCentralProducts(true);
    });

    // ⚡ مراقبة حية وفورية عبر Firebase Firestore (onSnapshot)
    let unsubscribeFirebase = () => {};
    try {
      unsubscribeFirebase = subscribeToLiveCompanies((fbCompanies) => {
        if (fbCompanies && fbCompanies.length > 0) {
          setTenants(prev => {
            const merged = [...prev];
            let hasNew = false;
            let newest = null;
            fbCompanies.forEach(fbComp => {
              const idx = merged.findIndex(t => 
                (t.id && t.id === fbComp.id) || 
                (t.email && fbComp.email && t.email === fbComp.email) ||
                (t.name_ar && fbComp.name_ar && t.name_ar === fbComp.name_ar)
              );
              if (idx === -1) {
                merged.unshift(fbComp);
                hasNew = true;
                newest = fbComp;
              } else {
                merged[idx] = { ...merged[idx], ...fbComp };
              }
            });
            if (hasNew && newest) {
              setNewTenantAlert(`🔥 شركة جديدة ظهرت حياً عبر Firebase: ${newest.name_ar} (المالك: ${newest.owner_name})`);
              setTimeout(() => setNewTenantAlert(null), 8000);
            }
            return merged;
          });
        }
      });
    } catch (e) {
      console.warn('Firebase live listener init note:', e);
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('suwayan_tenant_registered', handleTenantRegistered);
      if (typeof unsubscribeFirebase === 'function') unsubscribeFirebase();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'inventory' && selectedTenantForStock) {
      fetchTenantInventory(selectedTenantForStock);
    }
    if (activeTab === 'central_catalog') {
      fetchCentralProducts();
    }
  }, [activeTab, selectedTenantForStock]);

  const fetchSuperAdminData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [tenantsData, statsData] = await Promise.all([
        safeFetch('/api/superadmin/tenants'),
        safeFetch('/api/superadmin/system-stats')
      ]);
      if (tenantsData && tenantsData.success) {
        setTenants(prev => {
          if (prev.length > 0 && tenantsData.data.length > prev.length) {
            const newest = tenantsData.data[0];
            setNewTenantAlert(`🔔 شركة جديدة مسجلة الآن: ${newest.name_ar || newest.company_name_ar} (المالك: ${newest.owner_name})`);
            setTimeout(() => setNewTenantAlert(null), 7000);
          }
          return tenantsData.data;
        });
        if (tenantsData.data.length > 0 && !selectedTenantForStock) {
          setSelectedTenantForStock(String(tenantsData.data[0].id));
        }
      }
      if (statsData && statsData.success) setStats(statsData.data);
    } catch (err) {
      console.error('Error fetching superadmin data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchLiveLogins = async (silent = false) => {
    if (!silent) setLoadingLogins(true);
    try {
      const res = await safeFetch('/api/superadmin/login-activities');
      if (res && res.success && res.data) {
        setLogins(res.data);
      }
    } catch (err) {
      console.error('Error fetching login activities:', err);
    } finally {
      if (!silent) setLoadingLogins(false);
    }
  };

  const handleResetDemoData = () => {
    if (window.confirm('هل تريد إعادة تعيين المنظومة إلى البيانات التجريبية الشاملة والمتحركة للعرض التقديمي؟')) {
      LocalSaaSStorage.resetToDemoData();
      fetchSuperAdminData();
      fetchLiveLogins();
      fetchCentralProducts();
      alert('✅ تم تفعيل البيانات النموذجية التفاعلية للعرض بنجاح!');
    }
  };

  const fetchCentralProducts = async (silent = false) => {
    if (!silent) setLoadingCentral(true);
    try {
      const res = await safeFetch('/api/superadmin/central-products');
      if (res && res.success && res.data) {
        setCentralProducts(res.data);
      }
    } catch (err) {
      console.error('Error fetching central products:', err);
    } finally {
      if (!silent) setLoadingCentral(false);
    }
  };

  const handleCreateCentralProduct = async (e) => {
    e.preventDefault();
    if (!centralForm.name_ar || !centralForm.sale_price) {
      alert('يرجى ملء اسم الصنف وسعر البيع');
      return;
    }
    setSavingCentral(true);
    try {
      const generatedCode = centralForm.code || ('628' + Math.floor(1000000000 + Math.random() * 9000000000));
      const payload = {
        ...centralForm,
        code: generatedCode,
        barcode: generatedCode,
        sku: 'CENTRAL-' + (centralForm.code || Date.now().toString().slice(-4)),
        selling_price: Number(centralForm.sale_price),
        cost_price: Number(centralForm.cost_price || 0),
        retail_price: Number(centralForm.sale_price),
        initial_stock: Number(centralForm.initial_stock || 100)
      };
      const res = await safeFetch('/api/superadmin/central-products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res && res.success) {
        alert('✅ تم إضافة وحفظ الصنف الزراعي المركزي وتعميمه تلقائياً على كافة المشاتل والفروع!');
        setCentralForm({
          name_ar: '',
          name_en: '',
          code: '',
          category: 'شتلات زهور ومزروعات',
          sale_price: 120,
          cost_price: 60,
          unit: 'شتلة',
          initial_stock: 100,
          image_url: 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=500&q=80'
        });
        fetchCentralProducts();
      } else {
        alert('حدث خطأ: ' + (res?.error || 'فشلت العملية'));
      }
    } catch (err) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setSavingCentral(false);
    }
  };

  const handleBroadcastCentral = async () => {
    setBroadcasting(true);
    try {
      const res = await safeFetch('/api/superadmin/central-products/broadcast', {
        method: 'POST'
      });
      if (res && res.success) {
        alert(`✅ تم تعميم ومزامنة ${res.data?.products_count || 0} صنف مركزي على كافة المشاتل والشركات (${res.data?.tenants_count || 0} منشأة) بنجاح!`);
        fetchCentralProducts();
      } else {
        alert('حدث خطأ: ' + (res?.error || 'فشل التعميم'));
      }
    } catch (err) {
      alert('خطأ: ' + err.message);
    } finally {
      setBroadcasting(false);
    }
  };

  const fetchTenantInventory = async (tenantId) => {
    setLoadingStock(true);
    try {
      const res = await safeFetch(`/api/superadmin/inventory?tenant_id=${tenantId}`);
      if (res && res.success && res.data) {
        setInventoryList(res.data);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoadingStock(false);
    }
  };

  // تغيير حالة الشركة (قفل / فتح / تفعيل)
  const handleUpdateStatus = async (tenantId, status) => {
    try {
      const data = await safeFetch(`/api/superadmin/tenants/${tenantId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      if (data && data.success) {
        fetchSuperAdminData();
      } else {
        alert('حدث خطأ: ' + (data?.error || 'فشلت العملية'));
      }
    } catch (err) {
      alert('خطأ في الاتصال: ' + err.message);
    }
  };

  // إضافة صنف جديد للنظام كمسؤول
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name_ar || !newProduct.sale_price) {
      alert('يرجى ملء اسم الصنف وسعر البيع');
      return;
    }
    setSavingProduct(true);
    try {
      const payload = {
        ...newProduct,
        tenant_id: newProduct.target_tenant_id === 'ALL' ? null : Number(newProduct.target_tenant_id),
        apply_to_all: newProduct.target_tenant_id === 'ALL'
      };
      const res = await safeFetch('/api/superadmin/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res && res.success) {
        alert('✅ تم إضافة وتوزيع الصنف في النظام بنجاح!');
        setNewProduct({
          code: '',
          name_ar: '',
          name_en: '',
          category: 'INDOOR',
          purchase_price: 30,
          sale_price: 60,
          initial_stock: 100,
          unit: 'قطعة',
          target_tenant_id: 'ALL'
        });
        if (activeTab === 'inventory') fetchTenantInventory(selectedTenantForStock);
      } else {
        alert('حدث خطأ: ' + (res?.error || 'فشل الحفظ'));
      }
    } catch (err) {
      alert('خطأ: ' + err.message);
    } finally {
      setSavingProduct(false);
    }
  };

  // تعديل رصيد المخزون لصنف محدد
  const handleAdjustStock = async (product) => {
    if (newQtyVal === '' || isNaN(newQtyVal)) {
      alert('يرجى إدخال كمية صحيحة');
      return;
    }
    try {
      const res = await safeFetch('/api/superadmin/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: Number(selectedTenantForStock),
          product_id: product.id,
          new_quantity: Number(newQtyVal),
          reason: adjustReason
        })
      });
      if (res && res.success) {
        setAdjustingItemId(null);
        setNewQtyVal('');
        fetchTenantInventory(selectedTenantForStock);
      } else {
        alert('حدث خطأ: ' + (res?.error || 'فشل التعديل'));
      }
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  };

  // فتح نافذة تعديل بيانات الفاتورة والشركة
  const handleOpenInvoiceSettings = (tenant) => {
    setSelectedTenantForEdit(tenant);
    setInvoiceForm({
      name_ar: tenant.name_ar || '',
      name_en: tenant.name_en || '',
      vat_number: tenant.vat_number || '300000000000003',
      phone: tenant.phone || '920000000',
      cr_number: tenant.cr_number || '1010000000',
      bank_account: tenant.bank_account || '3165002243921500013',
      trial_ends_at: tenant.trial_ends_at || ''
    });
  };

  // حفظ إعدادات الفاتورة والشركة
  const handleSaveInvoiceSettings = async (e) => {
    e.preventDefault();
    setSavingInvoiceSettings(true);
    try {
      const res = await safeFetch(`/api/superadmin/tenants/${selectedTenantForEdit.id}/invoice-settings`, {
        method: 'POST',
        body: JSON.stringify(invoiceForm)
      });
      if (res && res.success) {
        alert('✅ تم حفظ وتحديث بيانات الفاتورة والشركة بنجاح!');
        setSelectedTenantForEdit(null);
        fetchSuperAdminData();
      } else {
        alert('فشل الحفظ: ' + (res?.error || 'خطأ غير متوقع'));
      }
    } catch (err) {
      alert('خطأ: ' + err.message);
    } finally {
      setSavingInvoiceSettings(false);
    }
  };

  // تمديد الفترة التجريبية بأزرار سريعة
  const handleAddTrialDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setInvoiceForm(prev => ({
      ...prev,
      trial_ends_at: d.toISOString().split('T')[0]
    }));
  };

  // ZATCA Onboarding
  const handleZatcaOnboard = async (e) => {
    e.preventDefault();
    setOnboardingZatca(true);
    try {
      const res = await safeFetch('/api/zatca/onboard', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: zatcaModalTenant.id,
          otp: zatcaOtp,
          env: zatcaEnv
        })
      });
      if (res && res.success) {
        alert(`✅ تم ربط منشأة (${zatcaModalTenant.name_ar}) مع هيئة الزكاة والضريبة والجمارك بنجاح!\nرمز الاعتماد: ${res.data.csid.substring(0, 20)}...`);
        setZatcaModalTenant(null);
        setZatcaOtp('');
        fetchSuperAdminData();
      } else {
        alert('فشل ربط ZATCA: ' + (res?.error || 'خطأ غير متوقع'));
      }
    } catch (err) {
      alert('خطأ: ' + err.message);
    } finally {
      setOnboardingZatca(false);
    }
  };

  const filteredTenants = tenants.filter(t => {
    if (searchTerm) {
      const matchName = t.name_ar?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchOwner = t.owner_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCode = t.code?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchName && !matchOwner && !matchCode) return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Super Admin Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #0f172a 100%)',
        padding: '1.75rem 2rem',
        borderRadius: '16px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
              صلاحيات المسؤول المطلق (Super Admin)
            </span>
            <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
              الحساب المعتمد: elhassanelsoudy@gmail.com
            </span>
          </div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 900 }}>
            مركز إدارة ومراقبة منظومة الصويان السحابية
          </h2>
          <p style={{ color: '#a7f3d0', fontSize: '0.85rem', maxWidth: '750px', marginTop: '0.3rem' }}>
            مراقبة حية لتسجيل دخول المستخدمين، إضافة وإعداد الأصناف، التحكم في كميات المخزون والفترات التجريبية، تخصيص بيانات الفاتورة الضريبية، وربط هيئة الزكاة والضريبة والجمارك (ZATCA).
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
          {/* شارة المزامنة الحية التلقائية الفورية */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid #10b981',
            padding: '0.3rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 800,
            color: '#a7f3d0'
          }}>
            <span style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              background: '#10b981',
              display: 'inline-block',
              boxShadow: '0 0 10px #10b981',
              animation: 'pulse 1.2s infinite'
            }}></span>
            <span>مزامنة حية نشطة ومباشرة (Realtime 3s)</span>
            <span style={{ opacity: 0.8, fontSize: '0.7rem' }}>
              ({lastSyncTime.toLocaleTimeString('ar-SA')})
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* زر إعادة تهيئة البيانات النموذجية للعرض */}
            <button
              onClick={handleResetDemoData}
              className="btn btn-secondary"
              style={{
                background: 'linear-gradient(135deg, #d97706, #b45309)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.8rem',
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.4)'
              }}
              title="إعادة شحن المنظومة ببيانات مشاتل وفواتير حقيقية لعرضها أمام كبار الشركات"
            >
              <span>📊 تهيئة البيانات النموذجية للعرض (Demo Data)</span>
            </button>

            <button 
              onClick={() => {
                fetchSuperAdminData();
                fetchLiveLogins();
                if (activeTab === 'inventory') fetchTenantInventory(selectedTenantForStock);
              }} 
              className="btn btn-secondary" 
              style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>تحديث يدوي</span>
            </button>
          </div>
        </div>
      </div>

      {/* تنبيه حي عند تسجيل أي شركة جديدة فوراً */}
      {newTenantAlert && (
        <div style={{
          background: 'linear-gradient(135deg, #10b981, #047857)',
          color: '#ffffff',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          fontWeight: 800,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 8px 20px -3px rgba(16, 185, 129, 0.4)',
          animation: 'bounce 0.8s'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🎉</span>
            <span>{newTenantAlert}</span>
          </div>
          <button
            onClick={() => setNewTenantAlert(null)}
            style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

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
          { id: 'tenants', label: '🏢 إدارة الشركات والمشتركين', count: tenants.length },
          { id: 'logins', label: '🔴 سجل الدخول اللحظي (Live Logins)', count: logins.length },
          { id: 'central_catalog', label: '🌐 إدارة الأصناف المركزية', count: centralProducts.length, badge: 'سحابي عام' },
          { id: 'products', label: '🌱 إضافة وإعداد الأصناف بالمنظومة', badge: 'جديد' },
          { id: 'inventory', label: '⚖️ تعديل كميات المخزون والجرد', badge: 'تحكم' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.65rem 1.1rem',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.85rem',
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
                background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                color: activeTab === tab.id ? '#ffffff' : '#0f172a',
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
                padding: '0.1rem 0.4rem',
                borderRadius: '6px',
                fontSize: '0.7rem'
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: Tenants & Subscriptions Management */}
      {activeTab === 'tenants' && (
        <>
          {/* Stats Cards */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              <div className="card" style={{ borderTop: '4px solid #047857' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>إجمالي الشركات المسجلة</span>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#0f172a', marginTop: '0.25rem' }} className="font-mono">
                  {stats.total_tenants}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.4rem' }}>
                  نشط: {stats.active_tenants} | تجريبي: {stats.trial_tenants}
                </div>
              </div>

              <div className="card" style={{ borderTop: '4px solid #10b981' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>الشركات النشطة</span>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#059669', marginTop: '0.25rem' }} className="font-mono">
                  {stats.active_tenants}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
                  اشتراكات مفعلة ومكتملة
                </div>
              </div>

              <div className="card" style={{ borderTop: '4px solid #d97706' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>الشركات في الفترة التجريبية</span>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#d97706', marginTop: '0.25rem' }} className="font-mono">
                  {stats.trial_tenants}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.4rem' }}>
                  يمكنك تعديل مدة التجربة يدوياً
                </div>
              </div>

              <div className="card" style={{ borderTop: '4px solid #be123c' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>الشركات المقفلة / الموقوفة</span>
                <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#be123c', marginTop: '0.25rem' }} className="font-mono">
                  {stats.locked_tenants}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#be123c', marginTop: '0.4rem' }}>
                  محظور دخولهم للنظام
                </div>
              </div>

              <div className="card" style={{ borderTop: '4px solid #0284c7' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>حجم مبيعات المنظومة الكلي</span>
                <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', marginTop: '0.25rem' }} className="font-mono">
                  {stats.total_volume?.toLocaleString('ar-SA')} <span style={{ fontSize: '0.8rem' }}>ر.س</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
                  عبر {stats.total_invoices} فاتورة مصدرة
                </div>
              </div>
            </div>
          )}

          {/* Tenants Management Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                  جدول إدارة الشركات والمشتركين ({filteredTenants.length})
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  تعديل بيانات الفاتورة الضريبية، تمديد الفترات التجريبية، قفل وفتح المنشآت، وربط هيئة الزكاة.
                </p>
              </div>

              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={16} style={{ position: 'absolute', right: '12px', top: '12px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="بحث بالشركة أو المالك..."
                  className="form-input"
                  style={{ paddingRight: '2.4rem', width: '100%' }}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>كود المنشأة</th>
                    <th>اسم الشركة / المشتل</th>
                    <th>مالك المنشأة والاتصال</th>
                    <th>حالة الاشتراك</th>
                    <th>نهاية الفترة التجريبية</th>
                    <th>ربط ZATCA</th>
                    <th>الحساب البنكي المعتمد</th>
                    <th>إجمالي المبيعات</th>
                    <th style={{ textAlign: 'center' }}>إجراءات المسؤول المطلق</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map(t => (
                    <tr key={t.id}>
                      <td className="font-mono" style={{ fontWeight: 800, color: '#047857' }}>
                        {t.code}
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{t.name_ar}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          هاتف: {t.phone || '920000000'} | ضريبي: {t.vat_number || '300000000000003'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{t.owner_name}</div>
                        <div className="font-mono" style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.email}</div>
                      </td>
                      <td>
                        <span className={`badge ${
                          t.status === 'active' ? 'badge-success' :
                          t.status === 'trial' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {t.status === 'active' ? '✅ نشط ومفعل' :
                           t.status === 'trial' ? '⏳ فترة تجريبية' : '🔒 مقفل وموقوف'}
                        </span>
                      </td>
                      <td>
                        <div>
                          <span className="font-mono" style={{ fontWeight: 700, color: t.status === 'trial' ? '#b45309' : '#059669' }}>
                            {t.trial_ends_at || 'مفعل دائم'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => setZatcaModalTenant(t)}
                          className={`badge ${t.enable_zatca ? 'badge-success' : 'badge-secondary'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                          title="إعداد وربط هيئة الزكاة والضريبة والجمارك"
                        >
                          {t.enable_zatca ? 'مربوط ZATCA 2 ✓' : 'غير مربوط (اضغط للربط)'}
                        </button>
                      </td>
                      <td>
                        <div className="font-mono" style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 700 }}>
                          {t.bank_account || '3165002243921500013'}
                        </div>
                      </td>
                      <td className="font-mono" style={{ fontWeight: 800 }}>
                        {t.total_sales?.toLocaleString('ar-SA')} ر.س
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                          {/* زر تعديل بيانات الفاتورة والفترة التجريبية */}
                          <button
                            onClick={() => handleOpenInvoiceSettings(t)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.775rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            title="تعديل بيانات الفاتورة والرقم الضريبي والهاتف والمدة التجريبية"
                          >
                            <Edit3 size={12} />
                            <span>تعديل الفاتورة</span>
                          </button>

                          {/* تفعيل كامل */}
                          {t.status !== 'active' && (
                            <button
                              onClick={() => handleUpdateStatus(t.id, 'active')}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.775rem', color: '#047857' }}
                              title="تفعيل دائم للمنشأة"
                            >
                              تفعيل
                            </button>
                          )}

                          {/* قفل أو فتح */}
                          {t.status === 'locked' ? (
                            <button
                              onClick={() => handleUpdateStatus(t.id, 'active')}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.775rem', color: '#047857' }}
                              title="فتح النظام"
                            >
                              <Unlock size={12} />
                              <span>فتح</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateStatus(t.id, 'locked')}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.775rem', color: '#be123c' }}
                              title="قفل النظام على المنشأة"
                            >
                              <Lock size={12} />
                              <span>قفل</span>
                            </button>
                          )}

                          {/* الدخول كمسؤول في الشركة */}
                          <button
                            onClick={() => onImpersonateTenant(t)}
                            className="btn btn-primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.775rem', background: '#047857' }}
                            title="الدخول للشركة لمعاينة وتعديل بياناتها كمسؤول مطلق"
                          >
                            <ExternalLink size={12} />
                            <span>دخول للمنشأة</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: Live Login Activities (سجل الدخول اللحظي) */}
      {activeTab === 'logins' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.5s infinite' }}></span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                  سجل الدخول الحي واللحظي إلى المنظومة (Live Login Feed)
                </h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                يتم رصد وتسجيل كل عملية دخول للمنظومة مباشرة وإشعار حساب المسؤول المطلق بالوقت والجهاز وهوية المستخدم والشركة.
              </p>
            </div>

            <button
              onClick={fetchLiveLogins}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <RefreshCw size={14} className={loadingLogins ? 'animate-spin' : ''} />
              <span>تحديث السجل الآن</span>
            </button>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>توقيت الدخول اللحظي</th>
                  <th>المستخدم</th>
                  <th>البريد الإلكتروني</th>
                  <th>الصلاحية / الدور</th>
                  <th>المنشأة / الشركة</th>
                  <th>عنوان IP والجهاز</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {logins.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                      لا توجد سجلات دخول مسجلة حالياً
                    </td>
                  </tr>
                ) : (
                  logins.map(l => (
                    <tr key={l.id}>
                      <td className="font-mono" style={{ fontWeight: 700, color: '#047857' }}>
                        {new Date(l.login_at).toLocaleString('ar-SA')}
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{l.user_name}</div>
                      </td>
                      <td className="font-mono" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {l.email}
                      </td>
                      <td>
                        <span className={`badge ${
                          l.role === 'super_admin' ? 'badge-primary' :
                          l.role === 'company_admin' ? 'badge-success' : 'badge-secondary'
                        }`}>
                          {l.role === 'super_admin' ? '👑 مسؤول مطلق' :
                           l.role === 'company_admin' ? '🏢 مدير شركة' : '👤 كاشير / موظف'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#047857' }}>
                          {l.tenant_name || 'منظومة الصويان العامة'}
                        </div>
                      </td>
                      <td>
                        <div className="font-mono" style={{ fontSize: '0.75rem', color: '#475569' }}>
                          {l.ip_address || '127.0.0.1'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.user_agent || 'Chrome / Windows'}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-success">ناجح ✓</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: Central Products Catalog (إدارة الأصناف المركزية) */}
      {activeTab === 'central_catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Info & Broadcast Action Bar */}
          <div style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #0f172a 100%)',
            padding: '1.5rem 1.75rem',
            borderRadius: '16px',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: '0 8px 25px -4px rgba(6, 78, 59, 0.4)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <span style={{ background: '#10b981', color: '#022c22', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 900 }}>
                  السحابة المركزية (Central Master Catalog)
                </span>
                <span style={{ fontSize: '0.85rem', color: '#a7f3d0' }}>
                  مربوط تلقائياً بجميع الفروع والمشاتل المشتركة
                </span>
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>
                إدارة وتوزيع الأصناف المركزية على الفروع والمشاتل
              </h3>
              <p style={{ color: '#d1fae5', fontSize: '0.85rem', maxWidth: '680px', marginTop: '0.35rem', lineHeight: 1.5 }}>
                أضف أي صنف زراعي (اسم الصنف، الصورة، السعر الافتراضي، والباركود) ليتم حفظه بالسحابة المركزية ويظهر تلقائياً في مخازن وواجهات الكاشير السريع (POS) لدى كافة المشاتل لبيعه فوراً.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleBroadcastCentral}
                disabled={broadcasting}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.7rem 1.4rem',
                  borderRadius: '10px',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                  cursor: broadcasting ? 'wait' : 'pointer'
                }}
              >
                <Share2 size={16} className={broadcasting ? 'animate-spin' : ''} />
                <span>{broadcasting ? 'جاري المزامنة مع المشاتل...' : 'تعميم ومزامنة كافة المشاتل الآن (Broadcast)'}</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            {/* 1. Form: إضافة صنف زراعي مركزي */}
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                    نموذج إضافة صنف زراعي مركزي جديد
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '3px 0 0' }}>
                    الصنف المضاف هنا سيظهر فوراً في نقاط بيع كاشير (POS) جميع المشاتل
                  </p>
                </div>
                <span className="badge badge-success" style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}>
                  سحابي عام ✓
                </span>
              </div>

              <form onSubmit={handleCreateCentralProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800 }}>اسم الصنف الزراعي بالعربية *</label>
                    <input
                      required
                      type="text"
                      className="form-input"
                      placeholder="مثال: شتلة جهنمية قزمية هجين"
                      value={centralForm.name_ar}
                      onChange={e => setCentralForm({ ...centralForm, name_ar: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800 }}>الاسم العلمي / الإنجليزي (اختياري)</label>
                    <input
                      type="text"
                      className="form-input font-mono"
                      placeholder="Bougainvillea Dwarf Hybrid"
                      value={centralForm.name_en}
                      onChange={e => setCentralForm({ ...centralForm, name_en: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label className="form-label" style={{ margin: 0, fontWeight: 800 }}>الباركود / كود الصنف *</label>
                      <button
                        type="button"
                        onClick={() => {
                          const code = '628' + Math.floor(1000000000 + Math.random() * 9000000000);
                          setCentralForm({ ...centralForm, code });
                        }}
                        style={{ background: 'none', border: 'none', color: '#047857', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Barcode size={12} />
                        <span>توليد تلقائي</span>
                      </button>
                    </div>
                    <input
                      required
                      type="text"
                      className="form-input font-mono"
                      placeholder="6281100998811"
                      value={centralForm.code}
                      onChange={e => setCentralForm({ ...centralForm, code: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800 }}>التصنيف الزراعي</label>
                    <select
                      className="form-input"
                      value={centralForm.category}
                      onChange={e => setCentralForm({ ...centralForm, category: e.target.value })}
                    >
                      <option value="نخيل وأشجار زينة">🌴 نخيل وأشجار زينة وتظليل</option>
                      <option value="شتلات زهور ومزروعات">🌸 شتلات زهور ونباتات مزهرة</option>
                      <option value="نباتات وظل داخلي">🪴 نباتات وظل داخلي (Indoor)</option>
                      <option value="أسمدة ومخصبات">🧪 أسمدة ومخصبات وتربة زراعية</option>
                      <option value="شبكات ومستلزمات ري">💧 شبكات ومستلزمات ري ذكي</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 800 }}>سعر البيع للجمهور * (ر.س)</label>
                    <input
                      required
                      type="number"
                      step="0.5"
                      className="form-input font-mono"
                      value={centralForm.sale_price}
                      onChange={e => setCentralForm({ ...centralForm, sale_price: Number(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">سعر التكلفة الافتراضي (ر.س)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-input font-mono"
                      value={centralForm.cost_price}
                      onChange={e => setCentralForm({ ...centralForm, cost_price: Number(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">الكمية المتاحة الافتراضية</label>
                    <input
                      type="number"
                      className="form-input font-mono"
                      value={centralForm.initial_stock}
                      onChange={e => setCentralForm({ ...centralForm, initial_stock: Number(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">وحدة الصنف</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="شتلة / شجرة / حبة / كيس"
                      value={centralForm.unit}
                      onChange={e => setCentralForm({ ...centralForm, unit: e.target.value })}
                    />
                  </div>
                </div>

                {/* رابط صورة الصنف واختيارات سريعة */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800 }}>رابط صورة الصنف الزراعي (Image URL)</label>
                  <input
                    type="url"
                    className="form-input font-mono"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={centralForm.image_url}
                    onChange={e => setCentralForm({ ...centralForm, image_url: e.target.value })}
                  />

                  {/* صور جاهزة ومقترحة لاختيار سريع */}
                  <div style={{ marginTop: '0.6rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                      أو اختر صورة جاهزة للشتلات والأصناف:
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {[
                        { label: '🌴 نخيل واشنطونيا', url: 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=500&q=80' },
                        { label: '🫒 زيتون معمر', url: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=500&q=80' },
                        { label: '🌹 ورد جوري', url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=500&q=80' },
                        { label: '🪴 نبتة زاميا', url: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=500&q=80' },
                        { label: '🌵 ألوفيرا', url: 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=500&q=80' },
                        { label: '🧪 سماد هولندي', url: 'https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?w=500&q=80' }
                      ].map(img => (
                        <button
                          key={img.label}
                          type="button"
                          onClick={() => setCentralForm({ ...centralForm, image_url: img.url })}
                          style={{
                            padding: '0.3rem 0.65rem',
                            borderRadius: '8px',
                            border: centralForm.image_url === img.url ? '2px solid #047857' : '1px solid #cbd5e1',
                            background: centralForm.image_url === img.url ? '#ecfdf5' : '#ffffff',
                            color: centralForm.image_url === img.url ? '#047857' : '#334155',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <span>{img.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="submit"
                    disabled={savingCentral}
                    className="btn btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #047857, #065f46)',
                      padding: '0.75rem 2.25rem',
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 12px rgba(4, 120, 87, 0.3)'
                    }}
                  >
                    <PlusCircle size={18} />
                    <span>{savingCentral ? 'جاري الحفظ والتعميم في السحابة...' : 'حفظ وتعميم الصنف المركزي فوراً'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* 2. بطاقة المعاينة المباشرة للصنف في الكاشير (POS Live Preview) */}
            <div className="card" style={{ background: '#0f172a', color: '#ffffff', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8' }}>
                  معاينة فورية لكارت الصنف في POS
                </span>
                <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #10b981', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                  🌐 صنف مركزي
                </span>
              </div>

              {/* بطاقة الكاشير المصغرة */}
              <div style={{
                background: '#1e293b',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid #047857',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
              }}>
                <div style={{ height: '160px', position: 'relative', background: '#0f172a' }}>
                  <img
                    src={centralForm.image_url || 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=500&q=80'}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=500&q=80'; }}
                  />
                  <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(2, 44, 34, 0.85)', backdropFilter: 'blur(4px)', color: '#34d399', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, border: '1px solid #047857' }}>
                    {centralForm.category || 'نخيل وأشجار'}
                  </div>
                  <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.75)', color: '#ffffff', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                    متوفر: {centralForm.initial_stock} {centralForm.unit}
                  </div>
                </div>

                <div style={{ padding: '1rem' }}>
                  <h5 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    {centralForm.name_ar || 'اسم الصنف الزراعي'}
                  </h5>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '3px 0 0', fontFamily: 'monospace' }}>
                    {centralForm.name_en || 'Product Name (English)'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <span style={{ background: '#334155', color: '#cbd5e1', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                      {centralForm.code || '6281100998811'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #334155' }}>
                    <div>
                      <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981' }}>
                        {Number(centralForm.sale_price || 0).toFixed(2)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: '3px' }}>ر.س</span>
                    </div>
                    <button
                      type="button"
                      style={{
                        background: '#047857',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 800
                      }}
                    >
                      + إضافة للسلة
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #0284c7', borderRadius: '10px', fontSize: '0.75rem', color: '#bae6fd', lineHeight: 1.5 }}>
                💡 <strong>ملاحظة للمسؤول السوبر:</strong> بمجرد الحفظ، سيتزامن هذا الكارت فوراً مع أجهزة التابلت والكمبيوتر لدى كافة المشاتل ليتمكن الكاشير من مسح الباركود أو الضغط على الصنف لبيعه مباشرة.
              </div>
            </div>
          </div>

          {/* جدول واستعراض الأصناف المركزية المسجلة بالسحابة */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  الأصناف المركزية المسجلة في السحابة ({centralProducts.length})
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '3px 0 0' }}>
                  هذه الأصناف معتمدة وموزعة على كافة المشاتل والفروع
                </p>
              </div>

              <button
                type="button"
                onClick={() => fetchCentralProducts()}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <RefreshCw size={13} className={loadingCentral ? 'animate-spin' : ''} />
                <span>تحديث القائمة</span>
              </button>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الصورة</th>
                    <th>اسم الصنف الزراعي</th>
                    <th>الباركود / الكود</th>
                    <th>التصنيف</th>
                    <th>سعر البيع الموحد</th>
                    <th>التكلفة الافتراضية</th>
                    <th>الوحدة</th>
                    <th>حالة النشر والمزامنة</th>
                  </tr>
                </thead>
                <tbody>
                  {centralProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                        لا توجد أصناف مركزية حالياً. استخدم النموذج أعلاه لإضافة أول صنف مركزي!
                      </td>
                    </tr>
                  ) : (
                    centralProducts.map(cp => (
                      <tr key={cp.id}>
                        <td>
                          <img
                            src={cp.image_url || 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=100&q=80'}
                            alt={cp.name_ar}
                            style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=100&q=80'; }}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{cp.name_ar}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>{cp.name_en || cp.sku}</div>
                        </td>
                        <td>
                          <span className="font-mono" style={{ background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                            {cp.barcode || cp.code}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-secondary">{cp.category || 'نباتات عامة'}</span>
                        </td>
                        <td className="font-mono" style={{ fontWeight: 800, color: '#047857' }}>
                          {Number(cp.selling_price || cp.sale_price || cp.retail_price || 0).toFixed(2)} ر.س
                        </td>
                        <td className="font-mono" style={{ color: '#64748b', fontSize: '0.85rem' }}>
                          {Number(cp.cost_price || 0).toFixed(2)} ر.س
                        </td>
                        <td>{cp.unit || 'شتلة'}</td>
                        <td>
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span>✓</span>
                            <span>موزع على جميع الفروع وPOS</span>
                          </span>
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

      {/* TAB 3: Add and Configure Products (إضافة وإعداد الأصناف) */}
      {activeTab === 'products' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Form */}
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                إضافة وإعداد صنف جديد في المنظومة (Master Product Catalog)
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                بصفتك المسؤول المطلق، يمكنك إضافة أصناف جديدة وتعميمها على جميع المشاتل والشركات المشتركة أو تخصيصها لمشتل معين مع ضبط الكميات الأولية.
              </p>
            </div>

            <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">كود الصنف / الباركود</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    placeholder="مثال: PLT-900 أو باركود دولي"
                    value={newProduct.code}
                    onChange={e => setNewProduct({ ...newProduct, code: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">اسم الصنف بالعربية *</label>
                  <input
                    required
                    type="text"
                    className="form-input"
                    placeholder="مثال: شتلة جهنمية قزمية هجين"
                    value={newProduct.name_ar}
                    onChange={e => setNewProduct({ ...newProduct, name_ar: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">الاسم بالإنجليزية (اختياري)</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    placeholder="Bougainvillea Dwarf Hybrid"
                    value={newProduct.name_en}
                    onChange={e => setNewProduct({ ...newProduct, name_en: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">تصنيف الصنف</label>
                  <select
                    className="form-input"
                    value={newProduct.category}
                    onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                  >
                    <option value="TREES">🌳 أشجار وظل خارجي (Trees)</option>
                    <option value="INDOOR">🪴 نباتات وظل داخلي (Indoor Plants)</option>
                    <option value="FERT">🧪 أسمدة ومخصبات زراعية (Fertilizers)</option>
                    <option value="IRRIG">💧 شبكات ومستلزمات ري (Irrigation)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div className="form-group">
                  <label className="form-label">سعر التكلفة / الشراء (ر.س)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="form-input font-mono"
                    value={newProduct.purchase_price}
                    onChange={e => setNewProduct({ ...newProduct, purchase_price: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">سعر البيع للجمهور * (ر.س)</label>
                  <input
                    required
                    type="number"
                    step="0.5"
                    className="form-input font-mono"
                    value={newProduct.sale_price}
                    onChange={e => setNewProduct({ ...newProduct, sale_price: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">الكمية الافتتاحية للمخزون</label>
                  <input
                    type="number"
                    className="form-input font-mono"
                    value={newProduct.initial_stock}
                    onChange={e => setNewProduct({ ...newProduct, initial_stock: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">وحدة القياس</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="شتلة / حبة / كجم / لتر"
                    value={newProduct.unit}
                    onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })}
                  />
                </div>
              </div>

              {/* النطاق والشركة المستهدفة */}
              <div className="form-group" style={{ background: '#ecfdf5', padding: '1rem', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                <label className="form-label" style={{ color: '#065f46', fontWeight: 800 }}>
                  توزيع الصنف على الشركات والمشاتل:
                </label>
                <select
                  className="form-input"
                  value={newProduct.target_tenant_id}
                  onChange={e => setNewProduct({ ...newProduct, target_tenant_id: e.target.value })}
                  style={{ borderColor: '#059669', background: '#ffffff' }}
                >
                  <option value="ALL">🌐 تعميم الصنف على جميع الشركات والمشاتل المشتركة في المنظومة</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      🏢 تخصيص لشركة: {t.name_ar} ({t.code})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: '#047857', marginTop: '0.4rem', display: 'block' }}>
                  عند اختيار (التعميم)، سيتم إنشاء الصنف مع رصيد مخزني أولي في مستودع كل شركة تلقائياً ليظهر مباشرة في الكاشير.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="btn btn-primary"
                  style={{ background: '#047857', padding: '0.75rem 2rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <PlusCircle size={18} />
                  <span>{savingProduct ? 'جاري الحفظ والتعميم...' : 'حفظ وإدراج الصنف في النظام'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: Stock Quantity Adjustments & Inventory (تعديل كميات المخزون) */}
      {activeTab === 'inventory' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                التحكم المباشر في أرصدة المخزون والجرد
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                معاينة رصيد المخزون الفعلي لأي شركة وتعديل الكميات يدوياً مع تسجيل قيود تسوية الجرد.
              </p>
            </div>

            {/* اختيار الشركة المستعرضة */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>اختر الشركة:</label>
              <select
                className="form-input"
                style={{ width: '220px' }}
                value={selectedTenantForStock}
                onChange={e => setSelectedTenantForStock(e.target.value)}
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name_ar} ({t.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>كود الصنف</th>
                  <th>اسم الصنف</th>
                  <th>التصنيف</th>
                  <th>سعر البيع</th>
                  <th>الكمية المتوفرة حالياً</th>
                  <th>تعديل الرصيد الفوري</th>
                </tr>
              </thead>
              <tbody>
                {loadingStock ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                      <div className="animate-spin" style={{ display: 'inline-block' }}>⏳</div> جاري جلب المخزون...
                    </td>
                  </tr>
                ) : inventoryList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                      لا توجد أصناف مسجلة لهذه الشركة حالياً
                    </td>
                  </tr>
                ) : (
                  inventoryList.map(item => (
                    <tr key={item.id}>
                      <td className="font-mono" style={{ fontWeight: 800, color: '#047857' }}>
                        {item.code}
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.name_ar}</div>
                        {item.name_en && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.name_en}</div>}
                      </td>
                      <td>
                        <span className="badge badge-secondary">{item.category || 'عام'}</span>
                      </td>
                      <td className="font-mono" style={{ fontWeight: 700 }}>
                        {Number(item.sale_price || item.price || 0).toFixed(2)} ر.س
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          background: item.quantity > 20 ? '#dcfce7' : item.quantity > 0 ? '#fef3c7' : '#ffe4e6',
                          color: item.quantity > 20 ? '#15803d' : item.quantity > 0 ? '#b45309' : '#be123c'
                        }}>
                          {item.quantity} {item.unit || 'قطعة'}
                        </span>
                      </td>
                      <td>
                        {adjustingItemId === item.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <input
                              type="number"
                              className="form-input font-mono"
                              style={{ width: '80px', padding: '0.25rem 0.45rem', fontSize: '0.85rem' }}
                              value={newQtyVal}
                              onChange={e => setNewQtyVal(e.target.value)}
                              placeholder="الكمية"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleAdjustStock(item)}
                              className="btn btn-primary"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: '#047857' }}
                            >
                              حفظ ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdjustingItemId(null)}
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustingItemId(item.id);
                              setNewQtyVal(String(item.quantity));
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', color: '#047857' }}
                          >
                            تعديل الكمية ✏️
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: تعديل بيانات الفاتورة والفترة التجريبية للشركة */}
      {selectedTenantForEdit && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} color="#047857" />
                <h3 style={{ fontWeight: 900, fontSize: '1.15rem' }}>
                  تعديل بيانات الفاتورة والمنشأة والفترة التجريبية
                </h3>
              </div>
              <button onClick={() => setSelectedTenantForEdit(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleSaveInvoiceSettings}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>الشركة: {selectedTenantForEdit.name_ar} ({selectedTenantForEdit.code})</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>المالك: {selectedTenantForEdit.owner_name} - {selectedTenantForEdit.email}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                  <div className="form-group">
                    <label className="form-label">اسم الشركة على الفاتورة (عربي) *</label>
                    <input
                      required
                      type="text"
                      className="form-input"
                      value={invoiceForm.name_ar}
                      onChange={e => setInvoiceForm({ ...invoiceForm, name_ar: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">اسم الشركة (إنجليزي)</label>
                    <input
                      type="text"
                      className="form-input font-mono"
                      value={invoiceForm.name_en}
                      onChange={e => setInvoiceForm({ ...invoiceForm, name_en: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                  <div className="form-group">
                    <label className="form-label">الرقم الضريبي (15 رقم) *</label>
                    <input
                      required
                      type="text"
                      maxLength="15"
                      className="form-input font-mono"
                      value={invoiceForm.vat_number}
                      onChange={e => setInvoiceForm({ ...invoiceForm, vat_number: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">رقم هاتف الشركة الموحد *</label>
                    <input
                      required
                      type="text"
                      className="form-input font-mono"
                      value={invoiceForm.phone}
                      onChange={e => setInvoiceForm({ ...invoiceForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">رقم السجل التجاري (CR)</label>
                    <input
                      type="text"
                      className="form-input font-mono"
                      value={invoiceForm.cr_number}
                      onChange={e => setInvoiceForm({ ...invoiceForm, cr_number: e.target.value })}
                    />
                  </div>
                </div>

                {/* الحساب البنكي المعتمد للتحويلات */}
                <div className="form-group" style={{ background: '#ecfdf5', padding: '0.85rem', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                  <label className="form-label" style={{ color: '#065f46', fontWeight: 800 }}>
                    🏦 رقم الحساب البنكي المعتمد لتحويل المبيعات (الراجحي):
                  </label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    style={{ fontWeight: 800, color: '#047857', letterSpacing: '1px' }}
                    value={invoiceForm.bank_account}
                    onChange={e => setInvoiceForm({ ...invoiceForm, bank_account: e.target.value })}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#047857', marginTop: '0.3rem', display: 'block' }}>
                    يظهر هذا الحساب تلقائياً للمشتري في واجهة الكاشير عند اختيار الدفع بالتحويل البنكي. الحساب الشخصي الافتراضي: 3165002243921500013
                  </span>
                </div>

                {/* تمديد الفترة التجريبية */}
                <div className="form-group" style={{ background: '#fef3c7', padding: '0.85rem', borderRadius: '10px', border: '1px solid #fde68a' }}>
                  <label className="form-label" style={{ color: '#92400e', fontWeight: 800 }}>
                    ⏳ تمديد وتعديل الفترة التجريبية:
                  </label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                    {[
                      { days: 7, label: '+7 أيام' },
                      { days: 14, label: '+14 يوم' },
                      { days: 30, label: '+شهر كامل' },
                      { days: 90, label: '+3 أشهر' },
                      { days: 365, label: '+سنة كاملة' }
                    ].map(btn => (
                      <button
                        key={btn.days}
                        type="button"
                        onClick={() => handleAddTrialDays(btn.days)}
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#ffffff', borderColor: '#d97706', color: '#92400e' }}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="date"
                    className="form-input font-mono"
                    value={invoiceForm.trial_ends_at}
                    onChange={e => setInvoiceForm({ ...invoiceForm, trial_ends_at: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setSelectedTenantForEdit(null)} className="btn btn-secondary">إلغاء</button>
                <button type="submit" disabled={savingInvoiceSettings} className="btn btn-primary" style={{ background: '#047857' }}>
                  {savingInvoiceSettings ? 'جاري الحفظ...' : 'حفظ التعديلات واعتماد الفاتورة ✔️'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: ربط هيئة الزكاة والضريبة والجمارك (ZATCA Onboarding) */}
      {zatcaModalTenant && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={22} color="#047857" />
                <h3 style={{ fontWeight: 900, fontSize: '1.15rem' }}>
                  ربط المنشأة بهيئة الزكاة والضريبة والجمارك (ZATCA 2)
                </h3>
              </div>
              <button onClick={() => setZatcaModalTenant(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleZatcaOnboard}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 800 }}>{zatcaModalTenant.name_ar}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    الرقم الضريبي: {zatcaModalTenant.vat_number || '300000000000003'} | الكود: {zatcaModalTenant.code}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">بيئة الربط (Environment)</label>
                  <select
                    className="form-input"
                    value={zatcaEnv}
                    onChange={e => setZatcaEnv(e.target.value)}
                  >
                    <option value="sandbox">🧪 البيئة التجريبية لهيئة الزكاة (Sandbox Fatoora)</option>
                    <option value="production">🚀 البيئة الإنتاجية الحية (Production ZATCA)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">رمز التحقق OTP المستخرج من بوابة فاتورة *</label>
                  <input
                    required
                    type="text"
                    maxLength="6"
                    placeholder="مثال: 123456"
                    className="form-input font-mono"
                    style={{ fontSize: '1.25rem', letterSpacing: '4px', textAlign: 'center' }}
                    value={zatcaOtp}
                    onChange={e => setZatcaOtp(e.target.value)}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem', display: 'block' }}>
                    يتم توليد الرمز عبر الدخول لبوابة (فاتورة) التابعة لهيئة الزكاة واختيار (إضافة جهاز جديد).
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setZatcaModalTenant(null)} className="btn btn-secondary">إلغاء</button>
                <button type="submit" disabled={onboardingZatca} className="btn btn-primary" style={{ background: '#047857' }}>
                  {onboardingZatca ? 'جاري التحقق والربط...' : 'إتمام الربط وإصدار الختم التشفيري (CSID) ✔️'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
