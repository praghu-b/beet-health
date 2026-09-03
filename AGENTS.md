# Beet Voice Meal Logger - Agent Guidelines & Development Standards

## Project Context
Beet is a nutrition-care platform where clients log their daily meals. This project implements an end-to-end voice assistant that enables effortless meal logging using spoken conversation backed by LiveKit, a MERN backend (Node.js/Express/MongoDB), and a React frontend.

## Core Mandate & Non-Negotiables
1. **Three Core Voice Actions Only**:
   - **Log a meal**: (e.g., "I had two rotis and a katori of dal for lunch.")
   - **Edit an entry**: (e.g., "Actually make that three rotis.")
   - **Delete an entry**: (e.g., "Remove the chai I logged this morning.")
2. **Strict Food Database Boundary**:
   - `foods.json` is the sole source of truth (30 predefined dishes with macros per 100g and household unit weights).
   - Only foods existing in `foods.json` can be logged. Disallow or politely explain unknown foods.
3. **Data Persistence**:
   - Logs must persist across restarts.
4. **Accuracy Over Aesthetics**:
   - Nutrition calculations must be mathematically exact based on unit-to-gram conversion and macros per 100g.
   - Frontend must reflect real-time updates from voice commands.

## Technology Stack
- **Voice Agent**: LiveKit Agents (Python or Node.js runtime with LiveKit Inference support).
- **Backend**: Node.js, Express, Mongoose (MongoDB).
- **Frontend**: React (Vite), LiveKit Client / Components.
- **Testing**: Rigorous testing across unit nutrition math, API integration, and voice tool handlers.

## Repository Layout
```
beet-health/
├── foods.json           # Nutritional database source of truth
├── server/              # Node.js Express REST API & LiveKit Token Service
│   ├── src/
│   │   ├── config/      # DB and environment configuration
│   │   ├── models/      # Mongoose schemas (MealLog, MealItem)
│   │   ├── controllers/ # API controllers (meals, livekit token)
│   │   ├── routes/      # Express routes
│   │   └── services/    # Nutrition calculation and food matching logic
│   └── tests/           # Backend integration and unit tests
├── client/              # React frontend (Vite)
│   ├── src/
│   │   ├── components/  # Voice room controller, meal timeline, macro summaries
│   │   ├── hooks/       # LiveKit and meal data hooks
│   │   └── services/    # API client
├── agent/               # LiveKit Voice Agent Worker
│   ├── agent.py         # LiveKit agent entrypoint with LLM/STT/TTS
│   ├── tools.py         # Voice tools (log_meal, edit_meal, delete_meal)
│   ├── food_matcher.py  # Fuzzy/alias matching against foods.json
│   └── tests/           # Agent tool unit tests
├── README.md            # Comprehensive documentation
├── AGENTS.md            # AI agent development guidelines
└── .gitignore
```

## Commit Standards
Always use conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `test:` Adding or updating tests
- `docs:` Documentation updates
- `refactor:` Code improvements without functionality changes
- `chore:` Build, dependencies, configs
