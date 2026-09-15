import React, { useState, useEffect } from 'react';
import { safeFetch } from '../api/client';

export default function FinancialVouchersView({ currentTenant }) {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'payment', 'receipt'
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPrintVoucher, setSelectedPrintVoucher] = useState(null);

  // نموذج إضافة سند جديد
  const [formData, setFormData] = useState({
    type: 'payment',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    party_name: '',
    category: 'إيجارات المشاتل والمعارض',
    payment_method: 'cash',
    description: '',
    branch_id: 1
  });

  const categories = {
    payment: [
      'إيجارات المشاتل والمعارض',
      'كهرباء ومياه الري والبيوت المحمية',
      'سداد موردين (أسمدة، بذور، شتلات)',
      'مصاريف نقل وشحن لوجستي',
      'صيانة شبكات الري ومعدات التشتيل',
      'أجور عمالة زراعية يومية',
      'مصروفات عمومية وإدارية'
    ],
    receipt: [
      'تحصيل ذمم عملاء مشاريع زراعية',
      'عربون تصميم وتنسيق حدائق',
      'إيرادات بيع مخلفات زراعية وأخشاب',
      'استرداد تأمين أو دفعات بنكية',
      'إيرادات متنوعة أخرى'
    ]
  };

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const res = await safeFetch(`/api/vouchers${typeFilter !== 'all' ? `?type=${typeFilter}` : ''}`);
      if (res && res.success) {
        setVouchers(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching vouchers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, [typeFilter]);

  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0 || !formData.party_name) {
      alert('يرجى كتابة المبلغ واسم المستلم / المودع بشكل صحيح');
      return;
    }

    setSubmitting(true);
    try {
      const res = await safeFetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res && res.success) {
        alert(res.message || '✅ تم إصدار السند المالي وتوليد القيد المحاسبي بنجاح');
        setShowAddModal(false);
        setFormData({
          type: 'payment',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          party_name: '',
          category: 'إيجارات المشاتل والمعارض',
          payment_method: 'cash',
          description: '',
          branch_id: 1
        });
        fetchVouchers();
      } else {
        alert('فشل إصدار السند: ' + (res?.error || 'خطأ غير متوقع'));
      }
    } catch (err) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalPayments = vouchers.filter(v => v.type === 'payment').reduce((s, v) => s + (Number(v.amount) || 0), 0);
  const totalReceipts = vouchers.filter(v => v.type === 'receipt').reduce((s, v) => s + (Number(v.amount) || 0), 0);
  const netCashflow = totalReceipts - totalPayments;

  const filteredVouchers = typeFilter === 'all'
    ? vouchers
    : vouchers.filter(v => v.type === typeFilter);

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-emerald-900 to-teal-900 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">📜</span>
            <h1 className="text-2xl font-bold">السندات المالية (سندات القبض والصرف)</h1>
          </div>
          <p className="text-emerald-200 text-sm mt-1">
            إثبات المصروفات الخارجية وسداد الموردين والإيرادات المتنوعة مع الترحيل المحاسبي اللحظي المباشر
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg"
          >
            <span>➕</span>
            <span>إصدار سند مالي رسمي</span>
          </button>
          <button
            onClick={fetchVouchers}
            className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2.5 rounded-xl text-sm transition"
            title="تحديث البيانات"
          >
            🔄
          </button>
        </div>
      </div>

      {/* المؤشرات المالية السريعة */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 text-sm mb-1">إجمالي سندات الصرف (المدفوعات)</div>
          <div className="text-2xl font-bold text-rose-600">
            {totalPayments.toLocaleString('ar-SA')} ر.س
          </div>
          <div className="text-xs text-rose-500 mt-1">إيجارات، كهرباء، سداد موردين</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 text-sm mb-1">إجمالي سندات القبض (المقبوضات)</div>
          <div className="text-2xl font-bold text-emerald-600">
            {totalReceipts.toLocaleString('ar-SA')} ر.س
          </div>
          <div className="text-xs text-emerald-500 mt-1">عربين، تحصيلات، إيرادات متنوعة</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 text-sm mb-1">صافي حركة السيولة بالسندات</div>
          <div className={`text-2xl font-bold ${netCashflow >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
            {netCashflow.toLocaleString('ar-SA')} ر.س
          </div>
          <div className="text-xs text-slate-400 mt-1">فارق المقبوضات عن المدفوعات</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-slate-500 text-sm mb-1">عدد السندات المحاسبية</div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {vouchers.length} سند
          </div>
          <div className="text-xs text-emerald-600 mt-1">مرحلة آلياً في دفتر اليومية</div>
        </div>
      </div>

      {/* فلاتر النوع */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
        <span className="text-xs font-bold text-slate-500 px-2">تصفية السندات:</span>
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
            typeFilter === 'all'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          كافة السندات ({vouchers.length})
        </button>
        <button
          onClick={() => setTypeFilter('payment')}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
            typeFilter === 'payment'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          🔴 سندات الصرف ({vouchers.filter(v => v.type === 'payment').length})
        </button>
        <button
          onClick={() => setTypeFilter('receipt')}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
            typeFilter === 'receipt'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          🟢 سندات القبض ({vouchers.filter(v => v.type === 'receipt').length})
        </button>
      </div>

      {/* جدول السندات المالية */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs font-semibold">
              <tr>
                <th className="p-4">رقم السند</th>
                <th className="p-4">النوع</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4">المستلم / المودع (الطرف)</th>
                <th className="p-4">التصنيف والغرض</th>
                <th className="p-4">طريقة الدفع</th>
                <th className="p-4">المبلغ</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">جاري تحميل السندات المالية...</td>
                </tr>
              ) : filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">لا توجد سندات مسجلة تطابق التصفية.</td>
                </tr>
              ) : (
                filteredVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition">
                    <td className="p-4 font-mono font-bold">
                      <span className={v.type === 'payment' ? 'text-rose-600' : 'text-emerald-600'}>
                        {v.voucher_number}
                      </span>
                      {v.journal_entry_number && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          قيد: {v.journal_entry_number}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {v.type === 'payment' ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                          سند صرف
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          سند قبض
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {v.date}
                    </td>
                    <td className="p-4 font-bold text-slate-800 dark:text-white">
                      {v.party_name}
                      {v.description && (
                        <div className="text-xs text-slate-400 font-normal truncate max-w-xs">{v.description}</div>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                        {v.category}
                      </span>
                    </td>
                    <td className="p-4 text-xs">
                      {v.payment_method === 'cash' && '💵 نقداً'}
                      {v.payment_method === 'bank_transfer' && '🏦 تحويل بنكي'}
                      {v.payment_method === 'mada' && '💳 مدى / شبكة'}
                    </td>
                    <td className="p-4 font-bold text-base">
                      <span className={v.type === 'payment' ? 'text-rose-600' : 'text-emerald-600'}>
                        {Number(v.amount).toLocaleString('ar-SA')} ر.س
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedPrintVoucher(v)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto"
                      >
                        <span>🖨️</span>
                        <span>طباعة السند</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* نافذة إصدار سند مالي جديد */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700 mb-5">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>📜</span>
                <span>إصدار سند مالي جديد (قبض / صرف)</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="space-y-4">
              {/* اختيار نوع السند */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  نوع السند المالي *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'payment', category: categories.payment[0] })}
                    className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition ${
                      formData.type === 'payment'
                        ? 'bg-rose-50 border-rose-500 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:text-white'
                    }`}
                  >
                    <span>🔴</span>
                    <span>سند صرف (دفع خارجي)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'receipt', category: categories.receipt[0] })}
                    className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition ${
                      formData.type === 'receipt'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:text-white'
                    }`}
                  >
                    <span>🟢</span>
                    <span>سند قبض (استلام أموال)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    المبلغ (ر.س) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="1500.00"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 text-base font-bold border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    تاريخ السند *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {formData.type === 'payment' ? 'صرفنا إلى السيد / المنشأة *' : 'استلمنا من السيد / المنشأة *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={formData.type === 'payment' ? 'مثال: شركة الكهرباء / المورد فهد الصالح' : 'مثال: مؤسسة حدائق الخليج'}
                  value={formData.party_name}
                  onChange={e => setFormData({ ...formData, party_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    التصنيف والغرض المحاسبي *
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  >
                    {(categories[formData.type] || []).map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    طريقة الدفع / الصرف *
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  >
                    <option value="cash">💵 نقداً من الصندوق (Cash)</option>
                    <option value="bank_transfer">🏦 تحويل بنكي (3165002243921500013)</option>
                    <option value="mada">💳 بطاقة شبكة مدى</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  البيان والشرح التفصيلي
                </label>
                <input
                  type="text"
                  placeholder="وذلك لقاء سداد إيجار صالة العرض والمستودع لشهر سبتمبر 2026"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                ⚡ بمجرد الحفظ، سيقوم المحرك تلقائياً بتوليد قيد يومية متوازن (Debit == Credit) وتحديث قائمة الدخل والميزانية فوراً.
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
                  {submitting ? 'جاري الإصدار...' : 'اعتماد السند وترحيل القيد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة طباعة السند المالي الرسمي */}
      {selectedPrintVoucher && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-8 shadow-2xl text-slate-800 animate-in fade-in">
            {/* الترويسة الرسمية للسند */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-slate-900">منظومة الصويان السحابية للمشاتل والزراعة</h2>
                <div className="text-xs text-slate-500">الرقم الضريبي: 300998877600003 | س.ت: 1010998877</div>
                <div className="text-xs text-emerald-700 font-mono mt-0.5">الحساب البنكي: 3165002243921500013 (مصرف الراجحي)</div>
              </div>
              <div className="text-left font-mono">
                <div className={`text-base font-bold px-3 py-1 rounded-lg ${
                  selectedPrintVoucher.type === 'payment' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {selectedPrintVoucher.type === 'payment' ? 'سند صرف (Payment Voucher)' : 'سند قبض (Receipt Voucher)'}
                </div>
                <div className="text-sm font-bold mt-1 text-slate-800">{selectedPrintVoucher.voucher_number}</div>
                <div className="text-xs text-slate-400">{selectedPrintVoucher.date}</div>
              </div>
            </div>

            {/* تفاصيل المبلغ والمستلم */}
            <div className="space-y-4 text-sm bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6">
              <div className="flex justify-between items-center border-b pb-3">
                <span className="text-slate-500">المبلغ بالأرقام:</span>
                <span className="text-xl font-bold font-mono text-emerald-800">
                  {Number(selectedPrintVoucher.amount).toFixed(2)} ر.س
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-xs">
                  {selectedPrintVoucher.type === 'payment' ? 'صرفنا إلى المكرم / السادة:' : 'استلمنا من المكرم / السادة:'}
                </span>
                <span className="text-base font-bold text-slate-900">{selectedPrintVoucher.party_name}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-xs">طريقة السداد:</span>
                <span className="font-semibold">
                  {selectedPrintVoucher.payment_method === 'cash' && 'نقداً من صندوق الكاشير'}
                  {selectedPrintVoucher.payment_method === 'bank_transfer' && 'تحويل بنكي مباشر (حساب 3165002243921500013)'}
                  {selectedPrintVoucher.payment_method === 'mada' && 'بطاقة مدى الإلكترونية'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-xs">وذلك لقاء (الغرض والتصنيف):</span>
                <span className="font-medium text-slate-800">
                  [{selectedPrintVoucher.category}] {selectedPrintVoucher.description || 'سداد معتمد ومقيد بالدفاتر'}
                </span>
              </div>
            </div>

            {/* أختام وتواقيع السند */}
            <div className="grid grid-cols-3 gap-4 text-center text-xs pt-4 border-t border-slate-200">
              <div>
                <div className="font-bold mb-8">
                  {selectedPrintVoucher.type === 'payment' ? 'توقيع المستلم' : 'توقيع المودع'}
                </div>
                <div className="border-b border-dashed border-slate-400 w-28 mx-auto"></div>
              </div>
              <div>
                <div className="font-bold mb-8">المحاسب المسؤول</div>
                <div className="border-b border-dashed border-slate-400 w-28 mx-auto"></div>
              </div>
              <div>
                <div className="font-bold mb-8">اعتماد الإدارة المالية</div>
                <div className="border-b border-dashed border-slate-400 w-28 mx-auto"></div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 print:hidden">
              <button
                onClick={() => setSelectedPrintVoucher(null)}
                className="px-4 py-2 border rounded-xl text-sm"
              >
                إغلاق
              </button>
              <button
                onClick={() => window.print()}
                className="px-6 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow"
              >
                🖨️ طباعة السند الآن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
