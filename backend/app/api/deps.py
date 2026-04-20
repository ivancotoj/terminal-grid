from __future__ import annotations

from fastapi import Request

from app.services.session_registry import SessionRegistry


def get_registry(request: Request) -> SessionRegistry:
    return request.app.state.registry
