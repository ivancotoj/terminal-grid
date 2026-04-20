from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_registry
from app.core.config import Settings, get_settings
from app.schemas.sessions import DetailResponse, SessionResponse
from app.services.session_registry import SessionRegistry

router = APIRouter(prefix="/sessions", tags=["sessions"])


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
