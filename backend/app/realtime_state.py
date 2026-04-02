from __future__ import annotations

from typing import Dict

from aiortc import RTCPeerConnection
from aiortc.contrib.media import MediaRelay
from fastapi import WebSocket


pcs: Dict[str, RTCPeerConnection] = {}
relay = MediaRelay()
ws_clients: Dict[str, WebSocket] = {}
