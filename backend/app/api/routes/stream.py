from __future__ import annotations

import json
import logging

from fastapi import APIRouter, WebSocket

from app.api.deps import get_registry
from app.ws.bridge import run_bridge

logger = logging.getLogger("app.ws")

router = APIRouter(tags=["sessions"])


@router.websocket("/sessions/{session_id}/stream")
async def stream_session(websocket: WebSocket, session_id: str) -> None:
    registry = get_registry(websocket)

    if session_id not in registry:
        logger.warning("ws rejected: unknown session=%s", session_id)
        await websocket.close(code=4004)
        return

    await websocket.accept()
    session = registry.get(session_id)

    buffered = session.buffered_output()
    if buffered:
        await websocket.send_bytes(buffered)

    # Signal that the replay buffer (if any) has been fully sent.
    # The frontend suppresses terminal.onData until this arrives so that
    # DA1 responses triggered by replayed escape sequences are not forwarded
    # back to the shell as unexpected stdin.
    await websocket.send_text(json.dumps({"__ctrl__": "stream_ready"}))

    await run_bridge(websocket, session)
