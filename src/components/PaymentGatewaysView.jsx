import React, { useState } from 'react';
import { 
  CreditCard, 
  ShieldCheck, 
  CheckCircle2, 
  Zap, 
  Clock, 
  ArrowRight, 
  Copy, 
  Check, 
  ExternalLink,
  Smartphone,
  Building2,
  Lock,
  RefreshCw,
  Award
} from 'lucide-react';
import { safeFetch } from '../api/client';

export default function PaymentGatewaysView({ currentTenant, currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('subscription'); // 'subscription' or 'merchant_gateway'
  const [selectedPlan, setSelectedPlan] = useState('annual'); // 'annual' or 'monthly'
  const [selectedGateway, setSelectedGateway] = useState('mada'); // 'mada', 'visa', 'applepay', 'stcpay', 'bank'
  const [copiedBank, setCopiedBank] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Card form state
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 4444');
  const [cardHolder, setCardHolder] = useState(currentTenant?.owner_name || 'فهد الصويان');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Merchant Gateways Toggle state
  const [merchantSettings, setMerchantSettings] = useState({
    enable_mada: true,
    enable_applepay: true,
    enable_visa_mc: true,
    enable_stcpay: true,
    enable_tabby: false,
    merchant_id: 'MID_SUWAYAN_984752',
    secret_key: 'sk_live_98475283928172648391',
    mode: 'live'
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const plans = {
    monthly: {
      id: 'monthly',
      title: 'الباقة الشهرية المرنة',
      price: 350,
      period: 'شهرياً',
      features: [
        'نظام محاسبي سحابي متكامل',
        'نقاط بيع باللمس غير محدودة',
        'ربط هيئة الزكاة (ZATCA 2)',
        'حتى 3 مستخدمين وكاشيرات',
        'دعم فني ونسخ احتياطي يومي'
      ]
    },
    annual: {
      id: 'annual',
      title: 'الباقة الملكية السنوية (الأكثر طلباً)',
      badge: 'وفر 30% سنوياً',
      price: 2950,
      period: 'سنوياً',
      features: [
        'كافة مميزات الباقة الشهرية',
        'عدد فروع ومستودعات غير محدود',
        'كاشيرات ومستخدمين غير محدودين',
        'ربط ZATCA معتمد وبدون رسوم إضافية',
        'نظام جرد بالموبايل وبوابات دفع إلكتروني',
        'تدريب مجاني ودعم فني مخصص 24/7'
      ]
    }
  };

  const handleStartCheckout = (planId) => {
    setSelectedPlan(planId);
    setShowCheckoutModal(true);
    setPaymentSuccess(false);
    setOtpStep(false);
  };

  const handleProcessCardPayment = (e) => {
    e.preventDefault();
    setProcessingPayment(true);

    // Simulate Payment Gateway 3D Secure / OTP Challenge
    setTimeout(() => {
      setProcessingPayment(false);
      setOtpStep(true);
    }, 1200);
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (otpCode !== '123456' && otpCode.length < 4) {
      alert('رمز التحقق غير صحيح، أدخل 123456 كرمز تجريبي');
      return;
    }
    setProcessingPayment(true);
    setTimeout(() => {
      setProcessingPayment(false);
      setPaymentSuccess(true);
    }, 1000);
  };

  const handleSaveMerchantSettings = (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setTimeout(() => {
      setSavingSettings(false);
      alert('✅ تم حفظ إعدادات بوابات الدفع الإلكتروني للمشتل بنجاح!');
    }, 800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #0f172a 100%)',
        padding: '1.75rem 2rem',
        borderRadius: '16px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
              بوابات الدفع والاشتراكات المعتمدة
            </span>
            <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
              مدى • Visa • Mastercard • Apple Pay • STC Pay
            </span>
          </div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 900 }}>
            مركز المدفوعات وبوابات الدفع الإلكتروني
          </h2>
          <p style={{ color: '#a7f3d0', fontSize: '0.85rem', maxWidth: '750px', marginTop: '0.3rem' }}>
            سداد اشتراكات المنظومة بكل سهولة عبر وسائل الدفع السريعة، أو تفعيل استقبال مدفوعات البطاقات وأبل باي لعملاء المشتل ونقاط البيع.
          </p>
        </div>

        {/* Current Subscription Status Badge */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.12)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          padding: '1rem 1.25rem',
          borderRadius: '14px',
          backdropFilter: 'blur(8px)',
          textAlign: 'right'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#a7f3d0', fontWeight: 700 }}>حالة الاشتراك الحالي:</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ffffff', marginTop: '0.2rem' }}>
            {currentTenant?.status === 'active' ? '✅ الباقة الملكية المفعلة' : '⏳ فترة تجريبية نشطة'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#e2e8f0', marginTop: '0.25rem' }}>
            تنتهي في: <strong className="font-mono">{currentTenant?.trial_ends_at || '2030-12-31'}</strong>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        background: '#ffffff',
        padding: '0.5rem',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        <button
          onClick={() => setActiveSubTab('subscription')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            border: 'none',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: activeSubTab === 'subscription' ? '#047857' : 'transparent',
            color: activeSubTab === 'subscription' ? '#ffffff' : '#475569'
          }}
        >
          <Award size={16} />
          <span>سداد اشتراك المنظومة والباقات</span>
        </button>

        <button
          onClick={() => setActiveSubTab('merchant_gateway')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            border: 'none',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: activeSubTab === 'merchant_gateway' ? '#047857' : 'transparent',
            color: activeSubTab === 'merchant_gateway' ? '#ffffff' : '#475569'
          }}
        >
          <CreditCard size={16} />
          <span>بوابة تحصيل مدفوعات العملاء (Merchant Gateway)</span>
        </button>
      </div>

      {/* SUBTAB 1: SaaS Subscription Plans */}
      {activeSubTab === 'subscription' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Supported Logos Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2rem',
            background: '#ffffff',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b' }}>وسائل الدفع المقبولة:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
              <span style={{ background: '#f8fafc', padding: '0.3rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>💳 مدى Mada</span>
              <span style={{ background: '#f8fafc', padding: '0.3rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>💳 Visa / MasterCard</span>
              <span style={{ background: '#f8fafc', padding: '0.3rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>🍏 Apple Pay</span>
              <span style={{ background: '#f8fafc', padding: '0.3rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>📱 STC Pay</span>
              <span style={{ background: '#ecfdf5', color: '#047857', padding: '0.3rem 0.8rem', borderRadius: '8px', border: '1px solid #a7f3d0' }}>🏦 تحويل الراجحي</span>
            </div>
          </div>

          {/* Pricing Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {/* Annual Plan */}
            <div className="card" style={{
              border: '2px solid #047857',
              position: 'relative',
              boxShadow: '0 12px 28px -5px rgba(4, 120, 87, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{
                position: 'absolute',
                top: '-12px',
                right: '24px',
                background: '#047857',
                color: '#ffffff',
                padding: '0.2rem 0.8rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 800
              }}>
                ⭐ الخيار الموصى به للمشاتل الكبرى
              </div>

              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '0.5rem' }}>
                  {plans.annual.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', margin: '1rem 0' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#047857' }} className="font-mono">
                    {plans.annual.price.toLocaleString('ar-SA')}
                  </span>
                  <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 700 }}>ر.س / {plans.annual.period}</span>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {plans.annual.features.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#334155' }}>
                      <CheckCircle2 size={16} color="#047857" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleStartCheckout('annual')}
                className="btn btn-primary"
                style={{
                  marginTop: '1.5rem',
                  padding: '0.85rem',
                  fontSize: '1rem',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #047857, #065f46)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 6px 16px rgba(4, 120, 87, 0.35)'
                }}
              >
                <span>💳 تجديد / تفعيل الاشتراك الآن</span>
              </button>
            </div>

            {/* Monthly Plan */}
            <div className="card" style={{
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '0.5rem' }}>
                  {plans.monthly.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', margin: '1rem 0' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a' }} className="font-mono">
                    {plans.monthly.price}
                  </span>
                  <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 700 }}>ر.س / {plans.monthly.period}</span>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {plans.monthly.features.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#334155' }}>
                      <CheckCircle2 size={16} color="#059669" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleStartCheckout('monthly')}
                className="btn btn-secondary"
                style={{
                  marginTop: '1.5rem',
                  padding: '0.85rem',
                  fontSize: '0.95rem',
                  fontWeight: 800
                }}
              >
                <span>الدفع الشهري</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Merchant Gateway Configuration */}
      {activeSubTab === 'merchant_gateway' && (
        <div className="card" style={{ maxWidth: '800px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
              إعدادات استقبال مدفوعات عملاء المشتل أونلاين
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
              تمكين عملائك من الدفع ببطاقات مدى وأبل باي مباشرة في الكاشير والمتجر مع إيداع المبالغ في حسابك البنكي المعتمد.
            </p>
          </div>

          <form onSubmit={handleSaveMerchantSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.75rem' }}>
                بوابات وطرق الدفع المفعلة للعملاء:
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {[
                  { id: 'enable_mada', label: '💳 بطاقات مدى (Mada)', sub: 'الأكثر استخداماً في المملكة' },
                  { id: 'enable_applepay', label: '🍏 أبل باي (Apple Pay)', sub: 'دفع فوري بالبصمة' },
                  { id: 'enable_visa_mc', label: '💳 فيزا وماستر كارد (Visa/MC)', sub: 'البطاقات الائتمانية' },
                  { id: 'enable_stcpay', label: '📱 محفظة STC Pay', sub: 'الدفع برقم الجوال' }
                ].map(item => (
                  <label key={item.id} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    background: '#ffffff',
                    padding: '0.85rem',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={merchantSettings[item.id]}
                      onChange={e => setMerchantSettings({ ...merchantSettings, [item.id]: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: '#047857', marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>{item.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* API Keys */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">رقم التاجر المعتمد (Merchant ID)</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  value={merchantSettings.merchant_id}
                  onChange={e => setMerchantSettings({ ...merchantSettings, merchant_id: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">مفتاح الربط المشفر (Live Secret Key)</label>
                <input
                  type="password"
                  className="form-input font-mono"
                  value={merchantSettings.secret_key}
                  onChange={e => setMerchantSettings({ ...merchantSettings, secret_key: e.target.value })}
                />
              </div>
            </div>

            {/* الحساب البنكي للإيداع */}
            <div style={{ background: '#ecfdf5', padding: '1rem', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 800 }}>الحساب البنكي المعتمد للتحصيل التلقائي:</span>
                  <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 900, color: '#065f46', marginTop: '0.2rem' }}>
                    3165002243921500013
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#047857' }}>مصرف الراجحي - الحساب الشخصي المعتمد</div>
                </div>
                <span className="badge badge-success">موثق ونشط ✓</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="submit"
                disabled={savingSettings}
                className="btn btn-primary"
                style={{ background: '#047857', padding: '0.75rem 2rem', fontWeight: 800 }}
              >
                {savingSettings ? 'جاري الحفظ والتفعيل...' : 'حفظ إعدادات بوابات الدفع ✔️'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Interactive Checkout Modal */}
      {showCheckoutModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', overflow: 'hidden' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={20} color="#047857" />
                <h3 style={{ fontWeight: 900, fontSize: '1.15rem' }}>
                  سداد وتجديد الاشتراك السحابي
                </h3>
              </div>
              <button onClick={() => setShowCheckoutModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {paymentSuccess ? (
                /* Payment Success View */
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '2rem' }}>
                    ✓
                  </div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>
                    تمت عملية السداد بنجاح!
                  </h3>
                  <p style={{ color: '#047857', fontSize: '0.9rem', marginTop: '0.4rem', fontWeight: 700 }}>
                    تم تفعيل المنظومة وإصدار سند القبض الضريبي برقم: REC-{Date.now().toString().slice(-6)}
                  </p>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', margin: '1.25rem 0', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      <span style={{ color: '#64748b' }}>الباقة المختارة:</span>
                      <strong style={{ color: '#0f172a' }}>{plans[selectedPlan].title}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      <span style={{ color: '#64748b' }}>المبلغ المدفوع:</span>
                      <strong style={{ color: '#047857', fontFamily: 'monospace' }}>{plans[selectedPlan].price} ر.س</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b' }}>تاريخ التجديد القادم:</span>
                      <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                        {selectedPlan === 'annual' ? '2027-09-30' : '2026-10-31'}
                      </strong>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowCheckoutModal(false)}
                    className="btn btn-primary"
                    style={{ background: '#047857', width: '100%', padding: '0.85rem', fontWeight: 800 }}
                  >
                    العودة إلى لوحة التحكم
                  </button>
                </div>
              ) : otpStep ? (
                /* OTP Verification Step */
                <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ fontSize: '2.5rem' }}>📱</div>
                  <h4 style={{ fontWeight: 900, fontSize: '1.2rem', color: '#0f172a' }}>
                    التحقق عبر الرمز السري (3D Secure OTP)
                  </h4>
                  <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    تم إرسال رمز التحقق إلى جوالك المسجل في البنك. (أدخل الرمز التجريبي: <strong className="font-mono text-emerald-700">123456</strong>)
                  </p>

                  <div style={{ margin: '0 auto', width: '220px' }}>
                    <input
                      required
                      type="text"
                      maxLength="6"
                      autoFocus
                      placeholder="123456"
                      className="form-input font-mono"
                      style={{ fontSize: '1.75rem', letterSpacing: '6px', textAlign: 'center' }}
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => setOtpStep(false)}
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                    >
                      رجوع
                    </button>
                    <button
                      type="submit"
                      disabled={processingPayment}
                      className="btn btn-primary"
                      style={{ flex: 2, background: '#047857', fontWeight: 800 }}
                    >
                      {processingPayment ? 'جاري تأكيد السداد...' : 'تأكيد السداد والخصم ✓'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Payment Gateway Selection & Inputs */
                <div>
                  {/* Summary */}
                  <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{plans[selectedPlan].title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>فاتورة ضريبية إلكترونية فورية</div>
                    </div>
                    <div className="font-mono" style={{ fontSize: '1.35rem', fontWeight: 900, color: '#047857' }}>
                      {plans[selectedPlan].price} ر.س
                    </div>
                  </div>

                  {/* Payment Method Switcher */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {[
                      { id: 'mada', label: '💳 مدى' },
                      { id: 'visa', label: '💳 فيزا/ماستر' },
                      { id: 'applepay', label: '🍏 Apple Pay' },
                      { id: 'bank', label: '🏦 تحويل بنكي' }
                    ].map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGateway(g.id)}
                        style={{
                          padding: '0.6rem 0.2rem',
                          borderRadius: '8px',
                          border: selectedGateway === g.id ? '2px solid #047857' : '1px solid #cbd5e1',
                          background: selectedGateway === g.id ? '#ecfdf5' : '#ffffff',
                          color: selectedGateway === g.id ? '#047857' : '#334155',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>

                  {selectedGateway === 'bank' ? (
                    /* Bank Transfer Details */
                    <div style={{ background: '#ecfdf5', padding: '1rem', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#065f46', marginBottom: '0.5rem' }}>
                        التحويل البنكي المباشر (مصرف الراجحي):
                      </div>
                      <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>رقم الحساب الشخصي المعتمد:</div>
                          <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#047857', letterSpacing: '1px' }}>
                            3165002243921500013
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText('3165002243921500013');
                            setCopiedBank(true);
                            setTimeout(() => setCopiedBank(false), 2000);
                          }}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: '#047857', color: '#ffffff', border: 'none' }}
                        >
                          {copiedBank ? 'تم النسخ ✔️' : 'نسخ الحساب 📋'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPaymentSuccess(true)}
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1rem', background: '#047857', fontWeight: 800 }}
                      >
                        تأكيد إتمام التحويل البنكي وتفعيل الاشتراك
                      </button>
                    </div>
                  ) : (
                    /* Card Payment Form (Mada, Visa, ApplePay) */
                    <form onSubmit={handleProcessCardPayment} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {/* Virtual Card Graphic */}
                      <div style={{
                        background: selectedGateway === 'mada' 
                          ? 'linear-gradient(135deg, #008450 0%, #004d2c 100%)' 
                          : 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
                        color: '#ffffff',
                        padding: '1.25rem',
                        borderRadius: '12px',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
                        position: 'relative'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 900, fontSize: '1rem' }}>
                            {selectedGateway === 'mada' ? 'مدى Mada' : 'Visa / MasterCard'}
                          </span>
                          <span style={{ fontSize: '1.2rem' }}>🔒</span>
                        </div>
                        <div className="font-mono" style={{ fontSize: '1.25rem', letterSpacing: '3px', margin: '1.25rem 0 0.75rem', fontWeight: 800 }}>
                          {cardNumber || '•••• •••• •••• ••••'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: 0.9 }}>
                          <div>
                            <span style={{ opacity: 0.7 }}>حامل البطاقة:</span> {cardHolder}
                          </div>
                          <div>
                            <span style={{ opacity: 0.7 }}>الانتهاء:</span> {cardExpiry}
                          </div>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">رقم البطاقة (16 رقم)</label>
                        <input
                          required
                          type="text"
                          maxLength="19"
                          className="form-input font-mono"
                          value={cardNumber}
                          onChange={e => setCardNumber(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="form-label">الاسم على البطاقة</label>
                          <input
                            required
                            type="text"
                            className="form-input"
                            value={cardHolder}
                            onChange={e => setCardHolder(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">الانتهاء MM/YY</label>
                          <input
                            required
                            type="text"
                            maxLength="5"
                            className="form-input font-mono"
                            value={cardExpiry}
                            onChange={e => setCardExpiry(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">CVV</label>
                          <input
                            required
                            type="password"
                            maxLength="4"
                            className="form-input font-mono"
                            value={cardCvv}
                            onChange={e => setCardCvv(e.target.value)}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={processingPayment}
                        className="btn btn-primary"
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.85rem',
                          background: 'linear-gradient(135deg, #047857, #065f46)',
                          fontSize: '1rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        {processingPayment ? (
                          <>
                            <div className="animate-spin">⏳</div>
                            <span>جاري الاتصال الآمن مع البنك...</span>
                          </>
                        ) : (
                          <>
                            <span>🔒 إتمام الدفع الآمن ({plans[selectedPlan].price} ر.س)</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
