# InterviewAI Agent Guide

This repository is a two-app workspace:

- `backend/`: FastAPI service for resume parsing, question generation, speech scoring, video scoring, and live audio/video session endpoints.
- `frontend/`: React + TypeScript + Vite client for the landing page, resume upload flow, and mock interview experience.

Use this file as the default orientation guide before editing code.

## Working Priorities

1. Preserve the frontend/backend contract. Check request and response shapes before changing either side.
2. Prefer focused fixes. This repo is a prototype, so avoid large refactors unless they remove a real blocker.
3. Keep runtime configuration environment-driven. Prefer `VITE_API_BASE`, `VITE_WS_BASE`, and backend `.env` settings over hardcoded URLs.
4. Ignore generated or heavy folders during exploration: `frontend/node_modules`, `backend/.venv`, `.git`, `.vite`.

## Core Commands

### Frontend

```powershell
cd frontend
npm run dev
npm run build
npm run lint
```

### Backend

```powershell
cd backend
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Git Workflow

Use non-interactive git commands when the user wants changes finalized in the remote repository:

```powershell
git add .
git commit -m "Describe the change"
git push
```

Guardrails:

- Do not commit or push unless the user explicitly asks for it.
- Review `git status` before committing so unrelated user changes are not included by accident.
- Prefer focused commit messages that describe the actual code or docs change.

## High-Signal Files

### Backend

- `backend/app/main.py`: HTTP, WebSocket, and WebRTC entrypoint
- `backend/app/parsers/resume_parser.py`: PDF/DOCX resume extraction
- `backend/app/questions/question_generator.py`: template and Gemini-backed question generation
- `backend/app/analysis/speech_feedback.py`: transcript feature extraction and scoring
- `backend/app/analysis/video_feedback.py`: frame-based presence scoring
- `backend/app/config.py`: environment settings

### Frontend

- `frontend/src/App.tsx`: router
- `frontend/src/pages/GetStarted.tsx`: resume upload and analysis flow
- `frontend/src/pages/MockInterview.tsx`: live session orchestration
- `frontend/src/components/Interview/WebRTCRecorder.tsx`: camera, mic, and signaling flow
- `frontend/src/components/Interview/useWhisper.tsx`: ASR WebSocket client
- `frontend/src/hooks/useFeedbackRequests.ts`: post-session feedback requests
- `frontend/src/hooks/useSessionType.ts`: interview vs pitch mode routing

## Repo Tree

```text
interview_ai/
|-- agents.md
|-- .codex/
|   |-- config.toml
|   `-- tree.toml
|-- backend/
|   |-- app/
|   |   |-- analysis/
|   |   |-- parsers/
|   |   |   |-- resume_parser_helpers/
|   |   |   `-- video_parser/
|   |   |-- questions/
|   |   |-- utils/
|   |   |-- config.py
|   |   |-- main.py
|   |   |-- models.py
|   |   |-- speech_models.py
|   |   `-- video_models.py
|   |-- agents.md
|   `-- requirements.txt
`-- frontend/
    |-- src/
    |   |-- assets/
    |   |-- components/
    |   |   |-- Interview/
    |   |   `-- parsers/
    |   |-- hooks/
    |   |-- pages/
    |   |-- App.tsx
    |   |-- index.css
    |   `-- main.tsx
    |-- agents.md
    `-- package.json
```

## Known Integration Risks

- The backend still hardcodes the allowed WebSocket origin `http://localhost:3000` in `backend/app/main.py`.
- Client-side vision metrics currently rely on browser `FaceDetector` availability, so video feedback quality varies by browser support.
- The real-time interview path depends on heavier media and transcription packages, so environment setup is more fragile than the resume-only flow.

## Change Guidance

- When changing API payloads, update both the FastAPI models and the frontend callers in the same pass.
- When touching interview session code, verify whether the flow is audio-only, video-only, or both.
- Keep comments short and only where the logic is not obvious from the code.
- Prefer small verification steps after edits: frontend build or lint, backend import or startup checks.
