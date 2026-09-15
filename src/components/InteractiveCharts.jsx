import React, { useState } from 'react';
import { TrendingUp, PieChart as PieIcon, DollarSign, Sprout, BarChart3 } from 'lucide-react';

export default function InteractiveCharts({ sales = [], theme = 'light' }) {
  const [chartPeriod, setChartPeriod] = useState('monthly');
  const [hoveredBar, setHoveredBar] = useState(null);

  // بيانات افتراضية وديناميكية للأشهر
  const monthlyData = [
    { label: 'يناير', sales: 42000, profit: 18500, orders: 120 },
    { label: 'فبراير', sales: 58000, profit: 26000, orders: 165 },
    { label: 'مارس', sales: 85000, profit: 39000, orders: 240 },
    { label: 'أبريل', sales: 110000, profit: 52000, orders: 310 },
    { label: 'مايو', sales: 95000, profit: 44000, orders: 280 },
    { label: 'يونيو', sales: 135000, profit: 64000, orders: 390 }
  ];

  const categoryDistribution = [
    { name: 'شتلات زهور ونباتات حولية', percent: 45, color: '#10b981', amount: '60,750 ر.س' },
    { name: 'أشجار مثمرة وزيتون ونخيل', percent: 30, color: '#047857', amount: '40,500 ر.س' },
    { name: 'أسمدة ومخصبات زراعية', percent: 15, color: '#f59e0b', amount: '20,250 ر.س' },
    { name: 'تربة بيتموس وأدوات ري', percent: 10, color: '#3b82f6', amount: '13,500 ر.س' }
  ];

  const maxVal = Math.max(...monthlyData.map(d => d.sales));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
      {/* 1. Bar / Trend Chart */}
      <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>حركة المبيعات والأرباح</h4>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>مقارنة الإيرادات وصافي الأرباح التقديرية</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--hover-bg)', padding: '0.2rem', borderRadius: '8px' }}>
            <button
              onClick={() => setChartPeriod('monthly')}
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.6rem',
                borderRadius: '6px',
                border: 'none',
                background: chartPeriod === 'monthly' ? '#047857' : 'transparent',
                color: chartPeriod === 'monthly' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              شهري
            </button>
            <button
              onClick={() => setChartPeriod('weekly')}
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.6rem',
                borderRadius: '6px',
                border: 'none',
                background: chartPeriod === 'weekly' ? '#047857' : 'transparent',
                color: chartPeriod === 'weekly' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              أسبوعي
            </button>
          </div>
        </div>

        {/* Interactive SVG / Bar visualization */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem', height: '170px', paddingTop: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          {monthlyData.map((d, idx) => {
            const hSales = Math.round((d.sales / maxVal) * 130);
            const hProfit = Math.round((d.profit / maxVal) * 130);
            const isHovered = hoveredBar === idx;

            return (
              <div
                key={d.label}
                onMouseEnter={() => setHoveredBar(idx)}
                onMouseLeave={() => setHoveredBar(null)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', cursor: 'pointer', position: 'relative' }}
              >
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    top: '-35px',
                    background: '#0f172a',
                    color: '#fff',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                  }}>
                    مبيعات: {d.sales.toLocaleString()} ر.س | ربح: {d.profit.toLocaleString()}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', width: '100%', justifyContent: 'center' }}>
                  {/* Sales Bar */}
                  <div
                    style={{
                      width: '45%',
                      maxWidth: '16px',
                      height: `${hSales}px`,
                      background: isHovered ? '#059669' : 'linear-gradient(180deg, #10b981 0%, #047857 100%)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease, background 0.2s ease'
                    }}
                  />
                  {/* Profit Bar */}
                  <div
                    style={{
                      width: '45%',
                      maxWidth: '16px',
                      height: `${hProfit}px`,
                      background: isHovered ? '#d97706' : 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease, background 0.2s ease'
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.5rem' }}>{d.label}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981' }} />
            <span style={{ color: 'var(--text-muted)' }}>إجمالي المبيعات</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#f59e0b' }} />
            <span style={{ color: 'var(--text-muted)' }}>صافي الأرباح</span>
          </div>
        </div>
      </div>

      {/* 2. Donut / Category Distribution */}
      <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(4, 120, 87, 0.15)', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PieIcon size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>توزيع مبيعات الأصناف الزراعية</h4>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>نسبة مساهمة كل فئة نباتية في الإيرادات</p>
          </div>
        </div>

        {/* Category Progress Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.75rem' }}>
          {categoryDistribution.map(cat => (
            <div key={cat.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                <span style={{ color: 'var(--text-main)' }}>{cat.name}</span>
                <span style={{ color: cat.color }}>{cat.percent}% ({cat.amount})</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--hover-bg)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${cat.percent}%`,
                    height: '100%',
                    background: cat.color,
                    borderRadius: '9999px',
                    transition: 'width 0.6s ease'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
