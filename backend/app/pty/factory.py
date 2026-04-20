from __future__ import annotations

import os

from app.core.config import Settings

from .platform import IS_WINDOWS, _NativePtyProcess
from .session import PtySession


def spawn_pty_session(settings: Settings) -> PtySession:
    if settings.default_shell:
        shell = settings.default_shell
        process = (
            _NativePtyProcess.spawn(shell)
            if IS_WINDOWS
            else _NativePtyProcess.spawn([shell])
        )
    elif IS_WINDOWS:
        shell = "cmd.exe"
        process = _NativePtyProcess.spawn(shell)
    else:
        shell = os.environ.get("SHELL", "/bin/bash")
        process = _NativePtyProcess.spawn([shell])

    return PtySession(process, shell, buffer_limit=settings.pty_buffer_limit)
