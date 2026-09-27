import React, { useState } from 'react';
import { 
  DollarSign, 
  Receipt, 
  ShoppingBag, 
  CheckCircle2, 
  X, 
  Building2, 
  User, 
  FileText, 
  CreditCard, 
  Banknote,
  AlertCircle
} from 'lucide-react';
import { safeFetch } from '../api/client';
import { saveExpenseToFirebase, savePurchaseToFirebase } from '../firebase';
import { t } from '../i18n';

export default function CashierBranchExpenseModal({
  currentBranch,
  currentUser,
  lang = 'ar',
  onClose,
  onSuccess
}) {
  const [transType, setTransType] = useState('operating_expense'); // 'operating_expense' or 'branch_purchase'
  const [category, setCategory] = useState('نثريات وضيافة المشتل');
  const [amount, setAmount] = useState('');
  const [vatRate, setVatRate] = useState(15);
  const [hasVat, setHasVat] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('cash_drawer'); // 'cash_drawer', 'card', 'transfer'
  const [receiptRef, setReceiptRef] = useState('');
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const numAmount = Number(amount) || 0;
  const vatAmount = hasVat ? Number((numAmount * (vatRate / 100)).toFixed(2)) : 0;
  const grandTotal = Number((numAmount + vatAmount).toFixed(2));

  const categories = [
    'نثريات وضيافة المشتل',
    'صيانة شبكات الري ومضخات الآبار',
    'أدوات ومواد تغليف وأكياس',
    'وقود ومحروقات شاحنات النقل',
    'أسمدة وتربة طارئة للمستودع',
    'شتلات وزهور تكميلية للفرع',
    'فواتير خدمات ومياه بلدية',
    'أجور عمالة يومية إضافية'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setErrorMsg('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      const payload = {
        branch_id: currentBranch?.id || 1,
        branch_name: currentBranch?.name_ar || 'الفرع الرئيسي',
        cashier_id: currentUser?.id || null,
        cashier_name: currentUser?.name || 'كاشير الفرع',
        category: category,
        amount: numAmount,
        vat_amount: vatAmount,
        grand_total: grandTotal,
        payment_method: paymentMethod,
        receipt_ref: receiptRef || `EXP-REF-${Date.now().toString().slice(-5)}`,
        payee: payee || (transType === 'operating_expense' ? 'مصاريف فرع نقدية' : 'مورد زراعي'),
        description: notes || `${transType === 'operating_expense' ? 'مصروف تشغيلي' : 'مشتريات بضاعة'} لفرع ${currentBranch?.name_ar || ''}`,
        date: new Date().toISOString().split('T')[0]
      };

      if (transType === 'operating_expense') {
        const res = await safeFetch('/api/expenses', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (!res || !res.success) {
          throw new Error(res?.error || 'فشل حفظ المصروف');
        }
        try {
          await saveExpenseToFirebase(payload);
        } catch (fbErr) {
          console.warn('Firebase expense save notice:', fbErr);
        }
      } else {
        const res = await safeFetch('/api/purchases', {
          method: 'POST',
          body: JSON.stringify({
            ...payload,
            subtotal: numAmount,
            vat_total: vatAmount,
            supplier_name: payee || 'مورد بضاعة زراعية'
          })
        });
        if (!res || !res.success) {
          throw new Error(res?.error || 'فشل حفظ فاتورة المشتريات');
        }
        try {
          await savePurchaseToFirebase(payload);
        } catch (fbErr) {
          console.warn('Firebase purchase save notice:', fbErr);
        }
      }

      // Record in local shift memory if paid from drawer
      if (paymentMethod === 'cash_drawer') {
        try {
          const shiftExp = JSON.parse(localStorage.getItem('suwayan_shift_drawer_expenses') || '[]');
          shiftExp.push({
            id: Date.now(),
            amount: grandTotal,
            category,
            description: notes,
            created_at: new Date().toISOString()
          });
          localStorage.setItem('suwayan_shift_drawer_expenses', JSON.stringify(shiftExp));
        } catch (e) {}
      }

      if (onSuccess) {
        onSuccess(payload);
      }
      onClose();
    } catch (err) {
      setErrorMsg('خطأ أثناء الحفظ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div className="modal-content" style={{ maxWidth: '580px', borderRadius: '16px', overflow: 'hidden' }}>
        {/* Header */}
        <div className="modal-header" style={{ background: '#047857', color: '#ffffff', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <DollarSign size={22} style={{ color: '#6ee7b7' }} />
            <div>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>
                {t('branch_expenses_purchases', lang)}
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#a7f3d0' }}>
                تسجيل حركة مالية وخصمها تلقائياً من صافي أرباح فرع ({currentBranch?.name_ar || 'الفرع'})
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

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {errorMsg && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.65rem 1rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Transaction Type Selector */}
            <div>
              <label className="form-label" style={{ fontWeight: 800, marginBottom: '0.4rem', display: 'block' }}>
                {t('expense_type', lang)}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setTransType('operating_expense')}
                  style={{
                    padding: '0.65rem',
                    borderRadius: '10px',
                    border: transType === 'operating_expense' ? '2px solid #047857' : '1px solid #cbd5e1',
                    background: transType === 'operating_expense' ? '#ecfdf5' : '#ffffff',
                    color: transType === 'operating_expense' ? '#065f46' : '#475569',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Receipt size={16} />
                  <span>{t('operating_expense', lang)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransType('branch_purchase')}
                  style={{
                    padding: '0.65rem',
                    borderRadius: '10px',
                    border: transType === 'branch_purchase' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: transType === 'branch_purchase' ? '#eff6ff' : '#ffffff',
                    color: transType === 'branch_purchase' ? '#1e40af' : '#475569',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <ShoppingBag size={16} />
                  <span>{t('branch_purchase', lang)}</span>
                </button>
              </div>
            </div>

            {/* Branch and Cashier Badges */}
            <div style={{ display: 'flex', gap: '0.75rem', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#047857', fontWeight: 700 }}>
                <Building2 size={16} />
                <span>الفرع: {currentBranch?.name_ar || 'الفرع الرئيسي'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569', fontWeight: 600 }}>
                <User size={16} />
                <span>الكاشير: {currentUser?.name || 'كاشير الفرع'}</span>
              </div>
            </div>

            {/* Category / Account */}
            <div className="form-group">
              <label className="form-label">{t('expense_category', lang)}</label>
              <select 
                className="form-select"
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Amount & VAT calculation */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">{t('amount_before_vat', lang)} (ر.س)</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="form-input font-mono"
                  style={{ fontWeight: 800, fontSize: '1rem', color: '#047857' }}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>ضريبة القيمة المضافة (15%)</span>
                  <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', color: '#64748b' }}>
                    <input 
                      type="checkbox" 
                      checked={hasVat} 
                      onChange={e => setHasVat(e.target.checked)} 
                    />
                    <span>تطبيق الضريبة</span>
                  </label>
                </label>
                <input 
                  type="text"
                  readOnly
                  className="form-input font-mono"
                  style={{ background: '#f8fafc', color: '#64748b' }}
                  value={`${vatAmount.toFixed(2)} ر.س`}
                />
              </div>
            </div>

            {/* Grand Total Preview Card */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#166534' }}>
                {t('amount_with_vat', lang)}:
              </span>
              <span className="font-mono" style={{ fontWeight: 900, fontSize: '1.25rem', color: '#047857' }}>
                {grandTotal.toFixed(2)} ر.س
              </span>
            </div>

            {/* Payment Method */}
            <div className="form-group">
              <label className="form-label">{t('payment_method', lang)}</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash_drawer')}
                  style={{
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: paymentMethod === 'cash_drawer' ? '2px solid #047857' : '1px solid #cbd5e1',
                    background: paymentMethod === 'cash_drawer' ? '#ecfdf5' : '#ffffff',
                    color: paymentMethod === 'cash_drawer' ? '#065f46' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}
                >
                  <Banknote size={16} />
                  <span>درج الكاشير (صندوق الوردية)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  style={{
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: paymentMethod === 'card' ? '2px solid #047857' : '1px solid #cbd5e1',
                    background: paymentMethod === 'card' ? '#ecfdf5' : '#ffffff',
                    color: paymentMethod === 'card' ? '#065f46' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}
                >
                  <CreditCard size={16} />
                  <span>بطاقة بنكية / مدى</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  style={{
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: paymentMethod === 'transfer' ? '2px solid #047857' : '1px solid #cbd5e1',
                    background: paymentMethod === 'transfer' ? '#ecfdf5' : '#ffffff',
                    color: paymentMethod === 'transfer' ? '#065f46' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}
                >
                  <FileText size={16} />
                  <span>تحويل بنكي / عهدة</span>
                </button>
              </div>
            </div>

            {/* Receipt Ref & Payee */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">{t('receipt_ref', lang)}</label>
                <input 
                  type="text"
                  placeholder="مثال: فاتورة ضريبية 984"
                  className="form-input"
                  value={receiptRef}
                  onChange={e => setReceiptRef(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('supplier_or_payee', lang)}</label>
                <input 
                  type="text"
                  placeholder="اسم المحل أو المورد"
                  className="form-input"
                  value={payee}
                  onChange={e => setPayee(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">{t('notes', lang)}</label>
              <textarea 
                rows="2"
                placeholder="تفاصيل المصروف أو المشتريات والغرض منها..."
                className="form-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
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
              style={{ background: '#047857', fontWeight: 800, minWidth: '150px' }}
            >
              {loading ? 'جاري الاعتماد...' : t('record_expense', lang)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
