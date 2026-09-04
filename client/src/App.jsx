import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Database } from 'lucide-react';
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

  const loadData = useCallback(async () => {
    try {
      const [mealsRes, summaryRes] = await Promise.all([
        api.getMeals(selectedDate),
        api.getDailySummary(selectedDate),
      ]);
      setMeals(mealsRes.data || []);
      setSummary(summaryRes.summary || null);
    } catch (err) {
      console.error('Failed to load meal data:', err);
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      {/* Main Content */}
      <main style={{ flex: 1, padding: '24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        {/* Top Utility Bar: Date & Database */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          {/* Date Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--surface-card)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Calendar size={16} color="var(--beet-primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Date:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                fontWeight: '700',
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            />
          </div>

          {/* View Food Database Button */}
          <button
            onClick={() => setIsDbModalOpen(true)}
            style={{
              background: 'var(--surface-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              fontWeight: '700',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
            }}
          >
            <Database size={16} color="var(--beet-primary)" />
            View Food Database ({foods.length})
          </button>
        </div>

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

      {/* Database Modal */}
      <FoodDatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        foods={foods}
      />
    </div>
  );
}
