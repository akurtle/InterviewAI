# Backend Agent Notes

Use the root [agents.md](/D:/Projects/interview_ai/agents.md) as the primary guide. This file only adds backend-specific context.

## Scope

The backend is a FastAPI service responsible for:

- resume parsing
- interview question generation
- speech feedback
- video feedback
- live WebSocket and WebRTC endpoints

## Primary Files

- `app/main.py`: app factory and router registration
- `app/api/`: feature routers for core, resumes, feedback, questions, and realtime endpoints
- `app/parsers/resume_parser.py`: PDF and DOCX parsing
- `app/questions/question_generator.py`: local and Gemini-backed questions
- `app/analysis/speech_feedback.py`: transcript scoring
- `app/analysis/video_feedback.py`: frame scoring
- `app/config.py`: environment settings

## Backend Commands

```powershell
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Backend Guardrails

- Keep request and response models in sync with the frontend.
- Avoid adding new hardcoded origins or URLs when settings can be used instead.
- If an endpoint changes shape, update the corresponding Pydantic models in the same pass.
- Real-time dependencies are broader than `requirements.txt`; check imports in `app/main.py` before assuming the environment is complete.
