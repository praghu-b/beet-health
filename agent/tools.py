import os
import json
import logging
import datetime
import requests
from typing import List, Dict, Any, Optional

from food_matcher import food_matcher

logger = logging.getLogger("beet-agent-tools")

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:5000/api")

def get_current_date() -> str:
    return datetime.date.today().isoformat()

def normalize_meal_type(meal_type: Optional[str]) -> str:
    if not meal_type:
        # Default based on current local hour
        hour = datetime.datetime.now().hour
        if 5 <= hour < 11:
            return "breakfast"
        elif 11 <= hour < 16:
            return "lunch"
        elif 16 <= hour < 19:
            return "snack"
        else:
            return "dinner"
    
    mt = meal_type.strip().lower()
    if mt in ["breakfast", "morning", "nashta", "breakfasts"]:
        return "breakfast"
    elif mt in ["lunch", "afternoon", "dopahar"]:
        return "lunch"
    elif mt in ["dinner", "night", "raat"]:
        return "dinner"
    elif mt in ["snack", "snacks", "tea time", "evening"]:
        return "snack"
    return "lunch"

async def broadcast_room_update(room: Any, action: str, details: Dict[str, Any]):
    """Publishes a real-time data packet to the LiveKit room for instant UI sync."""
    if not room:
        return
    try:
        payload = json.dumps({
            "type": "MEAL_LOG_UPDATED",
            "action": action,
            "details": details,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }).encode("utf-8")
        if hasattr(room, "local_participant") and room.local_participant:
            await room.local_participant.publish_data(payload, reliable=True)
            logger.info(f"Published real-time data event: {action}")
    except Exception as e:
        logger.warning(f"Failed to publish room data update: {e}")

def log_meal_action(
    items: List[Dict[str, Any]],
    meal_type: Optional[str] = None,
    date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Core business logic for logging meal items.
    Validates foods against foods.json and calls the backend REST API.
    """
    target_date = date or get_current_date()
    target_meal_type = normalize_meal_type(meal_type)

    if not items or not isinstance(items, list):
        return {
            "success": False,
            "message": "Please specify at least one food item and quantity to log."
        }

    # Pre-validate each item against food database
    verified_items = []
    for item in items:
        food_query = item.get("food") or item.get("foodName") or item.get("name") or ""
        qty = float(item.get("quantity", 1))
        unit = item.get("unit")

        matched = food_matcher.find_food(food_query)
        if not matched:
            return {
                "success": False,
                "message": (
                    f"I cannot log '{food_query}' because it is not in Beet's verified food database. "
                    "Only items from our curated nutrition list (like roti, dal tadka, paneer, eggs, idli, rice) can be logged."
                )
            }
        
        try:
            calculated = food_matcher.calculate_nutrition(matched["id"], qty, unit)
            verified_items.append({
                "food": matched["id"],
                "quantity": qty,
                "unit": calculated["unit"]
            })
        except ValueError as e:
            return {
                "success": False,
                "message": str(e)
            }

    # Call backend API
    payload = {
        "date": target_date,
        "mealType": target_meal_type,
        "items": verified_items
    }

    try:
        res = requests.post(f"{API_BASE_URL}/meals", json=payload, timeout=8)
        data = res.json()
        if res.status_code in [200, 201] and data.get("success"):
            meal_log = data.get("data", {})
            total_cals = meal_log.get("totalCalories", 0)
            total_prot = meal_log.get("totalProtein", 0)
            
            # Format friendly spoken confirmation
            food_phrases = [
                f"{it['quantity']} {it['unit']} of {it['food']}" for it in verified_items
            ]
            items_str = " and ".join(food_phrases)

            speech = (
                f"Logged {items_str} for {target_meal_type}. "
                f"Total {target_meal_type} calories are now {total_cals} kcal, with {total_prot} grams of protein."
            )
            return {
                "success": True,
                "speech": speech,
                "data": meal_log,
                "action": "log"
            }
        else:
            return {
                "success": False,
                "message": data.get("message", "Failed to log meal to backend.")
            }
    except Exception as e:
        logger.error(f"Error calling backend API: {e}")
        return {
            "success": False,
            "message": f"Could not connect to the meal backend service: {str(e)}"
        }

def edit_meal_action(
    food: str,
    new_quantity: float,
    new_unit: Optional[str] = None,
    meal_type: Optional[str] = None,
    date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Core business logic for editing an existing logged meal item.
    """
    target_date = date or get_current_date()
    normalized_mt = normalize_meal_type(meal_type) if meal_type else None

    matched = food_matcher.find_food(food)
    if not matched:
        return {
            "success": False,
            "message": f"I couldn't recognize '{food}' in Beet's verified food database."
        }

    payload = {
        "date": target_date,
        "foodQuery": matched["id"],
        "quantity": float(new_quantity),
        "unit": new_unit
    }
    if normalized_mt:
        payload["mealType"] = normalized_mt

    try:
        res = requests.patch(f"{API_BASE_URL}/meals/items/update", json=payload, timeout=8)
        data = res.json()
        if res.status_code == 200 and data.get("success"):
            item = data.get("updatedItem", {})
            log = data.get("data", {})
            speech = (
                f"Updated your {item.get('foodName', food)} to {item.get('quantity')} {item.get('unit')}. "
                f"Total {log.get('mealType')} is now {log.get('totalCalories')} kcal."
            )
            return {
                "success": True,
                "speech": speech,
                "data": log,
                "action": "edit"
            }
        else:
            return {
                "success": False,
                "message": data.get("message", f"Couldn't find an existing entry for {food} to update.")
            }
    except Exception as e:
        logger.error(f"Error calling edit meal API: {e}")
        return {
            "success": False,
            "message": f"Backend communication failed: {str(e)}"
        }

def delete_meal_action(
    food: str,
    meal_type: Optional[str] = None,
    date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Core business logic for deleting a logged food item.
    """
    target_date = date or get_current_date()
    normalized_mt = normalize_meal_type(meal_type) if meal_type else None

    matched = food_matcher.find_food(food)
    if not matched:
        return {
            "success": False,
            "message": f"Food '{food}' is not recognized in our database."
        }

    payload = {
        "date": target_date,
        "foodQuery": matched["id"]
    }
    if normalized_mt:
        payload["mealType"] = normalized_mt

    try:
        res = requests.delete(f"{API_BASE_URL}/meals/items/delete", json=payload, timeout=8)
        data = res.json()
        if res.status_code == 200 and data.get("success"):
            speech = f"Removed {matched['name']} from your logs."
            return {
                "success": True,
                "speech": speech,
                "data": data.get("data"),
                "action": "delete"
            }
        else:
            return {
                "success": False,
                "message": data.get("message", f"Could not find {food} to remove.")
            }
    except Exception as e:
        logger.error(f"Error calling delete meal API: {e}")
        return {
            "success": False,
            "message": f"Backend communication failed: {str(e)}"
        }

def get_today_summary_action(date: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetches the daily macro summary.
    """
    target_date = date or get_current_date()
    try:
        res = requests.get(f"{API_BASE_URL}/meals/summary", params={"date": target_date}, timeout=8)
        data = res.json()
        if res.status_code == 200 and data.get("success"):
            s = data.get("summary", {})
            speech = (
                f"Today you have logged {s.get('totalItems', 0)} item(s) across {s.get('mealCount', 0)} meal(s). "
                f"Total intake: {s.get('totalCalories', 0)} calories, "
                f"{s.get('totalProtein', 0)} grams protein, "
                f"{s.get('totalCarbs', 0)} grams carbs, and "
                f"{s.get('totalFat', 0)} grams fat."
            )
            return {
                "success": True,
                "speech": speech,
                "summary": s
            }
        else:
            return {
                "success": False,
                "message": "Failed to fetch daily summary."
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Could not reach backend service: {str(e)}"
        }

def get_logged_meals_action(
    meal_type: Optional[str] = None,
    date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Fetches already logged meals and items for a specific meal slot or the entire day.
    Helps ground the agent so it knows what foods currently exist in MongoDB.
    """
    target_date = date or get_current_date()
    params = {"date": target_date}

    normalized_mt = None
    if meal_type and meal_type.strip():
        raw_mt = meal_type.strip().lower()
        if raw_mt not in ["all", "everything", "today", "day"]:
            normalized_mt = normalize_meal_type(raw_mt)
            params["mealType"] = normalized_mt

    try:
        res = requests.get(f"{API_BASE_URL}/meals", params=params, timeout=8)
        data = res.json()
        if res.status_code == 200 and data.get("success"):
            logs = data.get("data", [])

            def format_qty(qty: Any) -> str:
                try:
                    f = float(qty)
                    return str(int(f)) if f.is_integer() else str(f)
                except Exception:
                    return str(qty)

            if normalized_mt:
                items = []
                total_cals = 0.0
                for log in logs:
                    if log.get("mealType") == normalized_mt:
                        items.extend(log.get("items", []))
                        total_cals += log.get("totalCalories", 0)

                if not items:
                    speech = f"You don't have any items logged for {normalized_mt} today."
                else:
                    item_descriptions = [
                        f"{format_qty(it.get('quantity'))} {it.get('unit')} of {it.get('foodName', it.get('foodId'))}"
                        for it in items
                    ]
                    items_str = ", ".join(item_descriptions)
                    speech = (
                        f"For {normalized_mt}, you have logged: {items_str} "
                        f"(total {round(total_cals, 1)} kcal)."
                    )
                return {
                    "success": True,
                    "speech": speech,
                    "data": logs,
                    "action": "get_logged_meals"
                }

            # Case: All meals for the day
            meal_summaries = []
            total_items = 0
            for log in logs:
                mt = log.get("mealType")
                items = log.get("items", [])
                if items:
                    total_items += len(items)
                    item_strs = [
                        f"{format_qty(it.get('quantity'))} {it.get('unit')} of {it.get('foodName', it.get('foodId'))}"
                        for it in items
                    ]
                    meal_summaries.append(f"for {mt}: {', '.join(item_strs)} ({log.get('totalCalories', 0)} kcal)")

            if total_items == 0:
                speech = "You haven't logged any meals today yet."
            else:
                speech = f"Today you have logged: {'; '.join(meal_summaries)}."

            return {
                "success": True,
                "speech": speech,
                "data": logs,
                "action": "get_logged_meals"
            }
        else:
            return {
                "success": False,
                "message": data.get("message", "Failed to retrieve meals from backend.")
            }
    except Exception as e:
        logger.error(f"Error calling get meals API: {e}")
        return {
            "success": False,
            "message": f"Could not reach meal service: {str(e)}"
        }

