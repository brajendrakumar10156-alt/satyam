# TODO Step 1 - AI Guardrail (score-only)

## Goal
- Backend returns AI score (sentiment) for an arbitrage opportunity.
- Frontend uses score only for UI/logging.
- No execution from AI score.

## Changes required
1. backend: add endpoint `/api/v1/ai-advisor/score` (or similar) that accepts `{ pair, buyEx, sellEx, buyPrice, sellPrice, netProfit, timestamp }` and returns `{ aiSentimentScore, confidence }`.
2. frontend demo:
   - In `src_demo/arbitrageWorker.js` or `src_demo/components/ArbitrageBot.jsx`, call backend score endpoint for each top opportunity.
   - Add score to logs/UI.

## Current repo status
- Read files:
  - `src_demo/arbitrageWorker.js`
  - `src_demo/components/ArbitrageBot.jsx`
  - `backend/ai_service.py`
  - `backend/main.py`

## Next action
- Implement backend score endpoint first (stub math-only score if no LLM).

