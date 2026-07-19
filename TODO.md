# TODO - JARVIS AI integration

## Info gathered
- SATYAM AI Terminal backend has `/ai/assist` that calls `backend/ai_service.py` providers (Groq/Gemini).
- New AI project: `c:/Users/satya/OneDrive/Documents/Desktop/jarvis`
  - FastAPI server file: `main.py`
  - Chat endpoint: `POST /api/chat`
  - It expects JSON: `{ "messages": [{"role": "user"|"assistant"|... , "content": "..."}] }`
  - Response: `{ "message": { "role": "assistant", "content": "..." } }` (no code-fence contract guaranteed).

## Step plan
1. Create a backend adapter in `backend/ai_service.py` for provider="jarvis".
2. Update `/ai/status` to include `jarvis` health/config.
3. Update `/ai/assist` to accept provider jarvis and route request.
4. Add environment variables support:
   - `JARVIS_API_URL` (default `http://127.0.0.1:8000/api/chat`)
   - `JARVIS_TIMEOUT_SECONDS` (optional)
5. Ensure frontend provider dropdown includes `jarvis` (recommended).
6. Test locally:
   - Start JARVIS server: `cd jarvis && python main.py`
   - Start SATYAM AI Terminal backend: `npm run backend`
   - In UI select provider jarvis and send prompt.


## Progress tracking
- [ ] Adapter implementation
- [ ] ai_status update
- [ ] Frontend update (optional)
- [ ] End-to-end test

