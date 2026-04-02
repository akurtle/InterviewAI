from __future__ import annotations

import asyncio
import logging
import uuid

from aiortc import RTCPeerConnection, RTCSessionDescription
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from whisperlivekit import AudioProcessor, TranscriptionEngine

from app.config import get_settings
from app.parsers.video_parser.helpers import run_video_pipeline, send_results
from app.realtime_state import pcs, relay, ws_clients


router = APIRouter(tags=["realtime"])
settings = get_settings()


class Offer(BaseModel):
    sdp: str
    type: str
    session_id: str | None = None


@router.post("/webrtc/offer")
async def webrtc_offer(offer: Offer):
    session_id = offer.session_id or str(uuid.uuid4())

    print("session_id:", session_id)

    pc = RTCPeerConnection()
    pcs[session_id] = pc

    @pc.on("track")
    def on_track(track):
        relayed = relay.subscribe(track)

        if track.kind == "audio":
            print("here")
        elif track.kind == "video":
            asyncio.create_task(run_video_pipeline(session_id, relayed))

    await pc.setRemoteDescription(
        RTCSessionDescription(sdp=offer.sdp, type=offer.type)
    )

    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return {
        "session_id": session_id,
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type,
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

    try:
        while True:
            _ = await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if ws_clients.get(session_id) is ws:
            ws_clients.pop(session_id, None)
