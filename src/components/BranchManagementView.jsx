import React, { useState, useEffect } from 'react';
import { safeFetch } from '../api/client';

export default function BranchManagementView({ currentTenant }) {
  const [stats, setStats] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('consolidated'); // 'consolidated' or branchId
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // نموذج إضافة فرع جديد
  const [formData, setFormData] = useState({
    code: '',
    name_ar: '',
    name_en: '',
    city: 'الرياض',
    address: '',
    phone: '',
    email: '',
    cr_number: '',
    vat_number: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await safeFetch('/api/branches/stats');
      if (res && res.success && res.data) {
        setStats(res.data.consolidated);
        setBranches(res.data.branches || []);
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
        alert('✅ تم إنشاء الفرع الجديد والمستودع التابع له بنجاح');
        setShowAddModal(false);
        setFormData({
          code: '',
          name_ar: '',
          name_en: '',
          city: 'الرياض',
          address: '',
          phone: '',
          email: '',
          cr_number: '',
          vat_number: ''
        });
        fetchData();
      } else {
        alert('حدث خطأ أثناء إنشاء الفرع: ' + (res?.error || 'يرجى المحاولة مجدداً'));
      }
    } catch (err) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBranchData = viewMode === 'consolidated'
    ? null
    : branches.find(b => String(b.id) === String(viewMode));

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-emerald-900 to-teal-900 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏢</span>
            <h1 className="text-2xl font-bold">إدارة الفروع والمخازن المتعددة</h1>
          </div>
          <p className="text-emerald-200 text-sm mt-1">
            ربط الحسابات والمستودعات والكواشير عبر فروع المشاتل مع إمكانية عرض تقارير مجمعة أو منفصلة
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg"
          >
            <span>➕</span>
            <span>إضافة فرع جديد</span>
          </button>
          <button
            onClick={fetchData}
            className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2.5 rounded-xl text-sm transition"
            title="تحديث البيانات"
          >
            🔄
          </button>
        </div>
      </div>

      {/* شريط اختيار نمط العرض (مجمع vs فرع محدد) */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-sm font-semibold">🔍 وضع التقرير المالي:</span>
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('consolidated')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${
                viewMode === 'consolidated'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'
              }`}
            >
              📊 تقرير مجمع لكافة الفروع (Consolidated)
            </button>
            {branches.map(b => (
              <button
                key={b.id}
                onClick={() => setViewMode(String(b.id))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  String(viewMode) === String(b.id)
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'
                }`}
              >
                📍 {b.name_ar}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {viewMode === 'consolidated' ? 'يعرض إجمالي الأرقام المالية والمخزنية للمنظومة' : `يعرض أداء فرع: ${selectedBranchData?.name_ar}`}
        </div>
      </div>

      {/* بطاقات المؤشرات السريعة */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-sm mb-2">
            <span>عدد الفروع المفعلة</span>
            <span className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">🏢</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {viewMode === 'consolidated' ? (stats?.total_branches || branches.length) : '1 فرع'}
          </div>
          <div className="text-xs text-emerald-600 mt-1">مربوطة بقاعدة بيانات سحابية موحدة</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-sm mb-2">
            <span>المبيعات المحققة</span>
            <span className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg">💰</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {viewMode === 'consolidated'
              ? (Number(stats?.total_sales || 0).toLocaleString('ar-SA') + ' ر.س')
              : (Number(selectedBranchData?.sales_total || 0).toLocaleString('ar-SA') + ' ر.س')}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            {viewMode === 'consolidated' ? `${stats?.total_orders || 0} فاتورة مبيعات` : `${selectedBranchData?.sales_count || 0} فاتورة`}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-sm mb-2">
            <span>المخزون السلعي للشتلات</span>
            <span className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">🌿</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {viewMode === 'consolidated'
              ? (Number(stats?.total_stock_qty || 0).toLocaleString('ar-SA') + ' شتلة')
              : (Number(selectedBranchData?.inventory_qty || 0).toLocaleString('ar-SA') + ' شتلة')}
          </div>
          <div className="text-xs text-amber-600 mt-1">
            {viewMode === 'consolidated' ? 'موزعة عبر كافة المستودعات' : `مستودع: ${selectedBranchData?.warehouse_name}`}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-sm mb-2">
            <span>فريق العمل والكاشير</span>
            <span className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg">👥</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {viewMode === 'consolidated'
              ? (branches.reduce((acc, b) => acc + (b.staff_count || 0), 0) + ' موظفين')
              : ((selectedBranchData?.staff_count || 0) + ' كاشير وفني')}
          </div>
          <div className="text-xs text-purple-600 mt-1">صلاحيات محددة لكل فرع</div>
        </div>
      </div>

      {/* جدول الفروع وتفاصيلها ومخازنها */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span>📋</span>
            <span>سجل الفروع والمستودعات التابعة</span>
          </h3>
          <span className="text-xs px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full font-bold">
            {branches.length} فروع مفعلة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs font-semibold">
              <tr>
                <th className="p-4">كود الفرع</th>
                <th className="p-4">اسم الفرع</th>
                <th className="p-4">المدينة / العنوان</th>
                <th className="p-4">المستودع التابع</th>
                <th className="p-4">المبيعات</th>
                <th className="p-4">رصيد المخزون</th>
                <th className="p-4">فريق الكاشير</th>
                <th className="p-4">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">جاري تحميل بيانات الفروع...</td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">لا توجد فروع مسجلة حتى الآن.</td>
                </tr>
              ) : (
                branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition">
                    <td className="p-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {b.code}
                    </td>
                    <td className="p-4 font-bold">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span>{b.name_ar}</span>
                      </div>
                      {b.name_en && <div className="text-xs text-slate-400">{b.name_en}</div>}
                    </td>
                    <td className="p-4">
                      <div>{b.city || 'الرياض'}</div>
                      <div className="text-xs text-slate-400">{b.phone || '0555000000'}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium">
                        🏬 {b.warehouse_name || `مستودع ${b.name_ar}`}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-blue-600 dark:text-blue-400">
                      {Number(b.sales_total || 0).toLocaleString('ar-SA')} ر.س
                      <div className="text-xs font-normal text-slate-400">({b.sales_count || 0} فاتورة)</div>
                    </td>
                    <td className="p-4 font-bold text-amber-600 dark:text-amber-400">
                      {Number(b.inventory_qty || 0).toLocaleString('ar-SA')} شتلة
                      <div className="text-xs font-normal text-slate-400">({b.inventory_items || 0} صنف)</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded text-xs">
                        {b.staff_count || 1} موظفين
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        نشط ومتصل
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* نافذة إضافة فرع جديد */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700 mb-5">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>➕</span>
                <span>تسجيل فرع ومستودع جديد للمشتل</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddBranch} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    كود الفرع (Code) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: BR-NORTH"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    المدينة *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="الرياض / القصيم / جدة"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  اسم الفرع (بالعربية) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: فرع مشتل طريق الملك فهد"
                  value={formData.name_ar}
                  onChange={e => setFormData({ ...formData, name_ar: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  اسم الفرع (بالإنجليزية)
                </label>
                <input
                  type="text"
                  placeholder="e.g. King Fahd Road Nursery Branch"
                  value={formData.name_en}
                  onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    رقم الهاتف / الجوال
                  </label>
                  <input
                    type="text"
                    placeholder="055XXXXXXX"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    placeholder="branch@al-suwayan.sa"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  العنوان التفصيلي
                </label>
                <input
                  type="text"
                  placeholder="طريق الملك فهد، مقابل سوق النباتات المركزي"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                💡 سيقوم النظام تلقائياً بإنشاء مستودع رئيسي مستقل لهذا الفرع، وربط شجرة الحسابات وصندوق الكاشير به فوراً.
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-xl text-sm hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg transition"
                >
                  {submitting ? 'جاري الإنشاء...' : 'حفظ الفرع وتفعيل المستودع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
