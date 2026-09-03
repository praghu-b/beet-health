import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Calendar, Database, HeartPulse, Sparkles } from 'lucide-react';
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

  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [meals, setMeals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [foods, setFoods] = useState([]);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [mealsRes, summaryRes] = await Promise.all([
        api.getMeals(selectedDate),
        api.getDailySummary(selectedDate),
      ]);
      setMeals(mealsRes.data || []);
      setSummary(summaryRes.summary || null);
    } catch (err) {
      console.error('Failed to load meal data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
    // Load food database once
    api.getFoods().then((res) => setFoods(res.data || [])).catch(console.error);

    // Periodic sync poll every 6 seconds as a backup to real-time events
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '16px 24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          {/* Logo & Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'var(--beet-gradient)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(225, 29, 72, 0.3)',
              }}
            >
              <HeartPulse size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: '800',
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Beet
                </h1>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    background: 'var(--beet-light)',
                    color: 'var(--beet-primary)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                  }}
                >
                  VOICE MEAL LOGGER
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Speak your meals naturally. LiveKit & MERN architecture.
              </p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Date Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--surface-subtle)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Calendar size={16} color="var(--text-secondary)" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontFamily: 'inherit',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadData}
              disabled={isRefreshing}
              title="Refresh logs"
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
              <RefreshCw size={14} className={isRefreshing ? 'pulsing-dot' : ''} />
              Refresh
            </button>

            {/* Food Database Sheet Button */}
            <button
              onClick={() => setIsDbModalOpen(true)}
              style={{
                background: 'var(--surface-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '32px 24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        {/* Voice Room Controller */}
        <VoiceRoom onMealUpdate={loadData} />

        {/* Nutritional Overview */}
        <MacroSummary summary={summary} />

        {/* Meal Timeline */}
        <MealTimeline
          meals={meals}
          selectedDate={selectedDate}
          onRefresh={loadData}
        />
      </main>

      {/* Footer */}
      <footer
        style={{
          background: '#ffffff',
          borderTop: '1px solid var(--border-subtle)',
          padding: '20px 24px',
          textAlign: 'center',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
        }}
      >
        Beet Nutrition Assistant • Powered by LiveKit Cloud Agents, Node.js, Express, MongoDB Atlas, and React.
      </footer>

      {/* Database Modal */}
      <FoodDatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        foods={foods}
      />
    </div>
  );
}
