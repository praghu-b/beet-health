import React, { useState, useEffect, useCallback } from 'react';
import { Database, Sun, Moon, HeartPulse } from 'lucide-react';
import VoiceRoom from './components/VoiceRoom';
import MacroSummary from './components/MacroSummary';
import MealTimeline from './components/MealTimeline';
import FoodDatabaseModal from './components/FoodDatabaseModal';
import { api } from './services/api';

export default function App() {
  const getTodayString = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const today = getTodayString();
  const [meals, setMeals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [foods, setFoods] = useState([]);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('beet-theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('beet-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const loadData = useCallback(async () => {
    try {
      const [mealsRes, summaryRes] = await Promise.all([
        api.getMeals(today),
        api.getDailySummary(today),
      ]);
      setMeals(mealsRes.data || []);
      setSummary(summaryRes.summary || null);
    } catch (err) {
      console.error('Failed to load meal data:', err);
    }
  }, [today]);

  useEffect(() => {
    loadData();
    // Load food database once
    api.getFoods().then((res) => setFoods(res.data || [])).catch(console.error);

    // Periodic sync poll every 6 seconds as a backup to real-time events
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      {/* Sleek Top Navigation */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          padding: '14px 24px',
          background: 'var(--surface-card)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Brand mark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--beet-gradient)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(244, 63, 94, 0.35)',
              }}
            >
              <HeartPulse size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  Beet
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    background: 'var(--beet-light)',
                    color: 'var(--beet-primary)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    letterSpacing: '0.05em',
                  }}
                >
                  VOICE MEAL LOGGER
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Utilities */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Food Database Button */}
            <button
              onClick={() => setIsDbModalOpen(true)}
              style={{
                background: 'var(--surface-subtle)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem',
                fontWeight: '700',
              }}
            >
              <Database size={16} color="var(--beet-primary)" />
              View Food Database ({foods.length})
            </button>

            {/* Theme Switcher */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              style={{
                background: 'var(--surface-subtle)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: '600',
              }}
            >
              {theme === 'dark' ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#6366f1" />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Dashboard */}
      <main style={{ flex: 1, padding: '28px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {/* Voice Assistant Controller */}
        <VoiceRoom onMealUpdate={loadData} />

        {/* Nutritional Overview Cards */}
        <MacroSummary summary={summary} />

        {/* 2x2 Meals Grid */}
        <MealTimeline meals={meals} onRefresh={loadData} />
      </main>

      {/* Database Modal */}
      <FoodDatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        foods={foods}
      />
    </div>
  );
}
