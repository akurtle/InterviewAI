from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict

from aiortc import RTCPeerConnection
from aiortc.contrib.media import MediaRelay
from fastapi import WebSocket


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class WebRTCSession:
    peer_connection: RTCPeerConnection
    created_at: datetime = field(default_factory=utc_now)
    last_seen_at: datetime = field(default_factory=utc_now)
    results_socket_connected_at: datetime | None = None
    connection_state: str = "new"
    ice_connection_state: str = "new"
    cleanup_task: asyncio.Task | None = None


pcs: Dict[str, RTCPeerConnection] = {}
sessions: Dict[str, WebRTCSession] = {}
relay = MediaRelay()
ws_clients: Dict[str, WebSocket] = {}
