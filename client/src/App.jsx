import React, { useState, useEffect, useCallback } from 'react';
import { Database } from 'lucide-react';
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
    api.getFoods().then((res) => setFoods(res.data || [])).catch(console.error);

    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px 40px' }}>
        {/* Top utility row: View Food Database */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button
            onClick={() => setIsDbModalOpen(true)}
            style={{
              background: 'var(--surface-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              fontWeight: '700',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Database size={16} color="var(--beet-primary)" />
            View Food Database ({foods.length})
          </button>
        </div>

        {/* Voice Assistant Controller */}
        <VoiceRoom onMealUpdate={loadData} />

        {/* Nutritional Overview Cards */}
        <MacroSummary summary={summary} />

        {/* Meals Grid */}
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
