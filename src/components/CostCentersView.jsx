import React, { useState, useEffect } from 'react';
import { safeFetch } from '../api/client';

export default function CostCentersView({ activeTenant, activeBranch, currentUser }) {
  const [costCenters, setCostCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCC, setNewCC] = useState({
    code: '',
    name_ar: '',
    name_en: '',
    budget: 50000,
    branch_id: ''
  });

  useEffect(() => {
    fetchCostCenters();
  }, []);

  const fetchCostCenters = async () => {
    try {
      setLoading(true);
      const res = await safeFetch('/api/cost-centers');
      if (res.success && res.data) {
        setCostCenters(res.data);
      }
    } catch (err) {
      console.error('Error fetching cost centers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newCC.code || !newCC.name_ar) {
      alert('يرجى كتابة رمز واسم مركز التكلفة');
      return;
    }

    try {
      const res = await safeFetch('/api/cost-centers', {
        method: 'POST',
        body: JSON.stringify({
          ...newCC,
          budget: Number(newCC.budget || 0),
          branch_id: activeBranch?.id || null
        })
      });

      if (res.success) {
        alert('✅ تم إنشاء مركز التكلفة بنجاح');
        setShowAddModal(false);
        setNewCC({ code: '', name_ar: '', name_en: '', budget: 50000, branch_id: '' });
        fetchCostCenters();
      } else {
        alert(`فشل إنشاء المركز: ${res.error}`);
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    }
  };

  const totalBudget = costCenters.reduce((sum, c) => sum + Number(c.budget || 0), 0);
  const totalActual = costCenters.reduce((sum, c) => sum + Number(c.actual_expenses || 0), 0);

  return (
    <div className="p-4 bg-slate-900 min-h-[calc(100vh-80px)] text-slate-100">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <span>🎯 مراكز التكلفة والمشاريع الزراعية (Cost Centers)</span>
          </h1>
          <p className="text-xs text-slate-400">
            توزيع المصروفات وتكاليف التشتيل والتشغيل حسب البيوت المحمية، أقسام الإنتاج، وصالات المشاتل
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950 flex items-center gap-1.5 transition-all"
        >
          <span>+</span>
          <span>إضافة مركز تكلفة جديد</span>
        </button>
      </div>

      {/* بطاقات الميزانية التقديرية مقابل الفعلي */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">إجمالي الميزانيات المعتمدة</p>
            <p className="text-2xl font-black text-white mt-1">{totalBudget.toFixed(2)} <span className="text-xs text-slate-400">ر.س</span></p>
          </div>
          <span className="text-3xl p-2 bg-slate-900 rounded-xl">📊</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">المصروفات الفعلية المحملة</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{totalActual.toFixed(2)} <span className="text-xs text-slate-400">ر.س</span></p>
          </div>
          <span className="text-3xl p-2 bg-slate-900 rounded-xl">💸</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">المتبقي من الميزانية</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{(totalBudget - totalActual).toFixed(2)} <span className="text-xs text-slate-400">ر.س</span></p>
          </div>
          <span className="text-3xl p-2 bg-slate-900 rounded-xl">🛡️</span>
        </div>
      </div>

      {/* جدول مراكز التكلفة */}
      <div className="bg-slate-800/80 rounded-2xl border border-slate-700/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-700 uppercase">
              <tr>
                <th className="p-3">رمز المركز</th>
                <th className="p-3">اسم مركز التكلفة</th>
                <th className="p-3">الفرع التابع</th>
                <th className="p-3">الميزانية التقديرية</th>
                <th className="p-3">المصروف الفعلي</th>
                <th className="p-3">نسبة الاستهلاك</th>
                <th className="p-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 text-slate-200">
              {costCenters.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-slate-500">
                    لا توجد مراكز تكلفة معرفة حالياً. اضغط "إضافة مركز تكلفة جديد" للبدء.
                  </td>
                </tr>
              ) : (
                costCenters.map(cc => {
                  const b = Number(cc.budget || 0);
                  const a = Number(cc.actual_expenses || 0);
                  const pct = b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
                  return (
                    <tr key={cc.id} className="hover:bg-slate-750 transition-colors">
                      <td className="p-3 font-mono text-emerald-400 font-bold">{cc.code}</td>
                      <td className="p-3">
                        <p className="font-bold text-white">{cc.name_ar}</p>
                        <p className="text-[10px] text-slate-400">{cc.name_en}</p>
                      </td>
                      <td className="p-3 text-slate-300">
                        {cc.branch_name_ar || activeBranch?.name_ar || 'الفرع الرئيسي'}
                      </td>
                      <td className="p-3 font-mono font-bold text-white">{b.toFixed(2)} ر.س</td>
                      <td className="p-3 font-mono font-bold text-amber-400">{a.toFixed(2)} ر.س</td>
                      <td className="p-3">
                        <div className="w-32 flex items-center gap-2">
                          <div className="flex-1 bg-slate-900 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 font-bold">{pct}%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          نشط (Active)
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* نافذة إضافة مركز تكلفة جديد */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-600/50 rounded-2xl p-5 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white">إضافة مركز تكلفة جديد</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 mt-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">رمز المركز (Code) *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: CC-103 أو CC-GH-02"
                  value={newCC.code}
                  onChange={(e) => setNewCC({ ...newCC, code: e.target.value })}
                  className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">اسم مركز التكلفة بالعربية *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: البيت المحمي رقم 2 - قسم النخيل والظلال"
                  value={newCC.name_ar}
                  onChange={(e) => setNewCC({ ...newCC, name_ar: e.target.value })}
                  className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">الاسم بالإنجليزية</label>
                <input
                  type="text"
                  placeholder="e.g. Greenhouse #2 Palms"
                  value={newCC.name_en}
                  onChange={(e) => setNewCC({ ...newCC, name_en: e.target.value })}
                  className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">الميزانية التقديرية المخصصة (ر.س)</label>
                <input
                  type="number"
                  value={newCC.budget}
                  onChange={(e) => setNewCC({ ...newCC, budget: e.target.value })}
                  className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700 font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg"
                >
                  حفظ المركز
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
