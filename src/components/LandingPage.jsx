import React, { useState } from 'react';
import { 
  Sprout, 
  ShieldCheck, 
  Store, 
  GitFork, 
  FileSpreadsheet, 
  Boxes, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  UserPlus, 
  LogIn, 
  Globe, 
  Sparkles,
  Building2,
  Calendar,
  Layers,
  Smartphone,
  PhoneCall
} from 'lucide-react';
import { translations } from '../i18n';
import { safeFetch } from '../api/client';
import { saveCompanyToFirebase, saveAuthUserToFirebase } from '../firebase';

export default function LandingPage({ onLoginSuccess, lang, setLang }) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register Form
  const [regForm, setRegForm] = useState({
    company_name_ar: '',
    company_name_en: '',
    owner_name: '',
    email: '',
    phone: '',
    password: '',
    cr_number: '',
    vat_number: '',
    city: 'الرياض',
    trial_days: 30
  });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  const t = translations[lang] || translations.ar;

  // تسجيل الدخول
  const handleLogin = async (e) => {
    e?.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const data = await safeFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: loginIdentifier, password: loginPassword })
      });
      if (data.success) {
        setShowLoginModal(false);
        onLoginSuccess(data);
      } else {
        setLoginError(data.error || 'فشل تسجيل الدخول، يرجى مراجعة البيانات');
      }
    } catch (err) {
      setLoginError('خطأ في الاتصال بالخدمة: ' + err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // تسجيل حساب شركة جديد
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError('');
    try {
      // 1. حفظ فوري في قاعدة بيانات فايربيز Firestore موحداً كـ "عميل/مشترك" (role: "customer") مع تفعيل "فترة تجريبية" (trialPeriod: true)
      try {
        await saveCompanyToFirebase({
          company_name_ar: regForm.company_name_ar,
          name_ar: regForm.company_name_ar,
          company_name_en: regForm.company_name_en,
          owner_name: regForm.owner_name,
          email: regForm.email,
          phone: regForm.phone,
          cr_number: regForm.cr_number,
          vat_number: regForm.vat_number,
          city: regForm.city,
          role: 'customer', // ⚡ توحيد الرتبة كـ عميل/مشترك
          trialPeriod: true, // ⚡ تفعيل الفترة التجريبية تلقائياً
          status: 'نشط ومفعل'
        });
      } catch (fbErr) {
        console.warn('Firebase Firestore saveCompany note:', fbErr);
      }

      const data = await safeFetch('/api/auth/register-tenant', {
        method: 'POST',
        body: JSON.stringify(regForm)
      });
      if (data.success) {
        setShowRegisterModal(false);
        // تسجيل الدخول تلقائياً
        onLoginSuccess(data.user, data.tenant, false);
      } else {
        setRegError(data.error || 'تعذر تسجيل المنشأة، يرجى التأكد من البيانات');
      }
    } catch (err) {
      setRegError('خطأ في الاتصال: ' + err.message);
    } finally {
      setRegLoading(false);
    }
  };

  // أزرار التعبئة السريعة لتسهيل التجربة للمستخدم
  const prefillSuperAdmin = () => {
    setLoginIdentifier('elhassanelsoudy@gmail.com');
    setLoginPassword('hassan@2016');
  };

  const prefillTenantOwner = () => {
    setLoginIdentifier('owner@al-suwayan.sa');
    setLoginPassword('hassan@2016');
  };

  const prefillCashier = () => {
    setLoginIdentifier('cashier1');
    setLoginPassword('hassan@2016');
  };

  const prefillTrialOwner = () => {
    setLoginIdentifier('sultan_owner');
    setLoginPassword('hassan@2016');
  };

  // 1. تسجيل الدخول والإنشاء عبر Google Gmail (موحد كـ customer وفترة تجريبية)
  const handleGoogleLogin = async () => {
    setLoginLoading(true);
    setLoginError('');
    try {
      const email = 'google.customer@gmail.com';
      const name = 'مشترك Google جديد';

      // ⚡ حفظ فوري في Firestore: role: "customer", trialPeriod: true
      await saveAuthUserToFirebase({
        provider: 'google',
        email,
        name,
        company_name: 'حساب عميل Google التجريبي'
      });

      const res = await safeFetch('/api/auth/google-login', {
        method: 'POST',
        body: JSON.stringify({
          google_email: email,
          google_name: name,
          company_name_ar: 'حساب عميل Google التجريبي'
        })
      });
      if (res.success) {
        setShowLoginModal(false);
        setShowRegisterModal(false);
        onLoginSuccess(res.user, res.tenant, res.isSuperAdmin);
      } else {
        setLoginError(res.error || 'فشل الدخول السريع عبر Google');
      }
    } catch (err) {
      setLoginError(`خطأ في الاتصال: ${err.message}`);
    } finally {
      setLoginLoading(false);
    }
  };

  // 2. تسجيل الدخول والإنشاء عبر Facebook (موحد كـ customer وفترة تجريبية)
  const handleFacebookLogin = async () => {
    setLoginLoading(true);
    setLoginError('');
    try {
      const email = 'facebook.customer@fb.com';
      const name = 'مشترك Facebook جديد';

      // ⚡ حفظ فوري في Firestore: role: "customer", trialPeriod: true
      await saveAuthUserToFirebase({
        provider: 'facebook',
        email,
        name,
        company_name: 'حساب عميل Facebook التجريبي'
      });

      const res = await safeFetch('/api/auth/facebook-login', {
        method: 'POST',
        body: JSON.stringify({
          facebook_email: email,
          facebook_name: name
        })
      });
      if (res.success) {
        setShowLoginModal(false);
        setShowRegisterModal(false);
        onLoginSuccess(res.user, res.tenant, res.isSuperAdmin);
      } else {
        setLoginError(res.error || 'فشل الدخول السريع عبر Facebook');
      }
    } catch (err) {
      setLoginError(`خطأ في الاتصال: ${err.message}`);
    } finally {
      setLoginLoading(false);
    }
  };

  // 3. تسجيل الدخول والإنشاء عبر رقم الهاتف (موحد كـ customer وفترة تجريبية)
  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (!phoneInput || phoneInput.trim().length < 8) {
      alert('يرجى إدخال رقم جوال صحيح');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const cleanPhone = phoneInput.trim();

      // ⚡ حفظ فوري في Firestore: role: "customer", trialPeriod: true
      await saveAuthUserToFirebase({
        provider: 'phone',
        phone: cleanPhone,
        name: `مشترك جوال (${cleanPhone})`,
        company_name: 'حساب مشترك هاتف تجريبي'
      });

      const res = await safeFetch('/api/auth/phone-login', {
        method: 'POST',
        body: JSON.stringify({ phone: cleanPhone })
      });
      if (res.success) {
        setShowPhoneModal(false);
        setShowLoginModal(false);
        setShowRegisterModal(false);
        onLoginSuccess(res.user, res.tenant, res.isSuperAdmin);
      } else {
        setLoginError(res.error || 'فشل الدخول عبر رقم الهاتف');
      }
    } catch (err) {
      setLoginError(`خطأ في الاتصال: ${err.message}`);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
      {/* Top Navbar */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '1rem 2.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(4, 120, 87, 0.35)'
          }}>
            <Sprout size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#064e3b', letterSpacing: '-0.3px', margin: 0 }}>
              {t.system_title}
            </h1>
            <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
              {t.system_subtitle}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Language Switcher */}
          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.825rem',
              color: '#334155'
            }}
          >
            <Globe size={15} />
            <span>{t.switch_lang}</span>
          </button>

          {/* Login Button */}
          <button
            onClick={() => { setShowLoginModal(true); setLoginError(''); }}
            className="btn btn-secondary"
            style={{ fontWeight: 700, padding: '0.6rem 1.25rem' }}
          >
            <LogIn size={16} />
            <span>{t.login}</span>
          </button>

          {/* Register Button */}
          <button
            onClick={() => { setShowRegisterModal(true); setRegError(''); }}
            className="btn btn-primary"
            style={{ fontWeight: 800, padding: '0.6rem 1.35rem', background: '#047857' }}
          >
            <UserPlus size={16} />
            <span>{t.register}</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        background: 'radial-gradient(circle at top right, #064e3b 0%, #047857 40%, #0f172a 100%)',
        color: '#ffffff',
        padding: '5rem 2.5rem 6rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ maxWidth: '950px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 1rem',
            borderRadius: '9999px',
            background: 'rgba(16, 185, 129, 0.25)',
            border: '1px solid rgba(110, 231, 183, 0.4)',
            color: '#a7f3d0',
            fontSize: '0.85rem',
            fontWeight: 800,
            marginBottom: '1.5rem'
          }}>
            <Sparkles size={16} />
            <span>منصة سحابية متكاملة للمشاتل والمزارع والشركات الزراعية</span>
          </div>

          <h2 style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1.25, marginBottom: '1.25rem', letterSpacing: '-0.5px' }}>
            إدارة محاسبية ومخزنية ذكية لمشاتلك وفروعك من أي مكان
          </h2>

          <p style={{ fontSize: '1.15rem', color: '#cbd5e1', lineHeight: 1.7, maxWidth: '750px', margin: '0 auto 2.5rem' }}>
            نظام متكامل يجمع بين تكويد أصناف الشتلات والأشجار والأسمدة، نقاط البيع السريعة للكاشيرات مع خصم المخزون اللحظي، شجرة حسابات مرنة، الجرد السنوي الآلي، والربط والامتثال المعتمد مع هيئة الزكاة والضريبة والجمارك (ZATCA 2).
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setShowRegisterModal(true); setRegError(''); }}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '0.9rem 2.25rem',
                borderRadius: '12px',
                fontSize: '1.05rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span>ابدأ تجربتك المجانية للشركات الآن</span>
              <ArrowRight size={18} />
            </button>

            <button
              onClick={() => { setShowLoginModal(true); setLoginError(''); }}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                padding: '0.9rem 2rem',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)'
              }}
            >
              تسجيل الدخول للمنظومة
            </button>
          </div>
        </div>
      </section>

      {/* Feature Pillars Grid */}
      <section style={{ padding: '4.5rem 2.5rem', maxWidth: '1350px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h3 style={{ fontSize: '2rem', fontWeight: 900, color: '#064e3b', marginBottom: '0.75rem' }}>
            حلول برمجية متخصصة صُممت لقطاع المشاتل والتجارة الزراعية
          </h3>
          <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '650px', margin: '0 auto' }}>
            بنية معمارية سحابية تتيح عزل بيانات كل شركة مع الحفاظ على مرونة الربط والتحكم المحاسبي المركزي.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          {/* Feature 1 */}
          <div className="card" style={{ padding: '2rem', borderTop: '4px solid #047857' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Store size={26} />
            </div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              نقاط بيع سريعة للكاشيرات (Fast POS)
            </h4>
            <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>
              لوحة لمسية مخصصة للكاشير، تدعم شتلات الزهور والأشجار والأسمدة، التبديل بين أسعار التجزئة والجملة، الخصم اللحظي من المستودع، وإصدار الفواتير فوراً.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="card" style={{ padding: '2rem', borderTop: '4px solid #10b981' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Boxes size={26} />
            </div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              الجرد السنوي التلقائي للمشاتل
            </h4>
            <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>
              مطابقة الكميات الدفترية مع الكميات الفعلية المحصورة في المشتل، حساب فروقات العجز والتوالف أو الفائض، وتوليد قيود التسوية المحاسبية تلقائياً.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="card" style={{ padding: '2rem', borderTop: '4px solid #0284c7' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <GitFork size={26} />
            </div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              شجرة حسابات ومحرك قيود آلي
            </h4>
            <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>
              توليد القيود المزدوجة فوراً بدون تدخل بشري عند كل عملية بيع كاشير أو شراء أو مصروف، مع ربط كل حركة بمركز تكلفة الفرع والمستودع.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="card" style={{ padding: '2rem', borderTop: '4px solid #d97706' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <ShieldCheck size={26} />
            </div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              الربط والتكامل ZATCA 2
            </h4>
            <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>
              توليد ملفات XML UBL 2.1 ورمز الاستجابة السريع المشفر TLV والتوقيع الرقمي مع خيار التفعيل الاختياري لكل شركة مشتركة.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="card" style={{ padding: '2rem', borderTop: '4px solid #9333ea' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#f3e8ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Building2 size={26} />
            </div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              منصة سحابية متعددة الشركات (Multi-Tenancy)
            </h4>
            <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>
              عزل تام لبيانات كل شركة مشتركة، مع تحكم مطلق للمسؤول في تحديد الفترات التجريبية وتفعيل أو قفل اشتراكات الشركات.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="card" style={{ padding: '2rem', borderTop: '4px solid #be123c' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#ffe4e6', color: '#be123c', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <FileSpreadsheet size={26} />
            </div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              القوائم والتقارير المالية الفورية
            </h4>
            <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>
              ميزان مراجعة متطابق 100%، قائمة الدخل (P&L)، الميزانية العمومية، كشوف حسابات العملاء والموردين، ونموذج إقرار الضريبة الجاهز.
            </p>
          </div>
        </div>
      </section>

      {/* Subscription Plans Section */}
      <section style={{ background: '#f1f5f9', padding: '4.5rem 2.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '2rem', fontWeight: 900, color: '#064e3b', marginBottom: '0.5rem' }}>
            باقات الاشتراك السحابية المرنة
          </h3>
          <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '3rem' }}>
            فترة تجريبية مجانية لكل شركة جديدة مع تحكم كامل في الفروع والكاشيرات
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {/* Plan 1 */}
            <div className="card" style={{ padding: '2rem', textAlign: 'right' }}>
              <h4 style={{ fontWeight: 800, fontSize: '1.25rem' }}>باقة المشتل الفردي</h4>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#047857', margin: '1rem 0 0.5rem' }} className="font-mono">
                199 <span style={{ fontSize: '0.9rem' }}>ر.س / شهرياً</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.5rem' }}>مناسبة للمشاتل الفردية ومعارض الزينة</p>
              <ul style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '2rem' }}>
                <li>✓ فرع واحد ومستودع مستقل</li>
                <li>✓ نقطة بيع كاشير واحدة</li>
                <li>✓ إدارة شتلات ومخزون زراعي</li>
                <li>✓ قيود محاسبية تلقائية</li>
              </ul>
              <button onClick={() => { setShowRegisterModal(true); setRegError(''); }} className="btn btn-secondary" style={{ width: '100%', fontWeight: 700 }}>
                بدء تجربة 30 يوماً
              </button>
            </div>

            {/* Plan 2 - Featured */}
            <div className="card" style={{ padding: '2rem', textAlign: 'right', border: '2px solid #047857', position: 'relative', boxShadow: '0 10px 25px -5px rgba(4, 120, 87, 0.2)' }}>
              <div style={{ position: 'absolute', top: '-14px', right: '2rem', background: '#047857', color: '#ffffff', padding: '0.2rem 0.8rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 800 }}>
                الأكثر طلباً للمشاتل
              </div>
              <h4 style={{ fontWeight: 800, fontSize: '1.25rem' }}>باقة المشاتل المتعددة (Pro)</h4>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#047857', margin: '1rem 0 0.5rem' }} className="font-mono">
                399 <span style={{ fontSize: '0.9rem' }}>ر.س / شهرياً</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.5rem' }}>للشركات ذات الفروع والمستودعات المتعددة</p>
              <ul style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '2rem' }}>
                <li>✓ فروع ومستودعات غير محدودة</li>
                <li>✓ كاشيرات متعددة بكلمات سر وصلاحيات مستقلة</li>
                <li>✓ تكويد أسعار التجزئة والجملة</li>
                <li>✓ نظام الجرد السنوي الذكي للمشاتل</li>
                <li>✓ ربط واختيار ZATCA 2 للفوترة الإلكترونية</li>
              </ul>
              <button onClick={() => { setShowRegisterModal(true); setRegError(''); }} className="btn btn-primary" style={{ width: '100%', fontWeight: 800, background: '#047857' }}>
                بدء تجربة 30 يوماً
              </button>
            </div>

            {/* Plan 3 */}
            <div className="card" style={{ padding: '2rem', textAlign: 'right' }}>
              <h4 style={{ fontWeight: 800, fontSize: '1.25rem' }}>باقة كبرى المزارع (Enterprise)</h4>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#0f172a', margin: '1rem 0 0.5rem' }} className="font-mono">
                799 <span style={{ fontSize: '0.9rem' }}>ر.س / شهرياً</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.5rem' }}>للمشاريع والمؤسسات الزراعية الكبرى</p>
              <ul style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '2rem' }}>
                <li>✓ كافة ميزات باقة Pro الزراعية</li>
                <li>✓ دعم فني مخصص وربط شبكات ري</li>
                <li>✓ تقارير مالية وتحليل هوامش أرباح الشتلات</li>
                <li>✓ مسيرات رواتب العمال والمهندسين</li>
              </ul>
              <button onClick={() => { setShowRegisterModal(true); setRegError(''); }} className="btn btn-secondary" style={{ width: '100%', fontWeight: 700 }}>
                طلب الباقة وتجربتها
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#064e3b', color: '#ffffff', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <Sprout size={22} style={{ color: '#6ee7b7' }} />
          <span style={{ fontSize: '1.15rem', fontWeight: 900 }}>منظومة الصويان السحابية</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#a7f3d0' }}>
          جميع الحقوق محفوظة لمنظومة الصويان السحابية © {new Date().getFullYear()} • المنصة السحابية الزراعية والمحاسبية المعتمدة
        </p>
      </footer>

      {/* ===================== Login Modal ===================== */}
      {showLoginModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LogIn size={20} style={{ color: '#047857' }} />
                <h3 style={{ fontWeight: 800, fontSize: '1.15rem' }}>تسجيل الدخول إلى منظومة الصويان</h3>
              </div>
              <button onClick={() => setShowLoginModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleLogin}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                {loginError && (
                  <div style={{ background: '#ffe4e6', color: '#be123c', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
                    {loginError}
                  </div>
                )}

                {/* Quick pre-fill shortcuts */}
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem' }}>
                    ⚡ تسجيل دخول تجريبي سريع بنقرة واحدة:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <button type="button" onClick={prefillSuperAdmin} style={{ fontSize: '0.725rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontWeight: 700, cursor: 'pointer' }}>
                      👑 المسؤول المطلق (elhassanelsoudy)
                    </button>
                    <button type="button" onClick={prefillTenantOwner} style={{ fontSize: '0.725rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: '#e0f2fe', border: '1px solid #bae6fd', color: '#0369a1', fontWeight: 700, cursor: 'pointer' }}>
                      🏢 مالك شركة الصويان
                    </button>
                    <button type="button" onClick={prefillCashier} style={{ fontSize: '0.725rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', fontWeight: 700, cursor: 'pointer' }}>
                      🛒 كاشير صالة الرياض (cashier1)
                    </button>
                    <button type="button" onClick={prefillTrialOwner} style={{ fontSize: '0.725rem', padding: '0.3rem 0.6rem', borderRadius: '6px', background: '#f3e8ff', border: '1px solid #d8b4fe', color: '#6b21a8', fontWeight: 700, cursor: 'pointer' }}>
                      ⏳ شركة تجريبية (sultan_owner)
                    </button>
                  </div>
                </div>

                {/* Unified Social & Phone Authentication Buttons (Role: customer, trialPeriod: true) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>⚡ تسجيل فوري وموحد كـ (عميل/مشترك) بفترة تجريبية مجانية:</span>
                  </div>

                  {/* 1. Google Gmail */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loginLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.65rem',
                      width: '100%',
                      padding: '0.65rem',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>الدخول بحساب Google (Gmail)</span>
                  </button>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {/* 2. Facebook */}
                    <button
                      type="button"
                      onClick={handleFacebookLogin}
                      disabled={loginLoading}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        padding: '0.65rem',
                        borderRadius: '10px',
                        border: '1px solid #93c5fd',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <span>حساب Facebook</span>
                    </button>

                    {/* 3. Phone */}
                    <button
                      type="button"
                      onClick={() => setShowPhoneModal(true)}
                      disabled={loginLoading}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        padding: '0.65rem',
                        borderRadius: '10px',
                        border: '1px solid #a7f3d0',
                        background: '#ecfdf5',
                        color: '#065f46',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }}
                    >
                      <Smartphone size={16} style={{ color: '#047857' }} />
                      <span>رقم الهاتف الجوال</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.75rem', margin: '0.2rem 0' }}>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                  <span>أو الدخول اليدوي ببيانات الحساب</span>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                </div>

                <div className="form-group">
                  <label className="form-label">البريد الإلكتروني أو اسم المستخدم</label>
                  <input
                    required
                    type="text"
                    placeholder="مثال: elhassanelsoudy@gmail.com أو cashier1"
                    className="form-input"
                    value={loginIdentifier}
                    onChange={e => setLoginIdentifier(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">كلمة المرور</label>
                  <input
                    required
                    type="password"
                    placeholder="••••••••"
                    className="form-input font-mono"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowLoginModal(false)} className="btn btn-secondary">إلغاء</button>
                <button type="submit" disabled={loginLoading} className="btn btn-primary" style={{ background: '#047857' }}>
                  {loginLoading ? 'جاري التحقق...' : 'تسجيل الدخول'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== Register Modal ===================== */}
      {showRegisterModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={20} style={{ color: '#047857' }} />
                <h3 style={{ fontWeight: 800, fontSize: '1.15rem' }}>إنشاء حساب شركة ومشترك جديد</h3>
              </div>
              <button onClick={() => setShowRegisterModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleRegister}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {regError && (
                  <div style={{ background: '#ffe4e6', color: '#be123c', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                    {regError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">اسم الشركة / المشتل (عربي)</label>
                    <input required type="text" placeholder="مثال: مشاتل الرياض الخضراء" className="form-input" value={regForm.company_name_ar} onChange={e => setRegForm({ ...regForm, company_name_ar: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">المدينة</label>
                    <input required type="text" placeholder="الرياض / جدة / القصيم" className="form-input" value={regForm.city} onChange={e => setRegForm({ ...regForm, city: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">اسم مالك أو مدير المنشأة</label>
                    <input required type="text" placeholder="مثال: عبدالرحمن السبيعي" className="form-input" value={regForm.owner_name} onChange={e => setRegForm({ ...regForm, owner_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">رقم الجوال</label>
                    <input type="text" placeholder="05xxxxxxxx" className="form-input font-mono" value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">البريد الإلكتروني (لتسجيل الدخول)</label>
                    <input required type="email" placeholder="owner@nursery.sa" className="form-input font-mono" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">كلمة المرور للحساب</label>
                    <input required type="password" placeholder="••••••••" className="form-input font-mono" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">السجل التجاري (اختياري)</label>
                    <input type="text" placeholder="1010xxxxxx" className="form-input font-mono" value={regForm.cr_number} onChange={e => setRegForm({ ...regForm, cr_number: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">الرقم الضريبي (ZATCA - 15 رقم)</label>
                    <input type="text" placeholder="310000000000003" className="form-input font-mono" value={regForm.vat_number} onChange={e => setRegForm({ ...regForm, vat_number: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowRegisterModal(false)} className="btn btn-secondary">إلغاء</button>
                <button type="submit" disabled={regLoading} className="btn btn-primary" style={{ background: '#047857' }}>
                  {regLoading ? 'جاري تأسيس المنشأة...' : 'تأكيد التسجيل وبدء الفترة التجريبية'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== Phone Auth Modal (Role: Customer, trialPeriod: true) ===================== */}
      {showPhoneModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="modal-content" style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
              padding: '1.25rem 1.5rem',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Smartphone size={22} style={{ color: '#a7f3d0' }} />
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                    الدخول / التسجيل برقم الجوال
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#d1fae5', margin: '0.2rem 0 0 0' }}>
                    تسجيل تلقائي كـ (عميل/مشترك) مع تفعيل الفترة التجريبية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPhoneModal(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePhoneSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '10px',
                padding: '0.75rem',
                fontSize: '0.8rem',
                color: '#065f46'
              }}>
                🔒 أمان موحد: يتم إنشاء حسابك كـ <strong>عميل/مشترك (Customer)</strong> وتفعيل اشتراك تجريبي مجاني 14 يوماً فورياً في Firebase Firestore.
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>رقم الجوال (السعودية / دولي)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    required
                    type="tel"
                    placeholder="05xxxxxxxx أو +9665xxxxxxxx"
                    className="form-input font-mono"
                    style={{ width: '100%', fontSize: '1rem', padding: '0.6rem 0.85rem', textAlign: 'left', direction: 'ltr' }}
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPhoneModal(false)}
                  className="btn btn-secondary"
                  disabled={loginLoading}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="btn btn-primary"
                  style={{ background: '#047857', padding: '0.6rem 1.25rem', fontWeight: 800 }}
                >
                  {loginLoading ? 'جاري التحقق والتسجيل...' : 'دخول ومتابعة الحساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
