# Beet — Voice-Based Meal Logger

An end-to-end voice assistant for logging daily nutrition effortlessly, built with **LiveKit Agents**, **Node.js/Express**, **MongoDB**, and **React**.

---

## Overview

Beet is a nutrition-care platform where nutritionists create diet plans and clients log what they eat. This project enables users to naturally speak their meal updates, which are immediately transcribed, matched against Beet's verified food database (`foods.json`), calculated for precise macro-nutrients, persisted in a database, and displayed in real time on a clean web interface.

### Supported Spoken Operations
1. **Log a meal**: *"I had two rotis and a katori of dal for lunch."*
2. **Edit an entry**: *"Actually make that three rotis."*
3. **Delete an entry**: *"Remove the chai I logged this morning."*

---

## System Architecture

```
                      +-----------------------------+
                      |         User Voice          |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |  React Web App (Frontend)   |
                      |  - LiveKit Client Audio     |
                      |  - Real-time Meal Timeline  |
                      |  - Macro Progress Dashboard |
                      +--------------+--------------+
                                     |
                 +-------------------+-------------------+
                 | WebRTC Audio                          | REST API
                 v                                       v
+--------------------------------+      +--------------------------------+
|      LiveKit Cloud Room        |      |    Express REST API Server     |
|   (Audio Router & Data Sync)   |      |  - Token Generator (LiveKit)   |
+----------------+---------------+      |  - Nutrition Calculation       |
                 |                      |  - Meal CRUD & Aggregations    |
                 | WebRTC Audio         +---------------+----------------+
                 v                                      |
+--------------------------------+                      |
|      LiveKit Voice Agent       |                      v
|  - STT (Speech-to-Text)        |            +-------------------+
|  - LLM + Tool Calling          |----------->|  MongoDB Storage  |
|  - TTS (Text-to-Speech)        |  REST API  |  (Persistent)     |
|  - Room Data Dispatcher        |            +-------------------+
+--------------------------------+
```

---

## Project Structure

```
beet-health/
├── foods.json           # Nutritional database (30 dishes, macros per 100g, household units)
├── server/              # Node.js + Express backend & LiveKit token server
│   ├── src/
│   │   ├── config/      # DB and environment configuration
│   │   ├── models/      # Mongoose schemas (MealLog, MealItem)
│   │   ├── controllers/ # Meal CRUD & LiveKit token generation
│   │   ├── routes/      # API routes
│   │   ├── services/    # Food database matching & nutrition calculator
│   │   └── server.js    # Express entrypoint
│   └── tests/           # Backend integration and unit tests
├── client/              # React frontend (Vite)
│   ├── src/
│   │   ├── components/  # Voice controller, meal timeline, macro summary cards
│   │   ├── hooks/       # LiveKit room and meal data hooks
│   │   └── App.jsx      # Main application page
├── agent/               # LiveKit Voice Agent Worker
│   ├── agent.py         # LiveKit agent entrypoint
│   ├── tools.py         # Voice function calling tools (log, edit, delete)
│   ├── food_matcher.py  # Food & alias matcher against foods.json
│   └── tests/           # Agent tool tests
├── README.md
├── AGENTS.md
└── .gitignore
```

---

## Key Technical Decisions

1. **Strict Food Boundary Enforcement**:
   - `foods.json` contains 30 verified Indian food items with household units (katori, piece, bowl, plate, etc.) and gram weights.
   - The system strictly forbids logging items outside this dataset, ensuring nutrition data integrity.
   - Both the agent prompt and the backend validation enforce this rule. If an unknown dish is spoken, the assistant informs the user and can recommend available alternatives.

2. **LiveKit Voice Pipeline & Inference**:
   - Built with the official **LiveKit Agents** framework.
   - Utilizes **LiveKit Inference** with zero requirement for multiple external API keys.
   - Tool calling via `@function_tool` maps natural language utterances into structured actions (`log_meal`, `edit_meal`, `delete_meal`).

3. **Sub-100ms UI Sync via LiveKit Data Channel**:
   - When the agent performs an action, it writes to the backend REST API and immediately broadcasts an event via LiveKit Room Data Packets.
   - The React client instantly catches this event to refresh state without relying on slow polling.

4. **Persistence & Fallback Architecture**:
   - Fully backed by MongoDB using Mongoose models.
   - Designed to run seamlessly either with a cloud MongoDB URI (Atlas) or a local instance, persisting data across server restarts.

---

## Local Setup & Quickstart (Empty Machine)

*(Detailed setup steps will be finalized as each component is built).*

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- LiveKit Cloud Account (Free tier, credentials for `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`)

---

## Testing Strategy
*(To be detailed with automated test commands and test coverage).*

---

## Known Limitations & Future Improvements
*(To be updated as development proceeds).*
