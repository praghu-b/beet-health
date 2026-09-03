const { MealLog } = require('../models/MealLog');
const foodService = require('../services/foodService');

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMeals = async (req, res) => {
  try {
    const date = req.query.date || getTodayDateString();
    const query = { date };

    if (req.query.mealType) {
      query.mealType = req.query.mealType.toLowerCase();
    }

    const logs = await MealLog.find(query).sort({ createdAt: 1 });
    return res.status(200).json({
      success: true,
      date,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch meal logs',
      error: error.message,
    });
  }
};

const getDailySummary = async (req, res) => {
  try {
    const date = req.query.date || getTodayDateString();
    const logs = await MealLog.find({ date });

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalItems = 0;

    for (const log of logs) {
      totalCalories += log.totalCalories || 0;
      totalProtein += log.totalProtein || 0;
      totalCarbs += log.totalCarbs || 0;
      totalFat += log.totalFat || 0;
      totalItems += log.items ? log.items.length : 0;
    }

    return res.status(200).json({
      success: true,
      date,
      summary: {
        totalCalories: Number(totalCalories.toFixed(1)),
        totalProtein: Number(totalProtein.toFixed(1)),
        totalCarbs: Number(totalCarbs.toFixed(1)),
        totalFat: Number(totalFat.toFixed(1)),
        totalItems,
        mealCount: logs.length,
      },
      meals: logs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch daily summary',
      error: error.message,
    });
  }
};

const logMeal = async (req, res) => {
  try {
    const { date = getTodayDateString(), mealType, items } = req.body;

    if (!mealType || !['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing mealType. Must be one of: 'breakfast', 'lunch', 'dinner', 'snack'.",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'items array is required and must contain at least one food item.',
      });
    }

    const calculatedItems = [];
    for (const item of items) {
      const foodQuery = item.food || item.foodId || item.foodName;
      const calculated = foodService.calculateItemNutrition(
        foodQuery,
        item.quantity,
        item.unit
      );
      calculatedItems.push(calculated);
    }

    const normalizedMealType = mealType.toLowerCase();
    let mealLog = await MealLog.findOne({ date, mealType: normalizedMealType });

    if (!mealLog) {
      mealLog = new MealLog({
        date,
        mealType: normalizedMealType,
        items: calculatedItems,
      });
    } else {
      mealLog.items.push(...calculatedItems);
    }

    await mealLog.save();

    return res.status(201).json({
      success: true,
      message: `Successfully logged ${calculatedItems.length} item(s) for ${normalizedMealType}.`,
      data: mealLog,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const updateMealItem = async (req, res) => {
  try {
    const { logId, itemId } = req.params;
    const { date = getTodayDateString(), mealType, foodQuery, quantity, unit } = req.body;

    let targetLog = null;
    let targetItem = null;

    if (logId && itemId) {
      targetLog = await MealLog.findById(logId);
      if (targetLog) {
        targetItem = targetLog.items.id(itemId);
      }
    } else if (foodQuery) {
      const food = foodService.findFood(foodQuery);
      if (!food) {
        return res.status(404).json({
          success: false,
          message: `Food '${foodQuery}' not found in verified database.`,
        });
      }

      const logFilter = { date };
      if (mealType) {
        logFilter.mealType = mealType.toLowerCase();
      }

      const logs = await MealLog.find(logFilter).sort({ updatedAt: -1 });

      for (const log of logs) {
        const item = log.items.find(
          (it) => it.foodId === food.id || it.foodName.toLowerCase() === food.name.toLowerCase()
        );
        if (item) {
          targetLog = log;
          targetItem = item;
          break;
        }
      }
    }

    if (!targetLog || !targetItem) {
      return res.status(404).json({
        success: false,
        message: `Meal entry not found to update.`,
      });
    }

    const newQuantity = quantity !== undefined ? Number(quantity) : targetItem.quantity;
    const newUnit = unit || targetItem.unit;

    const recalculated = foodService.calculateItemNutrition(
      targetItem.foodId,
      newQuantity,
      newUnit
    );

    targetItem.quantity = recalculated.quantity;
    targetItem.unit = recalculated.unit;
    targetItem.weightGrams = recalculated.weightGrams;
    targetItem.calories = recalculated.calories;
    targetItem.protein = recalculated.protein;
    targetItem.carbs = recalculated.carbs;
    targetItem.fat = recalculated.fat;

    targetLog.recalculateTotals();
    await targetLog.save();

    return res.status(200).json({
      success: true,
      message: `Updated ${targetItem.foodName} to ${targetItem.quantity} ${targetItem.unit} (${targetItem.calories} kcal).`,
      data: targetLog,
      updatedItem: targetItem,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteMealItem = async (req, res) => {
  try {
    const { logId, itemId } = req.params;
    const { date = getTodayDateString(), mealType, foodQuery } = req.body;

    let targetLog = null;
    let targetItemIndex = -1;
    let removedItemName = '';

    if (logId && itemId) {
      targetLog = await MealLog.findById(logId);
      if (targetLog) {
        targetItemIndex = targetLog.items.findIndex((it) => it._id.toString() === itemId);
      }
    } else if (foodQuery) {
      const food = foodService.findFood(foodQuery);
      if (!food) {
        return res.status(404).json({
          success: false,
          message: `Food '${foodQuery}' not found in verified database.`,
        });
      }

      const logFilter = { date };
      if (mealType) {
        logFilter.mealType = mealType.toLowerCase();
      }

      const logs = await MealLog.find(logFilter).sort({ updatedAt: -1 });

      for (const log of logs) {
        const idx = log.items.findIndex(
          (it) => it.foodId === food.id || it.foodName.toLowerCase() === food.name.toLowerCase()
        );
        if (idx !== -1) {
          targetLog = log;
          targetItemIndex = idx;
          break;
        }
      }
    }

    if (!targetLog || targetItemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Meal entry not found to delete.`,
      });
    }

    const removedItem = targetLog.items[targetItemIndex];
    removedItemName = removedItem.foodName;

    targetLog.items.splice(targetItemIndex, 1);

    if (targetLog.items.length === 0) {
      await MealLog.findByIdAndDelete(targetLog._id);
      return res.status(200).json({
        success: true,
        message: `Removed ${removedItemName}. Meal log was cleared.`,
        data: null,
      });
    } else {
      targetLog.recalculateTotals();
      await targetLog.save();
      return res.status(200).json({
        success: true,
        message: `Removed ${removedItemName} from ${targetLog.mealType}.`,
        data: targetLog,
      });
    }
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getMeals,
  getDailySummary,
  logMeal,
  updateMealItem,
  deleteMealItem,
};
