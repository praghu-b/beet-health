const foodService = require('../services/foodService');

const getFoods = (req, res) => {
  try {
    const foods = foodService.getAllFoods();
    return res.status(200).json({
      success: true,
      count: foods.length,
      data: foods,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve food database',
      error: error.message,
    });
  }
};

module.exports = {
  getFoods,
};
