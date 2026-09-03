# Beet — Voice-Based Meal Logger

An end-to-end voice assistant for logging daily nutrition effortlessly, built with **LiveKit Agents**, **Node.js/Express**, **MongoDB Atlas**, and **React**.

---

## 1. Overview & Core Features

Beet is a nutrition-care platform where clients log their daily meals and nutritionists build personalized care plans. This project enables users to speak naturally to log their meals, recalculating exact macronutrients and updating a real-time web interface.

The voice assistant strictly supports the **three core operations** specified in the assignment:
1. **Log a meal**: *"I had two rotis and a katori of dal for lunch."*
2. **Edit an entry**: *"Actually make that three rotis."*
3. **Delete an entry**: *"Remove the chai I logged this morning."*

---

## 2. System Architecture

```
                      +-----------------------------+
                      |       User Voice / Mic      |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |   React Web App (Frontend)  |
                      |   - LiveKit WebRTC Audio    |
                      |   - Instant Room Data Sync  |
                      |   - Real-time Timeline      |
                      |   - Macro Summary Cards     |
                      +--------------+--------------+
                                     |
                 +-------------------+-------------------+
                 | WebRTC Audio                          | REST API
                 v                                       v
+--------------------------------+      +--------------------------------+
|      LiveKit Cloud Room        |      |    Express REST API Server     |
|   (WebRTC Audio & Data Channel)|      |  - LiveKit Token Service       |
+----------------+---------------+      |  - Strict Nutrition Engine     |
                 |                      |  - Meal CRUD & Aggregations    |
                 | WebRTC Audio         +---------------+----------------+
                 v                                      |
+--------------------------------+                      |
|      LiveKit Voice Agent       |                      v
|  - LiveKit Agents (Python)     |            +-------------------+
|  - LiveKit Inference (STT/LLM) |----------->|   MongoDB Atlas   |
|  - Voice Tools (@function)     |  REST API  |   (Persistent)    |
|  - Room Data Broadcast Sync    |            +-------------------+
+--------------------------------+
```

### Component Breakdown
- **Client (`client/`)**: Single-page React app with LiveKit WebRTC client, audio controls, visualizer, daily macro breakdown (Calories, Protein, Carbs, Fat), categorized meal timeline, and an interactive database browser.
- **Server (`server/`)**: Express REST API backed by MongoDB Atlas using Mongoose. Responsible for generating LiveKit access tokens, validating food entries, executing exact unit-to-gram conversions, computing macronutrients, and persisting meal records.
- **Voice Agent (`agent/`)**: LiveKit Agent worker built with the `livekit-agents` framework. Features Speech-to-Text, Large Language Model orchestration with `@function_tool` calling, Text-to-Speech via LiveKit Inference, and real-time room data packet broadcasts for sub-100ms UI sync.
- **Food Database (`foods.json`)**: Curated source of truth containing 30 verified Indian dishes with household units (piece, katori, bowl, plate, glass, cup, tablespoon, gram) and macros per 100g.

---

## 3. Key Technical & Design Decisions

### A. Strict Food Database Boundary
- `foods.json` is treated as the immutable source of truth.
- Both the agent prompt, the Python matcher, and the Express backend enforce this rule.
- If a user mentions an unverified food (e.g. *pizza*, *burger*, *pasta*), the agent politely explains that Beet currently only logs foods from our verified database, and offers to log supported alternatives.

### B. Mathematical Accuracy Over Approximations
- Nutrition calculations are computed deterministically, never hallucinated by the LLM:
  $$\text{weightGrams} = \text{quantity} \times \text{unit.grams}$$
  $$\text{multiplier} = \frac{\text{weightGrams}}{100}$$
  $$\text{calories} = \text{round}(\text{macrosPer100g.calories} \times \text{multiplier}, 1)$$
  $$\text{protein} = \text{round}(\text{macrosPer100g.protein} \times \text{multiplier}, 1)$$
  $$\text{carbs} = \text{round}(\text{macrosPer100g.carbs} \times \text{multiplier}, 1)$$
  $$\text{fat} = \text{round}(\text{macrosPer100g.fat} \times \text{multiplier}, 1)$$

### C. LiveKit Inference (Zero External Provider Keys)
- Built using LiveKit Inference, which routes STT (Deepgram Nova-3), LLM (Google Gemma / OpenAI), and TTS (Cartesia Sonic-3) through a single LiveKit Cloud key, taking advantage of LiveKit's generous free credits with zero credit-card requirement.

### D. Sub-100ms Real-Time UI Synchronization
- Rather than relying on slow polling, when the agent performs an action (`log_meal`, `edit_meal`, `delete_meal`), it immediately publishes a data packet over the LiveKit Room Data Channel (`RoomEvent.DataReceived`). The React client catches this instantly to trigger a localized re-fetch, providing snappy, instantaneous visual feedback.

### E. Persistent Storage across Restarts
- Backed by MongoDB Atlas via Mongoose. All meal logs and individual items are stored in persistent collections that survive server restarts.

---

## 4. Local Setup & Quickstart (From an Empty Machine)

### Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.10 or v3.11)
- **LiveKit Cloud Credentials**: Free account on [LiveKit Cloud](https://cloud.livekit.io)
- **MongoDB Atlas URI**: Connection string to a MongoDB cluster

### Step 1: Clone Repository & Configure Environment
```bash
git clone <repo-url>
cd beet-health
cp .env.example .env
```
Edit `.env` and provide your credentials:
```ini
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/?appName=beet-meal-logger
PORT=5000
```

### Step 2: Install Backend & Frontend Dependencies
```bash
# Install root, server, and client dependencies
npm install
npm --prefix server install
npm --prefix client install
```

### Step 3: Install Voice Agent Dependencies
```bash
pip install -r agent/requirements.txt
```

### Step 4: Run the Services
Open 3 terminal windows:

**Terminal 1 — Backend API:**
```bash
npm run dev:server
# Server starts at http://localhost:5000
```

**Terminal 2 — Frontend Client:**
```bash
npm run dev:client
# React app opens at http://localhost:5173
```

**Terminal 3 — LiveKit Voice Agent Worker:**
```bash
cd agent
python agent.py dev
# Agent connects to LiveKit Cloud and registers voice worker
```

---

## 5. Testing Approach

Testing is structured into layers covering pure mathematics, database persistence, REST endpoints, and conversational voice tool calling.

### Running Automated Tests
From the root directory, run:
```bash
npm test
```
This runs both test suites consecutively:
1. **Server Unit & Integration Tests (Jest & Supertest)**:
   - Alias and canonical name resolution (e.g. `chapati` $\to$ `roti`, `daal` $\to$ `dal_tadka`, `dahi` $\to$ `curd`, `anda` $\to$ `boiled_egg`).
   - Unit-to-gram conversion and exact macro calculations matching `foods.json`.
   - Plural unit variants (`piece`, `pieces`, `katori`, `katoris`, `bowl`, `bowls`).
   - Rejection of foods outside `foods.json` (`pizza`, `burger`).
   - Rejection of unsupported units and invalid quantities.
   - LiveKit access token generation.
   - Scenario 1: Log meal (`POST /api/meals`).
   - Scenario 2: Edit meal (`PATCH /api/meals/items/update`).
   - Scenario 3: Delete meal (`DELETE /api/meals/items/delete`).
   - Daily macro summary aggregations.
2. **Voice Agent Unit Tests (Python `unittest`)**:
   - Zero-dependency Python unit tests verifying `FoodMatcher` and the 3 voice scenario actions with mocked responses.

---

## 6. What's Incomplete, Broken, or What We'd Do Differently With More Time

Being completely honest and transparent about trade-offs and future enhancements:

1. **Fractional Household Units & Ambiguous Portions**:
   - *Current state*: Handles standard units (e.g. "two rotis", "1.5 katoris", "half a plate").
   - *Future improvement*: Support regional slang and vernacular expressions (e.g., "ek chammach", "thoda sa", "quarter plate") with adaptive calibration.
2. **Multi-Turn Disambiguation**:
   - *Current state*: If a user says "dal", the system defaults to Yellow Dal Tadka (`dal_tadka`).
   - *Future improvement*: For ambiguous entries, the voice agent could ask: *"Did you have Dal Tadka or Yellow Dal?"* before logging.
3. **Offline Audio Fallback**:
   - *Current state*: LiveKit requires WebRTC connectivity to LiveKit Cloud.
   - *Future improvement*: Add an offline browser Web Speech API / Whisper.tflite fallback for low-connectivity rural environments.
4. **User Authentication & Multi-Tenancy**:
   - *Current state*: Scoped to the active user session and date.
   - *Future improvement*: Nutritionist-client linked profiles with target calorie goals and nutritionist review comments.

---

## 7. Submission Checklist
- [x] Three core voice actions: Log, Edit, Delete.
- [x] Strict food database boundary (`foods.json` sole source of truth).
- [x] Data persistence across restarts (MongoDB Atlas).
- [x] Accurate unit-to-gram macro mathematics.
- [x] LiveKit Agents with LiveKit Inference.
- [x] Clean React web frontend with real-time UI sync.
- [x] Rigorous automated tests (100% passing).
- [x] Comprehensive README with setup, architecture, and trade-offs.
