import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Printer, 
  FileDown, 
  X, 
  ShieldCheck, 
  Sprout, 
  Receipt, 
  CheckCircle2 
} from 'lucide-react';

export default function PrintableInvoiceModal({ 
  invoice, 
  tenant, 
  branch, 
  currentUser, 
  onClose 
}) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [printFormat, setPrintFormat] = useState('a4'); // 'a4' or 'thermal'

  const tenantName = tenant?.company_name_ar || tenant?.name_ar || 'شركة ومشاتل الصويان الزراعية';
  const tenantVat = tenant?.vat_number || '310984752000003';
  const tenantCr = tenant?.cr_number || '1010892341';
  const tenantPhone = tenant?.phone || '0501234567';
  const branchName = branch?.name_ar || 'مشتل وصالة الرياض الرئيسية';
  const cashierName = currentUser?.name || 'كاشير الصالة';
  const bankAccount = tenant?.bank_account || invoice?.bank_account_used || '3165002243921500013';

  // توليد رمز QR محلياً باستخدام مكتبة qrcode دون الحاجة للإنترنت
  useEffect(() => {
    const rawQr = invoice?.zatca_qr || invoice?.zatcaQr || invoice?.qr || 'AL-SUWAYAN-ZATCA-PHASE-2';
    QRCode.toDataURL(rawQr, {
      width: 180,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => {
        console.error('QR generation error:', err);
      });
  }, [invoice]);

  const handlePrint = (format) => {
    setPrintFormat(format);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  if (!invoice) return null;

  const items = invoice.items || [];
  const subtotal = invoice.subtotal || (invoice.grand_total ? invoice.grand_total / 1.15 : 0);
  const vatTotal = invoice.vat_total || (invoice.grand_total ? invoice.grand_total - subtotal : 0);
  const grandTotal = invoice.grand_total || invoice.total || 0;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      {/* Container for Dialog & On-screen preview */}
      <div 
        className="modal-content"
        style={{ 
          maxWidth: printFormat === 'thermal' ? '440px' : '820px', 
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#ffffff',
          color: '#0f172a',
          padding: '1.75rem',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Actions Bar (Hidden during printing via CSS) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ background: '#ecfdf5', color: '#047857', padding: '0.4rem', borderRadius: '10px' }}>
              <Receipt size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                فاتورة ضريبية مبسطة (ZATCA)
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                رقم الفاتورة: {invoice.invoice_number || invoice.invoiceNumber}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Thermal Print Button */}
            <button
              onClick={() => handlePrint('thermal')}
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              title="طباعة إيصال كاشير مقاس 80 مم"
            >
              <Printer size={15} />
              <span>إيصال كاشير (80mm)</span>
            </button>

            {/* A4 / PDF Button */}
            <button
              onClick={() => handlePrint('a4')}
              className="btn btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.825rem', background: '#047857', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              title="طباعة أو حفظ الفاتورة كـ PDF بصيغة A4"
            >
              <FileDown size={15} />
              <span>حفظ / طباعة كـ PDF (A4)</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ===================== THE PRINTABLE INVOICE ===================== */}
        <div 
          id="printable-invoice" 
          className={`invoice-print-area ${printFormat === 'thermal' ? 'format-thermal' : 'format-a4'}`}
          style={{
            direction: 'rtl',
            textAlign: 'right',
            color: '#0f172a',
            background: '#ffffff',
            padding: printFormat === 'thermal' ? '0.5rem' : '1.5rem',
            border: printFormat === 'thermal' ? '1px dashed #cbd5e1' : '1px solid #e2e8f0',
            borderRadius: '12px'
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #047857', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Sprout size={24} style={{ color: '#047857' }} />
              <h2 style={{ fontSize: printFormat === 'thermal' ? '1.25rem' : '1.6rem', fontWeight: 900, color: '#047857', margin: 0 }}>
                {tenantName}
              </h2>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', letterSpacing: '0.3px' }}>
              فاتورة ضريبية مبسطة (Simplified Tax Invoice)
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              الرقم الضريبي: <strong className="font-mono">{tenantVat}</strong> | السجل التجاري: <strong className="font-mono">{tenantCr}</strong>
            </div>
            <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.15rem' }}>
              {branchName} • هاتف: <strong className="font-mono">{tenantPhone}</strong> • المملكة العربية السعودية
            </div>
          </div>

          {/* Invoice Meta Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: printFormat === 'thermal' ? '1fr' : '1fr 1fr', 
            gap: '0.5rem', 
            background: '#f8fafc', 
            padding: '0.85rem', 
            borderRadius: '10px', 
            marginBottom: '1rem',
            fontSize: '0.825rem',
            border: '1px solid #e2e8f0'
          }}>
            <div>
              <span style={{ color: '#64748b' }}>رقم الفاتورة: </span>
              <strong className="font-mono" style={{ color: '#047857' }}>
                {invoice.invoice_number || invoice.invoiceNumber}
              </strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>التاريخ والوقت: </span>
              <strong>{invoice.issue_date || new Date().toISOString().split('T')[0]} {invoice.issue_time || new Date().toLocaleTimeString('ar-SA')}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>الكاشير المسؤول: </span>
              <strong>{cashierName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>طريقة الدفع: </span>
              <strong>
                {invoice.payment_method === 'cash' ? 'نقدي (Cash)' :
                 invoice.payment_method === 'card' || invoice.payment_method === 'mada' ? 'مدى / بطاقة (Mada)' :
                 invoice.payment_method === 'bank' || invoice.payment_method === 'transfer' ? 'تحويل بنكي (Bank Transfer)' :
                 invoice.payment_method || 'نقدي'}
              </strong>
            </div>

            {/* بيانات العميل إن وجدت */}
            {(invoice.customer_name || invoice.customer) && (
              <div style={{ 
                gridColumn: printFormat === 'thermal' ? '1' : '1 / -1', 
                borderTop: '1px dashed #cbd5e1', 
                paddingTop: '0.4rem', 
                marginTop: '0.2rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ color: '#64748b' }}>العميل: </span>
                  <strong style={{ color: '#047857' }}>{invoice.customer_name || invoice.customer?.name}</strong>
                </div>
                {(invoice.customer_phone || invoice.customer?.phone) && (
                  <div>
                    <span style={{ color: '#64748b' }}>الجوال: </span>
                    <strong className="font-mono">{invoice.customer_phone || invoice.customer?.phone}</strong>
                  </div>
                )}
                {(invoice.customer_vat || invoice.customer?.vat_number) && (
                  <div>
                    <span style={{ color: '#64748b' }}>الرقم الضريبي للمشتري: </span>
                    <strong className="font-mono">{invoice.customer_vat || invoice.customer?.vat_number}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* صندوق بيانات التحويل البنكي المعتمد */}
          {(invoice.payment_method === 'bank' || invoice.payment_method === 'transfer' || bankAccount) && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              padding: '0.5rem 0.85rem',
              marginBottom: '1rem',
              fontSize: '0.775rem',
              color: '#065f46'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <span>🏦 <strong>حساب التحويل البنكي:</strong> مصرف الراجحي</span>
                  <div style={{ marginTop: '2px' }}>
                    رقم الحساب الشخصي: <strong className="font-mono" style={{ fontSize: '0.9rem', color: '#047857' }}>{bankAccount}</strong>
                  </div>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#047857', opacity: 0.85 }}>
                  حساب معتمد لاستلام التحويلات
                </div>
              </div>
            </div>
          )}

          {/* Line Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.25rem', fontSize: printFormat === 'thermal' ? '0.775rem' : '0.85rem' }}>
            <thead>
              <tr style={{ background: '#047857', color: '#ffffff' }}>
                <th style={{ padding: '0.5rem', textAlign: 'right', borderRadius: '6px 0 0 6px' }}>الصنف / الشتلة</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>السعر</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>الكمية</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>الضريبة 15%</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderRadius: '0 6px 6px 0' }}>المجموع</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const price = Number(item.unit_price || 0);
                const qty = Number(item.quantity || 1);
                const lineTotal = price * qty * 1.15;
                const lineVat = price * qty * 0.15;

                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>
                      {item.name_ar || item.item_name || 'شتلة زراعية'}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }} className="font-mono">
                      {price.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700 }}>
                      {qty}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#64748b' }} className="font-mono">
                      {lineVat.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'left', fontWeight: 700 }} className="font-mono">
                      {lineTotal.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals Breakdown */}
          <div style={{ display: 'flex', justifyContent: printFormat === 'thermal' ? 'center' : 'flex-end', marginBottom: '1.25rem' }}>
            <div style={{ width: printFormat === 'thermal' ? '100%' : '320px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.4rem', color: '#64748b' }}>
                <span>المجموع الخاضع للضريبة:</span>
                <span className="font-mono">{Number(subtotal).toFixed(2)} ر.س</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.6rem', color: '#64748b' }}>
                <span>ضريبة القيمة المضافة (15%):</span>
                <span className="font-mono">{Number(vatTotal).toFixed(2)} ر.س</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 900, color: '#047857', borderTop: '2px dashed #cbd5e1', paddingTop: '0.5rem' }}>
                <span>المبلغ الإجمالي شامل الضريبة:</span>
                <span className="font-mono">{Number(grandTotal).toFixed(2)} ر.س</span>
              </div>
            </div>
          </div>

          {/* ZATCA QR Code & Validation Footer */}
          <div style={{ textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1rem' }}>
            {qrDataUrl ? (
              <div style={{ display: 'inline-block', padding: '0.5rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <img 
                  src={qrDataUrl} 
                  alt="ZATCA QR Code" 
                  style={{ width: printFormat === 'thermal' ? '130px' : '150px', height: printFormat === 'thermal' ? '130px' : '150px', display: 'block', margin: '0 auto' }} 
                />
              </div>
            ) : (
              <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                جاري تشفير رمز ZATCA...
              </div>
            )}
            
            <div style={{ fontSize: '0.725rem', color: '#047857', fontWeight: 700, marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={14} />
              <span>رمز استجابة سريع متوافق مع هيئة الزكاة والضريبة والجمارك (ZATCA 2)</span>
            </div>
            
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              شكراً لتعاملكم مع مشاتل الصويان الزراعية • فروعنا بالرياض والخرج
            </div>
          </div>
        </div>

        {/* Footer info (No-print) */}
        <div className="no-print" style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.5rem 1.75rem', fontWeight: 700 }}>
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
}
