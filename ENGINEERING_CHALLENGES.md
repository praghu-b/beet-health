# Beet Voice Meal Logger — Engineering Challenges, Debugging & Solutions

This document tracks real technical challenges encountered during the development of Beet's voice assistant, their underlying root causes, debugging processes, and the solutions implemented. Use this as a reference during system design and technical interview discussions.

---

## Challenge 1: LiveKit Agents 1.x Architecture Migration (Legacy Pipeline vs Modern AgentSession)

### 1. The Symptom
When the voice worker joined the LiveKit room, the process crashed with:
```
ModuleNotFoundError: No module named 'livekit.agents.pipeline'
```

### 2. Root Cause Analysis
- `livekit-agents` was installed at version **`1.7.1`**.
- In LiveKit Agents 1.x, the legacy monolithic `VoicePipelineAgent` from 0.x was completely deprecated and removed in favor of the modular **`AgentSession`** and **`Agent`** framework.
- The initial scaffolding attempted to import `VoicePipelineAgent` from `livekit.agents.pipeline`, which no longer exists in modern releases.

### 3. Solution & Architecture
- Migrated `agent/agent.py` to inherit from the official `livekit.agents.Agent`:
  ```python
  class BeetNutritionAgent(Agent):
      def __init__(self, room=None):
          super().__init__(instructions=SYSTEM_INSTRUCTION)
          self.room = room

      @function_tool
      async def log_meal(self, context: RunContext, food: str, quantity: float, unit: str = "", meal_type: str = "lunch") -> str:
          ...
  ```
- Configured **`AgentSession`** with zero-external-key LiveKit Inference:
  - **STT**: `inference.STT("deepgram/nova-3")`
  - **LLM**: `inference.LLM("google/gemma-4-31b-it")`
  - **TTS**: `inference.TTS("cartesia/sonic-3")`
  - **VAD**: `silero.VAD.load()`
- Initiated session with `await session.start(agent=agent, room=ctx.room)` and welcomed the user with `await session.say(...)`.

### 4. Key Interview Takeaway
> *"When integrating bleeding-edge AI frameworks (like LiveKit Agents), major versions frequently redesign agent lifecycles. Rather than relying on outdated online guides, we inspected package symbols at runtime (`dir(livekit.agents)`), identified the new `AgentSession` and `@function_tool` paradigms, and migrated cleanly to the latest architecture."*

---

## Challenge 2: Dual Assistant Concurrency & Echo Mutation Bug

### 1. The Symptom
- The user heard two assistants speaking simultaneously with different wording ("sound overlapping" / echo).
- Speaking *"add 1 glass of milk"* caused **two duplicate entries** to be created in MongoDB.

### 2. Root Cause Analysis
- LiveKit Cloud automatically dispatches a job to any registered worker when a room is created if the worker uses a generic `agent_name=""`.
- Concurrently, our Node.js backend (`server/src/controllers/tokenController.js`) had an explicit dispatch call: `dispatchClient.createDispatch(room, '')`.
- Because both dispatches ran in parallel without checking for an existing agent, **LiveKit Cloud spawned two separate jobs (`AJ_...`) for the exact same room**.
- Both agent instances subscribed to the client's microphone audio track. When the user spoke, both agents transcribed the speech, both independently executed the `log_meal` tool against the backend API, and both synthesized TTS speech back into the room.

### 3. Solution & Architecture
1. **Named Worker Isolation (`agent/agent.py`)**:
   Registered the worker under a dedicated namespace:
   ```python
   WorkerOptions(agent_name="beet-nutrition-agent", entrypoint_fnc=entrypoint)
   ```
   This prevents LiveKit Cloud from blindly routing generic room dispatches to it.
2. **In-Room Participant Concurrency Guard (`agent/agent.py`)**:
   Added a safeguard inside `entrypoint(ctx)`:
   ```python
   for p in ctx.room.remote_participants.values():
       if p.identity.startswith("agent") or "agent" in p.identity.lower():
           logger.warning(f"Another agent ({p.identity}) is already active. Exiting duplicate.")
           return
   ```
3. **Backend Deduplication (`server/src/controllers/tokenController.js`)**:
   Targeted the specific agent name in dispatch requests rather than wildcards.

### 4. Key Interview Takeaway
> *"In distributed WebRTC architectures, agent dispatching must be strictly idempotent. A double dispatch can cause catastrophic side effects like duplicate database writes and acoustic feedback loops. We solved this by pairing named worker registration with an in-room participant check to guarantee exactly-once agent execution per room."*

---

## Challenge 3: Reconnection Latency & Stale Cloud Dispatch State

### 1. The Symptom
- When the user disconnected and reconnected after being idle, the assistant did not respond for ~1–2 minutes before suddenly springing to life.

### 2. Root Cause Analysis
- When the user clicked "Disconnect", the agent closed its session because `close_on_disconnect=True` (the default behavior when all human participants leave).
- When the user clicked "Start Voice Assistant" again, the client requested a new token from `GET /api/livekit/token`.
- The backend inspected `dispatchClient.listDispatch(room)`.
- In LiveKit Cloud, dispatch metadata remains in the room's record until the room's idle timeout completes (1–2 minutes).
- As a result, `listDispatch(room)` returned the old closed dispatch record. The backend assumed an agent was already running and skipped creating a new dispatch.
- The user was stranded in a room with no agent until the cloud TTL finally expired.

### 3. Solution & Architecture
- **Active Probing over Passive Cache**:
  Replaced the passive dispatch list check with active participant inspection using `RoomServiceClient`:
  ```javascript
  const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
  const participants = await roomService.listParticipants(room).catch(() => []);
  const hasActiveAgent = participants.some(
    (p) => p.identity.startsWith('agent') || p.kind === 2 || p.isAgent
  );

  if (!hasActiveAgent) {
    // Purge lingering dispatch IDs if any, and summon a fresh agent immediately
    await dispatchClient.createDispatch(room, 'beet-nutrition-agent');
  }
  ```
- **Real-Time UI State Machine (`client/src/components/VoiceRoom.jsx`)**:
  Hooked into LiveKit events (`RoomEvent.Connected`, `ParticipantConnected`, `ActiveSpeakersChanged`) so the user sees:
  - *"Waiting for Beet Assistant to join..."*
  - *"Beet Assistant joined! Listening to you..."*
  - *"Beet Assistant is speaking..."*

### 4. Key Interview Takeaway
> *"Don't confuse control plane metadata with data plane reality. Checking whether a dispatch record exists isn't the same as checking if an agent is currently connected and processing WebRTC packets. Querying live room participant presence resolved reconnect delays and gave users instantaneous zero-latency reconnects."*

---

## Challenge 4: Strict Nutritional Accuracy vs. LLM Hallucinations

### 1. The Symptom
- LLMs often estimate calories, create invented dishes, or approximate portion weights when asked about regional food items (e.g. guessing that 1 roti is 200 calories or inventing dishes outside the database).

### 2. Root Cause Analysis
- Nutrition compliance requires deterministic mathematics. Allowing an LLM to compute calories from its weights leads to unpredictable drift and unverified data.

### 3. Solution & Architecture
- **Database Boundary Enforcement**:
  `foods.json` is enforced as the single source of truth (30 predefined Indian and common dishes).
- **Two-Tier Validation**:
  1. The LLM only acts as a semantic extractor (extracting dish name, portion, and household unit like *katori*, *bowl*, *piece*).
  2. The extracted parameters are passed to `foodService.js` / `food_matcher.py` which resolves aliases deterministically (e.g. *phulka*, *chapati* -> *roti*) and calculates exact macronutrients:
     $$\text{grams} = \text{quantity} \times \text{unit\_weight}$$
     $$\text{calories} = \frac{\text{grams}}{100} \times \text{calories\_per\_100g}$$
  3. If a dish is not in `foods.json`, the agent politely declines and explains that only verified Beet database dishes are supported.

### 4. Key Interview Takeaway
> *"In health and nutrition applications, never delegate critical math or validation to generative models. We treated the LLM purely as a natural language semantic parser, while enforcing 100% deterministic validation, alias resolution, and unit-to-gram mathematics in our backend service layer."*

---

## Summary Matrix

| Problem | Root Cause | Fix | Interview Impact |
| :--- | :--- | :--- | :--- |
| **Import Error in Agent** | `livekit-agents` 1.7+ removed legacy `VoicePipelineAgent` | Migrated to `AgentSession` + `Agent` + `@function_tool` | Demonstrates adaptability to modern framework evolutions |
| **Dual Agent Voice Overlap** | Double dispatch (LiveKit Cloud auto-dispatch + explicit backend dispatch) | Named worker (`beet-nutrition-agent`) + in-room participant deduplication | Proves understanding of WebRTC distributed state and concurrency |
| **Reconnect Delay** | Stale dispatch record kept backend from re-dispatching | Query live room participants (`RoomServiceClient`) instead of passive dispatch list | Highlights mastery of control-plane vs data-plane reality |
| **Nutrition Drift** | LLM hallucinating portion sizes and unsupported foods | Deterministic unit-to-gram conversion engine backed by `foods.json` | Shows architectural discipline: AI for NLU, deterministic code for math |
