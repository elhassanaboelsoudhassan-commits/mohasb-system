import React, { useState, useEffect } from 'react';
import { safeFetch } from '../api/client';

export default function DeliveryOrdersModal({ activeTenant, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showWaybill, setShowWaybill] = useState(false);

  useEffect(() => {
    fetchDeliveryOrders();
  }, []);

  const fetchDeliveryOrders = async () => {
    try {
      setLoading(true);
      const res = await safeFetch('/api/delivery/orders');
      if (res.success && res.data) {
        setOrders(res.data);
      }
    } catch (err) {
      console.error('Error fetching delivery orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const res = await safeFetch(`/api/delivery/orders/${orderId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.success) {
        fetchDeliveryOrders();
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case 'dispatched':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">جاري التوصيل 🚚</span>;
      case 'delivered':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">تم التسليم بنجاح ✅</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">ملغي ✕</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">قيد التجهيز 📦</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-emerald-600/40 rounded-3xl p-5 max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh]">
        {/* رأس النافذة */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl p-2 bg-emerald-950/60 rounded-xl border border-emerald-700/50">🚚</span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">إدارة طلبات الشحن والتوصيل (Delivery & Logistics)</h2>
              <p className="text-xs text-slate-400">تتبع الشحنات الميدانية، شركات التوصيل، وطباعة بوالص الشحن السريعة للمشاتل</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* قائمة الطلبات */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">جاري تحميل سجل الشحنات...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              لا توجد طلبات توصيل مسجلة حالياً. يمكنك تحديد "طلب شحن" من نقطة البيع السريعة.
            </div>
          ) : (
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700/60 overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-700 uppercase">
                  <tr>
                    <th className="p-3">رقم التتبع</th>
                    <th className="p-3">المستلم والاتصال</th>
                    <th className="p-3">عنوان الشحن</th>
                    <th className="p-3">شركة التوصيل</th>
                    <th className="p-3">رسوم الشحن</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 text-slate-200">
                  {orders.map(ord => (
                    <tr key={ord.id} className="hover:bg-slate-750 transition-colors">
                      <td className="p-3 font-mono text-emerald-400 font-bold">{ord.tracking_number}</td>
                      <td className="p-3">
                        <p className="font-bold text-white">{ord.recipient_name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{ord.recipient_phone}</p>
                      </td>
                      <td className="p-3 text-slate-300 max-w-[180px] truncate">{ord.shipping_address}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-200 border border-slate-700 text-[11px]">
                          {ord.courier_name}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-400">{Number(ord.delivery_fee || 0).toFixed(2)} ر.س</td>
                      <td className="p-3">
                        {getStatusBadge(ord.status)}
                      </td>
                      <td className="p-3 flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedOrder(ord);
                            setShowWaybill(true);
                          }}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold transition-colors"
                        >
                          بوليصة 📄
                        </button>
                        <select
                          value={ord.status}
                          onChange={(e) => handleUpdateStatus(ord.id, e.target.value)}
                          className="bg-slate-900 text-white text-[10px] p-1 rounded border border-slate-700"
                        >
                          <option value="pending">تجهيز</option>
                          <option value="dispatched">توصيل</option>
                          <option value="delivered">تم التسليم</option>
                          <option value="cancelled">إلغاء</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* نافذة بوليصة الشحن (Waybill) */}
        {showWaybill && selectedOrder && (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border-4 border-emerald-700 font-sans print:m-0">
              <div className="flex justify-between items-start border-b-2 border-emerald-800 pb-3 mb-3">
                <div>
                  <h3 className="font-black text-lg text-emerald-900">بوليصة شحن زراعية رسمية</h3>
                  <p className="text-xs text-slate-600">منظومة ومشتل الصويان السحابية</p>
                </div>
                <div className="text-left font-mono">
                  <span className="text-xs bg-emerald-100 text-emerald-900 px-2 py-1 rounded font-bold">
                    {selectedOrder.courier_name}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">رقم التتبع السريع:</span>
                  <span className="font-mono font-black text-emerald-800 text-sm">{selectedOrder.tracking_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">المستلم:</span>
                  <span className="font-bold text-slate-800">{selectedOrder.recipient_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">رقم الجوال:</span>
                  <span className="font-mono text-slate-800">{selectedOrder.recipient_phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">عنوان الشحن:</span>
                  <span className="text-slate-800 text-left font-medium">{selectedOrder.shipping_address}</span>
                </div>
              </div>

              {/* رمز الباركود التخيلي */}
              <div className="flex flex-col items-center justify-center p-3 bg-white border border-dashed border-slate-300 rounded-xl my-2">
                <div className="w-32 h-10 bg-slate-900 flex items-center justify-center text-white font-mono text-xs tracking-widest">
                  ||||| | |||| |||
                </div>
                <p className="text-[10px] font-mono text-slate-500 mt-1">{selectedOrder.tracking_number}</p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 mt-2">
                <button
                  onClick={() => setShowWaybill(false)}
                  className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إغلاق
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-emerald-700 text-white rounded-xl text-xs font-bold shadow hover:bg-emerald-600"
                >
                  طباعة البوليصة 🖨️
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
