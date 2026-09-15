import React, { useState, useEffect } from 'react';
import { safeFetch } from '../api/client';

export default function SupportTicketsView({ activeTenant, currentUser, isSuperAdmin }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicketData, setNewTicketData] = useState({
    subject: '',
    category: 'accounting',
    priority: 'normal',
    message: ''
  });
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await safeFetch('/api/tickets');
      if (res.success && res.data) {
        setTickets(res.data);
        if (res.data.length > 0 && !selectedTicket) {
          loadTicketDetails(res.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTicketDetails = async (id) => {
    try {
      const res = await safeFetch(`/api/tickets/${id}`);
      if (res.success && res.data) {
        setSelectedTicket(res.data);
      }
    } catch (err) {
      console.error('Error loading ticket details:', err);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicketData.subject || !newTicketData.message) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const res = await safeFetch('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(newTicketData)
      });
      if (res.success) {
        alert('✅ تم فتح تذكرة الدعم بنجاح ووصلت لفريق الدعم الفني والمحاسبي');
        setShowNewTicketModal(false);
        setNewTicketData({ subject: '', category: 'accounting', priority: 'normal', message: '' });
        fetchTickets();
      } else {
        alert(`فشل إنشاء التذكرة: ${res.error}`);
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;
    setSubmittingReply(true);
    try {
      const res = await safeFetch(`/api/tickets/${selectedTicket.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: replyMessage.trim() })
      });
      if (res.success) {
        setReplyMessage('');
        loadTicketDetails(selectedTicket.id);
        fetchTickets();
      } else {
        alert('فشل إرسال الرد');
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const res = await safeFetch(`/api/tickets/${ticketId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.success) {
        loadTicketDetails(ticketId);
        fetchTickets();
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    }
  };

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-900/60 text-rose-300 border border-rose-700">🚨 عاجل جداً</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-900/60 text-amber-300 border border-amber-700">⚡ أولوية عالية</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">🌱 عادي</span>;
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case 'open':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">جديدة (Open)</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-700">قيد المعالجة (In Progress)</span>;
      case 'resolved':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-950 text-blue-300 border border-blue-700">تم الحل (Resolved)</span>;
      case 'closed':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">مغلقة (Closed)</span>;
      default:
        return s;
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (filterStatus === 'ALL') return true;
    return t.status === filterStatus;
  });

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col p-3 bg-slate-900 overflow-hidden">
      {/* رأس الصفحة وأزرار التحكم */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <span>🎫 مركز تذاكر الدعم الفني والاستشارات المحاسبية</span>
          </h1>
          <p className="text-xs text-slate-400">
            {isSuperAdmin 
              ? 'متابعة ومعالجة تذاكر واستفسارات جميع الشركات والمشاتل الزراعية المشتركة' 
              : 'تواصل مباشر وسريع مع خبراء منظومة الصويان السحابية لحل أي استفسار فني أو محاسبي'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* فلتر الحالة */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none"
          >
            <option value="ALL">كافة الحالات (All)</option>
            <option value="open">تذاكر مفتوحة</option>
            <option value="in_progress">قيد المعالجة</option>
            <option value="resolved">تم حلها</option>
            <option value="closed">مغلقة</option>
          </select>

          {/* زر تذكرة جديدة (للشركات) */}
          <button
            onClick={() => setShowNewTicketModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-950 flex items-center gap-1.5 transition-all"
          >
            <span>+</span>
            <span>فتح تذكرة جديدة</span>
          </button>
        </div>
      </div>

      {/* المحتوى الرئيسي: قائمة التذاكر + المحادثة النشطة */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 pt-3 overflow-hidden">
        {/* قائمة التذاكر (Side List) */}
        <div className="w-full md:w-80 lg:w-96 flex flex-col bg-slate-800/80 rounded-2xl border border-slate-700/60 p-2 overflow-hidden">
          <div className="text-xs font-bold text-slate-400 px-2 py-1 mb-1">
            قائمة التذاكر ({filteredTickets.length})
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
            {loading ? (
              <div className="text-center py-10 text-slate-500 text-xs">جاري تحميل التذاكر...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                🌱 لا توجد تذاكر مسجلة حالياً
              </div>
            ) : (
              filteredTickets.map(t => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => loadTicketDetails(t.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-700/90 border-emerald-500 shadow-md shadow-emerald-950/40'
                        : 'bg-slate-900/60 hover:bg-slate-800 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="font-mono text-[10px] text-emerald-400 font-bold">{t.ticket_number}</span>
                      {getPriorityBadge(t.priority)}
                    </div>
                    <h4 className="text-xs font-bold text-white line-clamp-1 mb-1">{t.subject}</h4>
                    {isSuperAdmin && t.company_name_ar && (
                      <p className="text-[10px] text-slate-400 mb-1">🏢 {t.company_name_ar}</p>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                      <span>{t.created_at ? new Date(t.created_at).toLocaleDateString('ar-SA') : 'اليوم'}</span>
                      <span>{getStatusBadge(t.status)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* عرض تفاصيل ومحادثة التذكرة النشطة */}
        <div className="flex-1 flex flex-col bg-slate-800/95 rounded-2xl border border-slate-700/60 p-3 overflow-hidden">
          {selectedTicket ? (
            <>
              {/* رأس التذكرة */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700/70">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-900 text-emerald-400 font-bold border border-emerald-800/40">
                      {selectedTicket.ticket_number}
                    </span>
                    {getPriorityBadge(selectedTicket.priority)}
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                  <h2 className="text-base font-black text-white">{selectedTicket.subject}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    المرسل: <span className="text-emerald-300 font-semibold">{selectedTicket.sender_name || 'مالك المنشأة'}</span> • التصنيف: {selectedTicket.category}
                  </p>
                </div>

                {/* تغيير الحالة (خاص بالمسؤول أو المستأجر) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">الحالة:</span>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value)}
                    className="bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-700"
                  >
                    <option value="open">مفتوحة (Open)</option>
                    <option value="in_progress">قيد المعالجة (In Progress)</option>
                    <option value="resolved">تم الحل (Resolved)</option>
                    <option value="closed">إغلاق التذكرة (Closed)</option>
                  </select>
                </div>
              </div>

              {/* مجرى المحادثة والرسائل */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
                {/* الرسالة الأصلية الأولى */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700/80">
                  <div className="flex items-center justify-between text-xs mb-1.5 pb-1 border-b border-slate-800">
                    <span className="font-bold text-emerald-400">📝 الرسالة الافتتاحية للاستفسار</span>
                    <span className="text-[10px] text-slate-400">
                      {selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString('ar-SA') : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {selectedTicket.message}
                  </p>
                </div>

                {/* الردود السابقة */}
                {selectedTicket.replies && selectedTicket.replies.map(reply => {
                  const isStaff = reply.is_staff || reply.role === 'super_admin';
                  return (
                    <div
                      key={reply.id}
                      className={`p-3 rounded-xl max-w-[85%] ${
                        isStaff
                          ? 'mr-auto bg-gradient-to-br from-emerald-950/80 to-slate-900 border border-emerald-600/50'
                          : 'ml-auto bg-slate-900/80 border border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1 pb-1 border-b border-slate-800/60">
                        <span className={`font-bold ${isStaff ? 'text-emerald-300' : 'text-slate-300'}`}>
                          {isStaff ? '🛡️ دعم منظومة الصويان السحابية' : (reply.sender_name || 'العميل')}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {reply.created_at ? new Date(reply.created_at).toLocaleString('ar-SA') : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-100 leading-relaxed whitespace-pre-wrap">
                        {reply.message}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* مربع إدخال الرد */}
              <div className="pt-2 border-t border-slate-700/70 flex gap-2">
                <textarea
                  rows={2}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="اكتب ردك أو التوجيه الفني والمحاسبي هنا..."
                  className="flex-1 p-2 bg-slate-900 text-white rounded-xl border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs placeholder-slate-500 resize-none"
                />
                <button
                  onClick={handleSendReply}
                  disabled={submittingReply || !replyMessage.trim()}
                  className={`px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                    submittingReply || !replyMessage.trim()
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                  }`}
                >
                  {submittingReply ? 'جاري الإرسال...' : 'إرسال الرد 🚀'}
                </button>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
              <span className="text-4xl mb-2">💬</span>
              <p>اختر تذكرة من القائمة الجانبية لعرض تفاصيلها ومحادثتها</p>
            </div>
          )}
        </div>
      </div>

      {/* نافذة منبثقة لإنشاء تذكرة جديدة */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-600/50 rounded-2xl p-5 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>🎫 فتح تذكرة دعم فني أو محاسبي جديدة</span>
              </h3>
              <button
                onClick={() => setShowNewTicketModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 mt-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">عنوان التذكرة / الموضوع *</label>
                <input
                  type="text"
                  required
                  value={newTicketData.subject}
                  onChange={(e) => setNewTicketData({ ...newTicketData, subject: e.target.value })}
                  placeholder="مثال: استفسار حول إعدادات فاتورة هيئة الزكاة، أو قيد الإنتاج"
                  className="w-full p-2.5 bg-slate-800 text-white rounded-xl border border-slate-700 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">التصنيف</label>
                  <select
                    value={newTicketData.category}
                    onChange={(e) => setNewTicketData({ ...newTicketData, category: e.target.value })}
                    className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                  >
                    <option value="accounting">استشارة محاسبية وقيود</option>
                    <option value="zatca">الفاتورة الإلكترونية والربط</option>
                    <option value="pos">نقاط البيع والكاشير</option>
                    <option value="manufacturing">أوامر التصنيع وتكاليف الشتلات</option>
                    <option value="technical">مشكلة تقنية عامة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">درجة الأهمية</label>
                  <select
                    value={newTicketData.priority}
                    onChange={(e) => setNewTicketData({ ...newTicketData, priority: e.target.value })}
                    className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                  >
                    <option value="normal">عادي (Normal)</option>
                    <option value="high">مرتفع (High)</option>
                    <option value="urgent">عاجل جداً (Urgent)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">تفاصيل الاستفسار أو المشكلة بالتفصيل *</label>
                <textarea
                  rows={4}
                  required
                  value={newTicketData.message}
                  onChange={(e) => setNewTicketData({ ...newTicketData, message: e.target.value })}
                  placeholder="اشرح المشكلة أو الاستفسار مع ذكر أي تفاصيل تساعد فريق الدعم الفني في خدمتك بأسرع وقت..."
                  className="w-full p-2.5 bg-slate-800 text-white rounded-xl border border-slate-700 focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg"
                >
                  إرسال التذكرة الآن 🚀
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
