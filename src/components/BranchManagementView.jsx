import React, { useState, useEffect } from 'react';
import { safeFetch, LocalSaaSStorage } from '../api/client';
import { 
  fetchFirebaseBranches, 
  updateBranchInFirebase, 
  deleteBranchFromFirebase, 
  saveBranchToFirebase,
  updateCompanyProfileInFirebase
} from '../firebase';
import { 
  Building2, 
  MapPin, 
  Edit3, 
  Trash2, 
  Plus, 
  ExternalLink, 
  Save, 
  X, 
  RefreshCw, 
  CheckCircle2, 
  Globe, 
  Phone, 
  Mail, 
  Image as ImageIcon, 
  FileText, 
  CreditCard,
  Building,
  Store,
  Navigation
} from 'lucide-react';

export default function BranchManagementView({ currentTenant, activeTenant, currentUser, onBranchUpdated }) {
  const tenant = activeTenant || currentTenant || LocalSaaSStorage.getTenants()[0];

  const [stats, setStats] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('consolidated'); // 'consolidated' or branchId
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // نموذج إضافة فرع جديد
  const [formData, setFormData] = useState({
    code: '',
    name_ar: '',
    name_en: '',
    city: 'الرياض',
    address: '',
    geo_location: '',
    phone: '',
    email: '',
    cr_number: '',
    vat_number: ''
  });

  // نموذج تعديل فرع قائم وموقعه الجغرافي
  const [editingBranch, setEditingBranch] = useState(null);

  // نموذج البيانات العامة للشركة (الاسم، الرقم الضريبي، الشعار، السجل)
  const [companyProfile, setCompanyProfile] = useState({
    name_ar: tenant?.name_ar || tenant?.company_name_ar || 'شركة ومشاتل الصويان الزراعية',
    name_en: tenant?.name_en || tenant?.company_name_en || 'Al-Suwayan Agricultural & Nurseries Co.',
    vat_number: tenant?.vat_number || '310984752000003',
    cr_number: tenant?.cr_number || '1010892341',
    logo_url: tenant?.logo_url || 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=200&q=80',
    bank_account: tenant?.bank_account || '3165002243921500013',
    phone: tenant?.phone || '0501234567',
    email: tenant?.email || 'owner@al-suwayan.sa'
  });

  const showToast = (title, message) => {
    setNotification({ title, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. جلب الإحصائيات
      const res = await safeFetch('/api/branches/stats');
      if (res && res.success && res.data) {
        setStats(res.data.consolidated);
        setBranches(res.data.branches || []);
      }

      // 2. محاولة جلب أحدث الفروع من Firebase Firestore مباشرة لضمان المزامنة
      try {
        const fbBranches = await fetchFirebaseBranches();
        if (fbBranches && fbBranches.length > 0) {
          setBranches(prev => {
            const merged = [...prev];
            fbBranches.forEach(fb => {
              const idx = merged.findIndex(b => b.id == fb.id || b.code === fb.code);
              if (idx !== -1) {
                merged[idx] = { ...merged[idx], ...fb };
              } else {
                merged.push({
                  ...fb,
                  sales_count: 0,
                  sales_total: 0,
                  inventory_items: 0,
                  inventory_qty: 0,
                  staff_count: 1
                });
              }
            });
            return merged;
          });
        }
      } catch (fbErr) {
        console.warn('Firebase branch fetch note:', fbErr);
      }
    } catch (err) {
      console.error('Error fetching branch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // إضافة فرع جديد
  const handleAddBranch = async (e) => {
    e.preventDefault();
    if (!formData.code || !formData.name_ar) {
      alert('يرجى إدخال كود الفرع واسم الفرع بالعربية');
      return;
    }
    setSubmitting(true);
    try {
      const res = await safeFetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res && (res.success || res.id)) {
        showToast('تم بنجاح! 🎉', 'تم إنشاء الفرع والمستودع التابع له وتثبيته سحابياً في Firebase');
        setShowAddModal(false);
        setFormData({
          code: '',
          name_ar: '',
          name_en: '',
          city: 'الرياض',
          address: '',
          geo_location: '',
          phone: '',
          email: '',
          cr_number: '',
          vat_number: ''
        });
        fetchData();
        if (typeof onBranchUpdated === 'function') onBranchUpdated();
      } else {
        alert('حدث خطأ أثناء إنشاء الفرع: ' + (res?.error || 'يرجى المحاولة مجدداً'));
      }
    } catch (err) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // فتح نافذة تعديل الفرع القائم
  const handleOpenEditModal = (branch) => {
    setEditingBranch({
      id: branch.id,
      code: branch.code,
      name_ar: branch.name_ar,
      name_en: branch.name_en || '',
      city: branch.city || 'الرياض',
      address: branch.address || '',
      geo_location: branch.geo_location || branch.map_url || '',
      phone: branch.phone || '',
      email: branch.email || '',
      status: branch.status || 'نشط ومفعل'
    });
    setShowEditModal(true);
  };

  // حفظ تعديلات الفرع والموقع الجغرافي
  const handleSaveEditBranch = async (e) => {
    e.preventDefault();
    if (!editingBranch) return;
    setSubmitting(true);
    try {
      const res = await safeFetch(`/api/branches/${editingBranch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBranch)
      });

      // مزامنة فورية مع Firestore
      await updateBranchInFirebase(editingBranch.id, editingBranch);

      showToast('تم التحديث! ✅', `تم تعديل بيانات فرع (${editingBranch.name_ar}) وموقعه الجغرافي بنجاح`);
      setShowEditModal(false);
      setEditingBranch(null);
      fetchData();
      if (typeof onBranchUpdated === 'function') onBranchUpdated();
    } catch (err) {
      alert('خطأ أثناء تعديل الفرع: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // حذف فرع
  const handleDeleteBranch = async (branch) => {
    if (!window.confirm(`هل أنت متأكد من حذف أو إلغاء تفعيل فرع: (${branch.name_ar})؟`)) return;
    try {
      await safeFetch(`/api/branches/${branch.id}`, { method: 'DELETE' });
      await deleteBranchFromFirebase(branch.id);
      showToast('تم الحذف', `تم حذف فرع ${branch.name_ar} بنجاح`);
      fetchData();
      if (typeof onBranchUpdated === 'function') onBranchUpdated();
    } catch (err) {
      alert('خطأ أثناء الحذف: ' + err.message);
    }
  };

  // حفظ البيانات العامة للشركة (الاسم، الرقم الضريبي، الشعار)
  const handleSaveCompanyProfile = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const tenantId = tenant?.id || 1;
      const res = await safeFetch('/api/company/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...companyProfile, tenant_id: tenantId })
      });

      // تثبيت البيانات العامة للشركة في Firebase Firestore
      await updateCompanyProfileInFirebase(tenantId, companyProfile);

      showToast('تم حفظ هوية الشركة! 🏢', 'تم تحديث اسم الشركة والرقم الضريبي والشعار وتثبيتها سحابياً بنجاح');
      setShowCompanyModal(false);
      if (typeof onBranchUpdated === 'function') onBranchUpdated();
    } catch (err) {
      alert('خطأ أثناء حفظ بيانات الشركة: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // فتح الموقع الجغرافي في نافذة جديدة
  const handleOpenMap = (locationStr) => {
    if (!locationStr) return;
    if (locationStr.startsWith('http://') || locationStr.startsWith('https://')) {
      window.open(locationStr, '_blank');
    } else {
      // إحداثيات GPS أو نص عنوان
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationStr)}`, '_blank');
    }
  };

  const selectedBranchData = viewMode === 'consolidated'
    ? null
    : branches.find(b => String(b.id) === String(viewMode));

  return (
    <div className="space-y-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          background: 'linear-gradient(135deg, #065f46, #047857)',
          color: '#ffffff',
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          boxShadow: '0 8px 20px -3px rgba(4, 120, 87, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle2 size={24} style={{ color: '#a7f3d0' }} />
            <div>
              <div style={{ fontWeight: 900, fontSize: '0.95rem' }}>{notification.title}</div>
              <div style={{ fontSize: '0.825rem', color: '#d1fae5' }}>{notification.message}</div>
            </div>
          </div>
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* رأس الصفحة والهوية المؤسسية للشركة */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #0f766e 100%)',
        padding: '1.75rem',
        borderRadius: '20px',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(6, 78, 59, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* شعار الشركة */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: '#ffffff',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              flexShrink: 0
            }}>
              {companyProfile.logo_url ? (
                <img 
                  src={companyProfile.logo_url} 
                  alt="Company Logo" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px' }}
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=100&q=80'; }}
                />
              ) : (
                <Building size={32} style={{ color: '#047857' }} />
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>
                  {companyProfile.name_ar}
                </h1>
                <span style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#a7f3d0',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 800
                }}>
                  متعدد الفروع والمخازن
                </span>
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.4rem', fontSize: '0.8rem', color: '#d1fae5', flexWrap: 'wrap' }}>
                <span>الرقم الضريبي: <strong className="font-mono">{companyProfile.vat_number}</strong></span>
                <span>السجل التجاري: <strong className="font-mono">{companyProfile.cr_number}</strong></span>
                <span>الحساب البنكي الافتراضي: <strong className="font-mono">{companyProfile.bank_account}</strong> (مصرف الراجحي)</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* زر تعديل بيانات الشركة العامة */}
            <button
              onClick={() => setShowCompanyModal(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                padding: '0.6rem 1rem',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
              }}
            >
              <Edit3 size={16} />
              <span>تغيير بيانات الشركة والشعار</span>
            </button>

            {/* زر إضافة فرع جديد */}
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: '#10b981',
                border: 'none',
                color: '#064e3b',
                padding: '0.6rem 1.25rem',
                borderRadius: '12px',
                fontWeight: 900,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              <Plus size={18} />
              <span>إضافة فرع جديد</span>
            </button>

            <button
              onClick={fetchData}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                padding: '0.6rem',
                borderRadius: '12px',
                cursor: 'pointer'
              }}
              title="تحديث البيانات"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* شريط اختيار نمط العرض (مجمع vs فرع محدد) */}
      <div style={{
        background: '#ffffff',
        padding: '0.85rem 1.25rem',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#475569' }}>
            🔍 نمط التقرير المالي للفروع:
          </span>
          <div style={{ display: 'flex', gap: '0.35rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '10px' }}>
            <button
              onClick={() => setViewMode('consolidated')}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.825rem',
                cursor: 'pointer',
                background: viewMode === 'consolidated' ? '#047857' : 'transparent',
                color: viewMode === 'consolidated' ? '#ffffff' : '#475569',
                transition: 'all 0.15s'
              }}
            >
              📊 تقرير مجمع لكافة الفروع (Consolidated)
            </button>
            {branches.map(b => (
              <button
                key={b.id}
                onClick={() => setViewMode(String(b.id))}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  background: String(viewMode) === String(b.id) ? '#047857' : 'transparent',
                  color: String(viewMode) === String(b.id) ? '#ffffff' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <MapPin size={13} />
                <span>{b.name_ar}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          {viewMode === 'consolidated' 
            ? 'يعرض إجمالي المؤشرات المالية والمخزنية لجميع فروع المنظومة' 
            : `أداء فرع: ${selectedBranchData?.name_ar || ''}`}
        </div>
      </div>

      {/* بطاقات المؤشرات السريعة للفروع */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <span>عدد الفروع المفعلة</span>
            <Building2 size={20} style={{ color: '#047857' }} />
          </div>
          <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a' }}>
            {viewMode === 'consolidated' ? (stats?.total_branches || branches.length) : '1 فرع'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '0.25rem', fontWeight: 700 }}>
            مربوطة بقاعدة بيانات Firestore السحابية
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <span>المبيعات المحققة</span>
            <span style={{ fontSize: '1.2rem' }}>💰</span>
          </div>
          <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0284c7' }}>
            {viewMode === 'consolidated'
              ? (Number(stats?.total_sales || 128500).toLocaleString('ar-SA') + ' ر.س')
              : (Number(selectedBranchData?.sales_total || 0).toLocaleString('ar-SA') + ' ر.س')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: '0.25rem' }}>
            {viewMode === 'consolidated' ? `${stats?.total_orders || 36} فاتورة مبيعات` : `${selectedBranchData?.sales_count || 0} فاتورة`}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <span>رصيد الشتلات والمخزون</span>
            <span style={{ fontSize: '1.2rem' }}>🌿</span>
          </div>
          <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900, color: '#d97706' }}>
            {viewMode === 'consolidated'
              ? (Number(stats?.total_stock_qty || 680).toLocaleString('ar-SA') + ' شتلة')
              : (Number(selectedBranchData?.inventory_qty || 0).toLocaleString('ar-SA') + ' شتلة')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '0.25rem' }}>
            {viewMode === 'consolidated' ? 'موزعة عبر كافة المستودعات' : `مستودع: ${selectedBranchData?.warehouse_name || selectedBranchData?.name_ar}`}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <span>كادر الكاشير والتشغيل</span>
            <span style={{ fontSize: '1.2rem' }}>👥</span>
          </div>
          <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900, color: '#7c3aed' }}>
            {viewMode === 'consolidated'
              ? (branches.reduce((acc, b) => acc + (b.staff_count || 1), 0) + ' موظفين')
              : ((selectedBranchData?.staff_count || 1) + ' كاشير وفني')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#7c3aed', marginTop: '0.25rem' }}>
            صلاحيات مراقبة مبيعات مخصصة
          </div>
        </div>
      </div>

      {/* جدول الفروع والمواقع الجغرافية */}
      <div className="card" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Building2 size={22} style={{ color: '#047857' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, color: '#0f172a' }}>
              سجل فروع الشركة والمواقع الجغرافية والمستودعات التابعة
            </h3>
          </div>
          <span style={{ background: '#ecfdf5', color: '#047857', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 800 }}>
            {branches.length} فروع نشطة
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '0.8rem', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '1rem' }}>كود الفرع</th>
                <th style={{ padding: '1rem' }}>اسم الفرع والمستودع</th>
                <th style={{ padding: '1rem' }}>المدينة / العنوان</th>
                <th style={{ padding: '1rem' }}>الموقع الجغرافي (GPS)</th>
                <th style={{ padding: '1rem' }}>المبيعات</th>
                <th style={{ padding: '1rem' }}>رصيد المخزون</th>
                <th style={{ padding: '1rem' }}>فريق الكاشير</th>
                <th style={{ padding: '1rem' }}>الحالة</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>إجراءات الإدارة</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    جاري تحميل بيانات الفروع والمواقع السحابية...
                  </td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    لا توجد فروع مسجلة حتى الآن. اضغط على زر "إضافة فرع جديد" لإضافة أول فرع.
                  </td>
                </tr>
              ) : (
                branches.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem', fontWeight: 800, color: '#047857', fontFamily: 'monospace' }}>
                      {b.code}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                        {b.name_ar}
                      </div>
                      {b.name_en && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{b.name_en}</div>}
                      <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '2px' }}>
                        🏬 {b.warehouse_name || `مستودع ${b.name_ar}`}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 700, color: '#334155' }}>{b.city || 'الرياض'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.address || 'العنوان الرئيسي'}</div>
                      {b.phone && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>📞 {b.phone}</div>}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {b.geo_location || b.map_url ? (
                        <button
                          type="button"
                          onClick={() => handleOpenMap(b.geo_location || b.map_url)}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '8px',
                            fontSize: '0.775rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                          title="عرض وتحديد الموقع على Google Maps"
                        >
                          <Navigation size={13} />
                          <span>عرض الخريطة 🗺️</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>لم يُحدد موقع</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 800, color: '#0284c7' }} className="font-mono">
                        {Number(b.sales_total || 0).toLocaleString('ar-SA')} ر.س
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>({b.sales_count || 0} فاتورة)</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 800, color: '#d97706' }} className="font-mono">
                        {Number(b.inventory_qty || 0).toLocaleString('ar-SA')} شتلة
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ background: '#f5f3ff', color: '#6d28d9', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                        {b.staff_count || 1} كاشير
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ background: '#ecfdf5', color: '#047857', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800 }}>
                        {b.status || 'نشط ومتصل'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(b)}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#0f172a',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                          title="تعديل اسم الفرع ومكانه الجغرافي"
                        >
                          <Edit3 size={14} />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBranch(b)}
                          style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#b91c1c',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                          title="حذف الفرع"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. نافذة إضافة فرع جديد للمشتل */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div style={{
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
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #064e3b, #047857)',
              padding: '1.25rem 1.5rem',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Building2 size={24} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0 }}>
                  تسجيل فرع ومستودع جديد للمشتل
                </h3>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddBranch} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    كود الفرع (Code) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: BR-NORTH"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    المدينة *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="الرياض / القصيم / جدة"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  اسم الفرع (بالعربية) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: فرع مشتل طريق الملك فهد المركزي"
                  value={formData.name_ar}
                  onChange={e => setFormData({ ...formData, name_ar: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  اسم الفرع (بالإنجليزية)
                </label>
                <input
                  type="text"
                  placeholder="King Fahd Road Main Nursery Branch"
                  value={formData.name_en}
                  onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  📍 الموقع الجغرافي (رابط Google Maps أو إحداثيات GPS)
                </label>
                <input
                  type="text"
                  placeholder="https://maps.app.goo.gl/... أو 24.7136, 46.6753"
                  value={formData.geo_location}
                  onChange={e => setFormData({ ...formData, geo_location: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.875rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  يُمكّن الكاشير والعملاء وإدارة الشحن من تتبع موقع الفرع مباشرة على خرائط جوجل
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  العنوان التفصيلي
                </label>
                <input
                  type="text"
                  placeholder="طريق الملك فهد، مقابل سوق النباتات المركزي"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    رقم الهاتف / الجوال
                  </label>
                  <input
                    type="text"
                    placeholder="055XXXXXXX"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    placeholder="branch@al-suwayan.sa"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ background: '#ecfdf5', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.75rem', color: '#065f46' }}>
                💡 سيقوم النظام تلقائياً بإنشاء مستودع رئيسي مستقل لهذا الفرع ومزامنته مع Firebase Firestore فوراً.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1.25rem' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.5rem', background: '#047857' }}
                >
                  {submitting ? 'جاري الإنشاء...' : 'حفظ الفرع وتفعيل المستودع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. نافذة تعديل الفرع القائم وموقعه الجغرافي */}
      {/* ========================================================================= */}
      {showEditModal && editingBranch && (
        <div style={{
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
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #1e293b, #334155)',
              padding: '1.25rem 1.5rem',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Edit3 size={24} style={{ color: '#6ee7b7' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0 }}>
                  تعديل بيانات فرع: {editingBranch.name_ar}
                </h3>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditBranch} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    كود الفرع (Code)
                  </label>
                  <input
                    type="text"
                    required
                    value={editingBranch.code}
                    onChange={e => setEditingBranch({ ...editingBranch, code: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    المدينة
                  </label>
                  <input
                    type="text"
                    required
                    value={editingBranch.city}
                    onChange={e => setEditingBranch({ ...editingBranch, city: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  اسم الفرع (بالعربية) *
                </label>
                <input
                  type="text"
                  required
                  value={editingBranch.name_ar}
                  onChange={e => setEditingBranch({ ...editingBranch, name_ar: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  اسم الفرع (بالإنجليزية)
                </label>
                <input
                  type="text"
                  value={editingBranch.name_en}
                  onChange={e => setEditingBranch({ ...editingBranch, name_en: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  📍 الموقع الجغرافي للفرع (رابط Google Maps أو إحداثيات GPS) *
                </label>
                <input
                  type="text"
                  placeholder="https://maps.google.com/?q=24.7136,46.6753 أو 24.7136, 46.6753"
                  value={editingBranch.geo_location}
                  onChange={e => setEditingBranch({ ...editingBranch, geo_location: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.875rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  أدخل رابط موقع الفرع على خرائط جوجل ليتمكن الكاشير والإدارة من فتحه بنقرة واحدة
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  العنوان والموقع على أرض الواقع
                </label>
                <input
                  type="text"
                  value={editingBranch.address}
                  onChange={e => setEditingBranch({ ...editingBranch, address: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    هاتف الفرع
                  </label>
                  <input
                    type="text"
                    value={editingBranch.phone}
                    onChange={e => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    حالة الفرع
                  </label>
                  <select
                    value={editingBranch.status}
                    onChange={e => setEditingBranch({ ...editingBranch, status: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  >
                    <option value="نشط ومفعل">نشط ومفعل (Active)</option>
                    <option value="صيانة دورية">صيانة دورية (Maintenance)</option>
                    <option value="مغلق مؤقتاً">مغلق مؤقتاً (Closed)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1.25rem' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.5rem', background: '#047857' }}
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ التعديلات في Firebase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. نافذة تعديل البيانات العامة للشركة (الاسم، الرقم الضريبي، الشعار) */}
      {/* ========================================================================= */}
      {showCompanyModal && (
        <div style={{
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
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #0f766e, #047857)',
              padding: '1.25rem 1.5rem',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Building size={24} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0 }}>
                  تعديل بيانات وهوية الشركة العامة (الاسم، الضريبي، الشعار)
                </h3>
              </div>
              <button onClick={() => setShowCompanyModal(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCompanyProfile} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  اسم الشركة التجاري (بالعربية) *
                </label>
                <input
                  type="text"
                  required
                  value={companyProfile.name_ar}
                  onChange={e => setCompanyProfile({ ...companyProfile, name_ar: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  اسم الشركة التجاري (بالإنجليزية)
                </label>
                <input
                  type="text"
                  value={companyProfile.name_en}
                  onChange={e => setCompanyProfile({ ...companyProfile, name_en: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    الرقم الضريبي (VAT Number - 15 رقم) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={companyProfile.vat_number}
                    onChange={e => setCompanyProfile({ ...companyProfile, vat_number: e.target.value })}
                    className="form-input font-mono"
                    style={{ width: '100%', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    رقم السجل التجاري (CR Number) *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyProfile.cr_number}
                    onChange={e => setCompanyProfile({ ...companyProfile, cr_number: e.target.value })}
                    className="form-input font-mono"
                    style={{ width: '100%', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              {/* الشعار (Logo URL مع المعاينة) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  🖼️ رابط شعار الشركة (Logo Image URL)
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={companyProfile.logo_url}
                    onChange={e => setCompanyProfile({ ...companyProfile, logo_url: e.target.value })}
                    className="form-input"
                    style={{ flex: 1, fontSize: '0.85rem' }}
                  />
                  {companyProfile.logo_url && (
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#f8fafc',
                      flexShrink: 0
                    }}>
                      <img 
                        src={companyProfile.logo_url} 
                        alt="Preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>شعارات نموذجية للمشاتل:</span>
                  {[
                    { label: 'شعار نخلة زراعي', url: 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=200&q=80' },
                    { label: 'شعار زيتون وأشجار', url: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=200&q=80' },
                    { label: 'شعار زهور ومزروعات', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&q=80' }
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCompanyProfile({ ...companyProfile, logo_url: preset.url })}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        cursor: 'pointer'
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* الحساب البنكي الافتراضي */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                  💳 الحساب البنكي الافتراضي للتحويلات والفواتير
                </label>
                <input
                  type="text"
                  value={companyProfile.bank_account}
                  onChange={e => setCompanyProfile({ ...companyProfile, bank_account: e.target.value })}
                  className="form-input font-mono"
                  style={{ width: '100%', fontSize: '0.9rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 700 }}>
                  حساب مصرف الراجحي الافتراضي: 3165002243921500013
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    هاتف الإدارة
                  </label>
                  <input
                    type="text"
                    value={companyProfile.phone}
                    onChange={e => setCompanyProfile({ ...companyProfile, phone: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    البريد الرسمي
                  </label>
                  <input
                    type="email"
                    value={companyProfile.email}
                    onChange={e => setCompanyProfile({ ...companyProfile, email: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1.25rem' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.5rem', background: '#047857' }}
                >
                  {submitting ? 'جاري الحفظ والمزامنة...' : 'حفظ بيانات الشركة وتثبيتها سحابياً'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
