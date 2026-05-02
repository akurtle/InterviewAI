from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import WebSocket


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class Session:
    created_at: datetime = field(default_factory=utc_now)
    last_seen_at: datetime = field(default_factory=utc_now)
    results_socket_connected_at: datetime | None = None
    cleanup_task: asyncio.Task | None = None
    pending_results_messages: list[dict[str, Any]] = field(default_factory=list)


sessions: Dict[str, Session] = {}
ws_clients: Dict[str, WebSocket] = {}
