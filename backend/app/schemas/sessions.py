from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

SessionRole = Literal["orchestrator", "agent"]


class SessionResponse(BaseModel):
    session_id: str
    shell: str
    name: str | None = None
    role: SessionRole | None = None
    cwd: str | None = None


class DetailResponse(BaseModel):
    detail: str


class ResizeMessage(BaseModel):
    type: Literal["resize"]
    cols: int
    rows: int


class InjectRequest(BaseModel):
    text: str


class NameRequest(BaseModel):
    name: str
    role: SessionRole | None = None
    cwd: str | None = None


class SessionListItem(BaseModel):
    session_id: str
    shell: str
    name: str | None = None
    role: SessionRole | None = None
    cwd: str | None = None


class SessionListResponse(BaseModel):
    sessions: list[SessionListItem]


class TopologyResponse(BaseModel):
    orchestrator: SessionListItem | None = None
    agents: list[SessionListItem]


class BroadcastRequest(BaseModel):
    text: str
    target_role: SessionRole | None = None
