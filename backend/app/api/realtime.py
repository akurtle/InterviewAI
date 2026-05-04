from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from aiortc import (
    RTCConfiguration,
    RTCIceCandidate,
    RTCIceServer,
    RTCPeerConnection,
    RTCSessionDescription,
)
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
    mouth_tracking_enabled: bool = True


class CandidatePayload(BaseModel):
    candidate: str | None = None
    sdp_mid: str | None = Field(default=None, alias="sdpMid")
    sdp_mline_index: int | None = Field(default=None, alias="sdpMLineIndex")
    username_fragment: str | None = Field(default=None, alias="usernameFragment")

    model_config = {"populate_by_name": True}


class SessionCandidatePayload(CandidatePayload):
    session_id: str


class SessionCandidatesPayload(BaseModel):
    session_id: str
    candidates: list[CandidatePayload]


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


async def push_results_message(
    session_id: str,
    payload: dict[str, object],
    *,
    queue_if_unavailable: bool = False,
) -> None:
    session = sessions.get(session_id)
    ws = ws_clients.get(session_id)
    if not ws:
        if queue_if_unavailable and session:
            session.pending_results_messages.append(payload)
        return

    message = {
        "session_id": session_id,
        "timestamp": now_iso(),
        **payload,
    }

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
        await push_results_message(session_id, payload, queue_if_unavailable=False)


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


def build_candidate_key(payload: dict[str, object]) -> str:
    return "|".join(
        [
            str(payload.get("sdpMid") or ""),
            str(payload.get("sdpMLineIndex") if payload.get("sdpMLineIndex") is not None else ""),
            str(payload.get("candidate") or "__end_of_candidates__"),
            str(payload.get("usernameFragment") or ""),
        ]
    )


def extract_local_description_candidates(
    description: RTCSessionDescription | None,
) -> list[dict[str, object]]:
    if description is None or not description.sdp:
        return []

    candidates: list[dict[str, object]] = []
    current_mid: str | None = None
    current_mline_index = -1

    for raw_line in description.sdp.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if line.startswith("m="):
            current_mline_index += 1
            current_mid = None
            continue

        if line.startswith("a=mid:"):
            current_mid = line[6:]
            continue

        if line.startswith("a=candidate:"):
            candidates.append(
                {
                    "candidate": line[2:],
                    "sdpMid": current_mid,
                    "sdpMLineIndex": current_mline_index if current_mline_index >= 0 else None,
                    "usernameFragment": None,
                }
            )
            continue

        if line == "a=end-of-candidates":
            candidates.append(
                {
                    "candidate": None,
                    "sdpMid": current_mid,
                    "sdpMLineIndex": current_mline_index if current_mline_index >= 0 else None,
                    "usernameFragment": None,
                }
            )

    return candidates


def register_initial_answer_candidates(session: WebRTCSession) -> None:
    for payload in extract_local_description_candidates(session.peer_connection.localDescription):
        session.announced_local_candidate_keys.add(build_candidate_key(payload))
    session.initial_answer_candidates_registered = True


async def queue_new_local_description_candidates(session_id: str) -> None:
    session = touch_session(session_id)
    if not session or not session.initial_answer_candidates_registered:
        return

    new_payloads: list[dict[str, object]] = []
    for payload in extract_local_description_candidates(session.peer_connection.localDescription):
        key = build_candidate_key(payload)
        if key in session.announced_local_candidate_keys:
            continue

        session.announced_local_candidate_keys.add(key)
        new_payloads.append(
            {
                "type": "ice_candidate",
                **payload,
            }
        )

    for payload in new_payloads:
        await push_results_message(session_id, payload, queue_if_unavailable=True)


def register_peer_connection(
    session_id: str,
    pc: RTCPeerConnection,
    mouth_tracking_enabled: bool = True,
) -> WebRTCSession:
    session = WebRTCSession(
        peer_connection=pc,
        mouth_tracking_enabled=mouth_tracking_enabled,
    )
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
        await queue_new_local_description_candidates(session_id)

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


async def apply_candidate(
    session: WebRTCSession,
    payload: CandidatePayload,
) -> bool:
    candidate = parse_candidate(payload)
    if candidate is None:
        try:
            await session.peer_connection.addIceCandidate(None)
        except TypeError:
            logger.debug("Ignoring end-of-candidates marker unsupported by aiortc runtime.")
        return True

    await session.peer_connection.addIceCandidate(candidate)
    return False


def build_rtc_configuration() -> RTCConfiguration | None:
    raw_servers = settings.webrtc_ice_servers or []
    if not raw_servers:
        return None

    ice_servers: list[RTCIceServer] = []
    for server in raw_servers:
        if not isinstance(server, dict):
            continue

        urls = server.get("urls")
        if isinstance(urls, str):
            normalized_urls: str | list[str] = urls.strip()
        elif isinstance(urls, list):
            normalized_urls = [str(url).strip() for url in urls if str(url).strip()]
        else:
            continue

        if not normalized_urls:
            continue

        kwargs: dict[str, Any] = {"urls": normalized_urls}
        if server.get("username") is not None:
            kwargs["username"] = str(server["username"])
        if server.get("credential") is not None:
            kwargs["credential"] = str(server["credential"])
        if server.get("credentialType") is not None:
            kwargs["credentialType"] = str(server["credentialType"])

        ice_servers.append(RTCIceServer(**kwargs))

    return RTCConfiguration(iceServers=ice_servers) if ice_servers else None


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
    rtc_configuration = build_rtc_configuration()
    pc = RTCPeerConnection(configuration=rtc_configuration) if rtc_configuration else RTCPeerConnection()
    register_peer_connection(
        session_id,
        pc,
        mouth_tracking_enabled=offer.mouth_tracking_enabled,
    )

    await pc.setRemoteDescription(
        RTCSessionDescription(sdp=offer.sdp, type=offer.type)
    )

    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    session = touch_session(session_id)
    if session:
        register_initial_answer_candidates(session)

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

    completed = await apply_candidate(session, payload)
    return {"status": "ok", "session_id": payload.session_id, "completed": completed}


@router.post("/webrtc/candidates")
async def add_webrtc_candidates(payload: SessionCandidatesPayload):
    session = touch_session(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Unknown WebRTC session.")

    completed = False
    for candidate_payload in payload.candidates:
        completed = await apply_candidate(session, candidate_payload) or completed

    return {
        "status": "ok",
        "session_id": payload.session_id,
        "count": len(payload.candidates),
        "completed": completed,
    }


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
        for ap_task in ap.all_tasks_for_cleanup:
            ap_task.cancel()
        try:
            await ap.ffmpeg_manager.stop()
        except Exception:
            pass
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
    await flush_pending_results_messages(session_id)

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
