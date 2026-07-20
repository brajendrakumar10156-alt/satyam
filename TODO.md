# TODO

## AI Guardrail Interface (Score-only AI) — Implementation Tracker

### Step 1: Inspect existing arbitrage/signal pipeline
- [ ] Read `src_demo/arbitrageWorker.js`
- [ ] Read `src_demo/components/ArbitrageBot.jsx`
- [ ] Read corresponding logic under `src/` (non-demo) if used by default

### Step 2: Inspect backend AI + routing
- [ ] Read `backend/ai_service.py`
- [ ] Read `backend/main.py` to find current API routes

### Step 3: Add backend endpoint for AI advisor (score-only)
- [ ] Implement route like `POST /api/v1/ai-advisor/score`
- [ ] Implement response schema: `{ pair, timestamp, aiSentimentScore, confidence }`

### Step 4: Wire frontend demo to call AI advisor
- [ ] In `src_demo/arbitrageWorker.js`, request score from backend
- [ ] Pass score back to `ArbitrageBot.jsx`

### Step 5: Enforce guardrail in pipeline
- [ ] Ensure AI score does NOT directly place orders
- [ ] Only math/risk gate triggers execution (or create stub gate if missing)

### Step 6: Add logging + shadow mode behavior
- [ ] Log AI score vs decision
- [ ] Confirm no real execution is triggered during shadow mode

### Step 7: Run + smoke test
- [ ] Start backend
- [ ] Run frontend demo
- [ ] Trigger an arbitrage scan and verify score is shown/logged

