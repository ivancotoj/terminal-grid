from __future__ import annotations

import os
import tempfile
import uuid
from pathlib import Path

from app.core.config import Settings

from .platform import IS_WINDOWS, _NativePtyProcess
from .session import PtySession

# Directory where session ID files are written for tg-claude to read on Windows
_TG_DIR = Path(tempfile.gettempdir()) / "terminal-grid"


def _windows_cd_cmd(shell: str, start_dir: str) -> str:
    """Return a shell command that changes to start_dir on Windows.

    Injected into the PTY stdin right after spawn instead of using the cwd
    parameter, which triggers WinError 10060 in winpty-agent.exe.
    """
    base = os.path.basename(shell).lower()
    if base in ("powershell.exe", "pwsh.exe"):
        safe = start_dir.replace("'", "''")
        return f"Set-Location '{safe}'; Clear-Host\r\n"
    # cmd.exe and others
    return f'cd /d "{start_dir}" && cls\r\n'


def spawn_pty_session(settings: Settings) -> PtySession:
    session_id = str(uuid.uuid4())
    start_dir = settings.start_dir or None

    if IS_WINDOWS:
        # Passing extra kwargs (env or cwd) to winpty causes winpty-agent.exe to
        # time out on its named pipe (WinError 10060).  Spawn bare and inject a
        # cd command into the PTY stdin instead.
        shell = settings.default_shell or "cmd.exe"
        process = _NativePtyProcess.spawn(shell)

        _TG_DIR.mkdir(exist_ok=True)
        (_TG_DIR / f"{process.pid}.sid").write_text(session_id, encoding="utf-8")

        session = PtySession(process, shell, buffer_limit=settings.pty_buffer_limit, session_id=session_id)

        if start_dir:
            process.write(_windows_cd_cmd(shell, start_dir))

        return session
    else:
        env = {**os.environ, "TERMINAL_GRID_SESSION_ID": session_id}
        shell = settings.default_shell or os.environ.get("SHELL", "/bin/bash")
        process = _NativePtyProcess.spawn([shell], env=env, cwd=start_dir)

    return PtySession(process, shell, buffer_limit=settings.pty_buffer_limit, session_id=session_id)
