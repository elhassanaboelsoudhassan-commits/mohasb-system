import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  Percent, 
  Trash2, 
  Lock, 
  Unlock, 
  Check, 
  X, 
  AlertTriangle, 
  Key, 
  DollarSign, 
  FileText, 
  Save, 
  UserCheck 
} from 'lucide-react';
import { safeFetch } from '../api/client';
import { saveCashierPermissionsToFirebase, fetchCashierPermissionsFromFirebase } from '../firebase';

export default function CashierPermissionsModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [permissions, setPermissions] = useState({
    allow_discount: true,
    max_discount_percent: 5,
    allow_delete_items: false,
    allow_price_override: false,
    allow_credit_sales: false,
    allow_reprint_invoice: true,
    allow_shift_close: true,
    view_own_sales_only: true,
    supervisor_pin: '1234'
  });

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      // 1. محاولة الجلب السحابي من فايربيز أولاً
      const fbPerms = await fetchCashierPermissionsFromFirebase();
      if (fbPerms) {
        setPermissions(prev => ({ ...prev, ...fbPerms }));
      } else {
        // 2. الجلب من الـ API الداخلي
        const res = await safeFetch('/api/cashier-permissions');
        if (res && res.success && res.data) {
          setPermissions(prev => ({ ...prev, ...res.data }));
        }
      }
    } catch (err) {
      console.warn('Error fetching cashier permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // حفظ محلي وسحابي في نفس الوقت
      const res = await safeFetch('/api/cashier-permissions', {
        method: 'POST',
        body: JSON.stringify(permissions)
      });

      await saveCashierPermissionsToFirebase(permissions);

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        if (typeof onSuccess === 'function') onSuccess(permissions);
        onClose();
      }, 1200);
    } catch (err) {
      alert('خطأ أثناء حفظ الصلاحيات: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
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
        maxWidth: '640px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
          padding: '1.25rem 1.5rem',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0 }}>
                لوحة التحكم في صلاحيات الكاشير ونقاط البيع (POS)
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#a7f3d0', margin: '0.2rem 0 0 0' }}>
                تحديد الصلاحيات الممنوحة للكاشير وتثبيتها سحابياً في Firebase لمنع التلاعب
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {saveSuccess && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #10b981',
              color: '#065f46',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 800,
              fontSize: '0.9rem'
            }}>
              <Check size={18} />
              <span>✅ تم حفظ وتثبيت صلاحيات الكاشير بنجاح وتطبيقها فوراً على كافة نقاط البيع!</span>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b' }}>
              جاري تحميل إعدادات الصلاحيات...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Option 1: Allow Discount */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                background: permissions.allow_discount ? '#f0fdf4' : '#f8fafc',
                border: '1px solid ' + (permissions.allow_discount ? '#bbf7d0' : '#e2e8f0')
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Percent size={18} style={{ color: permissions.allow_discount ? '#059669' : '#94a3b8' }} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                      السماح بتقديم خصم على الفاتورة
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      تمكين الكاشير من إدخال نسبة خصم على الفاتورة للعملاء
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allow_discount}
                  onChange={e => setPermissions({ ...permissions, allow_discount: e.target.checked })}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#047857' }}
                />
              </div>

              {/* Option 2: Max Discount % */}
              {permissions.allow_discount && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  marginRight: '1.5rem'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                      أقصى نسبة خصم مسموحة للكاشير (%)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      أي نسبة أعلى تتطلب رمز المشرف (Supervisor PIN)
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={permissions.max_discount_percent}
                      onChange={e => setPermissions({ ...permissions, max_discount_percent: Number(e.target.value) })}
                      style={{
                        width: '70px',
                        padding: '0.35rem 0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontWeight: 800,
                        textAlign: 'center',
                        fontSize: '0.9rem'
                      }}
                    />
                    <span style={{ fontWeight: 800, color: '#047857' }}>%</span>
                  </div>
                </div>
              )}

              {/* Option 3: Allow Delete Items from Cart */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                background: permissions.allow_delete_items ? '#fef2f2' : '#f0fdf4',
                border: '1px solid ' + (permissions.allow_delete_items ? '#fecaca' : '#bbf7d0')
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Trash2 size={18} style={{ color: permissions.allow_delete_items ? '#dc2626' : '#059669' }} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                      السماح بحذف الأصناف بعد إدراجها بالسلة
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {permissions.allow_delete_items 
                        ? '⚠️ مسموح للكاشير بحذف الأصناف مباشرة'
                        : '🔒 ممنوع الحذف: يتطلب المشرف أو إذن الإدارة لحماية المبيعات'}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allow_delete_items}
                  onChange={e => setPermissions({ ...permissions, allow_delete_items: e.target.checked })}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#047857' }}
                />
              </div>

              {/* Option 4: Price Override */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <DollarSign size={18} style={{ color: '#059669' }} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                      السماح بتعديل سعر البيع يدوياً
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      تمكين الكاشير من تغيير سعر الوحدة المسجل في دليل الأصناف
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allow_price_override}
                  onChange={e => setPermissions({ ...permissions, allow_price_override: e.target.checked })}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#047857' }}
                />
              </div>

              {/* Option 5: Credit Sales */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FileText size={18} style={{ color: '#0284c7' }} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                      السماح بالبيع الآجل (على الحساب)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      إصدار فاتورة آجلة دون استلام نقد أو شبكة فورياً
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allow_credit_sales}
                  onChange={e => setPermissions({ ...permissions, allow_credit_sales: e.target.checked })}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#047857' }}
                />
              </div>

              {/* Option: View Own Sales Only */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                background: permissions.view_own_sales_only ? '#ecfdf5' : '#f8fafc',
                border: '1px solid ' + (permissions.view_own_sales_only ? '#a7f3d0' : '#e2e8f0')
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <UserCheck size={18} style={{ color: '#047857' }} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                      مشاهدة مبيعاته الشخصية فقط
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      تمكين الكاشير من استعراض مبيعاته وفواتيره الشخصية بالتواريخ فقط، وتقييد وصوله لمبيعات الفروع أو الزملاء
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.view_own_sales_only !== false}
                  onChange={e => setPermissions({ ...permissions, view_own_sales_only: e.target.checked })}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#047857' }}
                />
              </div>

              {/* Option 6: Supervisor PIN */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                background: '#fffbeb',
                border: '1px solid #fde68a'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Key size={18} style={{ color: '#d97706' }} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.9rem' }}>
                      رمز المشرف لتجاوز الصلاحيات (Supervisor PIN)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#b45309' }}>
                      الرمز السري المعتمد للمشرف لإلغاء أي حظر أو خصم استثنائي
                    </div>
                  </div>
                </div>
                <input
                  type="password"
                  maxLength={6}
                  value={permissions.supervisor_pin}
                  onChange={e => setPermissions({ ...permissions, supervisor_pin: e.target.value })}
                  style={{
                    width: '90px',
                    padding: '0.35rem 0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #f59e0b',
                    fontWeight: 800,
                    textAlign: 'center',
                    fontSize: '1rem',
                    letterSpacing: '3px'
                  }}
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            marginTop: '0.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e2e8f0'
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{
                padding: '0.5rem 1.5rem',
                fontSize: '0.875rem',
                background: '#047857',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Save size={16} />
              <span>{saving ? 'جاري الحفظ والمزامنة...' : 'حفظ وتثبيت الصلاحيات'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
