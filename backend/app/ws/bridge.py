from __future__ import annotations

import asyncio
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.pty.session import PtySession
from app.schemas.sessions import ResizeMessage

logger = logging.getLogger("app.ws.bridge")


async def pty_to_ws(websocket: WebSocket, session: PtySession) -> None:
    loop = asyncio.get_event_loop()
    while True:
        try:
            data: bytes = await loop.run_in_executor(None, session.read, 4096)
            if data:
                await websocket.send_bytes(data)
            elif not session.is_alive():
                await websocket.send_text("\r\n[Process exited]\r\n")
                break
        except Exception:
            break


async def ws_to_pty(websocket: WebSocket, session: PtySession) -> None:
    while True:
        try:
            message = await websocket.receive()

            if "bytes" in message and message["bytes"]:
                raw: bytes = message["bytes"]
            elif "text" in message and message["text"]:
                raw = message["text"].encode("utf-8")
            else:
                continue

            try:
                msg = ResizeMessage.model_validate_json(raw)
                session.resize(msg.cols, msg.rows)
                logger.debug("resize session=%s cols=%d rows=%d", session.session_id, msg.cols, msg.rows)
                continue
            except (ValidationError, ValueError):
                pass

            session.write(raw)

        except WebSocketDisconnect:
            break
        except Exception:
            break


async def control_to_ws(websocket: WebSocket, session: PtySession) -> None:
    while True:
        try:
            ctrl_msg = await session.control_queue.get()
            await websocket.send_text(json.dumps(ctrl_msg))
        except Exception:
            break


async def run_bridge(websocket: WebSocket, session: PtySession) -> None:
    reader = asyncio.create_task(pty_to_ws(websocket, session), name="pty_to_ws")
    writer = asyncio.create_task(ws_to_pty(websocket, session), name="ws_to_pty")
    controller = asyncio.create_task(control_to_ws(websocket, session), name="control_to_ws")

    _done, pending = await asyncio.wait(
        [reader, writer, controller],
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    try:
        await websocket.close()
    except Exception:
        pass
