from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_registry
from app.core.config import Settings, get_settings
from app.schemas.sessions import (
    BroadcastRequest,
    DetailResponse,
    InjectRequest,
    NameRequest,
    SessionListItem,
    SessionListResponse,
    SessionResponse,
    TopologyResponse,
)
from app.services.session_registry import SessionRegistry

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get(
    "",
    response_model=SessionListResponse,
    summary="List all active PTY sessions",
)
async def list_sessions(
    registry: SessionRegistry = Depends(get_registry),
) -> SessionListResponse:
    return SessionListResponse(
        sessions=[
            SessionListItem(
                session_id=s.session_id,
                shell=s.shell,
                name=s.name,
                role=s.role,  # type: ignore[arg-type]
                cwd=s.cwd,
            )
            for s in registry.list()
        ]
    )


@router.get(
    "/topology",
    response_model=TopologyResponse,
    summary="Get orchestrator + agent topology",
)
async def get_topology(
    registry: SessionRegistry = Depends(get_registry),
) -> TopologyResponse:
    sessions = registry.list()

    def _item(s):  # type: ignore[no-untyped-def]
        return SessionListItem(
            session_id=s.session_id,
            shell=s.shell,
            name=s.name,
            role=s.role,  # type: ignore[arg-type]
            cwd=s.cwd,
        )

    orch = next((s for s in sessions if s.role == "orchestrator"), None)
    agents = [s for s in sessions if s.role == "agent"]
    return TopologyResponse(
        orchestrator=_item(orch) if orch else None,
        agents=[_item(s) for s in agents],
    )


@router.get(
    "/by-name/{name}",
    response_model=SessionResponse,
    summary="Get a session by its registered name",
)
async def get_session_by_name(
    name: str,
    registry: SessionRegistry = Depends(get_registry),
) -> SessionResponse:
    session = registry.get_by_name(name)
    if session is None:
        raise HTTPException(status_code=404, detail=f"No session named '{name}'")
    return SessionResponse(
        session_id=session.session_id,
        shell=session.shell,
        name=session.name,
        role=session.role,  # type: ignore[arg-type]
        cwd=session.cwd,
    )


@router.post(
    "/by-name/{name}/inject",
    response_model=DetailResponse,
    summary="Inject text into a session by its registered name",
)
async def inject_by_name(
    name: str,
    body: InjectRequest,
    registry: SessionRegistry = Depends(get_registry),
) -> DetailResponse:
    session = registry.get_by_name(name)
    if session is None:
        raise HTTPException(status_code=404, detail=f"No session named '{name}'")
    session.write(body.text.encode("utf-8"))
    try:
        session.control_queue.put_nowait({"__ctrl__": "inject"})
    except asyncio.QueueFull:
        pass
    return DetailResponse(detail="Injected")


@router.post(
    "/broadcast",
    response_model=DetailResponse,
    summary="Inject text into all sessions (or filtered by role)",
)
async def broadcast(
    body: BroadcastRequest,
    registry: SessionRegistry = Depends(get_registry),
) -> DetailResponse:
    sessions = registry.list()
    if body.target_role is not None:
        sessions = [s for s in sessions if s.role == body.target_role]
    count = 0
    for session in sessions:
        session.write(body.text.encode("utf-8"))
        try:
            session.control_queue.put_nowait({"__ctrl__": "inject"})
        except asyncio.QueueFull:
            pass
        count += 1
    return DetailResponse(detail=f"Broadcast to {count} session(s)")


@router.post(
    "",
    response_model=SessionResponse,
    summary="Create a new PTY session",
    status_code=201,
)
async def create_session(
    registry: SessionRegistry = Depends(get_registry),
    settings: Settings = Depends(get_settings),
) -> SessionResponse:
    session = registry.create(settings)
    return SessionResponse(session_id=session.session_id, shell=session.shell)


@router.post(
    "/{session_id}/name",
    response_model=DetailResponse,
    summary="Register a human-readable name, role, and cwd for a session",
)
async def register_session_name(
    session_id: str,
    body: NameRequest,
    registry: SessionRegistry = Depends(get_registry),
) -> DetailResponse:
    if not registry.register_name(session_id, body.name, role=body.role, cwd=body.cwd):
        raise HTTPException(status_code=404, detail="Session not found")
    parts = [f"Registered as '{body.name}'"]
    if body.role:
        parts.append(f"role={body.role}")
    return DetailResponse(detail=", ".join(parts))


@router.post(
    "/{session_id}/inject",
    response_model=DetailResponse,
    summary="Inject text into a PTY session's stdin",
)
async def inject_session(
    session_id: str,
    body: InjectRequest,
    registry: SessionRegistry = Depends(get_registry),
) -> DetailResponse:
    session = registry.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    session.write(body.text.encode("utf-8"))
    try:
        session.control_queue.put_nowait({"__ctrl__": "inject"})
    except asyncio.QueueFull:
        pass
    return DetailResponse(detail="Injected")


@router.delete(
    "/{session_id}",
    response_model=DetailResponse,
    summary="Kill a PTY session",
)
async def delete_session(
    session_id: str,
    registry: SessionRegistry = Depends(get_registry),
) -> DetailResponse:
    session = registry.pop(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    session.kill()
    return DetailResponse(detail="Session terminated")
