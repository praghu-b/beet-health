const mongoose = require('mongoose');

const MealItemSchema = new mongoose.Schema({
  foodId: {
    type: String,
    required: true,
    trim: true,
  },
  foodName: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [0.01, 'Quantity must be greater than 0'],
  },
  unit: {
    type: String,
    required: true,
    trim: true,
  },
  weightGrams: {
    type: Number,
    required: true,
    min: 0,
  },
  calories: {
    type: Number,
    required: true,
    min: 0,
  },
  protein: {
    type: Number,
    required: true,
    min: 0,
  },
  carbs: {
    type: Number,
    required: true,
    min: 0,
  },
  fat: {
    type: Number,
    required: true,
    min: 0,
  },
});

const MealLogSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      index: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'],
    },
    mealType: {
      type: String,
      required: true,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      index: true,
    },
    items: [MealItemSchema],
    totalCalories: {
      type: Number,
      default: 0,
    },
    totalProtein: {
      type: Number,
      default: 0,
    },
    totalCarbs: {
      type: Number,
      default: 0,
    },
    totalFat: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to recalculate aggregated totals
MealLogSchema.methods.recalculateTotals = function () {
  let cals = 0;
  let prot = 0;
  let carbs = 0;
  let fat = 0;

  for (const item of this.items) {
    cals += item.calories || 0;
    prot += item.protein || 0;
    carbs += item.carbs || 0;
    fat += item.fat || 0;
  }

  this.totalCalories = Number(cals.toFixed(1));
  this.totalProtein = Number(prot.toFixed(1));
  this.totalCarbs = Number(carbs.toFixed(1));
  this.totalFat = Number(fat.toFixed(1));
};

MealLogSchema.pre('save', function (next) {
  this.recalculateTotals();
  next();
});

const MealLog = mongoose.model('MealLog', MealLogSchema);

module.exports = {
  MealLog,
  MealItemSchema,
};
