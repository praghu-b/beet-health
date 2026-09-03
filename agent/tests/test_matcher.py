import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from food_matcher import FoodMatcher

class TestFoodMatcher(unittest.TestCase):
    def setUp(self):
        self.matcher = FoodMatcher()

    def test_database_loads_all_dishes(self):
        foods = self.matcher.get_all_foods()
        self.assertEqual(len(foods), 30)

    def test_alias_resolution(self):
        self.assertEqual(self.matcher.find_food("chapati")["id"], "roti")
        self.assertEqual(self.matcher.find_food("phulka")["id"], "roti")
        self.assertEqual(self.matcher.find_food("wheat roti")["id"], "roti")
        self.assertEqual(self.matcher.find_food("chawal")["id"], "plain_rice")
        self.assertEqual(self.matcher.find_food("daal")["id"], "dal_tadka")
        self.assertEqual(self.matcher.find_food("dahi")["id"], "curd")
        self.assertEqual(self.matcher.find_food("anda")["id"], "boiled_egg")
        self.assertEqual(self.matcher.find_food("badam")["id"], "almonds")

    def test_nutrition_calculation_exact(self):
        # 2 pieces of roti = 80g
        r = self.matcher.calculate_nutrition("roti", 2, "piece")
        self.assertEqual(r["foodId"], "roti")
        self.assertEqual(r["quantity"], 2)
        self.assertEqual(r["weightGrams"], 80)
        self.assertEqual(r["calories"], 237.6)
        self.assertEqual(r["protein"], 9.0)
        self.assertEqual(r["carbs"], 46.4)
        self.assertEqual(r["fat"], 3.0)

        # 1 katori dal tadka = 150g
        d = self.matcher.calculate_nutrition("dal", 1, "katori")
        self.assertEqual(d["foodId"], "dal_tadka")
        self.assertEqual(d["calories"], 180.0)
        self.assertEqual(d["protein"], 9.0)

    def test_unknown_food_rejection(self):
        with self.assertRaises(ValueError):
            self.matcher.calculate_nutrition("pizza", 1)

        with self.assertRaises(ValueError):
            self.matcher.calculate_nutrition("burger", 1)

if __name__ == "__main__":
    unittest.main()
