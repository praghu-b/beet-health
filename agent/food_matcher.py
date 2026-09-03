import json
import os
from typing import Dict, Any, Optional, List, Tuple

class FoodMatcher:
    def __init__(self, foods_path: Optional[str] = None):
        if not foods_path:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            foods_path = os.path.abspath(os.path.join(current_dir, "..", "foods.json"))
        
        self.foods_path = foods_path
        self.foods: List[Dict[str, Any]] = []
        self.food_map: Dict[str, Dict[str, Any]] = {}
        self.alias_map: Dict[str, Dict[str, Any]] = {}
        self._load_foods()

    def _load_foods(self):
        if not os.path.exists(self.foods_path):
            raise FileNotFoundError(f"foods.json not found at: {self.foods_path}")
        
        with open(self.foods_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.foods = data.get("foods", [])

        for food in self.foods:
            self.food_map[food["id"].lower()] = food
            self.alias_map[food["name"].lower()] = food

            for alias in food.get("aliases", []):
                self.alias_map[alias.lower().strip()] = food

    def get_all_foods(self) -> List[Dict[str, Any]]:
        return self.foods

    def find_food(self, query: str) -> Optional[Dict[str, Any]]:
        if not query or not isinstance(query, str):
            return None
        
        normalized = query.strip().lower()

        # 1. Exact ID
        if normalized in self.food_map:
            return self.food_map[normalized]

        # 2. Exact Name / Alias
        if normalized in self.alias_map:
            return self.alias_map[normalized]

        # 3. Substring match
        for food in self.foods:
            if normalized in food["name"].lower() or food["name"].lower() in normalized:
                return food
            for alias in food.get("aliases", []):
                if normalized in alias.lower() or alias.lower() in normalized:
                    return food

        return None

    def match_unit(self, food: Dict[str, Any], unit_name: Optional[str]) -> Optional[Dict[str, Any]]:
        if not unit_name:
            return food["units"][0] # default to first unit

        normalized = unit_name.strip().lower()
        for u in food.get("units", []):
            u_name = u["name"].lower()
            if (
                u_name == normalized
                or f"{u_name}s" == normalized
                or f"{normalized}s" == u_name
                or (u_name == "piece" and normalized in ["pieces", "pc", "pcs"])
                or (u_name == "katori" and normalized in ["katoris", "katorie"])
                or (u_name == "plate" and normalized in ["plates"])
                or (u_name == "bowl" and normalized in ["bowls"])
                or (u_name == "glass" and normalized in ["glasses"])
                or (u_name == "cup" and normalized in ["cups"])
                or (u_name == "tablespoon" and normalized in ["tablespoons", "tbsp", "spoon", "spoons"])
            ):
                return u
        return None

    def calculate_nutrition(self, food_query: str, quantity: float, unit_name: Optional[str] = None) -> Dict[str, Any]:
        food = self.find_food(food_query)
        if not food:
            raise ValueError(
                f"Food '{food_query}' is not in the verified Beet food database. Only dishes in foods.json can be logged."
            )

        if quantity <= 0:
            raise ValueError(f"Quantity must be greater than 0, received {quantity}.")

        unit_obj = self.match_unit(food, unit_name)
        if not unit_obj:
            allowed = ", ".join([u["name"] for u in food["units"]])
            raise ValueError(f"Unit '{unit_name}' is not allowed for '{food['name']}'. Allowed units: {allowed}.")

        weight_grams = round(quantity * unit_obj["grams"], 1)
        multiplier = weight_grams / 100.0

        macros = food["macrosPer100g"]
        calories = round(macros["calories"] * multiplier, 1)
        protein = round(macros["protein"] * multiplier, 1)
        carbs = round(macros["carbs"] * multiplier, 1)
        fat = round(macros["fat"] * multiplier, 1)

        return {
            "foodId": food["id"],
            "foodName": food["name"],
            "quantity": quantity,
            "unit": unit_obj["name"],
            "weightGrams": weight_grams,
            "calories": calories,
            "protein": protein,
            "carbs": carbs,
            "fat": fat
        }

food_matcher = FoodMatcher()
