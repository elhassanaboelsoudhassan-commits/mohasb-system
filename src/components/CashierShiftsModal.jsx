import React, { useState, useEffect } from 'react';
import { safeFetch } from '../api/client';

export default function CashierShiftsModal({ isOpen, onClose, onShiftChanged }) {
  const [activeShift, setActiveShift] = useState(null);
  const [shiftsHistory, setShiftsHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'history'
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPrintShift, setSelectedPrintShift] = useState(null);

  // نموذج فتح وردية
  const [openData, setOpenData] = useState({
    opening_balance: 500,
    cashier_name: 'محمد الشمري',
    notes: 'الوردية الصباحية - صالة المشاتل الرئيسية'
  });

  // نموذج إغلاق وردية
  const [closeData, setCloseData] = useState({
    actual_cash: '',
    expenses_amount: 0,
    notes: ''
  });

  const fetchShiftData = async () => {
    setLoading(true);
    try {
      const [curRes, histRes] = await Promise.all([
        safeFetch('/api/pos/shifts/current'),
        safeFetch('/api/pos/shifts')
      ]);

      if (curRes && curRes.success) {
        setActiveShift(curRes.activeShift || null);
        if (curRes.activeShift) {
          setCloseData(prev => ({
            ...prev,
            actual_cash: String(curRes.activeShift.expected_cash || curRes.activeShift.opening_balance || 0)
          }));
        }
      }
      if (histRes && histRes.success) {
        setShiftsHistory(histRes.data || []);
      }
    } catch (err) {
      console.error('Error loading shift data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchShiftData();
    }
  }, [isOpen]);

  const handleOpenShift = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await safeFetch('/api/pos/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(openData)
      });
      if (res && res.success) {
        alert(res.message || '✅ تم فتح وردية الكاشير بنجاح');
        fetchShiftData();
        if (onShiftChanged) onShiftChanged();
      } else {
        alert('فشل فتح الوردية: ' + (res?.error || 'يرجى المحاولة مجدداً'));
      }
    } catch (err) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!window.confirm('هل أنت متأكد من إغلاق الوردية الحالية وجرد الخزينة والصندوق؟')) return;

    setSubmitting(true);
    try {
      const res = await safeFetch('/api/pos/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_id: activeShift?.id,
          actual_cash: Number(closeData.actual_cash || 0),
          expenses_amount: Number(closeData.expenses_amount || 0),
          notes: closeData.notes
        })
      });
      if (res && res.success) {
        alert(res.message || '✅ تم إغلاق الوردية وحفظ تقرير الجرد');
        setSelectedPrintShift(res.shift || activeShift);
        fetchShiftData();
        if (onShiftChanged) onShiftChanged();
      } else {
        alert('فشل إغلاق الوردية: ' + (res?.error || 'يرجى المحاولة مجدداً'));
      }
    } catch (err) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const expectedCash = activeShift ? Number(activeShift.expected_cash || 0) : 0;
  const actualCash = Number(closeData.actual_cash || 0);
  const variance = Number((actualCash - expectedCash).toFixed(2));

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
        {/* رأس النافذة */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700 mb-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xl">
              ⏱️
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">إدارة ورديات الكاشير وجرد الصندوق</h3>
              <p className="text-xs text-slate-400">فتح وإغلاق الورديات وطباعة تقرير إغلاق الخزينة (Z-Report)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* شريط التبويبات */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">
          <button
            onClick={() => setActiveTab('current')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'current'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {activeShift ? '🟢 الوردية الحالية المفتوحة' : '➕ فتح وردية جديدة'}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            📋 سجل الورديات المغلقة ({shiftsHistory.filter(s => s.status === 'closed').length})
          </button>
        </div>

        {/* محتوى التبويب */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400">جاري تحميل بيانات ورديات الكاشير...</div>
          ) : activeTab === 'current' ? (
            !activeShift ? (
              /* شاشة فتح وردية جديدة */
              <form onSubmit={handleOpenShift} className="space-y-4 bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="text-center py-2">
                  <span className="text-4xl mb-2 inline-block">🔓</span>
                  <h4 className="font-bold text-slate-800 dark:text-white text-base">لا توجد وردية مفتوحة حالياً</h4>
                  <p className="text-xs text-slate-500">يرجى تسجيل العهدة النقدية الافتتاحية لبدء استقبال مبيعات الكاشير</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    رصيد بداية الوردية (العهدة النقدية الافتتاحية بالدرج) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={openData.opening_balance}
                      onChange={e => setOpenData({ ...openData, opening_balance: e.target.value })}
                      className="w-full px-4 py-3 text-lg font-bold border rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                      placeholder="500.00"
                    />
                    <span className="absolute left-4 top-3.5 text-xs text-slate-400 font-bold">ر.س</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      اسم موظف الكاشير *
                    </label>
                    <input
                      type="text"
                      required
                      value={openData.cashier_name}
                      onChange={e => setOpenData({ ...openData, cashier_name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      ملاحظات أو رقم الصالة
                    </label>
                    <input
                      type="text"
                      value={openData.notes}
                      onChange={e => setOpenData({ ...openData, notes: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-base font-bold shadow-lg transition mt-4"
                >
                  {submitting ? 'جاري الفتح...' : '✅ تأكيد فتح الوردية وبدء البيع'}
                </button>
              </form>
            ) : (
              /* شاشة متابعة وإغلاق الوردية الحالية */
              <div className="space-y-4">
                {/* بطاقة معلومات الوردية النشطة */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-850 p-5 rounded-2xl border border-emerald-200 dark:border-slate-700">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                      <span className="font-bold text-emerald-950 dark:text-white text-base">
                        وردية نشطة: {activeShift.shift_number}
                      </span>
                    </div>
                    <span className="text-xs px-2.5 py-1 bg-emerald-200/60 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-full font-bold">
                      مفتوحة منذ: {new Date(activeShift.opened_at).toLocaleTimeString('ar-SA')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center my-3">
                    <div className="bg-white dark:bg-slate-700/60 p-3 rounded-xl border border-emerald-100 dark:border-slate-600">
                      <div className="text-[11px] text-slate-400">العهدة الافتتاحية</div>
                      <div className="text-base font-bold text-slate-800 dark:text-white">
                        {Number(activeShift.opening_balance || 0).toLocaleString('ar-SA')} ر.س
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-700/60 p-3 rounded-xl border border-emerald-100 dark:border-slate-600">
                      <div className="text-[11px] text-slate-400">مبيعات النقد (كاش)</div>
                      <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {Number(activeShift.cash_sales || 0).toLocaleString('ar-SA')} ر.س
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-700/60 p-3 rounded-xl border border-emerald-100 dark:border-slate-600">
                      <div className="text-[11px] text-slate-400">مبيعات الشبكة (مدى)</div>
                      <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                        {Number(activeShift.card_sales || 0).toLocaleString('ar-SA')} ر.س
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-700/60 p-3 rounded-xl border border-emerald-100 dark:border-slate-600">
                      <div className="text-[11px] text-slate-400">إجمالي مبيعات الوردية</div>
                      <div className="text-base font-bold text-purple-600 dark:text-purple-400">
                        {Number(activeShift.total_sales || 0).toLocaleString('ar-SA')} ر.س
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      💵 النقد المتوقع وجوده في الدرج (Expected Cash):
                    </span>
                    <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                      {expectedCash.toLocaleString('ar-SA')} ر.س
                    </span>
                  </div>
                </div>

                {/* نموذج إغلاق الوردية وجرد الصندوق */}
                <form onSubmit={handleCloseShift} className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                    <span>🔒</span>
                    <span>إغلاق الوردية ومطابقة الجرد الفعلي للصندوق</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                        النقدية الفعلية المحصوبة في الدرج (Actual Cash) *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={closeData.actual_cash}
                          onChange={e => setCloseData({ ...closeData, actual_cash: e.target.value })}
                          className="w-full px-3 py-2 text-base font-bold border rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                          placeholder="0.00"
                        />
                        <span className="absolute left-3 top-2 text-xs text-slate-400">ر.س</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                        المصروفات النثرية المسددة من الصندوق
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={closeData.expenses_amount}
                        onChange={e => setCloseData({ ...closeData, expenses_amount: e.target.value })}
                        className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* حالة الفارق المالي */}
                  <div className={`p-3 rounded-xl text-xs font-bold flex justify-between items-center ${
                    variance === 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : variance > 0
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}>
                    <span>
                      نتيجة المطابقة: {variance === 0 ? '✅ مطابق تماماً بدون فروقات' : variance > 0 ? `📈 يوجد فائض نقدي (+${variance} ر.س)` : `⚠️ يوجد عجز نقدي (${variance} ر.س)`}
                    </span>
                    <span className="font-mono text-sm">{variance.toLocaleString('ar-SA')} ر.س</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      ملاحظات الإغلاق والتسليم
                    </label>
                    <input
                      type="text"
                      placeholder="تم تسليم الخزينة ومطابقة النقدية بنجاح"
                      value={closeData.notes}
                      onChange={e => setCloseData({ ...closeData, notes: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPrintShift(activeShift)}
                      className="px-4 py-2 border rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white"
                    >
                      🖨️ طباعة معاينة جرد الخزينة (X-Report)
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-bold shadow-lg transition"
                    >
                      {submitting ? 'جاري الإغلاق...' : '🔒 إغلاق الوردية وطباعة تقرير Z-Report'}
                    </button>
                  </div>
                </form>
              </div>
            )
          ) : (
            /* سجل الورديات السابقة */
            <div className="space-y-3">
              {shiftsHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-400">لا يوجد سجل ورديات سابقة</div>
              ) : (
                shiftsHistory.map(s => (
                  <div
                    key={s.id}
                    className="p-4 bg-white dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-600 flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                        <span>{s.shift_number}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          s.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {s.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                        </span>
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        الكاشير: {s.cashier_name} | الفرع: {s.branch_name || 'الفرع الرئيسي'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        تاريخ الفتح: {new Date(s.opened_at).toLocaleDateString('ar-SA')} {new Date(s.opened_at).toLocaleTimeString('ar-SA')}
                      </div>
                    </div>

                    <div className="text-left">
                      <div className="font-bold text-slate-800 dark:text-white text-sm">
                        المبيعات: {Number(s.total_sales || 0).toLocaleString('ar-SA')} ر.س
                      </div>
                      <div className="text-xs text-emerald-600 font-medium">
                        الدرج الفعلي: {Number(s.actual_cash || s.opening_balance || 0).toLocaleString('ar-SA')} ر.س
                      </div>
                      <button
                        onClick={() => setSelectedPrintShift(s)}
                        className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        🖨️ طباعة تقرير الجرد
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* نافذة طباعة تقرير إغلاق الوردية والخزينة (Z-Report) */}
      {selectedPrintShift && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-800 animate-in fade-in">
            <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
              <h3 className="text-lg font-bold">منظومة الصويان السحابية للمشاتل</h3>
              <div className="text-xs font-bold text-slate-500">تقرير جرد الصندوق وإغلاق وردية الكاشير (Z-Report)</div>
              <div className="font-mono text-sm font-bold mt-1 text-emerald-800">{selectedPrintShift.shift_number}</div>
            </div>

            <div className="text-xs space-y-1.5 border-b pb-3 mb-3">
              <div className="flex justify-between">
                <span className="text-slate-500">اسم الكاشير:</span>
                <span className="font-bold">{selectedPrintShift.cashier_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">تاريخ ووقت الفتح:</span>
                <span>{new Date(selectedPrintShift.opened_at).toLocaleString('ar-SA')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">تاريخ ووقت الإغلاق:</span>
                <span>{selectedPrintShift.closed_at ? new Date(selectedPrintShift.closed_at).toLocaleString('ar-SA') : 'مفتوحة الآن'}</span>
              </div>
            </div>

            <div className="text-xs space-y-2 border-b pb-3 mb-3">
              <div className="flex justify-between">
                <span>العهدة الافتتاحية (Opening Float):</span>
                <span className="font-bold">{Number(selectedPrintShift.opening_balance || 0).toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>مبيعات النقد (Cash Sales):</span>
                <span>+{Number(selectedPrintShift.cash_sales || 0).toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between text-blue-700 font-bold">
                <span>مبيعات الشبكة ومدى (Card Sales):</span>
                <span>+{Number(selectedPrintShift.card_sales || 0).toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>المصروفات النثرية الصادرة:</span>
                <span>-{Number(selectedPrintShift.expenses_amount || 0).toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between pt-1 border-t font-bold text-slate-900">
                <span>إجمالي مبيعات الوردية:</span>
                <span>{Number(selectedPrintShift.total_sales || 0).toFixed(2)} ر.س</span>
              </div>
            </div>

            <div className="bg-slate-100 p-3 rounded-xl text-xs space-y-1.5 mb-4">
              <div className="flex justify-between font-bold text-slate-700">
                <span>النقدية المحسوبة المفترضة:</span>
                <span>{Number(selectedPrintShift.expected_cash || selectedPrintShift.opening_balance || 0).toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-800">
                <span>النقدية الفعلية المحصوبة بالدرج:</span>
                <span>{Number(selectedPrintShift.actual_cash || selectedPrintShift.opening_balance || 0).toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-300 font-bold text-slate-900">
                <span>الفارق المالي (العجز / الفائض):</span>
                <span className={Number(selectedPrintShift.difference || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {Number(selectedPrintShift.difference || 0).toFixed(2)} ر.س
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center text-[10px] pt-2 border-t text-slate-500 mb-4">
              <div>
                <div>توقيع موظف الكاشير</div>
                <div className="border-b border-dashed border-slate-400 w-24 mx-auto mt-6"></div>
              </div>
              <div>
                <div>اعتماد المحاسب / المشرف</div>
                <div className="border-b border-dashed border-slate-400 w-24 mx-auto mt-6"></div>
              </div>
            </div>

            <div className="flex justify-end gap-2 print:hidden">
              <button
                onClick={() => setSelectedPrintShift(null)}
                className="px-4 py-2 border rounded-xl text-xs"
              >
                إغلاق
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold shadow"
              >
                🖨️ طباعة التقرير
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
