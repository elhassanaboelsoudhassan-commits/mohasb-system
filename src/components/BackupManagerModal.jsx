import React, { useState, useEffect } from 'react';
import { safeFetch } from '../api/client';

export default function BackupManagerModal({ onClose }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await safeFetch('/api/backups');
      if (res.success && res.data) {
        setBackups(res.data);
      }
    } catch (err) {
      console.error('Error fetching backups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await safeFetch('/api/backups/create', { method: 'POST' });
      if (res.success) {
        alert('✅ تم إنشاء النسخة الاحتياطية لقاعدة البيانات بنجاح!');
        fetchBackups();
      } else {
        alert(`فشل إنشاء النسخة: ${res.error}`);
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (backupId) => {
    if (!window.confirm('⚠️ تحذير: استعادة هذه النسخة سيستبدل قاعدة البيانات الحالية بالكامل ببيانات هذه النقطة الزمنية. هل أنت متأكد؟')) {
      return;
    }

    setRestoringId(backupId);
    try {
      const res = await safeFetch(`/api/backups/${backupId}/restore`, { method: 'POST' });
      if (res.success) {
        alert('✅ تم استعادة قاعدة البيانات بنجاح! سيتم تحديث الصفحة لتطبيق البيانات المستعادة.');
        window.location.reload();
      } else {
        alert(`فشل الاستعادة: ${res.error}`);
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    } finally {
      setRestoringId(null);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-emerald-600/40 rounded-3xl p-5 max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
        {/* رأس النافذة */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl p-2 bg-emerald-950/60 rounded-xl border border-emerald-700/50">💾</span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">إدارة النسخ الاحتياطي التلقائي (Automated Cloud Backups)</h2>
              <p className="text-xs text-slate-400">حماية وتأمين بيانات الشركات والمشاتل، جدولة يومية، واستعادة بنقرة واحدة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* بطاقة حالة الجدولة التلقائية */}
        <div className="my-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-600/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></div>
            <div>
              <p className="text-xs font-black text-emerald-300">النسخ الاحتياطي التلقائي اليومي مفعل (Active Daily 03:00 AM)</p>
              <p className="text-[11px] text-slate-400">يقوم النظام بحفظ لقطة متكاملة من قاعدة بيانات المنظومة في مجلد آمن يومياً</p>
            </div>
          </div>
          <button
            onClick={handleCreateBackup}
            disabled={creating}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950 flex items-center gap-1.5 transition-all active:scale-95"
          >
            {creating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>أخذ نسخة فورية الآن</span>
              </>
            )}
          </button>
        </div>

        {/* قائمة النسخ المحفوظة */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2">
          {loading ? (
            <div className="text-center py-10 text-slate-400 text-xs">جاري فحص سجل النسخ الاحتياطية...</div>
          ) : backups.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              لا توجد نسخ احتياطية مسجلة حالياً. اضغط "أخذ نسخة فورية الآن" لإنشاء أول نسخة.
            </div>
          ) : (
            backups.map(bk => (
              <div
                key={bk.id}
                className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between hover:border-slate-600 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl p-2 bg-slate-900 rounded-lg">🗄️</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white font-mono">{bk.filename}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        bk.backup_type === 'auto_daily'
                          ? 'bg-teal-950 text-teal-300 border border-teal-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {bk.backup_type === 'auto_daily' ? 'يومي تلقائي ⏰' : 'يدوي فوري 👤'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      الحجم: <span className="text-emerald-400 font-mono font-bold">{formatBytes(bk.file_size)}</span> • تاريخ الإنشاء: {bk.created_at ? new Date(bk.created_at).toLocaleString('ar-SA') : 'الآن'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/api/backups/${bk.id}/download`}
                    download
                    className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    <span>تحميل 📥</span>
                  </a>
                  <button
                    onClick={() => handleRestore(bk.id)}
                    disabled={restoringId === bk.id}
                    className="px-2.5 py-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    {restoringId === bk.id ? 'جاري الاستعادة...' : 'استعادة ⚠️'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* تذييل */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
