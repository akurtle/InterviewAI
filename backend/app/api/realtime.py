from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from aiortc import RTCIceCandidate, RTCPeerConnection, RTCSessionDescription
from aiortc.sdp import candidate_from_sdp
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from whisperlivekit import AudioProcessor, TranscriptionEngine

from app.config import get_settings
from app.parsers.video_parser.helpers import run_video_pipeline, send_results
from app.realtime_state import WebRTCSession, pcs, relay, sessions, utc_now, ws_clients


logger = logging.getLogger(__name__)
router = APIRouter(tags=["realtime"])
settings = get_settings()


class Offer(BaseModel):
    sdp: str
    type: str
    session_id: str | None = None


class CandidatePayload(BaseModel):
    candidate: str | None = None
    sdp_mid: str | None = Field(default=None, alias="sdpMid")
    sdp_mline_index: int | None = Field(default=None, alias="sdpMLineIndex")
    username_fragment: str | None = Field(default=None, alias="usernameFragment")

    model_config = {"populate_by_name": True}


class SessionCandidatePayload(CandidatePayload):
    session_id: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def touch_session(session_id: str) -> WebRTCSession | None:
    session = sessions.get(session_id)
    if session:
        session.last_seen_at = utc_now()
    return session


async def push_session_event(session_id: str, payload: dict[str, object]) -> None:
    ws = ws_clients.get(session_id)
    if not ws:
        return

    message = {
        "type": "session_event",
        "session_id": session_id,
        "timestamp": now_iso(),
        **payload,
    }

    try:
        await ws.send_text(json.dumps(message))
    except Exception:
        logger.exception("Failed to push session event for %s", session_id)


async def cleanup_session(session_id: str, reason: str) -> None:
    session = sessions.pop(session_id, None)
    pc = pcs.pop(session_id, None)
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

    target_pc = session.peer_connection if session else pc
    if target_pc:
        try:
            await target_pc.close()
        except Exception:
            logger.debug("Peer connection already closed for %s", session_id)


def schedule_disconnect_cleanup(session_id: str) -> None:
    session = sessions.get(session_id)
    if not session:
        return

    if session.cleanup_task:
        session.cleanup_task.cancel()

    async def delayed_cleanup() -> None:
        try:
            await asyncio.sleep(settings.webrtc_disconnect_grace_seconds)
            current = sessions.get(session_id)
            if not current:
                return
            if current.connection_state in {"disconnected", "failed", "closed"}:
                await cleanup_session(session_id, f"{current.connection_state}_timeout")
        except asyncio.CancelledError:
            return

    session.cleanup_task = asyncio.create_task(delayed_cleanup())


def register_peer_connection(session_id: str, pc: RTCPeerConnection) -> WebRTCSession:
    session = WebRTCSession(peer_connection=pc)
    sessions[session_id] = session
    pcs[session_id] = pc

    @pc.on("connectionstatechange")
    async def on_connectionstatechange() -> None:
        current = touch_session(session_id)
        if not current:
            return

        current.connection_state = pc.connectionState
        logger.info("Session %s connection state -> %s", session_id, pc.connectionState)
        await push_session_event(
            session_id,
            {"event": "connection_state", "value": pc.connectionState},
        )

        if pc.connectionState == "connected" and current.cleanup_task:
            current.cleanup_task.cancel()
            current.cleanup_task = None
        elif pc.connectionState in {"disconnected", "failed", "closed"}:
            schedule_disconnect_cleanup(session_id)

    @pc.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange() -> None:
        current = touch_session(session_id)
        if not current:
            return

        current.ice_connection_state = pc.iceConnectionState
        logger.info("Session %s ICE state -> %s", session_id, pc.iceConnectionState)
        await push_session_event(
            session_id,
            {"event": "ice_connection_state", "value": pc.iceConnectionState},
        )

        if pc.iceConnectionState in {"failed", "closed", "disconnected"}:
            schedule_disconnect_cleanup(session_id)

    @pc.on("icegatheringstatechange")
    async def on_icegatheringstatechange() -> None:
        touch_session(session_id)
        logger.info("Session %s ICE gathering -> %s", session_id, pc.iceGatheringState)
        await push_session_event(
            session_id,
            {"event": "ice_gathering_state", "value": pc.iceGatheringState},
        )

    @pc.on("track")
    def on_track(track) -> None:
        touch_session(session_id)
        relayed = relay.subscribe(track)
        logger.info("Session %s received %s track", session_id, track.kind)

        if track.kind == "video":
            asyncio.create_task(run_video_pipeline(session_id, relayed))

    return session


def parse_candidate(payload: CandidatePayload) -> RTCIceCandidate | None:
    raw_candidate = (payload.candidate or "").strip()
    if not raw_candidate:
        return None

    if raw_candidate.startswith("candidate:"):
        raw_candidate = raw_candidate.split(":", 1)[1]

    candidate = candidate_from_sdp(raw_candidate)
    candidate.sdpMid = payload.sdp_mid
    candidate.sdpMLineIndex = payload.sdp_mline_index
    candidate.usernameFragment = payload.username_fragment
    return candidate


@router.get("/webrtc/config")
async def webrtc_config():
    return {
        "ice_servers": settings.webrtc_ice_servers,
        "results_ws_heartbeat_seconds": settings.ws_heartbeat_seconds,
        "session_ttl_seconds": settings.webrtc_session_ttl_seconds,
    }


@router.post("/webrtc/offer")
async def webrtc_offer(offer: Offer):
    session_id = offer.session_id or str(uuid.uuid4())
    pc = RTCPeerConnection()
    register_peer_connection(session_id, pc)

    await pc.setRemoteDescription(
        RTCSessionDescription(sdp=offer.sdp, type=offer.type)
    )

    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    touch_session(session_id)

    return {
        "session_id": session_id,
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type,
    }


@router.post("/webrtc/candidate")
async def add_webrtc_candidate(payload: SessionCandidatePayload):
    session = touch_session(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Unknown WebRTC session.")

    candidate = parse_candidate(payload)
    if candidate is None:
        return {"status": "ok", "session_id": payload.session_id, "completed": True}

    await session.peer_connection.addIceCandidate(candidate)
    return {"status": "ok", "session_id": payload.session_id}


@router.websocket("/asr")
async def asr(ws: WebSocket):
    await ws.accept()

    ap = AudioProcessor(
        transcription_engine=TranscriptionEngine(
            model="base", diarization=False, lan="en"
        )
    )
    gen = await ap.create_tasks()

    task = asyncio.create_task(send_results(ws, gen))

    try:
        while True:
            chunk = await ws.receive_bytes()
            await ap.process_audio(chunk)
    except WebSocketDisconnect:
        logging.info("Client disconnected")
    except Exception:
        logging.exception("WS crashed while processing audio")
    finally:
        task.cancel()
        try:
            await ws.close()
        except Exception:
            pass


@router.websocket("/ws/results/{session_id}")
async def ws_results(ws: WebSocket, session_id: str):
    origin = ws.headers.get("origin")
    allowed_origins = settings.effective_ws_allowed_origins
    if "*" not in allowed_origins and origin not in allowed_origins:
        await ws.close(code=1008)
        return

    await ws.accept()
    ws_clients[session_id] = ws

    session = touch_session(session_id)
    if session:
        session.results_socket_connected_at = utc_now()

    await push_session_event(
        session_id,
        {"event": "results_socket", "value": "connected"},
    )

    try:
        while True:
            raw_message = await ws.receive_text()
            touch_session(session_id)

            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                logger.debug("Ignoring non-JSON websocket message for %s", session_id)
                continue

            if message.get("type") == "ping":
                await ws.send_text(
                    json.dumps(
                        {
                            "type": "pong",
                            "session_id": session_id,
                            "timestamp": now_iso(),
                        }
                    )
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
            if age > settings.webrtc_session_ttl_seconds:
                await cleanup_session(session_id, "session_ttl_expired")


@router.on_event("startup")
async def startup_realtime_tasks() -> None:
    asyncio.create_task(_session_reaper())
