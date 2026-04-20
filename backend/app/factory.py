from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, sessions, stream
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.lifespan import lifespan


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="terminal-grid API",
        description="Manage and stream PTY sessions over WebSocket.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list(),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(sessions.router)
    app.include_router(stream.router)

    return app
