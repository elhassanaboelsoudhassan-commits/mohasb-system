import React, { useState, useEffect } from 'react';
import { safeFetch } from '../api/client';

export default function ManufacturingView({ activeTenant, activeBranch, currentUser }) {
  const [recipes, setRecipes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('orders'); // orders, recipes
  const [loading, setLoading] = useState(true);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showNewRecipeModal, setShowNewRecipeModal] = useState(false);
  const [completingId, setCompletingId] = useState(null);

  const [newOrder, setNewOrder] = useState({
    recipe_id: '',
    quantity: 100,
    cost_center_id: '',
    notes: 'تشغيل دفعة زراعية جديدة'
  });

  const [costCenters, setCostCenters] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [recRes, ordRes, ccRes] = await Promise.all([
        safeFetch('/api/manufacturing/recipes'),
        safeFetch('/api/manufacturing/orders'),
        safeFetch('/api/cost-centers')
      ]);

      if (recRes.success && recRes.data) setRecipes(recRes.data);
      if (ordRes.success && ordRes.data) setOrders(ordRes.data);
      if (ccRes.success && ccRes.data) setCostCenters(ccRes.data);
    } catch (err) {
      console.error('Error fetching manufacturing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.recipe_id || !newOrder.quantity) {
      alert('يرجى تحديد تركيبة الشتلة وكمية الإنتاج المطلوبة');
      return;
    }

    try {
      const res = await safeFetch('/api/manufacturing/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...newOrder,
          quantity: Number(newOrder.quantity),
          cost_center_id: newOrder.cost_center_id ? Number(newOrder.cost_center_id) : null
        })
      });

      if (res.success) {
        alert('✅ تم إنشاء أمر التصنيع بنجاح وحجز متطلبات الإنتاج');
        setShowNewOrderModal(false);
        fetchData();
      } else {
        alert(`فشل إنشاء أمر التصنيع: ${res.error}`);
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    }
  };

  const handleCompleteOrder = async (orderId) => {
    if (!window.confirm('هل أنت متأكد من إنهاء أمر الإنتاج؟ سيتم خصم المواد الخام وإضافة الشتلات الجاهزة للمخزن وترحيل القيد المحاسبي.')) {
      return;
    }

    setCompletingId(orderId);
    try {
      const res = await safeFetch(`/api/manufacturing/orders/${orderId}/complete`, {
        method: 'POST'
      });

      if (res.success) {
        alert(`✅ ${res.message || 'تم إتمام أمر الإنتاج وإضافة الشتلات للمخزن وترحيل القيد المحاسبي بنجاح!'}\nرقم القيد: ${res.journalEntryNumber || ''}`);
        fetchData();
      } else {
        alert(`فشل إتمام الأمر: ${res.error}`);
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="p-4 bg-slate-900 min-h-[calc(100vh-80px)] text-slate-100">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <span>🏭 تكاليف التصنيع وإنتاج الشتلات (Manufacturing & BOM)</span>
          </h1>
          <p className="text-xs text-slate-400">
            تركيبات شتلات النباتات والزهور، استهلاك المواد الخام (تربة، بذور، أسمدة، عمالة) وترحيل قيود الإنتاج الآلية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (recipes.length > 0) {
                setNewOrder({ ...newOrder, recipe_id: recipes[0].id });
              }
              setShowNewOrderModal(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950 flex items-center gap-1.5 transition-all"
          >
            <span>+</span>
            <span>أمر تصنيع وتشتيل جديد</span>
          </button>
        </div>
      </div>

      {/* بطاقات الإحصاءات */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">تركيبات الشتلات المعتمدة (BOM)</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{recipes.length} تركيبة</p>
          </div>
          <span className="text-3xl p-2 bg-slate-900 rounded-xl">📜</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">أوامر الإنتاج النشطة</p>
            <p className="text-2xl font-black text-amber-400 mt-1">
              {orders.filter(o => o.status !== 'completed').length} أمر قيد العمل
            </p>
          </div>
          <span className="text-3xl p-2 bg-slate-900 rounded-xl">🌱</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">دفعات إنتاج مكتملة ومرحلة</p>
            <p className="text-2xl font-black text-teal-400 mt-1">
              {orders.filter(o => o.status === 'completed').length} دفعة جاهزة
            </p>
          </div>
          <span className="text-3xl p-2 bg-slate-900 rounded-xl">✅</span>
        </div>
      </div>

      {/* شريط التبويبات */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 mb-4">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'orders'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          🌱 أوامر الإنتاج والتشتيل ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('recipes')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'recipes'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          📋 قوائم المواد وتكاليف الشتلات (BOM Recipes)
        </button>
      </div>

      {/* محتوى أوامر الإنتاج */}
      {activeTab === 'orders' && (
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-700 uppercase">
                <tr>
                  <th className="p-3">رقم الأمر</th>
                  <th className="p-3">اسم الصنف والتركيبة</th>
                  <th className="p-3">الكمية المستهدفة</th>
                  <th className="p-3">التكلفة التقديرية</th>
                  <th className="p-3">مركز التكلفة (البيت المحمي)</th>
                  <th className="p-3">حالة الأمر</th>
                  <th className="p-3">قيد اليومية الآلي</th>
                  <th className="p-3">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-6 text-center text-slate-500">
                      لا توجد أوامر إنتاج مسجلة حالياً.
                    </td>
                  </tr>
                ) : (
                  orders.map(ord => {
                    const isCompleted = ord.status === 'completed';
                    return (
                      <tr key={ord.id} className="hover:bg-slate-750 transition-colors">
                        <td className="p-3 font-mono text-emerald-400 font-bold">{ord.order_number}</td>
                        <td className="p-3">
                          <p className="font-bold text-white">{ord.recipe_name || ord.product_name || 'تشتيل نباتات زينة'}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{ord.recipe_code}</p>
                        </td>
                        <td className="p-3 font-bold text-white">{ord.quantity} شتلة</td>
                        <td className="p-3 font-mono font-bold text-emerald-400">
                          {Number(ord.total_cost || 0).toFixed(2)} ر.س
                        </td>
                        <td className="p-3 text-slate-300">
                          {ord.cost_center_name || 'عام - المشتل'}
                        </td>
                        <td className="p-3">
                          {isCompleted ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              مكتمل ومرحل للمخزن ✅
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              قيد التشتيل والإنماء 🌱
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[10px] text-teal-300">
                          {ord.journal_entry_number || (isCompleted ? 'JE-PROD-AUTO' : '-')}
                        </td>
                        <td className="p-3">
                          {!isCompleted && (
                            <button
                              onClick={() => handleCompleteOrder(ord.id)}
                              disabled={completingId === ord.id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] shadow transition-all flex items-center gap-1"
                            >
                              {completingId === ord.id ? 'جاري الإنهاء...' : 'إتمام الدفعة وترحيل القيد ⚡'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* محتوى قوائم المواد BOM Recipes */}
      {activeTab === 'recipes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map(rec => (
            <div key={rec.id} className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60 mb-3">
                  <span className="font-mono text-xs text-emerald-400 font-bold">{rec.recipe_code}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-900 text-slate-300 border border-slate-700">
                    دفعة أساسية: {rec.standard_qty} شتلة
                  </span>
                </div>

                <h3 className="text-sm font-black text-white mb-1">{rec.name_ar}</h3>
                <p className="text-xs text-slate-400 mb-3">{rec.name_en}</p>

                <div className="space-y-1.5 text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-slate-300">
                    <span>تكلفة المواد الأولية (بذور، تربة):</span>
                    <span className="font-mono text-emerald-400">{Number(rec.material_cost || 0).toFixed(2)} ر.س</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>تكلفة العمالة والتشتيل المباشرة:</span>
                    <span className="font-mono text-emerald-400">{Number(rec.labor_cost || 0).toFixed(2)} ر.س</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>مصاريف إضافية (ري وطاقة):</span>
                    <span className="font-mono text-emerald-400">{Number(rec.overhead_cost || 0).toFixed(2)} ر.س</span>
                  </div>
                  <div className="flex justify-between text-white font-bold pt-1.5 border-t border-slate-700">
                    <span>إجمالي تكلفة الشتلة الواحدة:</span>
                    <span className="font-mono text-emerald-400 text-sm">
                      {((Number(rec.material_cost || 0) + Number(rec.labor_cost || 0) + Number(rec.overhead_cost || 0)) / (rec.standard_qty || 100)).toFixed(2)} ر.س
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setNewOrder({ ...newOrder, recipe_id: rec.id });
                  setShowNewOrderModal(true);
                }}
                className="w-full mt-3 py-2 bg-slate-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-colors"
              >
                بدء تشغيل دفعة جديدة من هذه الشتلة 🌱
              </button>
            </div>
          ))}
        </div>
      )}

      {/* نافذة أمر إنتاج جديد */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-600/50 rounded-2xl p-5 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white">إصدار أمر إنتاج وتشتيل جديد</h3>
              <button onClick={() => setShowNewOrderModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3 mt-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">اختيار تركيبة الشتلة (BOM) *</label>
                <select
                  required
                  value={newOrder.recipe_id}
                  onChange={(e) => setNewOrder({ ...newOrder, recipe_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 text-white rounded-xl border border-slate-700"
                >
                  <option value="">-- اختر التركيبة الزراعية --</option>
                  {recipes.map(r => (
                    <option key={r.id} value={r.id}>{r.name_ar} ({r.recipe_code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">الكمية المراد إنتاجها (عدد الشتلات) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newOrder.quantity}
                  onChange={(e) => setNewOrder({ ...newOrder, quantity: e.target.value })}
                  className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">مركز التكلفة (البيت المحمي / المزرعة)</label>
                <select
                  value={newOrder.cost_center_id}
                  onChange={(e) => setNewOrder({ ...newOrder, cost_center_id: e.target.value })}
                  className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                >
                  <option value="">-- بدون مركز تكلفة محدد (عام) --</option>
                  {costCenters.map(cc => (
                    <option key={cc.id} value={cc.id}>{cc.code} - {cc.name_ar}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">ملاحظات التشغيل</label>
                <input
                  type="text"
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                  className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg"
                >
                  تأكيد وإصدار الأمر 🚀
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
