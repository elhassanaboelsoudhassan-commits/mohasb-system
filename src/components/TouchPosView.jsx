import React, { useState, useEffect, useMemo } from 'react';
import { safeFetch, LocalSaaSStorage } from '../api/client';
import PrintableInvoiceModal from './PrintableInvoiceModal';
import CashierShiftsModal from './CashierShiftsModal';
import CashierMySalesModal from './CashierMySalesModal';

export default function TouchPosView({ activeTenant, activeBranch, currentUser, onInvoiceCreated }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // cash, card, mada
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryData, setDeliveryData] = useState({
    recipient_name: '',
    recipient_phone: '',
    shipping_address: '',
    courier_name: 'سيارة المشتل الخاصة (Nursery Van)'
  });
  const [processing, setProcessing] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showMySalesModal, setShowMySalesModal] = useState(false);

  // صلاحيات الكاشير من الإدارة
  const [cashierPermissions, setCashierPermissions] = useState(() => {
    try {
      return LocalSaaSStorage.getCashierPermissions();
    } catch {
      return {
        allow_discount: true,
        max_discount_percent: 15,
        allow_delete_items: true,
        allow_price_override: false,
        allow_credit_sales: true,
        supervisor_pin: '1234'
      };
    }
  });

  useEffect(() => {
    safeFetch('/api/cashier-permissions').then(res => {
      if (res && res.success && res.data) {
        setCashierPermissions(res.data);
      }
    }).catch(() => {});
  }, []);

  // إدارة ورديات الكاشير وجرد الصندوق
  const [currentShift, setCurrentShift] = useState(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [loadingShift, setLoadingShift] = useState(false);

  // إدارة العملاء وبيانات الاتصال والضريبة
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', vat_number: '', address: '' });
  const [isAddingNewCust, setIsAddingNewCust] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);

  const categories = [
    { id: 'ALL', name_ar: '🌱 كافة الأصناف', name_en: 'All Items' },
    { id: 'TREES', name_ar: '🌳 أشجار وظل', name_en: 'Trees & Shade' },
    { id: 'INDOOR', name_ar: '🪴 نباتات داخلية', name_en: 'Indoor Plants' },
    { id: 'FERT', name_ar: '🧪 أسمدة ومخصبات', name_en: 'Fertilizers' },
    { id: 'IRRIG', name_ar: '💧 شبكات ري', name_en: 'Irrigation' }
  ];

  const defaultProducts = [
    { id: 101, code: 'PLT-001', name_ar: 'شتلة بيتونيا هجين فرنسي', name_en: 'Petunia Hybrid', category: 'INDOOR', price: 15.00, stock: 450, icon: '🌸' },
    { id: 102, code: 'PLT-002', name_ar: 'شجرة بونسيانا ملكية ظل', name_en: 'Royal Poinciana Tree', category: 'TREES', price: 180.00, stock: 65, icon: '🌳' },
    { id: 103, code: 'PLT-003', name_ar: 'شجرة نيم هندي طارد حشرات', name_en: 'Neem Tree Large', category: 'TREES', price: 65.00, stock: 120, icon: '🌿' },
    { id: 104, code: 'PLT-004', name_ar: 'نبتة زاميا داخلية فاخرة', name_en: 'Zamioculcas (ZZ)', category: 'INDOOR', price: 110.00, stock: 40, icon: '🪴' },
    { id: 105, code: 'PLT-005', name_ar: 'ألوفيرا طبية أصيص فخار', name_en: 'Aloe Vera Ceramic', category: 'INDOOR', price: 35.00, stock: 90, icon: '🌵' },
    { id: 106, code: 'FERT-01', name_ar: 'سماد NPK هولندي متوازن 20-20-20 (1كجم)', name_en: 'Dutch NPK Fertilizer 1kg', category: 'FERT', price: 45.00, stock: 150, icon: '🧪' },
    { id: 107, code: 'FERT-02', name_ar: 'بيتموس ألماني ممتاز 70 لتر', name_en: 'German Peat Moss 70L', category: 'FERT', price: 85.00, stock: 80, icon: '🌾' },
    { id: 108, code: 'IRR-01', name_ar: 'مؤقت ري ذكي ديجيتال أوتوماتيك', name_en: 'Digital Irrigation Timer', category: 'IRRIG', price: 165.00, stock: 25, icon: '⏱️' },
    { id: 109, code: 'IRR-02', name_ar: 'لي تنقيط زراعي 16 ملم (لفة 100م)', name_en: 'Drip Hose 16mm (100m)', category: 'IRRIG', price: 120.00, stock: 35, icon: '💧' },
    { id: 110, code: 'PLT-006', name_ar: 'شتلة ياسمين عراقي متسلق عطري', name_en: 'Climbing Jasmine', category: 'INDOOR', price: 40.00, stock: 85, icon: '🌺' },
    { id: 111, code: 'PLT-007', name_ar: 'أكاسيا جلوكا ذهبية مزهرة', name_en: 'Acacia Glauca Gold', category: 'TREES', price: 95.00, stock: 55, icon: '🌼' },
    { id: 112, code: 'FERT-03', name_ar: 'هيوميك أسيد معالج تربة سائل (1 لتر)', name_en: 'Liquid Humic Acid 1L', category: 'FERT', price: 55.00, stock: 70, icon: '🧪' }
  ];

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    fetchCurrentShift();
  }, []);

  const fetchCurrentShift = async () => {
    try {
      setLoadingShift(true);
      const res = await safeFetch('/api/pos/shifts/current');
      if (res && res.success) {
        setCurrentShift(res.data);
      }
    } catch (e) {
      console.error('Error fetching current shift:', e);
    } finally {
      setLoadingShift(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await safeFetch('/api/customers');
      if (res.success && res.data) {
        setCustomers(res.data);
      }
    } catch (e) {
      console.error('Error fetching customers:', e);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await safeFetch('/api/inventory/products');
      if (res.success && res.data && res.data.length > 0) {
        // دمجه مع التصنيفات وعلامات الأصناف المركزية
        const enriched = res.data.map((p, idx) => ({
          ...p,
          price: Number(p.sale_price || p.price || p.retail_price || 50),
          stock: p.stock !== undefined ? p.stock : (p.quantity || 100),
          category: p.category || (idx % 4 === 0 ? 'TREES' : idx % 3 === 0 ? 'FERT' : idx % 2 === 0 ? 'IRRIG' : 'INDOOR'),
          icon: p.category === 'TREES' ? '🌳' : p.category === 'FERT' ? '🧪' : p.category === 'IRRIG' ? '💧' : '🌱',
          is_central: p.is_central === 1 || p.is_central === true,
          image_url: p.image_url
        }));
        setProducts(enriched);
      } else {
        setProducts(defaultProducts);
      }
    } catch (err) {
      setProducts(defaultProducts);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = activeCategory === 'ALL' || p.category === activeCategory;
      const matchSearch = !searchQuery || 
        (p.name_ar && p.name_ar.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.name_en && p.name_en.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [products, activeCategory, searchQuery]);

  const addToCart = (product) => {
    if (product.stock <= 0) {
      alert('⚠️ هذا الصنف نافد من المخزون حالياً!');
      return;
    }
    setCart(prev => {
      const exist = prev.find(item => item.id === product.id);
      if (exist) {
        if (exist.qty >= product.stock) {
          alert('⚠️ لا يتوفر رصيد إضافي في المخزن لتجاوز الكمية الحالية!');
          return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const verifySupervisorPin = () => {
    const isRestricted = currentUser?.role === 'cashier' || (!currentUser?.role?.includes('admin'));
    if (!cashierPermissions.allow_delete_items && isRestricted) {
      const pin = window.prompt('🔒 تنبيه: حذف الأصناف مقيد. يرجى إدخال الرقم السري للمشرف للمتابعة:');
      if (!pin || pin.trim() !== String(cashierPermissions.supervisor_pin || '1234').trim()) {
        alert('❌ الرقم السري للمشرف غير صحيح! تم إلغاء عملية الحذف.');
        return false;
      }
    }
    return true;
  };

  const updateQty = (id, delta) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (item && item.qty + delta <= 0) {
        if (!verifySupervisorPin()) return prev;
      }
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.qty + delta;
          if (newQty <= 0) return null;
          if (newQty > item.stock) {
            alert('⚠️ الكمية المطلوبة تتجاوز رصيد المستودع!');
            return item;
          }
          return { ...item, qty: newQty };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeFromCart = (id) => {
    if (!verifySupervisorPin()) return;
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (!verifySupervisorPin()) return;
    if (window.confirm('هل أنت متأكد من تفريغ السلة؟')) {
      setCart([]);
      setDiscountPercent(0);
      setIsDelivery(false);
    }
  };

  // الحسابات المالية
  const rawSubtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discountAmount = Number(((rawSubtotal * discountPercent) / 100).toFixed(2));
  const taxableAmount = Math.max(0, rawSubtotal - discountAmount);
  const vatAmount = Number((taxableAmount * 0.15).toFixed(2));
  const deliveryFee = isDelivery ? 25.00 : 0.00;
  const grandTotal = Number((taxableAmount + vatAmount + deliveryFee).toFixed(2));

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerForm.name) {
      alert('⚠️ يرجى إدخال اسم العميل');
      return;
    }
    setSavingCustomer(true);
    try {
      const res = await safeFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify(newCustomerForm)
      });
      if (res.success && res.data) {
        setCustomers(prev => [res.data, ...prev]);
        setSelectedCustomer(res.data);
        setShowCustomerModal(false);
        setNewCustomerForm({ name: '', phone: '', vat_number: '', address: '' });
        setIsAddingNewCust(false);
      } else {
        alert(res.error || 'فشل حفظ بيانات العميل');
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('⚠️ السلة فارغة! يرجى اختيار أصناف أولاً.');
      return;
    }

    if (isDelivery && (!deliveryData.recipient_name || !deliveryData.recipient_phone || !deliveryData.shipping_address)) {
      alert('⚠️ يرجى استكمال بيانات الشحن والتوصيل (الاسم، الهاتف، العنوان)!');
      return;
    }

    setProcessing(true);
    try {
      const bankAccountUsed = (paymentMethod === 'bank' || paymentMethod === 'transfer')
        ? (activeTenant?.bank_account || '3165002243921500013')
        : null;

      const payload = {
        branch_id: activeBranch?.id || 1,
        shift_id: currentShift?.id || null,
        payment_method: paymentMethod,
        discount_amount: discountAmount,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || 'عميل نقدي صالة العرض',
        customer_phone: selectedCustomer?.phone || '',
        customer_vat: selectedCustomer?.vat_number || '',
        bank_account_used: bankAccountUsed,
        notes: isDelivery ? `طلب شحن عبر: ${deliveryData.courier_name}` : 'بيع كاشير مباشر من صالة العرض',
        items: cart.map(item => ({
          product_id: item.id,
          name: item.name_ar,
          quantity: item.qty,
          unit_price: item.price
        }))
      };

      const res = await safeFetch('/api/invoices/pos-checkout', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        // إذا كان طلب توصيل، نسجل أمر الشحن في جدول التوصيل
        if (isDelivery) {
          await safeFetch('/api/delivery/orders', {
            method: 'POST',
            body: JSON.stringify({
              invoice_id: res.data?.id || Date.now(),
              courier_name: deliveryData.courier_name,
              recipient_name: deliveryData.recipient_name || selectedCustomer?.name,
              recipient_phone: deliveryData.recipient_phone || selectedCustomer?.phone,
              shipping_address: deliveryData.shipping_address,
              delivery_fee: deliveryFee,
              notes: 'تم الإنشاء تلقائياً عبر نقطة البيع السريعة'
            })
          });
        }

        // إشعار نجاح وتحديث الكميات محلياً
        setProducts(prev => prev.map(p => {
          const inCart = cart.find(c => c.id === p.id);
          if (inCart) {
            return { ...p, stock: Math.max(0, p.stock - inCart.qty) };
          }
          return p;
        }));

        const invoiceInfo = res.data || {
          invoice_number: res.invoiceNumber || `INV-POS-${Date.now().toString().slice(-4)}`,
          grand_total: grandTotal,
          subtotal: taxableAmount,
          vat_total: vatAmount,
          customer_name: selectedCustomer?.name,
          customer_phone: selectedCustomer?.phone,
          customer_vat: selectedCustomer?.vat_number,
          payment_method: paymentMethod,
          bank_account_used: bankAccountUsed,
          zatca_qr: res.zatcaQr || res.data?.zatca_qr,
          zatca_xml: res.zatcaXml || res.data?.zatca_xml,
          zatca_hash: res.zatcaHash || res.data?.zatca_hash,
          cryptographic_stamp: res.cryptographicStamp || res.data?.cryptographic_stamp,
          issue_date: new Date().toISOString().split('T')[0],
          issue_time: new Date().toLocaleTimeString('ar-SA'),
          items: cart.map(i => ({
            name: i.name_ar,
            quantity: i.qty,
            unit_price: i.price,
            line_total: (i.qty * i.price * 1.15).toFixed(2)
          }))
        };

        setCompletedInvoice(invoiceInfo);
        setShowInvoiceModal(true);
        setCart([]);
        setDiscountPercent(0);
        setIsDelivery(false);
        fetchCurrentShift();
        if (onInvoiceCreated) onInvoiceCreated(invoiceInfo);
      } else {
        alert(`فشل إتمام البيع: ${res.error || 'خطأ غير متوقع'}`);
      }
    } catch (err) {
      alert(`حدث خطأ أثناء الاتصال: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] gap-3 p-2 bg-slate-900 overflow-hidden select-none">
      {/* 1. قسم المنتجات واللمس السريع (Touch Grid) */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-800/80 rounded-2xl border border-slate-700/70 p-3 shadow-xl backdrop-blur-sm overflow-hidden">
        {/* شريط إدارة وردية الكاشير وجرد الخزينة (Cashier Shift Bar) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 mb-2.5 bg-gradient-to-r from-slate-900 via-emerald-950/50 to-slate-900 rounded-xl border border-emerald-600/30 text-xs">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${currentShift?.status === 'open' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`} />
            {currentShift?.status === 'open' ? (
              <div className="flex items-center gap-2 flex-wrap text-slate-200">
                <span className="font-bold text-emerald-400">الوردية الحالية مفتوحة:</span>
                <span className="font-mono bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded border border-emerald-700/50">{currentShift.shift_number}</span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-300">الكاشير: <strong className="text-white">{currentShift.cashier_name || currentUser?.name || 'الكاشير الحالي'}</strong></span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-300">مبيعات الوردية: <strong className="text-emerald-300 font-mono">{Number(currentShift.total_sales || 0).toFixed(2)} ر.س</strong></span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-300">
                <span className="font-bold">⚠️ تنبيه الورديات:</span>
                <span>لا توجد وردية كاشير مفتوحة حالياً لهذا الفرع. يمكنك فتح وردية جديدة لبدء الجرد والمبيعات.</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowShiftModal(true)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow ${
                currentShift?.status === 'open'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <span>{currentShift?.status === 'open' ? '🔒 إغلاق وجرد الصندوق (Z-Report)' : '🔓 فتح وردية جديدة'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowShiftModal(true)}
              className="px-2.5 py-1.5 rounded-lg font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
              title="عرض سجل وتقارير الورديات السابقة"
            >
              📜 سجل الورديات
            </button>
            <button
              type="button"
              onClick={() => setShowMySalesModal(true)}
              className="px-2.5 py-1.5 rounded-lg font-bold text-xs bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 transition-all flex items-center gap-1"
              title="استعراض مبيعاتي وفواتيري الشخصية بالتواريخ"
            >
              <span>📊 مبيعاتي بالتواريخ</span>
            </button>
          </div>
        </div>

        {/* شريط البحث وتصنيفات اللمس */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pb-3 border-b border-slate-700/60">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-emerald-400 text-lg">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، الباركود، أو الرمز الزراعي..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-900/90 text-white rounded-xl border border-emerald-600/40 focus:border-emerald-500 focus:outline-none text-sm placeholder-slate-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* تصنيفات اللمس الكبيرة */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 ${
                  activeCategory === cat.id
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/40 scale-105'
                    : 'bg-slate-700/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/40'
                }`}
              >
                <span>{cat.name_ar}</span>
              </button>
            ))}
          </div>
        </div>

        {/* شبكة بطاقات المنتجات (Touch Cards) */}
        <div className="flex-1 overflow-y-auto pt-3 pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 auto-rows-max">
          {loading ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p>جاري تحميل الكتالوج الزراعي السريع...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
              <span className="text-4xl mb-2">🌿</span>
              <p className="text-base font-medium">لا توجد أصناف مطابقة لهذا البحث</p>
            </div>
          ) : (
            filteredProducts.map(prod => {
              const inCartItem = cart.find(c => c.id === prod.id);
              const isOutOfStock = prod.stock <= 0;

              return (
                <div
                  key={prod.id}
                  onClick={() => !isOutOfStock && addToCart(prod)}
                  className={`group relative flex flex-col justify-between p-3 rounded-2xl border transition-all duration-200 select-none cursor-pointer active:scale-95 ${
                    isOutOfStock
                      ? 'bg-slate-800/40 border-slate-700/40 opacity-50 cursor-not-allowed'
                      : inCartItem
                      ? 'bg-gradient-to-b from-emerald-950/60 to-slate-800/90 border-emerald-500 shadow-md shadow-emerald-900/20'
                      : 'bg-slate-800/90 hover:bg-slate-750 border-slate-700/80 hover:border-emerald-500/60 hover:shadow-lg'
                  }`}
                >
                  {/* شارة الكمية في السلة */}
                  {inCartItem && (
                    <span className="absolute -top-2 -right-2 bg-emerald-500 text-slate-950 font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900">
                      {inCartItem.qty}
                    </span>
                  )}

                  {/* رأس البطاقة والأيقونة / الصورة */}
                  <div className="flex items-start justify-between gap-1 mb-1">
                    {prod.image_url ? (
                      <img
                        src={prod.image_url}
                        alt=""
                        className="w-9 h-9 rounded-xl object-cover border border-slate-700"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-2xl sm:text-3xl p-1 bg-slate-900/60 rounded-xl">
                        {prod.icon || '🌱'}
                      </span>
                    )}

                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        prod.stock > 20 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50' :
                        prod.stock > 0 ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50' :
                        'bg-rose-950/80 text-rose-300 border border-rose-800/50'
                      }`}>
                        {prod.stock > 0 ? `${prod.stock} متوفر` : 'نفد'}
                      </span>
                      {prod.is_central && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-bold">
                          🌐 سحابي
                        </span>
                      )}
                    </div>
                  </div>

                  {/* اسم الصنف */}
                  <div className="my-1">
                    <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-emerald-300">
                      {prod.name_ar}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{prod.code || prod.barcode || prod.sku}</p>
                  </div>

                  {/* السعر وزر الإضافة */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-700/50 mt-1">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-sm sm:text-base font-black text-emerald-400">
                        {prod.price.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400">ر.س</span>
                    </div>
                    <button
                      type="button"
                      disabled={isOutOfStock}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                        isOutOfStock
                          ? 'bg-slate-700 text-slate-500'
                          : 'bg-emerald-600 group-hover:bg-emerald-500 text-white shadow'
                      }`}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* شريط السلة العائم السريع للهواتف والأجهزة اللمسية الصغيرة */}
        <div className="lg:hidden mt-2 pt-2 border-t border-slate-700/60">
          <button
            type="button"
            onClick={() => setShowMobileCart(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm flex items-center justify-between shadow-lg shadow-emerald-950 active:scale-98"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🛒</span>
              <span>عرض السلة ({cart.length} أصناف)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black">{grandTotal.toFixed(2)} ر.س</span>
              <span className="bg-emerald-800/80 px-2 py-0.5 rounded text-xs">إتمام الدفع 👈</span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. سلة المشتريات ومحرك الدفع واللمس (Touch Cart & Checkout) */}
      <div className={`w-full lg:w-96 flex flex-col bg-slate-800/95 rounded-2xl border border-slate-700/70 p-3 shadow-2xl backdrop-blur-md transition-all ${
        showMobileCart 
          ? 'fixed inset-2 z-50 overflow-y-auto lg:static' 
          : 'hidden lg:flex'
      }`}>
        {/* عنوان السلة وزر التفريغ */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/70">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛒</span>
            <div>
              <h3 className="text-sm font-black text-white">سلة الكاشير التفاعلية</h3>
              <p className="text-[10px] text-emerald-400">{cart.length} أصناف مختارة</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 bg-rose-950/40 rounded-lg border border-rose-900/40 transition-colors"
              >
                تفريغ 🗑️
              </button>
            )}
            {/* زر إغلاق السلة والعودة للأصناف على الموبايل */}
            <button
              type="button"
              onClick={() => setShowMobileCart(false)}
              className="lg:hidden text-xs text-slate-300 hover:text-white px-2 py-1 bg-slate-700 rounded-lg border border-slate-600"
            >
              ✕ رجوع للأصناف
            </button>
          </div>
        </div>

        {/* اختيار العميل السريع */}
        <div className="py-2 border-b border-slate-700/70">
          <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-xl border border-slate-700/80">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base text-emerald-400">👤</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {selectedCustomer ? selectedCustomer.name : 'عميل نقدي (صالة العرض)'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {selectedCustomer ? (selectedCustomer.phone || selectedCustomer.vat_number || 'عميل مسجل') : 'اضغط لتحديد عميل أو إضافة جديد'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="text-[10px] text-rose-400 hover:text-rose-300 px-1.5 py-0.5 rounded bg-rose-950/40 border border-rose-900/40"
                  title="إلغاء تحديد العميل"
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCustomerSearch('');
                  setIsAddingNewCust(false);
                  setShowCustomerModal(true);
                }}
                className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                {selectedCustomer ? 'تغيير' : '+ تحديد عميل'}
              </button>
            </div>
          </div>
        </div>

        {/* قائمة عناصر السلة مع أزرار لمس كبيرة */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-0.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <span className="text-4xl mb-2 opacity-60">🪴</span>
              <p className="text-sm font-semibold text-slate-300">السلة فارغة حالياً</p>
              <p className="text-xs text-slate-500 mt-1">اضغط على أي صنف من القائمة لإضافته مباشرة للبيع السريع</p>
            </div>
          ) : (
            cart.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-700/60 shadow-sm"
              >
                <div className="flex-1 min-w-0 pr-1">
                  <h5 className="text-xs font-bold text-white truncate">{item.name_ar}</h5>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-emerald-400 font-semibold">{item.price.toFixed(2)} ر.س</span>
                    <span className="text-[10px] text-slate-400">× {item.qty} = {(item.price * item.qty).toFixed(2)}</span>
                  </div>
                </div>

                {/* أزرار زيادة ونقصان باللمس */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQty(item.id, -1)}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-black flex items-center justify-center border border-slate-600 text-sm active:scale-95"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-bold text-xs text-white">
                    {item.qty}
                  </span>
                  <button
                    onClick={() => updateQty(item.id, 1)}
                    className="w-7 h-7 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-black flex items-center justify-center border border-emerald-600 text-sm active:scale-95"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 mr-1 text-xs"
                    title="حذف الصنف"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* خيار طلب الشحن والتوصيل (Delivery Order) */}
        <div className="border-t border-slate-700/70 pt-2 pb-2">
          <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-slate-900/60 border border-emerald-600/30 hover:bg-slate-900/90 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-lg">🚚</span>
              <div>
                <p className="text-xs font-bold text-white">طلب شحن وتوصيل للمشتري؟</p>
                <p className="text-[10px] text-slate-400">إصدار بوليصة شحن وتكليف مندوب (+25 ر.س)</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isDelivery}
              onChange={(e) => setIsDelivery(e.target.checked)}
              className="w-4 h-4 text-emerald-500 rounded border-slate-600 focus:ring-emerald-500 cursor-pointer"
            />
          </label>

          {isDelivery && (
            <div className="mt-2 p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">شركة / وسيلة الشحن</label>
                <select
                  value={deliveryData.courier_name}
                  onChange={(e) => setDeliveryData({ ...deliveryData, courier_name: e.target.value })}
                  className="w-full p-1.5 bg-slate-800 text-white rounded-lg border border-slate-600 text-xs"
                >
                  <option value="سيارة المشتل الخاصة (Nursery Van)">سيارة المشتل الخاصة (Nursery Van)</option>
                  <option value="أرامكس (Aramex Express)">أرامكس (Aramex Express)</option>
                  <option value="سمسا إكسبريس (SMSA)">سمسا إكسبريس (SMSA)</option>
                  <option value="جاهز لوجستيك (Jahez)">جاهز لوجستيك (Jahez)</option>
                  <option value="مرسول فوري (Mrsool)">مرسول فوري (Mrsool)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  placeholder="اسم المستلم"
                  value={deliveryData.recipient_name}
                  onChange={(e) => setDeliveryData({ ...deliveryData, recipient_name: e.target.value })}
                  className="w-full p-1.5 bg-slate-800 text-white rounded-lg border border-slate-600 text-xs placeholder-slate-500"
                />
                <input
                  type="tel"
                  placeholder="رقم الجوال"
                  value={deliveryData.recipient_phone}
                  onChange={(e) => setDeliveryData({ ...deliveryData, recipient_phone: e.target.value })}
                  className="w-full p-1.5 bg-slate-800 text-white rounded-lg border border-slate-600 text-xs placeholder-slate-500"
                />
              </div>
              <input
                type="text"
                placeholder="العنوان التفصيلي والحي..."
                value={deliveryData.shipping_address}
                onChange={(e) => setDeliveryData({ ...deliveryData, shipping_address: e.target.value })}
                className="w-full p-1.5 bg-slate-800 text-white rounded-lg border border-slate-600 text-xs placeholder-slate-500"
              />
            </div>
          )}
        </div>

        {/* وسائل الدفع السريعة باللمس (Cash, Card, Mada, Bank) */}
        <div className="pt-2 border-t border-slate-700/70">
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {[
              { id: 'cash', label: '💵 نقداً', desc: 'Cash' },
              { id: 'card', label: '💳 مدى / بطاقة', desc: 'Mada / Card' },
              { id: 'bank', label: '🏦 تحويل بنكي', desc: 'Bank Transfer' }
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id)}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                  paymentMethod === m.id
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950'
                    : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <div>{m.label}</div>
              </button>
            ))}
          </div>

          {/* بطاقة الحساب البنكي عند اختيار التحويل البنكي */}
          {(paymentMethod === 'bank' || paymentMethod === 'transfer') && (
            <div className="mb-2 p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border border-emerald-500/50 shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                  <span>🏦</span> بيانات الحساب البنكي للتحويل المباشر:
                </span>
                <span className="text-[10px] bg-emerald-900/80 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-700/50">
                  مصرف الراجحي
                </span>
              </div>
              <div className="flex items-center justify-between bg-slate-950/80 p-2 rounded-lg border border-emerald-600/40">
                <div className="font-mono text-emerald-400 font-black tracking-wider text-xs sm:text-sm dir-ltr">
                  3165002243921500013
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText('3165002243921500013');
                    setCopiedBank(true);
                    setTimeout(() => setCopiedBank(false), 2500);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                    copiedBank
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                  }`}
                >
                  {copiedBank ? 'تم النسخ ✔️' : 'نسخ الحساب 📋'}
                </button>
              </div>
              <p className="text-[10px] text-slate-300 mt-1 text-center">
                يتم إيداع المبلغ مباشرة على الحساب الشخصي المعتمد للمبيعات.
              </p>
            </div>
          )}

          {/* الخصم السريع */}
          <div className="flex items-center justify-between gap-2 mb-2 bg-slate-900/50 p-1.5 rounded-xl border border-slate-700/50">
            <span className="text-xs text-slate-300 font-medium">خصم فوري:</span>
            {!cashierPermissions.allow_discount ? (
              <span className="text-[11px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/40">
                🔒 مقيد من الإدارة
              </span>
            ) : (
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15].filter(p => p <= (cashierPermissions.max_discount_percent || 100)).map(pct => (
                  <button
                    key={pct}
                    onClick={() => setDiscountPercent(pct)}
                    className={`px-2 py-0.5 text-xs rounded-lg font-bold ${
                      discountPercent === pct
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ملخص الحساب والإجمالي */}
          <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-700/80 space-y-1 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>المجموع قبل الضريبة:</span>
              <span>{taxableAmount.toFixed(2)} ر.س</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>قيمة الخصم ({discountPercent}%):</span>
                <span>-{discountAmount.toFixed(2)} ر.س</span>
              </div>
            )}
            <div className="flex justify-between text-slate-400">
              <span>ضريبة القيمة المضافة (15%):</span>
              <span>{vatAmount.toFixed(2)} ر.س</span>
            </div>
            {isDelivery && (
              <div className="flex justify-between text-teal-400">
                <span>رسوم التوصيل والشحن:</span>
                <span>{deliveryFee.toFixed(2)} ر.س</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-700 text-white font-black text-sm sm:text-base">
              <span className="text-emerald-400">الإجمالي النهائي:</span>
              <span className="text-emerald-400 text-lg sm:text-xl font-black">{grandTotal.toFixed(2)} ر.س</span>
            </div>
          </div>

          {/* زر إتمام البيع والطباعة الفورية */}
          <button
            onClick={handleCheckout}
            disabled={processing || cart.length === 0}
            className={`w-full mt-2.5 py-3 rounded-xl font-black text-base flex items-center justify-center gap-2 shadow-xl transition-all duration-200 active:scale-95 ${
              processing || cart.length === 0
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/60'
            }`}
          >
            {processing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>جاري إتمام الفاتورة والقيد...</span>
              </>
            ) : (
              <>
                <span>⚡ إتمام البيع وطباعة الفاتورة</span>
                <span>({grandTotal.toFixed(2)} ر.س)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* نافذة تحديد وإضافة العميل بسلاسة (Customer Selection / Add Modal) */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="text-2xl">👤</span>
                <div>
                  <h3 className="font-bold text-white text-base">إدارة وبيانات العملاء</h3>
                  <p className="text-xs text-slate-400">اختيار عميل للفاتورة أو إضافة عميل جديد بسلاسة</p>
                </div>
              </div>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 text-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* تبديل بين اختيار عميل أو إنشاء جديد */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNewCust(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    !isAddingNewCust
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🔍 اختيار من العملاء المسجلين
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingNewCust(true)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    isAddingNewCust
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  ✨ إضافة عميل جديد
                </button>
              </div>

              {!isAddingNewCust ? (
                <div>
                  {/* بحث في العملاء */}
                  <div className="relative mb-3">
                    <input
                      type="text"
                      placeholder="ابحث بالاسم، رقم الجوال، أو الرقم الضريبي..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full pr-9 pl-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400">🔍</span>
                  </div>

                  {/* قائمة العملاء */}
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {/* خيار عميل نقدي افتراضي */}
                    <div
                      onClick={() => {
                        setSelectedCustomer(null);
                        setShowCustomerModal(false);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        !selectedCustomer
                          ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-300'
                          : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-xs">عميل نقدي صالة العرض (بدون اسم)</p>
                        <p className="text-[10px] opacity-75">المشتريات النقدية السريعة</p>
                      </div>
                      <span className="text-xs bg-slate-700/80 px-2 py-0.5 rounded">افتراضي</span>
                    </div>

                    {customers
                      .filter(c => {
                        if (!customerSearch) return true;
                        const s = customerSearch.toLowerCase();
                        return (
                          (c.name && c.name.toLowerCase().includes(s)) ||
                          (c.phone && c.phone.includes(s)) ||
                          (c.vat_number && c.vat_number.includes(s))
                        );
                      })
                      .map(c => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setShowCustomerModal(false);
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            selectedCustomer?.id === c.id
                              ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-md'
                              : 'bg-slate-800/70 border-slate-700/70 hover:bg-slate-800 hover:border-slate-600 text-slate-200'
                          }`}
                        >
                          <div>
                            <p className="font-bold text-xs text-white">{c.name}</p>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                              {c.phone && <span>📱 {c.phone}</span>}
                              {c.vat_number && <span className="text-emerald-400">ضريبي: {c.vat_number}</span>}
                            </div>
                            {c.address && <p className="text-[10px] text-slate-400 mt-0.5 truncate">📍 {c.address}</p>}
                          </div>
                          <button
                            type="button"
                            className="text-xs text-emerald-400 hover:text-emerald-300 font-bold px-2 py-1 bg-slate-700/50 rounded-lg"
                          >
                            اختيار 👈
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                /* نموذج إضافة عميل جديد */
                <form onSubmit={handleSaveCustomer} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      اسم العميل / المؤسسة <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: شركة نخيل الرياض للتطوير الزراعي"
                      value={newCustomerForm.name}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                      className="w-full p-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">رقم الجوال</label>
                      <input
                        type="tel"
                        placeholder="05xxxxxxxx"
                        value={newCustomerForm.phone}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        الرقم الضريبي (15 رقم)
                      </label>
                      <input
                        type="text"
                        maxLength="15"
                        placeholder="300000000000003"
                        value={newCustomerForm.vat_number}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, vat_number: e.target.value })}
                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-emerald-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">العنوان أو الحي</label>
                    <input
                      type="text"
                      placeholder="الرياض - حي الملز - طريق صلاح الدين"
                      value={newCustomerForm.address}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                      className="w-full p-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCust(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={savingCustomer}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-lg shadow-emerald-950"
                    >
                      {savingCustomer ? 'جاري الحفظ...' : 'حفظ وتحديد العميل ✔️'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* نافذة طباعة الفاتورة ZATCA والـ PDF المدمجة */}
      {showInvoiceModal && completedInvoice && (
        <PrintableInvoiceModal
          invoice={completedInvoice}
          tenant={activeTenant}
          branch={activeBranch}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {/* نافذة إدارة ورديات الكاشير وجرد الصندوق */}
      <CashierShiftsModal
        isOpen={showShiftModal}
        onClose={() => {
          setShowShiftModal(false);
          fetchCurrentShift();
        }}
        currentShift={currentShift}
        currentUser={currentUser}
        activeBranch={activeBranch}
      />

      {/* نافذة استعراض مبيعات الكاشير الشخصية بالتواريخ */}
      <CashierMySalesModal
        isOpen={showMySalesModal}
        onClose={() => setShowMySalesModal(false)}
        currentUser={currentUser}
        currentTenant={activeTenant}
      />
    </div>
  );
}
