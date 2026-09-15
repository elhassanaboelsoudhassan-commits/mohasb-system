import React, { useState, useEffect } from 'react';
import { safeFetch } from '../api/client';

export default function InventoryTransfersView() {
  const [transfers, setTransfers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPrintTransfer, setSelectedPrintTransfer] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // نموذج إضافة مناقلة جديدة
  const [formData, setFormData] = useState({
    source_branch_id: '',
    source_warehouse_id: '',
    dest_branch_id: '',
    dest_warehouse_id: '',
    product_id: '',
    quantity: 10,
    driver_name: 'سعد القحطاني',
    vehicle_plate: 'أ د ل 4092',
    notes: 'نقل دفعة شتلات زراعية لتغطية طلبات المعرض'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trfRes, brRes, prodRes] = await Promise.all([
        safeFetch(`/api/inventory/transfers${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`),
        safeFetch('/api/branches'),
        safeFetch('/api/products')
      ]);

      if (trfRes && trfRes.success) setTransfers(trfRes.data || []);
      if (brRes && brRes.success) setBranches(brRes.data || []);
      if (prodRes && prodRes.success) setProducts(prodRes.data || []);
    } catch (err) {
      console.error('Error loading transfer data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    if (!formData.source_warehouse_id || !formData.dest_warehouse_id || !formData.product_id || !formData.quantity) {
      alert('يرجى تحديد المستودع المصدر والمستودع المستقبل والصنف والكمية');
      return;
    }
    if (formData.source_warehouse_id === formData.dest_warehouse_id) {
      alert('لا يمكن إجراء مناقلة لنفس المستودع!');
      return;
    }

    setSubmitting(true);
    try {
      const res = await safeFetch('/api/inventory/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res && res.success) {
        alert(res.message || '✅ تم إصدار أمر التحويل وبدء نقل الشحنة بنجاح');
        setShowAddModal(false);
        fetchData();
      } else {
        alert('فشل إصدار التحويل: ' + (res?.error || 'خطأ غير متوقع'));
      }
    } catch (err) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    const confirmMsg = status === 'received'
      ? 'هل أنت متأكد من استلام الشحنة وتوريد الكميات إلى مستودع الفرع المستلم؟'
      : 'هل أنت متأكد من إلغاء الشحنة وإعادة الأصناف للمستودع المصدر؟';

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await safeFetch(`/api/inventory/transfers/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res && res.success) {
        alert(res.message || 'تم تحديث حالة الشحنة بنجاح');
        fetchData();
      } else {
        alert('حدث خطأ: ' + (res?.error || 'يرجى المحاولة مجدداً'));
      }
    } catch (err) {
      alert('خطأ في الاتصال: ' + err.message);
    }
  };

  // جلب المستودعات المتاحة
  const allWarehouses = branches.flatMap(b => (b.warehouses || []).map(w => ({ ...w, branch_name: b.name_ar })));

  // الصنف المختار لمعرفة رصيده
  const selectedProd = products.find(p => String(p.id) === String(formData.product_id));

  const filteredTransfers = statusFilter === 'all'
    ? transfers
    : transfers.filter(t => t.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-emerald-900 to-teal-900 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚚</span>
            <h1 className="text-2xl font-bold">التحويل المخزني وتتبع شحنات الفروع</h1>
          </div>
          <p className="text-emerald-200 text-sm mt-1">
            مناقلة الشتلات والمزروعات بين مستودعات الفروع وتتبع حركة الشاحنات (قيد النقل 🚚 / تم الاستلام ✅)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg"
          >
            <span>➕</span>
            <span>إصدار مناقلة شتلات جديدة</span>
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

      {/* المؤشرات السريعة */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 text-sm mb-1">إجمالي المناقلات</div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">{transfers.length}</div>
          <div className="text-xs text-slate-400 mt-1">بين كافة المستودعات</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 text-sm mb-1">شحنات قيد النقل بالطريق</div>
          <div className="text-2xl font-bold text-amber-600">
            {transfers.filter(t => t.status === 'in_transit').length} شحنة 🚚
          </div>
          <div className="text-xs text-amber-500 mt-1">بانتظار تأكيد استلام الفرع</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 text-sm mb-1">شحنات تم استلامها بنجاح</div>
          <div className="text-2xl font-bold text-emerald-600">
            {transfers.filter(t => t.status === 'received').length} شحنة ✅
          </div>
          <div className="text-xs text-emerald-500 mt-1">تم إيداعها بالمخزون المستلم</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 text-sm mb-1">إجمالي الشتلات المنقولة</div>
          <div className="text-2xl font-bold text-blue-600">
            {transfers.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0)} شتلة
          </div>
          <div className="text-xs text-blue-500 mt-1">أشجار ونخيل ومزروعات</div>
        </div>
      </div>

      {/* فلاتر الحالة */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
        <span className="text-xs font-bold text-slate-500 px-2">تصفية حسب الحالة:</span>
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            statusFilter === 'all'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          الكل ({transfers.length})
        </button>
        <button
          onClick={() => setStatusFilter('in_transit')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            statusFilter === 'in_transit'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          🚚 قيد النقل بالطريق ({transfers.filter(t => t.status === 'in_transit').length})
        </button>
        <button
          onClick={() => setStatusFilter('received')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            statusFilter === 'received'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          ✅ تم الاستلام والتوريد ({transfers.filter(t => t.status === 'received').length})
        </button>
        <button
          onClick={() => setStatusFilter('cancelled')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            statusFilter === 'cancelled'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          ⚠️ ملغاة ({transfers.filter(t => t.status === 'cancelled').length})
        </button>
      </div>

      {/* جدول المناقلات المخزنية */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs font-semibold">
              <tr>
                <th className="p-4">رقم الشحنة</th>
                <th className="p-4">من مستودع (المصدر)</th>
                <th className="p-4">إلى مستودع (الوجهة)</th>
                <th className="p-4">الصنف المنقول</th>
                <th className="p-4">الكمية</th>
                <th className="p-4">السائق والمركبة</th>
                <th className="p-4">الحالة والتتبع</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">جاري تحميل سجل التحويلات...</td>
                </tr>
              ) : filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">لا توجد مناقلات مخزنية تطابق الفلتر.</td>
                </tr>
              ) : (
                filteredTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition">
                    <td className="p-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {t.transfer_number}
                      <div className="text-[10px] text-slate-400 font-normal">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString('ar-SA') : ''}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800 dark:text-white">
                        {t.source_warehouse_name || 'المستودع الرئيسي'}
                      </div>
                      <div className="text-xs text-slate-400">{t.source_branch_name || 'الفرع الرئيسي'}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800 dark:text-white">
                        {t.dest_warehouse_name || 'مستودع الفرع'}
                      </div>
                      <div className="text-xs text-slate-400">{t.dest_branch_name || 'فرع الاستلام'}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-emerald-800 dark:text-emerald-300">
                        {t.product_name}
                      </div>
                      {t.product_sku && <div className="text-xs text-slate-400 font-mono">{t.product_sku}</div>}
                    </td>
                    <td className="p-4 font-bold text-base text-slate-900 dark:text-white">
                      {t.quantity} <span className="text-xs font-normal text-slate-500">{t.unit || 'شتلة'}</span>
                    </td>
                    <td className="p-4 text-xs">
                      <div className="font-medium text-slate-700 dark:text-slate-300">👤 {t.driver_name || 'سائق النقل'}</div>
                      <div className="text-slate-400 font-mono">🚛 {t.vehicle_plate || 'لوحة النقل'}</div>
                    </td>
                    <td className="p-4">
                      {t.status === 'in_transit' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 animate-pulse">
                          <span>🚚</span>
                          <span>قيد النقل بالطريق</span>
                        </span>
                      )}
                      {t.status === 'received' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                          <span>✅</span>
                          <span>تم الاستلام والتوريد</span>
                        </span>
                      )}
                      {t.status === 'cancelled' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
                          <span>⚠️</span>
                          <span>ملغاة ومسترجعة</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {t.status === 'in_transit' && (
                          <button
                            onClick={() => handleUpdateStatus(t.id, 'received')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold shadow transition"
                            title="تأكيد وصول واستلام الشحنة في المستودع"
                          >
                            تأكيد الاستلام ✅
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedPrintTransfer(t)}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs px-2.5 py-1.5 rounded-lg transition"
                          title="طباعة إذن المناقلة"
                        >
                          🖨️ طباعة
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

      {/* نافذة إنشاء مناقلة جديدة */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700 mb-5">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>🚚</span>
                <span>إصدار أمر تحويل شتلات بين المستودعات</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    المستودع المصدر (من) *
                  </label>
                  <select
                    required
                    value={formData.source_warehouse_id}
                    onChange={e => {
                      const wId = e.target.value;
                      const wh = allWarehouses.find(x => String(x.id) === String(wId));
                      setFormData({
                        ...formData,
                        source_warehouse_id: wId,
                        source_branch_id: wh?.branch_id || ''
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  >
                    <option value="">-- اختر مستودع الشحن --</option>
                    {allWarehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name_ar} ({w.branch_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    المستودع الهدف (إلى) *
                  </label>
                  <select
                    required
                    value={formData.dest_warehouse_id}
                    onChange={e => {
                      const wId = e.target.value;
                      const wh = allWarehouses.find(x => String(x.id) === String(wId));
                      setFormData({
                        ...formData,
                        dest_warehouse_id: wId,
                        dest_branch_id: wh?.branch_id || ''
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  >
                    <option value="">-- اختر مستودع الاستلام --</option>
                    {allWarehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name_ar} ({w.branch_name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  الصنف الزراعي المنقول *
                </label>
                <select
                  required
                  value={formData.product_id}
                  onChange={e => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                >
                  <option value="">-- اختر الصنف من قائمة المشاتل --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name_ar} (المتاح بالمستودع: {p.stock || 0} {p.unit})
                    </option>
                  ))}
                </select>
                {selectedProd && (
                  <div className="text-xs text-emerald-600 mt-1">
                    الرصيد المتاح الإجمالي: {selectedProd.stock || 0} {selectedProd.unit}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    الكمية المطلوب تحويلها *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    اسم السائق المسؤول
                  </label>
                  <input
                    type="text"
                    value={formData.driver_name}
                    onChange={e => setFormData({ ...formData, driver_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    رقم لوحة المركبة / الشاحنة
                  </label>
                  <input
                    type="text"
                    value={formData.vehicle_plate}
                    onChange={e => setFormData({ ...formData, vehicle_plate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    ملاحظات وتعليمات النقل
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                ⚠️ سيتم خصم الكمية المحولة فوراً من المستودع المصدر، وستظل بحالة (قيد النقل 🚚) حتى يؤكد المستودع الهدف الاستلام الفعلي لترحل محاسبياً وتضاف لرصيده.
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
                  {submitting ? 'جاري الإصدار...' : 'إصدار أمر المناقلة والشحن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة طباعة إذن المناقلة الرسمي */}
      {selectedPrintTransfer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl text-slate-800 animate-in fade-in">
            <div className="border-b-2 border-emerald-800 pb-4 mb-6 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-emerald-900">منظومة الصويان السحابية للمشاتل والزراعة</h2>
                <div className="text-sm text-slate-500">إذن تسليم وتحويل مخزني داخلي (Inter-Branch Transfer Note)</div>
              </div>
              <div className="text-left font-mono">
                <div className="text-lg font-bold text-emerald-700">{selectedPrintTransfer.transfer_number}</div>
                <div className="text-xs text-slate-400">{new Date(selectedPrintTransfer.created_at || Date.now()).toLocaleDateString('ar-SA')}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl mb-6 text-sm">
              <div>
                <span className="text-slate-400 block text-xs">المستودع المحول منه (المصدر):</span>
                <span className="font-bold">{selectedPrintTransfer.source_warehouse_name || 'المستودع الرئيسي'}</span>
                <div className="text-xs text-slate-500">{selectedPrintTransfer.source_branch_name}</div>
              </div>
              <div>
                <span className="text-slate-400 block text-xs">المستودع المحول إليه (الوجهة):</span>
                <span className="font-bold">{selectedPrintTransfer.dest_warehouse_name || 'مستودع الفرع'}</span>
                <div className="text-xs text-slate-500">{selectedPrintTransfer.dest_branch_name}</div>
              </div>
            </div>

            <table className="w-full text-right border border-slate-200 rounded-xl overflow-hidden mb-6 text-sm">
              <thead className="bg-emerald-900 text-white text-xs">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">اسم الصنف الزراعي</th>
                  <th className="p-3">الوحدة</th>
                  <th className="p-3">الكمية المشحونة</th>
                  <th className="p-3">حالة الشحنة</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3 font-mono">1</td>
                  <td className="p-3 font-bold">{selectedPrintTransfer.product_name}</td>
                  <td className="p-3">{selectedPrintTransfer.unit || 'شتلة'}</td>
                  <td className="p-3 font-bold text-lg">{selectedPrintTransfer.quantity}</td>
                  <td className="p-3 text-xs">
                    {selectedPrintTransfer.status === 'received' ? '✅ تم الاستلام والتوريد' : '🚚 قيد النقل بالطريق'}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 mb-8 p-3 border rounded-xl">
              <div><strong>السائق المسؤول:</strong> {selectedPrintTransfer.driver_name || 'سعد القحطاني'}</div>
              <div><strong>رقم اللوحة:</strong> {selectedPrintTransfer.vehicle_plate || 'أ د ل 4092'}</div>
              <div className="col-span-2"><strong>ملاحظات الشحن:</strong> {selectedPrintTransfer.notes || 'لا توجد ملاحظات إضافية'}</div>
            </div>

            <div className="grid grid-cols-3 gap-6 text-center text-xs pt-4 border-t border-slate-200">
              <div>
                <div className="font-bold mb-8">أمين المستودع المصدر (المُسلّم)</div>
                <div className="border-b border-dashed border-slate-400 w-32 mx-auto"></div>
              </div>
              <div>
                <div className="font-bold mb-8">سائق النقل والتوصيل</div>
                <div className="border-b border-dashed border-slate-400 w-32 mx-auto"></div>
              </div>
              <div>
                <div className="font-bold mb-8">أمين المستودع المستلم</div>
                <div className="border-b border-dashed border-slate-400 w-32 mx-auto"></div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 print:hidden">
              <button
                onClick={() => setSelectedPrintTransfer(null)}
                className="px-4 py-2 border rounded-xl text-sm"
              >
                إغلاق
              </button>
              <button
                onClick={() => window.print()}
                className="px-6 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow"
              >
                🖨️ طباعة الآن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
