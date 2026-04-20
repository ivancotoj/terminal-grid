from __future__ import annotations

import logging

from app.core.config import Settings
from app.pty.factory import spawn_pty_session
from app.pty.session import PtySession

logger = logging.getLogger("app.registry")


class SessionRegistry:
    def __init__(self) -> None:
        self._sessions: dict[str, PtySession] = {}

    def create(self, settings: Settings) -> PtySession:
        session = spawn_pty_session(settings)
        self._sessions[session.session_id] = session
        logger.info("session created: %s (shell=%s)", session.session_id, session.shell)
        return session

    def get(self, session_id: str) -> PtySession | None:
        return self._sessions.get(session_id)

    def pop(self, session_id: str) -> PtySession | None:
        session = self._sessions.pop(session_id, None)
        if session:
            logger.info("session removed: %s", session_id)
        return session

    def __contains__(self, session_id: str) -> bool:
        return session_id in self._sessions

    def kill_all(self) -> int:
        count = len(self._sessions)
        for session in self._sessions.values():
            session.kill()
        self._sessions.clear()
        return count
