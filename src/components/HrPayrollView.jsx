import React, { useState, useEffect } from 'react';
import { safeFetch } from '../api/client';

export default function HrPayrollView({ activeTenant, activeBranch, currentUser }) {
  const [employees, setEmployees] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [activeTab, setActiveTab] = useState('employees'); // employees, payrolls
  const [loading, setLoading] = useState(true);
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [showRunPayrollModal, setShowRunPayrollModal] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState(null);

  const [newEmp, setNewEmp] = useState({
    emp_code: '',
    name_ar: '',
    name_en: '',
    national_id: '',
    job_title: 'مهندس زراعي ومشرف بيوت محمية',
    department: 'الإنتاج الزراعي',
    basic_salary: 5000,
    housing_allowance: 1250,
    transport_allowance: 500,
    other_allowance: 0,
    bank_iban: 'SA'
  });

  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [processingPayroll, setProcessingPayroll] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, payRes] = await Promise.all([
        safeFetch('/api/hr/employees'),
        safeFetch('/api/hr/payrolls')
      ]);

      if (empRes.success && empRes.data) {
        setEmployees(empRes.data);
      }
      if (payRes.success && payRes.data) {
        setPayrolls(payRes.data);
      }
    } catch (err) {
      console.error('Error fetching HR data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      const res = await safeFetch('/api/hr/employees', {
        method: 'POST',
        body: JSON.stringify({
          ...newEmp,
          basic_salary: Number(newEmp.basic_salary),
          housing_allowance: Number(newEmp.housing_allowance),
          transport_allowance: Number(newEmp.transport_allowance),
          other_allowance: Number(newEmp.other_allowance)
        })
      });

      if (res.success) {
        alert('✅ تم إضافة الموظف بنجاح إلى قاعدة بيانات الموارد البشرية');
        setShowAddEmpModal(false);
        setNewEmp({
          emp_code: '',
          name_ar: '',
          name_en: '',
          national_id: '',
          job_title: 'مهندس زراعي ومشرف بيوت محمية',
          department: 'الإنتاج الزراعي',
          basic_salary: 5000,
          housing_allowance: 1250,
          transport_allowance: 500,
          other_allowance: 0,
          bank_iban: 'SA'
        });
        fetchData();
      } else {
        alert(`فشل الإضافة: ${res.error}`);
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    }
  };

  const handleRunPayroll = async () => {
    if (!payrollMonth) {
      alert('يرجى تحديد شهر المسير');
      return;
    }
    setProcessingPayroll(true);
    try {
      const res = await safeFetch('/api/hr/payrolls', {
        method: 'POST',
        body: JSON.stringify({ month_year: payrollMonth })
      });

      if (res.success) {
        alert(`✅ ${res.message || 'تم اعتماد مسير الرواتب وترحيل القيد المحاسبي الآلي بنجاح!'}`);
        setShowRunPayrollModal(false);
        fetchData();
      } else {
        alert(`فشل اعتماد المسير: ${res.error}`);
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    } finally {
      setProcessingPayroll(false);
    }
  };

  const totalSalaries = employees.reduce((sum, e) => {
    return sum + (Number(e.basic_salary || 0) + Number(e.housing_allowance || 0) + Number(e.transport_allowance || 0) + Number(e.other_allowance || 0));
  }, 0);

  return (
    <div className="p-4 bg-slate-900 min-h-[calc(100vh-80px)] text-slate-100">
      {/* رأس القسم */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <span>👥 إدارة الموارد البشرية والرواتب (HR & Payroll)</span>
          </h1>
          <p className="text-xs text-slate-400">
            سجلات المهندسين والعمال الزراعيين، إعداد مسيرات الرواتب وتوليد القيود المحاسبية الآلية للرواتب
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddEmpModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <span>+</span>
            <span>إضافة موظف جديد</span>
          </button>
          <button
            onClick={() => setShowRunPayrollModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950 flex items-center gap-1.5 transition-all"
          >
            <span>⚡</span>
            <span>إصدار مسير رواتب الشهر</span>
          </button>
        </div>
      </div>

      {/* بطاقات الإحصائيات السريعة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">إجمالي الموظفين النشطين</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{employees.length} موظف</p>
          </div>
          <span className="text-3xl p-2 bg-slate-900 rounded-xl">👨‍🌾</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">كتلة الأجور والبدلات الشهرية</p>
            <p className="text-2xl font-black text-white mt-1">{totalSalaries.toFixed(2)} <span className="text-xs text-slate-400">ر.س</span></p>
          </div>
          <span className="text-3xl p-2 bg-slate-900 rounded-xl">💰</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">مسيرات الرواتب المعتمدة</p>
            <p className="text-2xl font-black text-teal-400 mt-1">{payrolls.length} مسير</p>
          </div>
          <span className="text-3xl p-2 bg-slate-900 rounded-xl">📋</span>
        </div>
      </div>

      {/* شريط التبويبات */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 mb-4">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'employees'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          👨‍🌾 دليل الموظفين والبدلات
        </button>
        <button
          onClick={() => setActiveTab('payrolls')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'payrolls'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          📜 مسيرات الرواتب والقيود الآلية ({payrolls.length})
        </button>
      </div>

      {/* محتوى التبويب الأول: جدول الموظفين */}
      {activeTab === 'employees' && (
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-700 uppercase">
                <tr>
                  <th className="p-3">الرقم الوظيفي</th>
                  <th className="p-3">اسم الموظف</th>
                  <th className="p-3">المسمى الوظيفي / القسم</th>
                  <th className="p-3">الراتب الأساسي</th>
                  <th className="p-3">بدل السكن</th>
                  <th className="p-3">بدل النقل</th>
                  <th className="p-3">إجمالي الراتب</th>
                  <th className="p-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-6 text-center text-slate-500">
                      لا يوجد موظفون مسجلون حالياً. اضغط "إضافة موظف جديد" للبدء.
                    </td>
                  </tr>
                ) : (
                  employees.map(emp => {
                    const total = Number(emp.basic_salary || 0) + Number(emp.housing_allowance || 0) + Number(emp.transport_allowance || 0) + Number(emp.other_allowance || 0);
                    return (
                      <tr key={emp.id} className="hover:bg-slate-750 transition-colors">
                        <td className="p-3 font-mono text-emerald-400 font-bold">{emp.emp_code}</td>
                        <td className="p-3">
                          <p className="font-bold text-white">{emp.name_ar}</p>
                          <p className="text-[10px] text-slate-400">{emp.name_en}</p>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
                            {emp.job_title}
                          </span>
                        </td>
                        <td className="p-3 font-mono">{Number(emp.basic_salary).toFixed(2)} ر.س</td>
                        <td className="p-3 font-mono">{Number(emp.housing_allowance).toFixed(2)} ر.س</td>
                        <td className="p-3 font-mono">{Number(emp.transport_allowance).toFixed(2)} ر.س</td>
                        <td className="p-3 font-mono font-bold text-emerald-400">{total.toFixed(2)} ر.س</td>
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
      )}

      {/* محتوى التبويب الثاني: جدول مسيرات الرواتب */}
      {activeTab === 'payrolls' && (
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-700 uppercase">
                <tr>
                  <th className="p-3">رقم المسير</th>
                  <th className="p-3">الشهر المستحق</th>
                  <th className="p-3">تاريخ الاعتماد</th>
                  <th className="p-3">إجمالي الأجور الصافية</th>
                  <th className="p-3">رقم القيد المحاسبي الآلي</th>
                  <th className="p-3">حالة الصرف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {payrolls.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-6 text-center text-slate-500">
                      لم يتم اعتماد أي مسير رواتب حتى الآن. اضغط "إصدار مسير رواتب الشهر" للاعتماد التلقائي.
                    </td>
                  </tr>
                ) : (
                  payrolls.map(pay => (
                    <tr key={pay.id} className="hover:bg-slate-750 transition-colors">
                      <td className="p-3 font-mono text-emerald-400 font-bold">{pay.payroll_number}</td>
                      <td className="p-3 font-bold text-white">{pay.month_year}</td>
                      <td className="p-3 text-slate-400">{pay.created_at ? new Date(pay.created_at).toLocaleDateString('ar-SA') : '-'}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400 text-sm">
                        {Number(pay.total_net).toFixed(2)} ر.س
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-teal-300 font-mono font-bold border border-teal-800">
                          {pay.journal_entry_number || 'قيد آلي معتمد'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          معتمد ومرحل بالدفاتر ✅
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* نافذة إضافة موظف جديد */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-600/50 rounded-2xl p-5 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white">إضافة موظف زراعي جديد</h3>
              <button onClick={() => setShowAddEmpModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-3 mt-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">الرقم الوظيفي</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: EMP-04"
                    value={newEmp.emp_code}
                    onChange={(e) => setNewEmp({ ...newEmp, emp_code: e.target.value })}
                    className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">رقم الهوية / الإقامة</label>
                  <input
                    type="text"
                    required
                    value={newEmp.national_id}
                    onChange={(e) => setNewEmp({ ...newEmp, national_id: e.target.value })}
                    className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">الاسم بالعربية *</label>
                  <input
                    type="text"
                    required
                    value={newEmp.name_ar}
                    onChange={(e) => setNewEmp({ ...newEmp, name_ar: e.target.value })}
                    className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">الاسم بالإنجليزية</label>
                  <input
                    type="text"
                    value={newEmp.name_en}
                    onChange={(e) => setNewEmp({ ...newEmp, name_en: e.target.value })}
                    className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">المسمى الوظيفي</label>
                  <input
                    type="text"
                    value={newEmp.job_title}
                    onChange={(e) => setNewEmp({ ...newEmp, job_title: e.target.value })}
                    className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">القسم</label>
                  <input
                    type="text"
                    value={newEmp.department}
                    onChange={(e) => setNewEmp({ ...newEmp, department: e.target.value })}
                    className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">الأساسي (ر.س)</label>
                  <input
                    type="number"
                    required
                    value={newEmp.basic_salary}
                    onChange={(e) => setNewEmp({ ...newEmp, basic_salary: e.target.value })}
                    className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">بدل السكن</label>
                  <input
                    type="number"
                    value={newEmp.housing_allowance}
                    onChange={(e) => setNewEmp({ ...newEmp, housing_allowance: e.target.value })}
                    className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">بدل النقل</label>
                  <input
                    type="number"
                    value={newEmp.transport_allowance}
                    onChange={(e) => setNewEmp({ ...newEmp, transport_allowance: e.target.value })}
                    className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">الآيبان البنكي (IBAN)</label>
                <input
                  type="text"
                  value={newEmp.bank_iban}
                  onChange={(e) => setNewEmp({ ...newEmp, bank_iban: e.target.value })}
                  className="w-full p-2 bg-slate-800 text-white rounded-xl border border-slate-700 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg"
                >
                  حفظ الموظف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة اعتماد مسير الرواتب */}
      {showRunPayrollModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-600/50 rounded-2xl p-5 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>⚡ اعتماد مسير الرواتب وترحيل القيد المحاسبي</span>
              </h3>
              <button onClick={() => setShowRunPayrollModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 mt-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">تحديد شهر الاستحقاق (YYYY-MM)</label>
                <input
                  type="month"
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(e.target.value)}
                  className="w-full p-2.5 bg-slate-800 text-white rounded-xl border border-slate-700"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>عدد الموظفين المشمولين:</span>
                  <span className="font-bold text-white">{employees.length}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>إجمالي صافي الأجور المستحقة:</span>
                  <span className="font-black text-emerald-400 text-sm">{totalSalaries.toFixed(2)} ر.س</span>
                </div>
                <div className="pt-2 border-t border-slate-700/60 text-[11px] text-emerald-300">
                  ⚖️ سيقوم المحرك تلقائياً بتوليد قيد مزدوج متوازن:
                  <br />• من حـ/ مصروفات الرواتب والأجور (5211)
                  <br />• إلى حـ/ البنك أو الصندوق (1121)
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRunPayrollModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleRunPayroll}
                  disabled={processingPayroll}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-1.5"
                >
                  {processingPayroll ? 'جاري الترحيل...' : 'تأكيد واعتماد المسير 🚀'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
