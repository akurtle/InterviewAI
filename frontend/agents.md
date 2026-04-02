# Frontend Agent Notes

Use the root [agents.md](/D:/Projects/interview_ai/agents.md) as the primary guide. This file only adds frontend-specific context.

## Scope

The frontend is a React + TypeScript + Vite application for:

- landing and navigation flows
- resume upload and analysis rendering
- interview and pitch session setup
- live transcript capture
- post-session speech and video feedback display

## Primary Files

- `src/App.tsx`: route registration
- `src/pages/GetStarted.tsx`: resume flow
- `src/pages/InterviewType.tsx`: session mode selection
- `src/pages/MockInterview.tsx`: live session page
- `src/components/Interview/`: interview UI and media components
- `src/hooks/useFeedbackRequests.ts`: feedback fetch logic
- `src/hooks/useSessionType.ts`: interview vs pitch state

## Frontend Commands

```powershell
npm run dev
npm run build
npm run lint
```

## Frontend Guardrails

- Prefer environment-driven backend URLs over hardcoded localhost values.
- Keep TypeScript payload types aligned with backend request models.
- Interview session changes usually affect pages, hooks, and media components together.
- Avoid introducing unnecessary state abstractions in this codebase; keep flows direct and easy to trace.
