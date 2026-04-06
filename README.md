# InterviewAI

InterviewAI is a full-stack practice platform for resume review and mock interview coaching. The repository combines:

- A `FastAPI` backend for resume parsing, question generation, speech feedback, video feedback, and real-time audio/video session endpoints.
- A `React + TypeScript + Vite` frontend for the landing page, resume upload flow, and live mock interview experience.

The product currently supports two main workflows:

1. Resume analysis: upload a PDF or DOCX resume and extract structured profile data.
2. Mock interview or pitch practice: generate questions, capture audio/video, transcribe speech live, and compute post-session feedback.

## Repository Layout

```text
interview_ai/
|-- backend/
|   |-- app/
|   |   |-- api/                      # FastAPI routers by feature
|   |   |-- analysis/                 # Speech/video scoring logic
|   |   |-- parsers/                  # Resume and video helpers
|   |   |-- questions/                # Question request models + generator
|   |   |-- utils/                    # Upload/file validation helpers
|   |   |-- config.py                 # Environment-driven settings
|   |   |-- main.py                   # FastAPI app factory + router registration
|   |   |-- models.py                 # Resume response models
|   |   |-- realtime_state.py         # Shared WebRTC / WebSocket state
|   |   |-- speech_models.py          # Speech feedback request/response models
|   |   `-- video_models.py           # Video feedback request/response models
|   |-- requirements.txt
|   `-- README.md
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- components/
|   |   |   |-- Interview/            # Recording, transcription, questions, feedback UI
|   |   |   `-- parsers/              # Resume upload + analysis UI
|   |   |-- hooks/                    # Session type + feedback request hooks
|   |   |-- pages/                    # App routes
|   |   |-- App.tsx                   # Router setup
|   |   `-- main.tsx                  # Vite entrypoint
|   |-- .env.example
|   |-- package.json
|   `-- README.md
`-- README.md
```

## Agent And Repo Workflow

- [agents.md](/D:/Projects/interview_ai/agents.md) is the root guidance file for repository-aware coding agents.
- `.codex/config.toml` stores project-specific navigation and workflow hints.
- `.codex/tree.toml` stores a curated source tree and key cross-app relationships.

If you want to finalize a change set with git, use the standard non-interactive flow:

```bash
git add .
git commit -m "Describe the change"
git push
```

Review `git status` before committing so unrelated work is not included by accident.

## What The App Does

### Resume Analysis

- Accepts `.pdf` and `.docx` resume uploads.
- Extracts raw text from the document.
- Detects major sections such as `skills`, `experience`, and `education`.
- Uses heuristics plus `spaCy` NER to pull fields like name, email, phone, skills, education, and experience.
- Returns a normalized JSON response that the frontend renders in the analysis screen.

### Mock Interview / Pitch Practice

- Lets the user choose interview or pitch mode.
- Generates question sets from role, company, and call type input.
- Uses WebSocket audio streaming for live transcription.
- Uses WebRTC to create a live browser-to-backend media session.
- Captures client-side video frames during the session.
- Sends transcript text to the backend for speech scoring.
- Sends collected video frames to the backend for video-presence scoring.

### AI / LLM-Assisted Question Generation

- If `GEMINI_API_KEY` is configured, the backend attempts Gemini-based question generation.
- If Gemini is unavailable, the backend falls back to local template-based question banks for:
  - interviews
  - sales calls
  - presentations

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS 4

### Backend

- FastAPI
- Pydantic / pydantic-settings
- Uvicorn
- pdfplumber
- python-docx
- spaCy
- pyresparser

### Real-Time / Media Features

The backend code also imports libraries used by the real-time interview flow:

- `aiortc`
- `whisperlivekit`
- `faster-whisper`
- `numpy`

These are used by the live audio/video endpoints and are now pinned in `backend/requirements.txt`.

## Architecture Overview

### Frontend Flow

1. `src/App.tsx` defines the public routes.
2. `Home` renders the marketing landing page.
3. `GetStarted` drives the resume upload flow.
4. `InterviewType` lets the user pick `interview` or `pitch`.
5. `MockInterview` coordinates:
   - question generation
   - audio streaming
   - WebRTC session setup
   - transcript accumulation
   - speech/video feedback requests

### Backend Flow

1. `app/main.py` creates the FastAPI application and registers feature routers.
2. `ResumeParser` handles PDF/DOCX extraction and resume field parsing.
3. `generate_questions()` creates question sets from local templates or Gemini.
4. `generate_feedback()` scores transcript quality using rule-based features and a linear model.
5. `generate_video_feedback()` scores visual presence from frame metadata and a linear model.

## Frontend Routes

The app currently exposes these routes:

- `/` - landing page
- `/get-started` - choose resume or interview path
- `/interview-type` - choose interview vs pitch session
- `/mock-interview` - live session page

There are also `Auth.tsx` and `Account.tsx` page files in the repo, but they are placeholders and are not wired into the router yet.

## Backend API Reference

### Health and Root

- `GET /`
  - Returns a simple service status payload.
- `GET /health`
  - Returns `{ "status": "healthy" }`.

### Resume Parsing

- `POST /parse-resume/`
  - Multipart form request with:
    - `file`: uploaded resume
    - `filePath`: extra form field currently sent by the frontend
  - Returns `ParseResponse`.

- `POST /parse-resumes-batch/`
  - Multipart batch upload for multiple files.
  - Returns a list of `ParseResponse` items.

### Interview Question Generation

- `POST /questions/generate`
  - JSON body:

```json
{
  "role": "Backend Engineer",
  "company": "Acme",
  "call_type": "interview",
  "num_questions": 10
}
```

  - Returns categorized questions plus warnings and input metadata.

### Speech Feedback

- `POST /speech/feedback`
  - Accepts either:
    - `text`
    - `words` with timestamps
    - `segments` with timestamps
  - Returns:
    - score
    - derived metrics
    - feedback messages
    - warnings

### Video Feedback

- `POST /video/feedback`
  - Accepts an array of frame measurements:
    - timestamp
    - face presence
    - gaze / camera-looking flag
    - smile probability
    - head yaw / pitch
  - Returns score, metrics, feedback, and warnings.

### Real-Time Endpoints

- `POST /webrtc/offer`
  - Accepts a WebRTC SDP offer and returns an answer plus a generated `session_id`.

- `WS /asr`
  - Accepts streamed audio bytes and emits ASR messages.

- `WS /ws/results/{session_id}`
  - Session-specific results socket.
  - Current code only allows the origin `http://localhost:3000`.

## Resume Parsing Details

The backend parser in `backend/app/parsers/resume_parser.py` works like this:

1. Extracts document text from PDF or DOCX.
2. Detects sections using configurable section headings.
3. Parses skills, education, and experience from those sections when possible.
4. Falls back to regex and heuristic extraction for common fields.

### Parsed Fields

- `name`
- `email`
- `phone`
- `skills`
- `education`
- `experience`

### Configurable Resume Section Headings

The parser supports section-heading overrides through environment variables:

- `RESUME_SECTION_HEADINGS_JSON`
- `RESUME_SECTION_HEADINGS_PATH`
- `RESUME_SECTION_HEADINGS_MODE`

Use this when your resumes follow custom section names not covered by the built-in defaults.

## Question Generation Details

`backend/app/questions/question_generator.py` supports:

- role-aware question templates
- interview, sales, and presentation call types
- optional company-specific question injection
- optional Gemini-backed generation

Role detection is heuristic and maps text such as `backend`, `frontend`, `ml`, `data`, and `devops` into internal categories.

If Gemini is not configured, the backend adds a warning and uses local templates instead.

## Speech Feedback Details

Speech scoring is implemented in `backend/app/analysis/speech_feedback.py`.

It computes features such as:

- filler word rate
- vocabulary variety
- sentence length average and variance
- pause frequency
- long-pause ratio
- speaking rate (words per minute)
- repetition rate

Those features are combined through a lightweight linear model and converted to a 0-100 score.

The backend also returns human-readable coaching suggestions such as:

- reduce filler words
- slow down or speed up
- vary vocabulary
- shorten long sentences

## Video Feedback Details

Video scoring is implemented in `backend/app/analysis/video_feedback.py`.

It computes:

- face presence rate
- gaze-at-camera rate
- smile rate
- average smile probability
- head movement variability
- long gaze break rate

Those signals are also passed through a simple linear model to produce a score and qualitative feedback.

## Local Development

### Prerequisites

- Node.js 18+
- npm
- Python 3.10+
- pip

Recommended for the live interview flow:

- a working webcam and microphone
- browser permission for media capture
- any system dependencies required by your local `whisperlivekit` / media stack

## 1. Start the Backend

From the repository root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# Windows PowerShell
.venv\Scripts\Activate.ps1
```

Install the pinned backend packages:

```bash
pip install -r requirements.txt
```

Install the spaCy English model:

```bash
python -m spacy download en_core_web_sm
```

Run the API:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 2. Start the Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:3000`.

## Environment Variables

### Frontend

Create `frontend/.env` from `frontend/.env.example`:

```env
VITE_API_BASE=http://127.0.0.1:8000
VITE_WS_BASE=ws://127.0.0.1:8000
```

### Backend

The backend reads `.env` values through `pydantic-settings`. The main optional settings are:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
CORS_ALLOW_ORIGINS=["http://localhost:3000"]
WS_ALLOWED_ORIGINS=["http://localhost:3000"]
```

Optional resume parsing overrides:

```env
RESUME_SECTION_HEADINGS_MODE=merge
RESUME_SECTION_HEADINGS_JSON={"skills":["skills","tools"],"experience":["experience","projects"]}
```

## Running The Main Workflows

### Resume Workflow

1. Open `http://localhost:3000`.
2. Click `Get Started`.
3. Choose the resume path.
4. Upload a PDF or DOCX file.
5. The frontend posts the file to `POST /parse-resume/`.
6. The analysis page renders the extracted JSON fields.

### Mock Interview Workflow

1. Open `http://localhost:3000/interview-type`.
2. Choose `Interview` or `Pitch`.
3. Generate a question set from role/company/call type input.
4. Start the session in audio, video, or both mode.
5. Speak into the microphone; audio is streamed to `WS /asr`.
6. When the session ends, the frontend sends:
   - transcript text to `POST /speech/feedback`
   - collected vision frames to `POST /video/feedback`
7. The feedback panel displays scores, metrics, and improvement notes.

## Example Requests

### Generate Questions

```bash
curl -X POST http://localhost:8000/questions/generate \
  -H "Content-Type: application/json" \
  -d "{\"role\":\"Frontend Engineer\",\"company\":\"Acme\",\"call_type\":\"interview\",\"num_questions\":5}"
```

### Speech Feedback

```bash
curl -X POST http://localhost:8000/speech/feedback \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"I led the migration, reduced latency, and improved reliability.\"}"
```

## Important Implementation Notes

- The frontend now routes backend calls through `VITE_API_BASE` and `VITE_WS_BASE`.
- `frontend/vite.config.ts` defines an `/api` proxy, but the current frontend code calls the backend through explicit absolute URLs, so that proxy is not currently used.
- The backend CORS list and WebSocket allowed origins are configured through `backend/app/config.py` and can be overridden with environment variables.
- The `run_video_pipeline()` function currently only sends a basic status message. Most video scoring in practice comes from client-collected frames posted later to `/video/feedback`.
- Client-side video feedback now sends metric-shaped frames that match the backend schema instead of raw base64 image data.
- `backend/app/parsers/resume_parser.py` will attempt to download the spaCy model automatically if it is missing, but installing it manually is more predictable for local setup and CI.

## Key Files To Know

### Frontend

- `frontend/src/App.tsx` - route registration
- `frontend/src/pages/GetStarted.tsx` - resume upload flow
- `frontend/src/pages/MockInterview.tsx` - interview orchestration
- `frontend/src/components/Interview/WebRTCRecorder.tsx` - browser media capture + WebRTC signaling
- `frontend/src/components/Interview/useWhisper.tsx` - ASR WebSocket client
- `frontend/src/hooks/useFeedbackRequests.ts` - post-session feedback requests

### Backend

- `backend/app/main.py` - app factory and router registration
- `backend/app/api/` - feature routers for core, resumes, questions, feedback, and realtime endpoints
- `backend/app/parsers/resume_parser.py` - resume parsing logic
- `backend/app/questions/question_generator.py` - question generation
- `backend/app/analysis/speech_feedback.py` - transcript scoring
- `backend/app/analysis/video_feedback.py` - video scoring
- `backend/app/config.py` - environment settings

## Current Maturity

This codebase is already useful for local experimentation and demos, but it still has some rough edges:

- some pages are placeholders
- browser-dependent vision sampling still needs stronger cross-browser support
- video streaming is only partially implemented server-side

For local development, the project is best treated as a working prototype with a clear frontend/backend split and reasonably self-contained feature modules.
