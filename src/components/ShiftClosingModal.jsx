import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Receipt, 
  Printer, 
  CheckCircle2, 
  X, 
  Banknote, 
  CreditCard, 
  Calendar, 
  Clock, 
  Building2, 
  User, 
  AlertTriangle,
  FileSpreadsheet,
  QrCode,
  DollarSign
} from 'lucide-react';
import { safeFetch } from '../api/client';
import { saveShiftToFirebase } from '../firebase';
import { generateZatcaPhase2QR } from '../utils/zatcaPhase2';
import { t } from '../i18n.jsx';

export default function ShiftClosingModal({
  currentBranch,
  currentUser,
  currentTenant,
  lang = 'ar',
  onClose,
  onShiftClosed
}) {
  const [openingBalance, setOpeningBalance] = useState(500.00);
  const [actualCash, setActualCash] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [shiftSummary, setShiftSummary] = useState(null);
  const [closedZReport, setClosedZReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. حساب وتحليل مبيعات ومصروفات الوردية الحالية
  useEffect(() => {
    async function loadShiftMetrics() {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const res = await safeFetch(`/api/reports/sales-purchases?fromDate=${todayStr}&toDate=${todayStr}&branchId=${currentBranch?.id || 1}&cashierId=${encodeURIComponent(currentUser?.name || '')}`);
        
        const salesList = (res && res.success && res.data?.sales) ? res.data.sales : [];
        
        let cashSales = 0;
        let cardSales = 0;
        let creditSales = 0;
        let totalSales = 0;
        let vatTotal = 0;

        salesList.forEach(s => {
          const grand = Number(s.grand_total || s.total_amount || 0);
          const vat = Number(s.vat_total || s.vat_amount || 0);
          totalSales += grand;
          vatTotal += vat;
          if (s.payment_method === 'cash') cashSales += grand;
          else if (s.payment_method === 'card' || s.payment_method === 'bank') cardSales += grand;
          else creditSales += grand;
        });

        // جلب المصروفات المسحوبة من درج الكاشير
        let cashExpenses = 0;
        try {
          const savedDrawerExp = JSON.parse(localStorage.getItem('suwayan_shift_drawer_expenses') || '[]');
          cashExpenses = savedDrawerExp.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        } catch (e) {}

        const shiftMetrics = {
          shiftDate: todayStr,
          openedAt: new Date(Date.now() - 7 * 3600000).toLocaleTimeString('ar-SA'),
          closedAt: new Date().toLocaleTimeString('ar-SA'),
          invoicesCount: salesList.length,
          totalSales,
          cashSales,
          cardSales,
          creditSales,
          vatTotal,
          cashExpenses
        };

        setShiftSummary(shiftMetrics);
        // Pre-fill actual cash with expected cash
        const expected = Number((openingBalance + cashSales - cashExpenses).toFixed(2));
        setActualCash(String(expected));
      } catch (err) {
        console.warn('Error calculating shift metrics:', err);
      }
    }

    loadShiftMetrics();
  }, [currentBranch, currentUser]);

  const numActualCash = Number(actualCash) || 0;
  const numOpening = Number(openingBalance) || 0;
  const numCashSales = shiftSummary?.cashSales || 0;
  const numCashExpenses = shiftSummary?.cashExpenses || 0;
  const expectedCash = Number((numOpening + numCashSales - numCashExpenses).toFixed(2));
  const cashDifference = Number((numActualCash - expectedCash).toFixed(2));

  // 2. تأكيد إغلاق الوردية وتوليد تقرير Z-Report الرسمي
  const handleConfirmClose = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const zReportNumber = `ZREP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date();

      const zReportData = {
        z_report_number: zReportNumber,
        branch_id: currentBranch?.id || 1,
        branch_name: currentBranch?.name_ar || 'الفرع الرئيسي',
        cashier_id: currentUser?.id || null,
        cashier_name: currentUser?.name || 'كاشير الفرع',
        shift_date: new Date().toISOString().split('T')[0],
        opened_at: new Date(Date.now() - 7 * 3600000).toISOString(),
        closed_at: now.toISOString(),
        total_sales: shiftSummary?.totalSales || 0,
        cash_sales: numCashSales,
        card_sales: shiftSummary?.cardSales || 0,
        credit_sales: shiftSummary?.creditSales || 0,
        vat_total: shiftSummary?.vatTotal || 0,
        invoices_count: shiftSummary?.invoicesCount || 0,
        opening_balance: numOpening,
        cash_expenses: numCashExpenses,
        expected_cash: expectedCash,
        actual_cash: numActualCash,
        difference: cashDifference,
        status: 'closed',
        notes: settlementNotes || 'تمت تصفية الوردية ومطابقة النقدية والصندوق بالكامل',
        created_at: now.toISOString()
      };

      // 1. توليد ختم وQR المرحلة الثانية ZATCA لتقرير التصفية
      try {
        const qrBase64 = generateZatcaPhase2QR({
          sellerName: currentTenant?.company_name_ar || currentTenant?.name_ar || 'منظومة الصويان السحابية',
          vatNumber: currentTenant?.vat_number || '310984752000003',
          timestamp: now.toISOString(),
          totalAmount: shiftSummary?.totalSales || 0,
          vatAmount: shiftSummary?.vatTotal || 0
        });
        zReportData.zatca_qr = qrBase64;
      } catch (e) {}

      // 2. إرسال وتحديث في API
      const apiRes = await safeFetch('/api/pos/shifts/close', {
        method: 'POST',
        body: JSON.stringify(zReportData)
      });

      // 3. حفظ سحابي مباشر في Firestore لتثبيتها ضد الـ F5
      try {
        await saveShiftToFirebase(zReportData);
      } catch (fbErr) {
        console.warn('Firebase save shift notice:', fbErr);
      }

      // 4. حفظ محلي بالمتصفح ضد F5
      try {
        localStorage.setItem('suwayan_active_z_report', JSON.stringify(zReportData));
        localStorage.removeItem('suwayan_shift_drawer_expenses');
      } catch (e) {}

      setClosedZReport(zReportData);

      if (onShiftClosed) {
        onShiftClosed(zReportData);
      }
    } catch (err) {
      setErrorMsg('خطأ أثناء إغلاق الوردية: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div className="modal-content" style={{ maxWidth: '620px', borderRadius: '16px', overflow: 'hidden' }}>
        {/* Header */}
        <div className="modal-header" style={{ background: closedZReport ? '#047857' : '#0f172a', color: '#ffffff', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {closedZReport ? <CheckCircle2 size={24} style={{ color: '#6ee7b7' }} /> : <Lock size={22} style={{ color: '#fbbf24' }} />}
            <div>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem' }}>
                {closedZReport ? '✅ تقرير إغلاق الوردية الرسمي (Z-Report)' : t('close_shift', lang)}
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: closedZReport ? '#a7f3d0' : '#94a3b8' }}>
                {closedZReport ? `تم اعتماد التصفية برقم (${closedZReport.z_report_number}) وإرسالها للإدارة` : 'جرد مبيعات الصندوق وتفصيل الكاش والشبكة وإرسال التقرير للمسؤول'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.25rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {closedZReport ? (
          /* ======================================================== */
          /* Printable Z-Report Official Voucher View                */
          /* ======================================================== */
          <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div id="z-report-printable" style={{ background: '#ffffff', border: '2px dashed #047857', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #047857', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#047857' }}>
                    {currentTenant?.company_name_ar || 'منظومة الصويان السحابية'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    فرع: {closedZReport.branch_name}
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div className="badge badge-success" style={{ fontWeight: 800 }}>
                    {closedZReport.z_report_number}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {closedZReport.shift_date}
                  </div>
                </div>
              </div>

              {/* Cashier & Time Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem' }}>
                <div><strong>الكاشير:</strong> {closedZReport.cashier_name}</div>
                <div><strong>الفواتير:</strong> {closedZReport.invoices_count} فاتورة</div>
                <div><strong>الحالة:</strong> مقفل ومعتمد ✅</div>
              </div>

              {/* Financial Breakdown Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', height: '32px' }}>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>💵 مبيعات النقد (كاش):</td>
                    <td style={{ textAlign: 'left', fontWeight: 800 }} className="font-mono">{closedZReport.cash_sales.toFixed(2)} ر.س</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', height: '32px' }}>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>💳 مبيعات الشبكة (مدى / فيزا):</td>
                    <td style={{ textAlign: 'left', fontWeight: 800 }} className="font-mono">{closedZReport.card_sales.toFixed(2)} ر.س</td>
                  </tr>
                  {closedZReport.credit_sales > 0 && (
                    <tr style={{ borderBottom: '1px solid #e2e8f0', height: '32px' }}>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>📝 مبيعات الآجل:</td>
                      <td style={{ textAlign: 'left', fontWeight: 800 }} className="font-mono">{closedZReport.credit_sales.toFixed(2)} ر.س</td>
                    </tr>
                  )}
                  <tr style={{ borderBottom: '2px solid #047857', height: '36px', background: '#ecfdf5', fontWeight: 800 }}>
                    <td style={{ textAlign: 'right', color: '#065f46' }}>💰 إجمالي مبيعات الوردية:</td>
                    <td style={{ textAlign: 'left', color: '#047857', fontSize: '1.05rem' }} className="font-mono">{closedZReport.total_sales.toFixed(2)} ر.س</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', height: '30px', color: '#64748b' }}>
                    <td style={{ textAlign: 'right' }}>ضريبة القيمة المضافة المحصلة (15%):</td>
                    <td style={{ textAlign: 'left' }} className="font-mono">{closedZReport.vat_total.toFixed(2)} ر.س</td>
                  </tr>
                </tbody>
              </table>

              {/* Drawer Cash Reconciliation */}
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '1rem', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 800, color: '#334155', marginBottom: '0.5rem', textAlign: 'right' }}>
                  جرد ومطابقة النقد الفعلي في الصندوق:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>المتوقع بالدرج</div>
                    <div className="font-mono" style={{ fontWeight: 800 }}>{closedZReport.expected_cash.toFixed(2)} ر.س</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>المعدود الفعلي</div>
                    <div className="font-mono" style={{ fontWeight: 800, color: '#047857' }}>{closedZReport.actual_cash.toFixed(2)} ر.س</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>فرق الصندوق</div>
                    <div className="font-mono" style={{ fontWeight: 800, color: closedZReport.difference === 0 ? '#047857' : (closedZReport.difference > 0 ? '#2563eb' : '#dc2626') }}>
                      {closedZReport.difference > 0 ? `+${closedZReport.difference.toFixed(2)} (فائض)` : (closedZReport.difference < 0 ? `${closedZReport.difference.toFixed(2)} (عجز)` : '0.00 (مطابق)')}
                    </div>
                  </div>
                </div>
              </div>

              {/* QR and Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                  <div>توقيع الكاشير: _________________</div>
                  <div style={{ marginTop: '0.5rem' }}>اعتماد المحاسب المسؤول: _________________</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  {closedZReport.zatca_qr && (
                    <div style={{ background: '#f8fafc', padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'inline-block' }}>
                      <QrCode size={48} style={{ color: '#047857' }} />
                    </div>
                  )}
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>مشفر ZATCA</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <button 
                type="button" 
                onClick={handlePrint} 
                className="btn btn-primary"
                style={{ background: '#047857', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 800 }}
              >
                <Printer size={18} />
                <span>طباعة إشعار Z-Report</span>
              </button>
              <button 
                type="button" 
                onClick={onClose} 
                className="btn btn-secondary"
                style={{ padding: '0.6rem 1.5rem', fontWeight: 700 }}
              >
                إنهاء
              </button>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* Active Shift Liquidation & Closing Form                  */
          /* ======================================================== */
          <form onSubmit={handleConfirmClose}>
            <div className="modal-body" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {errorMsg && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.65rem 1rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Branch & Cashier Info Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#047857', fontWeight: 800 }}>
                  <Building2 size={16} />
                  <span>الفرع: {currentBranch?.name_ar || 'الفرع الرئيسي'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569', fontWeight: 700 }}>
                  <User size={16} />
                  <span>الكاشير: {currentUser?.name || 'كاشير الفرع'}</span>
                </div>
              </div>

              {/* Shift Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 700 }}>💵 مبيعات الكاش</div>
                  <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 900, color: '#047857', marginTop: '0.2rem' }}>
                    {numCashSales.toFixed(2)} <span style={{ fontSize: '0.75rem' }}>ر.س</span>
                  </div>
                </div>

                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 700 }}>💳 مبيعات الشبكة</div>
                  <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 900, color: '#2563eb', marginTop: '0.2rem' }}>
                    {(shiftSummary?.cardSales || 0).toFixed(2)} <span style={{ fontSize: '0.75rem' }}>ر.س</span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 700 }}>🧾 عدد الفواتير</div>
                  <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', marginTop: '0.2rem' }}>
                    {shiftSummary?.invoicesCount || 0}
                  </div>
                </div>
              </div>

              {/* Total Shift Sales Banner */}
              <div style={{ background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)', color: '#ffffff', borderRadius: '12px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#a7f3d0', fontWeight: 700 }}>
                    {t('total_shift_sales', lang)}:
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#d1fae5', marginTop: '0.15rem' }}>
                    شامل ضريبة القيمة المضافة 15% ({(shiftSummary?.vatTotal || 0).toFixed(2)} ر.س)
                  </div>
                </div>
                <div className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 900 }}>
                  {(shiftSummary?.totalSales || 0).toFixed(2)} <span style={{ fontSize: '0.9rem' }}>ر.س</span>
                </div>
              </div>

              {/* Drawer Cash Reconciliation Section */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>
                  🗄️ تصفية وجرد النقدية في الدرج (Cash Drawer):
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('opening_cash', lang)}</label>
                    <input 
                      type="number"
                      step="0.01"
                      className="form-input font-mono"
                      value={openingBalance}
                      onChange={e => setOpeningBalance(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('expected_cash', lang)}</label>
                    <input 
                      type="text"
                      readOnly
                      className="form-input font-mono"
                      style={{ background: '#e2e8f0', fontWeight: 800, color: '#334155' }}
                      value={`${expectedCash.toFixed(2)} ر.س`}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 800, color: '#047857' }}>
                      {t('actual_cash', lang)} *
                    </label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      className="form-input font-mono"
                      style={{ fontWeight: 900, fontSize: '1.1rem', color: '#047857', border: '2px solid #10b981' }}
                      value={actualCash}
                      onChange={e => setActualCash(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('cash_difference', lang)}</label>
                    <div 
                      className="font-mono"
                      style={{
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        fontWeight: 900,
                        fontSize: '0.95rem',
                        background: cashDifference === 0 ? '#ecfdf5' : (cashDifference > 0 ? '#eff6ff' : '#fef2f2'),
                        color: cashDifference === 0 ? '#047857' : (cashDifference > 0 ? '#1d4ed8' : '#dc2626'),
                        border: '1px solid #cbd5e1'
                      }}
                    >
                      {cashDifference === 0 ? '0.00 (مطابق ✅)' : (cashDifference > 0 ? `+${cashDifference.toFixed(2)} (فائض)` : `${cashDifference.toFixed(2)} (عجز ⚠️)`)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Settlement Notes */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('settlement_notes', lang)}</label>
                <textarea 
                  rows="2"
                  placeholder="ملاحظات تسليم الصندوق إلى مشرف الوردية القادمة..."
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                  value={settlementNotes}
                  onChange={e => setSettlementNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                {t('cancel', lang)}
              </button>
              <button 
                type="submit" 
                disabled={loading} 
                className="btn btn-primary"
                style={{ background: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Lock size={16} />
                <span>{loading ? 'جاري التصفية...' : t('confirm_shift_close', lang)}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
