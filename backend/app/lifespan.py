from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.services.session_registry import SessionRegistry

logger = logging.getLogger("app.lifespan")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    app.state.registry = SessionRegistry()
    logger.info("startup: session registry initialised")

    yield

    count = app.state.registry.kill_all()
    logger.info("shutdown: killed %d remaining session(s)", count)
