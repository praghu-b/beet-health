const express = require('express');
const router = express.Router();

const { getFoods } = require('../controllers/foodController');
const { getLivekitToken } = require('../controllers/tokenController');
const {
  getMeals,
  getDailySummary,
  logMeal,
  updateMealItem,
  deleteMealItem,
} = require('../controllers/mealController');

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Food database routes
router.get('/foods', getFoods);

// LiveKit Token generation
router.get('/livekit/token', getLivekitToken);

// Meal Logging CRUD
router.get('/meals', getMeals);
router.get('/meals/summary', getDailySummary);
router.post('/meals', logMeal);

// Semantic voice-friendly item updates and deletes
router.patch('/meals/items/update', updateMealItem);
router.delete('/meals/items/delete', deleteMealItem);

// Direct ID item updates and deletes
router.patch('/meals/:logId/items/:itemId', updateMealItem);
router.delete('/meals/:logId/items/:itemId', deleteMealItem);

module.exports = router;
