from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from whisperlivekit import AudioProcessor, TranscriptionEngine

from app.config import get_settings
from app.parsers.video_parser.helpers import send_results
from app.realtime_state import Session, sessions, utc_now, ws_clients


logger = logging.getLogger(__name__)
router = APIRouter(tags=["realtime"])
settings = get_settings()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def touch_session(session_id: str) -> Session | None:
    session = sessions.get(session_id)
    if session:
        session.last_seen_at = utc_now()
    return session


async def push_session_event(session_id: str, payload: dict) -> None:
    ws = ws_clients.get(session_id)
    if not ws:
        return
    message = {"type": "session_event", "session_id": session_id, "timestamp": now_iso(), **payload}
    try:
        await ws.send_text(json.dumps(message))
    except Exception:
        logger.exception("Failed to push session event for %s", session_id)


async def push_results_message(
    session_id: str,
    payload: dict,
    *,
    queue_if_unavailable: bool = False,
) -> None:
    session = sessions.get(session_id)
    ws = ws_clients.get(session_id)
    if not ws:
        if queue_if_unavailable and session:
            session.pending_results_messages.append(payload)
        return
    message = {"session_id": session_id, "timestamp": now_iso(), **payload}
    try:
        await ws.send_text(json.dumps(message))
    except Exception:
        logger.exception("Failed to push results message for %s", session_id)
        if queue_if_unavailable and session:
            session.pending_results_messages.append(payload)


async def flush_pending_results_messages(session_id: str) -> None:
    session = sessions.get(session_id)
    if not session or not session.pending_results_messages:
        return
    pending = list(session.pending_results_messages)
    session.pending_results_messages.clear()
    for payload in pending:
        await push_results_message(session_id, payload)


async def cleanup_session(session_id: str, reason: str) -> None:
    session = sessions.pop(session_id, None)
    ws = ws_clients.pop(session_id, None)

    if session and session.cleanup_task:
        session.cleanup_task.cancel()
        session.cleanup_task = None

    logger.info("Cleaning up session %s (%s)", session_id, reason)

    if ws:
        try:
            await ws.close()
        except Exception:
            logger.debug("Results websocket already closed for %s", session_id)


@router.websocket("/asr")
async def asr(ws: WebSocket) -> None:
    await ws.accept()

    ap = AudioProcessor(
        transcription_engine=TranscriptionEngine(model="base", diarization=False, lan="en")
    )
    gen = await ap.create_tasks()
    task = asyncio.create_task(send_results(ws, gen))

    try:
        while True:
            chunk = await ws.receive_bytes()
            await ap.process_audio(chunk)
    except WebSocketDisconnect:
        logger.info("ASR client disconnected")
    except Exception:
        logger.exception("ASR websocket crashed")
    finally:
        task.cancel()
        try:
            await ws.close()
        except Exception:
            pass


@router.websocket("/ws/results/{session_id}")
async def ws_results(ws: WebSocket, session_id: str) -> None:
    origin = ws.headers.get("origin")
    allowed_origins = settings.effective_ws_allowed_origins
    if "*" not in allowed_origins and origin not in allowed_origins:
        await ws.close(code=1008)
        return

    await ws.accept()

    if session_id not in sessions:
        sessions[session_id] = Session()

    ws_clients[session_id] = ws
    session = touch_session(session_id)
    if session:
        session.results_socket_connected_at = utc_now()

    await push_session_event(session_id, {"event": "results_socket", "value": "connected"})
    await flush_pending_results_messages(session_id)

    try:
        while True:
            raw_message = await ws.receive_text()
            touch_session(session_id)

            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                logger.debug("Ignoring non-JSON message for %s", session_id)
                continue

            if message.get("type") == "ping":
                await ws.send_text(
                    json.dumps({"type": "pong", "session_id": session_id, "timestamp": now_iso()})
                )
    except WebSocketDisconnect:
        logger.info("Results websocket disconnected for %s", session_id)
    finally:
        if ws_clients.get(session_id) is ws:
            ws_clients.pop(session_id, None)
        session = touch_session(session_id)
        if session:
            session.results_socket_connected_at = None


async def _session_reaper() -> None:
    while True:
        await asyncio.sleep(30)
        now = utc_now()
        for session_id, session in list(sessions.items()):
            age = (now - session.last_seen_at).total_seconds()
            if age > settings.ws_session_ttl_seconds:
                await cleanup_session(session_id, "session_ttl_expired")


@router.on_event("startup")
async def startup_realtime_tasks() -> None:
    asyncio.create_task(_session_reaper())
