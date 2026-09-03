const foodService = require('../src/services/foodService');

describe('FoodService - Strict Database Matching & Nutrition Mathematics', () => {
  describe('Alias & Name Resolution', () => {
    test('resolves exact food ID and canonical name', () => {
      const food = foodService.findFood('roti');
      expect(food).not.toBeNull();
      expect(food.id).toBe('roti');
      expect(food.name).toBe('Roti');
    });

    test('resolves aliases correctly', () => {
      expect(foodService.findFood('chapati')?.id).toBe('roti');
      expect(foodService.findFood('phulka')?.id).toBe('roti');
      expect(foodService.findFood('chawal')?.id).toBe('plain_rice');
      expect(foodService.findFood('daal')?.id).toBe('dal_tadka');
      expect(foodService.findFood('dahi')?.id).toBe('curd');
      expect(foodService.findFood('yogurt')?.id).toBe('curd');
      expect(foodService.findFood('anda')?.id).toBe('boiled_egg');
      expect(foodService.findFood('chaay')?.id).toBe('chai');
      expect(foodService.findFood('badam')?.id).toBe('almonds');
    });

    test('is case-insensitive and trims whitespace', () => {
      expect(foodService.findFood('  ROTI  ')?.id).toBe('roti');
      expect(foodService.findFood('Dal Tadka')?.id).toBe('dal_tadka');
      expect(foodService.findFood('  PANEER BUTTER MASALA  ')?.id).toBe('paneer_butter_masala');
    });

    test('returns null for unknown foods outside foods.json', () => {
      expect(foodService.findFood('pizza')).toBeNull();
      expect(foodService.findFood('burger')).toBeNull();
      expect(foodService.findFood('pasta')).toBeNull();
      expect(foodService.findFood('french fries')).toBeNull();
    });
  });

  describe('Nutrition Mathematics & Unit-to-Gram Conversions', () => {
    test('calculates exact macros for 2 pieces of roti (80g)', () => {
      const result = foodService.calculateItemNutrition('roti', 2, 'piece');
      // Roti per 100g: cals: 297, prot: 11.2, carbs: 58.0, fat: 3.7
      // 80g = 0.8x
      expect(result.foodId).toBe('roti');
      expect(result.foodName).toBe('Roti');
      expect(result.quantity).toBe(2);
      expect(result.unit).toBe('piece');
      expect(result.weightGrams).toBe(80);
      expect(result.calories).toBe(237.6);
      expect(result.protein).toBe(9.0);
      expect(result.carbs).toBe(46.4);
      expect(result.fat).toBe(3.0);
    });

    test('calculates exact macros for 1 katori of dal_tadka (150g)', () => {
      const result = foodService.calculateItemNutrition('dal', 1, 'katori');
      // Dal Tadka per 100g: cals: 120, prot: 6.0, carbs: 14.0, fat: 4.5
      // 150g = 1.5x
      expect(result.foodId).toBe('dal_tadka');
      expect(result.quantity).toBe(1);
      expect(result.unit).toBe('katori');
      expect(result.weightGrams).toBe(150);
      expect(result.calories).toBe(180);
      expect(result.protein).toBe(9.0);
      expect(result.carbs).toBe(21.0);
      expect(result.fat).toBe(6.8);
    });

    test('handles plural unit variants (e.g. pieces, katoris, glasses, bowls)', () => {
      const r1 = foodService.calculateItemNutrition('roti', 3, 'pieces');
      expect(r1.quantity).toBe(3);
      expect(r1.unit).toBe('piece');
      expect(r1.weightGrams).toBe(120);

      const r2 = foodService.calculateItemNutrition('curd', 1, 'glasses');
      expect(r2.weightGrams).toBe(200);
      expect(r2.calories).toBe(122);
    });

    test('defaults to primary unit if unit is omitted', () => {
      const result = foodService.calculateItemNutrition('roti', 2);
      expect(result.unit).toBe('piece');
      expect(result.weightGrams).toBe(80);
    });
  });

  describe('Constraint Enforcement & Error Handling', () => {
    test('rejects foods not present in foods.json with explicit error', () => {
      expect(() => {
        foodService.calculateItemNutrition('pizza', 1, 'slice');
      }).toThrow(/not in the verified food database/);
    });

    test('rejects unsupported units for a dish', () => {
      expect(() => {
        foodService.calculateItemNutrition('roti', 1, 'glass');
      }).toThrow(/not valid for 'Roti'/);
    });

    test('rejects negative or zero quantities', () => {
      expect(() => {
        foodService.calculateItemNutrition('roti', 0, 'piece');
      }).toThrow(/Invalid quantity/);

      expect(() => {
        foodService.calculateItemNutrition('roti', -2, 'piece');
      }).toThrow(/Invalid quantity/);
    });
  });
});
