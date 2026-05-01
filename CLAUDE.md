# InterviewAI — Claude Code Guide

Full-stack speaking coaching platform. FastAPI backend + React/TypeScript/Vite frontend.

## Project Structure

```
backend/app/
  main.py              # FastAPI app factory + router registration
  config.py            # Environment settings (pydantic-settings)
  api/                 # Feature routers: core, resumes, feedback, questions, realtime
  analysis/            # speech_feedback.py, video_feedback.py
  parsers/             # resume_parser.py + helpers
  questions/           # question_generator.py
  speech_models.py     # Speech feedback request/response Pydantic models
  video_models.py      # Video feedback request/response Pydantic models
  realtime_state.py    # Shared WebRTC + WebSocket state

frontend/src/
  App.tsx              # Route registration
  pages/               # GetStarted.tsx, MockInterview.tsx
  components/Interview/ # WebRTCRecorder, useWhisper, FeedbackPanel, QuestionGenerator
  hooks/               # useFeedbackRequests.ts, useSessionType.ts, useMockInterviewController.ts
```

## Commands

### Frontend (from `frontend/`)
```bash
npm run dev      # Vite dev server on http://localhost:3000
npm run build
npm run lint
```

### Backend (from `backend/`)
```powershell
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Environment Variables

### Frontend (`frontend/.env`)
```
VITE_API_BASE=http://127.0.0.1:8000
VITE_WS_BASE=ws://127.0.0.1:8000
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
```

### Backend (`.env` in backend root)
```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-flash
CORS_ALLOW_ORIGINS=["http://localhost:3000"]
WS_ALLOWED_ORIGINS=["http://localhost:3000"]
```

## API Contracts (do not break without updating both sides)

| Contract | Frontend | Backend |
|---|---|---|
| Speech feedback | `hooks/useFeedbackRequests.ts` | `speech_models.py` |
| Video feedback | `hooks/useFeedbackRequests.ts` | `video_models.py` |
| Question generation | Interview question UI | `questions/question_generator.py` |
| Resume parse | `pages/GetStarted.tsx` | `main.py` `/parse-resume/` |

When changing any API payload, update the FastAPI models and the frontend callers in the same pass.

## Key Endpoints

- `POST /parse-resume/` — multipart resume upload
- `POST /questions/generate` — question set from role/company/call_type
- `POST /speech/feedback` — transcript scoring
- `POST /video/feedback` — frame-based presence scoring
- `POST /webrtc/offer` — WebRTC SDP exchange
- `WS /asr` — live audio streaming
- `WS /ws/results/{session_id}` — per-session results socket

## Working Rules

- Prefer small, focused changes. This is a prototype — avoid refactors unless they fix a real blocker.
- Keep all config environment-driven. No hardcoded URLs; use `VITE_API_BASE`, `VITE_WS_BASE`, backend `.env`.
- When touching interview session code, check whether the flow is audio-only, video-only, or both.
- After frontend changes: `npm run build && npm run lint`.
- After backend changes: restart uvicorn and verify startup import succeeds.
- Do not commit or push unless the user explicitly asks.

## Known Issues

- `resume_upload_has_hardcoded_url`: the resume upload component has a hardcoded URL that should use `VITE_API_BASE`.
- `video_feedback_schema_currently_misaligned`: video feedback schema between frontend and backend is not fully aligned.
- `realtime_dependencies_not_fully_pinned`: some real-time packages may not be fully pinned in requirements.txt.
- `WS /ws/results/{session_id}` only allows origin `http://localhost:3000` — change `config.py` to expand this.
- `run_video_pipeline()` only sends a basic status message; real video scoring comes from client-collected frames posted to `/video/feedback`.
- `FaceDetector` API is not available in all browsers — video feedback quality varies.

## Ignored Paths

`frontend/node_modules`, `backend/.venv`, `.git`, `.vite`, `backend/app/__pycache__`
