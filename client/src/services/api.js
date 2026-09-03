const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = {
  async getFoods() {
    const res = await fetch(`${API_BASE_URL}/foods`);
    if (!res.ok) throw new Error('Failed to fetch food database');
    return res.json();
  },

  async getLivekitToken(room = 'beet-meal-logger', username) {
    const params = new URLSearchParams({ room });
    if (username) params.append('username', username);
    const res = await fetch(`${API_BASE_URL}/livekit/token?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch LiveKit token');
    return res.json();
  },

  async getMeals(date) {
    const params = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await fetch(`${API_BASE_URL}/meals${params}`);
    if (!res.ok) throw new Error('Failed to fetch meals');
    return res.json();
  },

  async getDailySummary(date) {
    const params = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await fetch(`${API_BASE_URL}/meals/summary${params}`);
    if (!res.ok) throw new Error('Failed to fetch daily summary');
    return res.json();
  },

  async logMeal(payload) {
    const res = await fetch(`${API_BASE_URL}/meals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to log meal');
    return data;
  },

  async updateMealItem(payload) {
    const res = await fetch(`${API_BASE_URL}/meals/items/update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update meal');
    return data;
  },

  async deleteMealItem(payload) {
    const res = await fetch(`${API_BASE_URL}/meals/items/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete meal');
    return data;
  },
};
