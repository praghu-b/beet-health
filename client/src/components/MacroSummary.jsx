import React from 'react';
import { Flame, Dumbbell, Apple, Droplet } from 'lucide-react';

export default function MacroSummary({ summary }) {
  const {
    totalCalories = 0,
    totalProtein = 0,
    totalCarbs = 0,
    totalFat = 0,
    totalItems = 0,
    mealCount = 0,
  } = summary || {};

  const cards = [
    {
      title: 'Calories',
      value: totalCalories,
      unit: 'kcal',
      icon: Flame,
      color: 'var(--macro-cal)',
      bg: 'var(--macro-cal-bg)',
    },
    {
      title: 'Protein',
      value: totalProtein,
      unit: 'g',
      icon: Dumbbell,
      color: 'var(--macro-protein)',
      bg: 'var(--macro-protein-bg)',
    },
    {
      title: 'Carbs',
      value: totalCarbs,
      unit: 'g',
      icon: Apple,
      color: 'var(--macro-carbs)',
      bg: 'var(--macro-carbs-bg)',
    },
    {
      title: 'Fat',
      value: totalFat,
      unit: 'g',
      icon: Droplet,
      color: 'var(--macro-fat)',
      bg: 'var(--macro-fat-bg)',
    },
  ];

  return (
    <div style={{ marginBottom: '32px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
          Today's Nutritional Summary
        </h2>
        <span
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            fontWeight: '600',
            background: 'var(--surface-card)',
            padding: '4px 12px',
            borderRadius: '20px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {mealCount} meals logged ({totalItems} items)
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              style={{
                background: 'var(--surface-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-md)',
                  background: card.bg,
                  color: card.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={24} />
              </div>
              <div>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {card.title}
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                  <span
                    style={{
                      fontSize: '1.6rem',
                      fontWeight: '800',
                      color: 'var(--text-primary)',
                      lineHeight: '1.2',
                    }}
                  >
                    {card.value}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    {card.unit}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
