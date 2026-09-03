import unittest
import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import tools

class TestAgentVoiceTools(unittest.TestCase):
    def test_log_meal_unknown_food_fails_politely(self):
        res = tools.log_meal_action([{"food": "pizza", "quantity": 1}], meal_type="lunch")
        self.assertFalse(res["success"])
        self.assertIn("not in Beet's verified food database", res["message"])

    @patch("tools.requests.post")
    def test_log_meal_scenario_1_success(self, mock_post):
        # Mock backend response for: "I had two rotis and a katori of dal for lunch."
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.json.return_value = {
            "success": True,
            "data": {
                "mealType": "lunch",
                "totalCalories": 417.6,
                "totalProtein": 18.0,
                "items": [
                    {"foodName": "Roti", "quantity": 2, "unit": "piece"},
                    {"foodName": "Dal Tadka", "quantity": 1, "unit": "katori"}
                ]
            }
        }
        mock_post.return_value = mock_resp

        items = [
            {"food": "roti", "quantity": 2, "unit": "piece"},
            {"food": "dal", "quantity": 1, "unit": "katori"}
        ]
        res = tools.log_meal_action(items, meal_type="lunch")
        self.assertTrue(res["success"])
        self.assertIn("Logged 2.0 piece of roti and 1.0 katori of dal_tadka for lunch", res["speech"])
        self.assertIn("417.6 kcal", res["speech"])

    @patch("tools.requests.patch")
    def test_edit_meal_scenario_2_success(self, mock_patch):
        # Mock backend response for: "Actually make that three rotis."
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "success": True,
            "data": {
                "mealType": "lunch",
                "totalCalories": 536.4,
                "totalProtein": 20.2
            },
            "updatedItem": {
                "foodName": "Roti",
                "quantity": 3,
                "unit": "piece"
            }
        }
        mock_patch.return_value = mock_resp

        res = tools.edit_meal_action(food="roti", new_quantity=3, meal_type="lunch")
        self.assertTrue(res["success"])
        self.assertIn("Updated your Roti to 3 piece", res["speech"])
        self.assertIn("536.4 kcal", res["speech"])

    @patch("tools.requests.delete")
    def test_delete_meal_scenario_3_success(self, mock_delete):
        # Mock backend response for: "Remove the chai I logged this morning."
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "success": True,
            "data": None
        }
        mock_delete.return_value = mock_resp

        res = tools.delete_meal_action(food="chai", meal_type="breakfast")
        self.assertTrue(res["success"])
        self.assertIn("Removed Chai (with sugar) from your logs", res["speech"])

    def test_meal_type_normalization(self):
        self.assertEqual(tools.normalize_meal_type("morning"), "breakfast")
        self.assertEqual(tools.normalize_meal_type("nashta"), "breakfast")
        self.assertEqual(tools.normalize_meal_type("afternoon"), "lunch")
        self.assertEqual(tools.normalize_meal_type("night"), "dinner")
        self.assertEqual(tools.normalize_meal_type("evening"), "snack")

if __name__ == "__main__":
    unittest.main()
