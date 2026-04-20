from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class SessionResponse(BaseModel):
    session_id: str
    shell: str


class DetailResponse(BaseModel):
    detail: str


class ResizeMessage(BaseModel):
    type: Literal["resize"]
    cols: int
    rows: int
