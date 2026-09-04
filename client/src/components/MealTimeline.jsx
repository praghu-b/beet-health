import React, { useState } from 'react';
import { Sun, Coffee, Moon, Cookie, Trash2, Edit3, Check, X } from 'lucide-react';
import { api } from '../services/api';

const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast', icon: Coffee, color: '#f59e0b' },
  { id: 'lunch', label: 'Lunch', icon: Sun, color: '#e11d48' },
  { id: 'dinner', label: 'Dinner', icon: Moon, color: '#6366f1' },
  { id: 'snack', label: 'Snacks', icon: Cookie, color: '#10b981' },
];

export default function MealTimeline({ meals, onRefresh }) {
  const [editingItem, setEditingItem] = useState(null); // { logId, itemId, quantity, foodName }
  const [loadingAction, setLoadingAction] = useState(false);

  // Group meals by mealType
  const mealMap = {};
  for (const slot of MEAL_SLOTS) {
    mealMap[slot.id] = null;
  }
  for (const m of meals || []) {
    mealMap[m.mealType.toLowerCase()] = m;
  }

  const handleDeleteItem = async (mealLog, item) => {
    if (!confirm(`Are you sure you want to remove ${item.foodName}?`)) return;
    setLoadingAction(true);
    try {
      await api.deleteMealItem({
        date: mealLog.date,
        mealType: mealLog.mealType,
        foodQuery: item.foodId,
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Failed to delete item: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSaveEdit = async (mealLog) => {
    if (!editingItem) return;
    setLoadingAction(true);
    try {
      await api.updateMealItem({
        date: mealLog.date,
        mealType: mealLog.mealType,
        foodQuery: editingItem.foodId,
        quantity: Number(editingItem.quantity),
      });
      setEditingItem(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Failed to update item: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Meals & Dishes
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '20px',
        }}
      >
        {MEAL_SLOTS.map((slot) => {
          const SlotIcon = slot.icon;
          const log = mealMap[slot.id];
          const hasItems = log && log.items && log.items.length > 0;

          return (
            <div
              key={slot.id}
              style={{
                background: 'var(--surface-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '16px 20px',
                  background: 'var(--surface-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'var(--surface-card)',
                      color: slot.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <SlotIcon size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {slot.label}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {hasItems ? `${log.items.length} item(s)` : 'Nothing logged yet'}
                    </span>
                  </div>
                </div>

                {hasItems && (
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontSize: '1.15rem',
                        fontWeight: '800',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {log.totalCalories}{' '}
                      <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                        kcal
                      </span>
                    </span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {log.totalProtein}g P • {log.totalCarbs}g C • {log.totalFat}g F
                    </div>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div style={{ padding: '8px 20px', flex: 1 }}>
                {!hasItems ? (
                  <div
                    style={{
                      padding: '32px 0',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.88rem',
                      fontStyle: 'italic',
                    }}
                  >
                    No items logged for {slot.label}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {log.items.map((item) => {
                      const isEditing =
                        editingItem && editingItem.itemId === item._id.toString();

                      return (
                        <div
                          key={item._id}
                          style={{
                            padding: '14px 0',
                            borderBottom: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '12px',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h4
                                style={{
                                  fontSize: '0.95rem',
                                  fontWeight: '700',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {item.foodName}
                              </h4>
                              <span
                                style={{
                                  fontSize: '0.8rem',
                                  background: 'var(--surface-subtle)',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  color: 'var(--text-secondary)',
                                  fontWeight: '600',
                                }}
                              >
                                {item.weightGrams}g
                              </span>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginTop: '4px',
                              }}
                            >
                              {isEditing ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0.1"
                                    value={editingItem.quantity}
                                    onChange={(e) =>
                                      setEditingItem({
                                        ...editingItem,
                                        quantity: e.target.value,
                                      })
                                    }
                                    style={{
                                      width: '60px',
                                      padding: '4px 6px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--beet-primary)',
                                      background: 'var(--surface-subtle)',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.85rem',
                                      outline: 'none',
                                    }}
                                  />
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {item.unit}
                                  </span>
                                  <button
                                    onClick={() => handleSaveEdit(log)}
                                    disabled={loadingAction}
                                    style={{
                                      background: 'var(--emerald-primary)',
                                      color: '#ffffff',
                                      borderRadius: '4px',
                                      padding: '4px 8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingItem(null)}
                                    style={{
                                      background: 'var(--surface-subtle)',
                                      color: 'var(--text-secondary)',
                                      border: '1px solid var(--border-subtle)',
                                      borderRadius: '4px',
                                      padding: '4px 8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  Quantity: <strong>{item.quantity} {item.unit}{item.quantity > 1 && !item.unit.endsWith('s') ? 's' : ''}</strong>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Nutrition stats + actions */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <span
                                style={{
                                  fontSize: '0.95rem',
                                  fontWeight: '700',
                                  color: 'var(--macro-cal)',
                                }}
                              >
                                {item.calories} kcal
                              </span>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                  marginTop: '2px',
                                }}
                              >
                                P: {item.protein}g • C: {item.carbs}g • F: {item.fat}g
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {!isEditing && (
                                <button
                                  onClick={() =>
                                    setEditingItem({
                                      logId: log._id,
                                      itemId: item._id.toString(),
                                      foodId: item.foodId,
                                      foodName: item.foodName,
                                      quantity: item.quantity,
                                    })
                                  }
                                  title="Edit quantity"
                                  style={{
                                    background: 'transparent',
                                    color: 'var(--text-secondary)',
                                    padding: '6px',
                                    borderRadius: '6px',
                                  }}
                                >
                                  <Edit3 size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteItem(log, item)}
                                title="Remove item"
                                style={{
                                  background: 'transparent',
                                  color: 'var(--beet-primary)',
                                  padding: '6px',
                                  borderRadius: '6px',
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
