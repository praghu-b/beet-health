import os
import sys
import logging
import asyncio
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(dotenv_path=env_path)
load_dotenv()

from food_matcher import food_matcher
import tools

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("beet-voice-agent")

SYSTEM_INSTRUCTION = """
You are Beet's personal voice nutrition assistant.
Your goal is to help users effortlessly track their meals through natural conversation.

CORE RULES & BEHAVIOR:
1. You support three primary voice operations:
   - Log a meal: When the user says what they ate (e.g., "I had two rotis and a katori of dal for lunch.").
   - Edit an entry: When the user corrects or changes an existing item (e.g., "Actually make that three rotis.").
   - Delete an entry: When the user asks to remove a logged item (e.g., "Remove the chai I logged this morning.").
2. STRICT FOOD DATABASE BOUNDARY:
   - You can ONLY log foods that exist in Beet's verified food database (e.g., roti, dal tadka, rajma, chole, paneer butter masala, palak paneer, curd, toned milk, chai, idli, plain dosa, sambar, coconut chutney, poha, upma, aloo paratha, plain paratha, egg omelette, boiled egg, chicken curry, tandoori chicken, fish curry, mixed veg sabzi, bhindi masala, khichdi, chicken biryani, banana, apple, almonds).
   - If a user mentions an unsupported food (e.g. pizza, pasta, burger, soda), politely explain that Beet's verified database currently only supports the curated dishes in our database, and do not log it.
3. Always respond naturally and concisely. Mention the total calories or protein added/updated so the user gets instant audible feedback on their progress.
"""

def create_agent_pipeline():
    """
    Sets up LiveKit Agent with Speech-to-Text, LLM with tool calling, and Text-to-Speech.
    Supports LiveKit Inference natively, or provider plugins.
    """
    from livekit.agents import llm
    from livekit.agents.pipeline import VoicePipelineAgent
    from livekit.plugins import silero

    # 1. Try LiveKit Inference (no provider keys needed)
    try:
        from livekit.agents import inference
        stt = inference.STT("deepgram/nova-3")
        llm_instance = inference.LLM("google/gemma-4-31b-it")
        tts = inference.TTS("cartesia/sonic-3")
        logger.info("Initialized LiveKit Inference models (Deepgram/Nova-3, Google/Gemma, Cartesia/Sonic-3)")
    except Exception as e:
        logger.info(f"LiveKit inference fallback to provider plugins: {e}")
        from livekit.plugins import deepgram, openai
        stt = deepgram.STT()
        llm_instance = openai.LLM()
        tts = openai.TTS()

    chat_context = llm.ChatContext().append(
        role="system",
        text=SYSTEM_INSTRUCTION
    )

    class MealAssistantFunctionContext(llm.FunctionContext):
        def __init__(self, room=None):
            super().__init__()
            self.room = room

        @llm.ai_callable(description="Log one or more foods eaten for a meal (breakfast, lunch, dinner, snack).")
        async def log_meal(
            self,
            items_description: str,
            meal_type: str = "lunch"
        ) -> str:
            """
            Log food items.
            items_description: e.g. "2 rotis and 1 katori of dal"
            meal_type: breakfast, lunch, dinner, or snack
            """
            # Extract items via food_matcher
            words = items_description.lower().split()
            # Simple parser fallback or split by 'and'
            parts = items_description.replace(" and ", ",").replace("&", ",").split(",")
            parsed_items = []
            for part in parts:
                part = part.strip()
                if not part:
                    continue
                # Extract number if present
                tokens = part.split()
                qty = 1.0
                unit = None
                food_query = part
                for tok in tokens:
                    try:
                        qty = float(tok)
                        part_without_qty = part.replace(tok, "").strip()
                        food_query = part_without_qty
                        break
                    except ValueError:
                        pass
                
                # Check known units
                for u in ["katori", "piece", "plate", "bowl", "glass", "cup", "tablespoon", "gram"]:
                    if u in food_query:
                        unit = u
                        food_query = food_query.replace(u + "s", "").replace(u, "").replace("of", "").strip()
                        break

                parsed_items.append({
                    "food": food_query.strip(),
                    "quantity": qty,
                    "unit": unit
                })

            res = tools.log_meal_action(parsed_items, meal_type=meal_type)
            if res.get("success"):
                await tools.broadcast_room_update(self.room, "log", res.get("data", {}))
                return res.get("speech")
            return res.get("message")

        @llm.ai_callable(description="Edit or update an existing meal entry (e.g. change quantity of roti to 3).")
        async def edit_meal(
            self,
            food: str,
            new_quantity: float,
            new_unit: str = "",
            meal_type: str = ""
        ) -> str:
            res = tools.edit_meal_action(
                food=food,
                new_quantity=new_quantity,
                new_unit=new_unit or None,
                meal_type=meal_type or None
            )
            if res.get("success"):
                await tools.broadcast_room_update(self.room, "edit", res.get("data", {}))
                return res.get("speech")
            return res.get("message")

        @llm.ai_callable(description="Delete a logged food item from today's meals (e.g. remove chai or remove dal).")
        async def delete_meal(
            self,
            food: str,
            meal_type: str = ""
        ) -> str:
            res = tools.delete_meal_action(food=food, meal_type=meal_type or None)
            if res.get("success"):
                await tools.broadcast_room_update(self.room, "delete", {"food": food})
                return res.get("speech")
            return res.get("message")

        @llm.ai_callable(description="Get the summary of total calories and macronutrients consumed today.")
        async def get_daily_summary(self) -> str:
            res = tools.get_today_summary_action()
            return res.get("speech") if res.get("success") else res.get("message")

    return {
        "stt": stt,
        "llm": llm_instance,
        "tts": tts,
        "chat_context": chat_context,
        "vad": silero.VAD.load(),
        "FunctionContextClass": MealAssistantFunctionContext
    }

async def entrypoint(ctx):
    from livekit.agents import AutoSubscribe
    logger.info(f"Connecting agent to LiveKit room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)

    pipeline_cfg = create_agent_pipeline()
    fnc_ctx = pipeline_cfg["FunctionContextClass"](room=ctx.room)

    from livekit.agents.pipeline import VoicePipelineAgent
    agent = VoicePipelineAgent(
        vad=pipeline_cfg["vad"],
        stt=pipeline_cfg["stt"],
        llm=pipeline_cfg["llm"],
        tts=pipeline_cfg["tts"],
        chat_ctx=pipeline_cfg["chat_context"],
        fnc_ctx=fnc_ctx
    )

    participant = await ctx.wait_for_participant()
    logger.info(f"Participant joined: {participant.identity}. Starting voice pipeline.")
    agent.start(ctx.room, participant)

    # Initial greeting - Agent talks back immediately!
    await agent.say("Hi! I'm Beet, your nutrition assistant. What did you have to eat?", allow_interruptions=True)

if __name__ == "__main__":
    from livekit.agents import WorkerOptions, cli
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
