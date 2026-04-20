from __future__ import annotations

import logging

from app.core.config import Settings
from app.pty.factory import spawn_pty_session
from app.pty.session import PtySession

logger = logging.getLogger("app.registry")


class SessionRegistry:
    def __init__(self) -> None:
        self._sessions: dict[str, PtySession] = {}
        self._names: dict[str, str] = {}  # name → session_id

    def create(self, settings: Settings) -> PtySession:
        session = spawn_pty_session(settings)
        self._sessions[session.session_id] = session
        logger.info("session created: %s (shell=%s)", session.session_id, session.shell)
        return session

    def get(self, session_id: str) -> PtySession | None:
        return self._sessions.get(session_id)

    def get_by_name(self, name: str) -> PtySession | None:
        session_id = self._names.get(name)
        return self._sessions.get(session_id) if session_id else None

    def get_orchestrator(self) -> PtySession | None:
        return next((s for s in self._sessions.values() if s.role == "orchestrator"), None)

    def register_name(
        self,
        session_id: str,
        name: str,
        role: str | None = None,
        cwd: str | None = None,
    ) -> bool:
        session = self._sessions.get(session_id)
        if session is None:
            return False
        if session.name and session.name in self._names:
            del self._names[session.name]
        session.name = name
        self._names[name] = session_id
        if role is not None:
            session.role = role
        if cwd is not None:
            session.cwd = cwd
        logger.info("session %s registered as '%s' (role=%s)", session_id, name, session.role)
        self._notify_session_registered(session)
        self._notify_topology_change()
        return True

    def pop(self, session_id: str) -> PtySession | None:
        session = self._sessions.pop(session_id, None)
        if session:
            if session.name and session.name in self._names:
                del self._names[session.name]
            logger.info("session removed: %s", session_id)
            self._notify_topology_change()
        return session

    def list(self) -> list[PtySession]:
        return list(self._sessions.values())

    def __contains__(self, session_id: str) -> bool:
        return session_id in self._sessions

    def kill_all(self) -> int:
        count = len(self._sessions)
        for session in self._sessions.values():
            session.kill()
        self._sessions.clear()
        self._names.clear()
        return count

    # ── Internal topology notifications ──────────────────────────────────────

    def _notify_session_registered(self, session: PtySession) -> None:
        payload: dict = {
            "__ctrl__": "registered",
            "name": session.name,
            "role": session.role,
            "cwd": session.cwd,
        }
        try:
            session.control_queue.put_nowait(payload)
        except Exception:
            pass

    def _notify_topology_change(self) -> None:
        orchestrator = self.get_orchestrator()
        if orchestrator is None:
            return
        try:
            orchestrator.control_queue.put_nowait(
                {"__ctrl__": "topology", "data": self._build_topology()}
            )
        except Exception:
            pass

    def _build_topology(self) -> dict:
        sessions = self.list()

        def _item(s: PtySession) -> dict:
            return {
                "session_id": s.session_id,
                "name": s.name,
                "shell": s.shell,
                "role": s.role,
                "cwd": s.cwd,
            }

        orch = next((s for s in sessions if s.role == "orchestrator"), None)
        agents = [s for s in sessions if s.role == "agent"]
        return {
            "orchestrator": _item(orch) if orch else None,
            "agents": [_item(s) for s in agents],
        }
