import os
import sys
import logging
import asyncio
from dotenv import load_dotenv

# Load environment variables from parent .env
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(dotenv_path=env_path)
load_dotenv()

from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    function_tool,
    inference,
    RunContext,
)
from livekit.agents.voice.agent_session import TurnHandlingOptions
from livekit.plugins import silero

from food_matcher import food_matcher
import tools

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("beet-voice-agent")

SYSTEM_INSTRUCTION = """
You are Beet's personal voice nutrition assistant.
Your goal is to help users track their meals effortlessly through spoken conversation.

CORE RULES & BEHAVIOR:
1. Core Voice Operations:
   - Log a meal: (e.g., "I had two rotis and a katori of dal for lunch.") -> Call log_meal.
   - Edit an entry: (e.g., "Actually make that three rotis.") -> Call edit_meal.
   - Delete an entry: (e.g., "Remove the plain dosa I logged this morning.") -> Call delete_meal.
   - Check logged meals: (e.g., "What did I have for lunch?", "What do I have logged today?") -> Call get_logged_meals.
   - Daily macro summary: (e.g., "What are my total calories today?") -> Call get_daily_summary.
   - Never assume or claim a meal is empty without checking with get_logged_meals.

2. Speech Recognition & Phonetic Tolerance:
   - Spoken words may occasionally have acoustic noise or minor phonetic variations (e.g. "plane dosa" -> plain dosa, "tridosa" -> 3 plain dosas, "dal" -> dal tadka, "2 roti" -> 2 rotis).
   - Recognize the user's intent from Beet's verified database:
     (roti, plain rice, dal tadka, rajma, chole, paneer butter masala, palak paneer, curd, toned milk, chai, idli, plain dosa, sambar, coconut chutney, poha, upma, aloo paratha, plain paratha, egg omelette, boiled egg, chicken curry, tandoori chicken, fish curry, mixed veg sabzi, bhindi masala, khichdi, chicken biryani, banana, apple, almonds).
   - If the user says "remove the plain dosa", execute delete_meal for plain dosa immediately.

3. Strict Database Boundary:
   - If a user asks to log an unverified food outside our database (e.g. pizza, pasta, burger, soda), politely explain: "Beet currently only tracks dishes in our verified food database."

4. Concise Confirmations:
   - Keep answers under two short sentences.
   - Mention the food item, portion, and calories/protein.
"""

class BeetNutritionAgent(Agent):
    def __init__(self, room=None):
        super().__init__(instructions=SYSTEM_INSTRUCTION)
        self.room = room

    @function_tool
    async def log_meal(
        self,
        context: RunContext,
        food: str,
        quantity: float,
        unit: str = "",
        meal_type: str = "lunch"
    ) -> str:
        """Log a meal item that the user ate.
        
        Args:
            food: Name of the food dish (e.g. 'roti', 'dal tadka', 'chole', 'plain dosa', 'paneer butter masala').
            quantity: Number of portions or amount eaten (e.g. 2, 1, 0.5).
            unit: Optional household unit (e.g. 'piece', 'katori', 'bowl', 'plate', 'glass', 'cup').
            meal_type: Meal slot ('breakfast', 'lunch', 'dinner', 'snack').
        """
        logger.info(f"log_meal tool called: food={food}, quantity={quantity}, unit={unit}, meal_type={meal_type}")
        items = [{"food": food, "quantity": float(quantity), "unit": unit or None}]
        res = tools.log_meal_action(items, meal_type=meal_type)
        if res.get("success"):
            await tools.broadcast_room_update(self.room, "log", res.get("data", {}))
            return res.get("speech")
        return res.get("message")

    @function_tool
    async def edit_meal(
        self,
        context: RunContext,
        food: str,
        new_quantity: float,
        new_unit: str = "",
        meal_type: str = ""
    ) -> str:
        """Edit or update the quantity of an already logged meal item.
        
        Args:
            food: Name of the food dish to update (e.g. 'roti', 'plain dosa').
            new_quantity: The updated quantity (e.g. 3).
            new_unit: Optional updated unit (e.g. 'piece', 'katori').
            meal_type: Optional meal slot (e.g. 'lunch').
        """
        logger.info(f"edit_meal tool called: food={food}, new_quantity={new_quantity}, new_unit={new_unit}, meal_type={meal_type}")
        res = tools.edit_meal_action(
            food=food,
            new_quantity=float(new_quantity),
            new_unit=new_unit or None,
            meal_type=meal_type or None
        )
        if res.get("success"):
            await tools.broadcast_room_update(self.room, "edit", res.get("data", {}))
            return res.get("speech")
        return res.get("message")

    @function_tool
    async def delete_meal(
        self,
        context: RunContext,
        food: str,
        meal_type: str = ""
    ) -> str:
        """Delete or remove a logged food item from today's meals.
        
        Args:
            food: Name of the food dish to remove (e.g. 'chai', 'dal', 'plain dosa', 'roti').
            meal_type: Optional meal slot (e.g. 'breakfast', 'lunch', 'dinner').
        """
        logger.info(f"delete_meal tool called: food={food}, meal_type={meal_type}")
        res = tools.delete_meal_action(food=food, meal_type=meal_type or None)
        if res.get("success"):
            await tools.broadcast_room_update(self.room, "delete", {"food": food})
            return res.get("speech")
        return res.get("message")

    @function_tool
    async def get_daily_summary(self, context: RunContext) -> str:
        """Get the daily nutritional summary of total calories and macronutrients eaten today."""
        logger.info("get_daily_summary tool called")
        res = tools.get_today_summary_action()
        return res.get("speech") if res.get("success") else res.get("message")

    @function_tool
    async def get_logged_meals(
        self,
        context: RunContext,
        meal_type: str = ""
    ) -> str:
        """Check or retrieve already logged meals and food items for today (e.g. what the user had for lunch, breakfast, dinner, or throughout the day).
        
        Args:
            meal_type: Optional meal slot ('breakfast', 'lunch', 'dinner', 'snack', or leave blank for all meals today).
        """
        logger.info(f"get_logged_meals tool called: meal_type={meal_type}")
        res = tools.get_logged_meals_action(meal_type=meal_type or None)
        return res.get("speech") if res.get("success") else res.get("message")


async def entrypoint(ctx: JobContext):
    logger.info(f"Connecting agent worker to LiveKit room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)

    # Prevent duplicate agents from joining the same room
    for p in ctx.room.remote_participants.values():
        if p.identity.startswith("agent") or "agent" in p.identity.lower():
            logger.warning(f"Another agent ({p.identity}) is already active in {ctx.room.name}. Exiting duplicate.")
            return

    logger.info("Initializing LiveKit Inference session (Deepgram STT, Gemma LLM, Cartesia TTS)...")

    session = AgentSession(
        stt=inference.STT("deepgram/nova-3"),
        llm=inference.LLM("google/gemma-4-31b-it"),
        tts=inference.TTS("cartesia/sonic-3"),
        vad=silero.VAD.load(),
        turn_handling=TurnHandlingOptions(turn_detection="vad"),
    )

    agent = BeetNutritionAgent(room=ctx.room)
    
    logger.info("Starting AgentSession with BeetNutritionAgent...")
    await session.start(agent=agent, room=ctx.room)

    # Greet the user out loud upon joining the room
    logger.info("Agent joined room. Speaking initial greeting...")
    await session.say("Hi! I'm Beet, your nutrition assistant. What did you have to eat?")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(agent_name="beet-nutrition-agent", entrypoint_fnc=entrypoint))
