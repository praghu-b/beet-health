const fs = require('fs');
const path = require('path');

class FoodService {
  constructor(foodsFilePath) {
    const defaultPath = path.resolve(__dirname, '../../../foods.json');
    this.filePath = foodsFilePath || process.env.FOODS_FILE_PATH || defaultPath;
    this.foods = [];
    this.foodMap = new Map();
    this.aliasMap = new Map();
    this.loadFoods();
  }

  loadFoods() {
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`Food database file not found at: ${this.filePath}`);
    }
    const rawData = fs.readFileSync(this.filePath, 'utf-8');
    const parsed = JSON.parse(rawData);
    this.foods = parsed.foods || [];

    this.foodMap.clear();
    this.aliasMap.clear();

    for (const food of this.foods) {
      this.foodMap.set(food.id.toLowerCase(), food);
      this.aliasMap.set(food.name.toLowerCase(), food);

      if (Array.isArray(food.aliases)) {
        for (const alias of food.aliases) {
          this.aliasMap.set(alias.toLowerCase().trim(), food);
        }
      }
    }
  }

  getAllFoods() {
    return this.foods;
  }

  findFood(query) {
    if (!query || typeof query !== 'string') return null;
    const normalized = query.toLowerCase().trim();

    // 1. Direct ID match
    if (this.foodMap.has(normalized)) {
      return this.foodMap.get(normalized);
    }

    // 2. Direct Name or Alias match
    if (this.aliasMap.has(normalized)) {
      return this.aliasMap.get(normalized);
    }

    // 3. Substring / partial match on aliases or names
    for (const food of this.foods) {
      if (food.name.toLowerCase().includes(normalized) || normalized.includes(food.name.toLowerCase())) {
        return food;
      }
      if (food.aliases) {
        for (const alias of food.aliases) {
          const a = alias.toLowerCase();
          if (a.includes(normalized) || normalized.includes(a)) {
            return food;
          }
        }
      }
    }

    return null;
  }

  calculateItemNutrition(foodQuery, quantity, unitName) {
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new Error(`Invalid quantity: ${quantity}. Must be a positive number.`);
    }

    const food = this.findFood(foodQuery);
    if (!food) {
      throw new Error(
        `Food '${foodQuery}' is not in the verified food database. Only dishes listed in foods.json are supported.`
      );
    }

    // Determine unit
    let unitObj = null;
    if (unitName && typeof unitName === 'string') {
      const normalizedUnit = unitName.toLowerCase().trim();
      unitObj = food.units.find((u) => {
        const uName = u.name.toLowerCase();
        return (
          uName === normalizedUnit ||
          uName + 's' === normalizedUnit ||
          normalizedUnit + 's' === uName ||
          (uName === 'piece' && (normalizedUnit === 'pieces' || normalizedUnit === 'pc')) ||
          (uName === 'katori' && normalizedUnit === 'katoris') ||
          (uName === 'plate' && normalizedUnit === 'plates') ||
          (uName === 'bowl' && normalizedUnit === 'bowls') ||
          (uName === 'glass' && normalizedUnit === 'glasses') ||
          (uName === 'cup' && normalizedUnit === 'cups') ||
          (uName === 'tablespoon' && (normalizedUnit === 'tablespoons' || normalizedUnit === 'tbsp'))
        );
      });
    }

    // If unit not provided or invalid, check if we can fall back to primary unit
    if (!unitObj) {
      if (!unitName) {
        unitObj = food.units[0]; // default unit
      } else {
        const validUnits = food.units.map((u) => u.name).join(', ');
        throw new Error(
          `Unit '${unitName}' is not valid for '${food.name}'. Allowed units: ${validUnits}`
        );
      }
    }

    const weightGrams = Number((qty * unitObj.grams).toFixed(1));
    const multiplier = weightGrams / 100;

    const calories = Number((food.macrosPer100g.calories * multiplier).toFixed(1));
    const protein = Number((food.macrosPer100g.protein * multiplier).toFixed(1));
    const carbs = Number((food.macrosPer100g.carbs * multiplier).toFixed(1));
    const fat = Number((food.macrosPer100g.fat * multiplier).toFixed(1));

    return {
      foodId: food.id,
      foodName: food.name,
      quantity: qty,
      unit: unitObj.name,
      weightGrams,
      calories,
      protein,
      carbs,
      fat,
    };
  }
}

module.exports = new FoodService();
