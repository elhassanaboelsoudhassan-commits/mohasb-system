import React, { useState, useEffect, useRef } from 'react';
import { Bot, Sparkles, Send, X, TrendingUp, AlertTriangle, Lightbulb, Minimize2, Maximize2 } from 'lucide-react';
import { safeFetch } from '../api/client';

export default function AiAssistantWidget({ currentTenant, currentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'أهلاً بك! أنا **المساعد المحاسبي الذكي لمنظومة الصويان** 🤖🌿.\nجاهز لتحليل مبيعات مشاتلك، هوامش أرباح الشتلات، وتنبيهات المخزون ومراكز التكلفة فوراً.',
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const quickPrompts = [
    '📊 تحليل هوامش الأرباح الحالية',
    '📦 ما هي الأصناف التي أوشكت على النفاد؟',
    '🌱 تقييم تكلفة إنتاج شتلات البتونيا',
    '💡 نصيحة لتحسين السيولة النقدية'
  ];

  const handleSendMessage = async (msgText) => {
    const textToSend = msgText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg = {
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await safeFetch('/api/ai/advisor', {
        method: 'POST',
        tenantId: currentTenant?.id || 1,
        body: JSON.stringify({ message: textToSend })
      });

      const botReply = {
        sender: 'bot',
        text: res?.reply || 'تم تحليل البيانات المالية لمشتلك بنجاح.',
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botReply]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: 'عذراً، حدث خطأ أثناء الاتصال بمحرك التحليل الذكي: ' + err.message,
          time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setIsMinimized(false); }}
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '9999px',
            padding: '0.85rem 1.4rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            cursor: 'pointer',
            boxShadow: '0 8px 25px rgba(4, 120, 87, 0.45)',
            zIndex: 9999,
            fontWeight: 800,
            fontSize: '0.9rem',
            transition: 'transform 0.2s ease',
          }}
          className="hover-lift"
        >
          <div style={{ position: 'relative' }}>
            <Bot size={22} />
            <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', borderRadius: '50%', background: '#6ee7b7' }} />
          </div>
          <span>المساعد الذكي (AI)</span>
          <Sparkles size={16} style={{ color: '#a7f3d0' }} />
        </button>
      )}

      {/* Main Chat Drawer */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            width: '420px',
            maxWidth: 'calc(100vw - 48px)',
            height: isMinimized ? '60px' : '580px',
            maxHeight: 'calc(100vh - 48px)',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 9999,
            transition: 'height 0.3s ease'
          }}
        >
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
            color: '#ffffff',
            padding: '0.9rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>المستشار المالي الذكي</h4>
                <span style={{ fontSize: '0.68rem', color: '#a7f3d0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6ee7b7' }} /> متصل ببيانات المشتل الحية
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '4px' }}
              >
                {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          {!isMinimized && (
            <>
              <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '88%',
                        padding: '0.75rem 1rem',
                        borderRadius: m.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        background: m.sender === 'user' ? '#047857' : 'var(--hover-bg)',
                        color: m.sender === 'user' ? '#ffffff' : 'var(--text-main)',
                        fontSize: '0.84rem',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-line',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                      }}
                    >
                      {m.text}
                      <div style={{ fontSize: '0.65rem', opacity: 0.7, textAlign: 'left', marginTop: '4px' }}>
                        {m.time}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ padding: '0.6rem 1rem', borderRadius: '12px', background: 'var(--hover-bg)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      جاري تحليل الأرقام والتقارير... ⏳
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts Chips */}
              <div style={{ padding: '0.5rem 0.85rem', background: 'var(--hover-bg)', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.4rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                {quickPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p)}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.6rem',
                      borderRadius: '8px',
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <form
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                style={{
                  padding: '0.75rem 1rem',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'var(--card-bg)'
                }}
              >
                <input
                  type="text"
                  placeholder="اسأل المساعد المحاسبي الذكي..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.65rem 0.9rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#047857',
                    color: '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: loading || !input.trim() ? 0.6 : 1
                  }}
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
