import React, { useState } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Layers, 
  Plus, 
  Receipt, 
  ArrowRightLeft,
  ShoppingBag,
  Globe,
  Sun,
  Moon,
  Bell,
  AlertTriangle,
  X,
  Menu
} from 'lucide-react';
import { t } from '../i18n';

export default function Header({ 
  branches = [], 
  selectedBranch, 
  onSelectBranch, 
  onOpenNewInvoice, 
  onOpenNewExpense, 
  onOpenTransfer,
  onOpenPos,
  onOpenTouchPos,
  onOpenBackups,
  onOpenDeliveryOrders,
  currentTenant,
  currentUser,
  products = [],
  lang,
  onToggleLang,
  theme = 'light',
  onToggleTheme,
  onToggleMobileMenu
}) {
  const isCashier = currentUser?.role === 'cashier';
  const [showLowStockMenu, setShowLowStockMenu] = useState(false);

  // حساب الأصناف التي أوشكت على النفاد (الكمية 10 أو أقل)
  const lowStockProducts = products.filter(p => {
    const stock = Number(p.stock !== undefined ? p.stock : (p.total_stock !== undefined ? p.total_stock : 15));
    const limit = Number(p.min_limit || 10);
    return stock <= limit;
  });

  return (
    <header className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Mobile / Tablet Hamburger Menu Toggle */}
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="mobile-menu-btn"
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
            title="القائمة الجانبية"
          >
            <Menu size={20} />
          </button>
        )}
        {/* Branch Selector */}
        {!isCashier && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card-bg)', padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <Building2 size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {t('active_branch', lang)}
            </span>
            <select 
              value={selectedBranch} 
              onChange={(e) => onSelectBranch(e.target.value)}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                outline: 'none', 
                fontWeight: 700, 
                fontSize: '0.9rem', 
                color: 'var(--text-main)',
                cursor: 'pointer' 
              }}
            >
              <option value="all" style={{ background: 'var(--card-bg)', color: 'var(--text-main)' }}>
                🏢 {t('all_branches', lang)}
              </option>
              {branches.map(b => (
                <option key={b.id} value={b.id} style={{ background: 'var(--card-bg)', color: 'var(--text-main)' }}>
                  📍 {b.name_ar} ({b.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ZATCA Phase 2 Active Badge */}
        <div className="badge badge-success" title="نظام الربط مع منصة فاتورة نشط ومفعل للمرحلة الثانية">
          <ShieldCheck size={14} />
          <span>{t('zatca_compliant', lang)}</span>
        </div>

        {/* Tenant Name & Status */}
        {currentTenant && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', padding: '0.25rem 0.65rem', borderRadius: '8px' }}>
              🌿 {currentTenant.name_ar || currentTenant.company_name_ar || 'المنشأة'}
            </div>
            {currentTenant.status === 'trial' && (
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', padding: '0.25rem 0.6rem', borderRadius: '8px' }}>
                ⏳ تجريبي حتى {currentTenant.trial_ends_at}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', position: 'relative' }}>
        {/* Low Stock Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLowStockMenu(!showLowStockMenu)}
            className="btn btn-secondary"
            style={{ 
              padding: '0.45rem 0.65rem', 
              position: 'relative',
              background: lowStockProducts.length > 0 ? (theme === 'dark' ? 'rgba(217, 119, 6, 0.2)' : '#fef3c7') : 'transparent',
              borderColor: lowStockProducts.length > 0 ? '#f59e0b' : 'var(--border-color)',
              color: lowStockProducts.length > 0 ? '#b45309' : 'var(--text-main)'
            }}
            title={lowStockProducts.length > 0 ? `تنبيه: يوجد ${lowStockProducts.length} صنف زراعي أوشك على النفاد!` : 'حالة المخزون ممتازة'}
          >
            <Bell size={17} />
            {lowStockProducts.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#dc2626',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 900,
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 5px rgba(220, 38, 38, 0.4)'
              }}>
                {lowStockProducts.length}
              </span>
            )}
          </button>

          {/* Low Stock Dropdown Popover */}
          {showLowStockMenu && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              width: '320px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.25)',
              padding: '1rem',
              zIndex: 100,
              animation: 'fadeIn 0.15s ease-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.875rem', color: '#047857' }}>
                  <Bell size={16} />
                  <span>مركز الإشعارات والتنبيهات الحية</span>
                </div>
                <button 
                  onClick={() => setShowLowStockMenu(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* تنبيه انتهاء الفترة التجريبية إن وجد */}
              {currentTenant?.status === 'trial' && (
                <div style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  fontSize: '0.78rem',
                  marginBottom: '0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <span>⏳</span>
                  <span><strong>تنبيه الاشتراك التجريبي:</strong> ينتهي اشتراكك في <strong>{currentTenant.trial_ends_at}</strong>. تواصل مع الإدارة للترقية.</span>
                </div>
              )}

              {/* تنبيهات المخزون */}
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={14} />
                <span>تنبيهات الأصناف والشتلات (قرب النفاد):</span>
              </div>

              {lowStockProducts.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.6rem 0' }}>
                  🌱 كافة مستويات المخزون والشتلات آمنة ومتوفرة.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {lowStockProducts.map(p => (
                    <div 
                      key={p.id}
                      style={{
                        padding: '0.45rem 0.65rem',
                        borderRadius: '8px',
                        background: theme === 'dark' ? '#1a2e26' : '#fffbeb',
                        border: '1px solid #fde68a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div style={{ overflow: 'hidden', paddingLeft: '0.5rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {p.name_ar}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {p.category}
                        </div>
                      </div>
                      <div style={{ textAlign: 'left', flexShrink: 0 }}>
                        <span style={{ fontWeight: 900, color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                          متبقي: {p.stock ?? p.total_stock ?? 0} {p.unit || 'شتلة'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* روابط وإجراءات سريعة داخل الإشعارات */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                {onOpenBackups && (
                  <button
                    onClick={() => {
                      setShowLowStockMenu(false);
                      onOpenBackups();
                    }}
                    style={{
                      width: '100%',
                      padding: '0.4rem',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#059669',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <span>💾</span>
                    <span>النسخ الاحتياطي التلقائي (Automated Backup)</span>
                  </button>
                )}

                {onOpenTransfer && (
                  <button
                    onClick={() => {
                      setShowLowStockMenu(false);
                      onOpenTransfer();
                    }}
                    style={{
                      width: '100%',
                      padding: '0.4rem',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <ArrowRightLeft size={14} />
                    <span>طلب مناقلة مخزون عاجلة</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dark / Light Mode Switcher */}
        <button
          onClick={onToggleTheme}
          className="btn btn-secondary"
          style={{ padding: '0.45rem 0.75rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          title={theme === 'dark' ? 'التبديل للوضع النهاري (Light Mode)' : 'التبديل للوضع الليلي (Dark Mode)'}
        >
          {theme === 'dark' ? (
            <>
              <Sun size={15} style={{ color: '#fbbf24' }} />
              <span>نهاري</span>
            </>
          ) : (
            <>
              <Moon size={15} style={{ color: '#047857' }} />
              <span>ليلي</span>
            </>
          )}
        </button>

        {/* Language Switcher */}
        <button
          onClick={onToggleLang}
          className="btn btn-secondary"
          style={{ padding: '0.45rem 0.8rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          title="تغيير لغة النظام / Change Language"
        >
          <Globe size={15} />
          <span>{t('switch_lang', lang)}</span>
        </button>

        {/* Quick Actions */}
        {onOpenTouchPos && (
          <button 
            onClick={onOpenTouchPos}
            className="btn btn-primary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #047857 0%, #10b981 100%)', boxShadow: '0 4px 12px rgba(4, 120, 87, 0.3)' }}
            title="نقطة البيع التفاعلية المدعومة باللمس للموبايل والتابلت"
          >
            <span>📱 كاشير اللمس</span>
          </button>
        )}

        <button 
          onClick={onOpenPos}
          className="btn btn-secondary"
          style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
        >
          <ShoppingBag size={16} />
          <span>{t('cashier_pos', lang)}</span>
        </button>

        {!isCashier && (
          <>
            <button 
              onClick={onOpenNewInvoice}
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
            >
              <Receipt size={16} />
              <span>{t('new_invoice', lang)}</span>
            </button>

            <button 
              onClick={onOpenNewExpense}
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
            >
              <Plus size={16} />
              <span>{t('new_expense', lang)}</span>
            </button>

            <button 
              onClick={onOpenTransfer}
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
            >
              <ArrowRightLeft size={16} />
              <span>{t('stock_transfer', lang)}</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
