from __future__ import annotations

import asyncio
import collections
import os
import tempfile
import uuid
from pathlib import Path

from .platform import IS_WINDOWS, _NativePtyProcess

_DEFAULT_BUFFER_LIMIT = 65536


class PtySession:
    """Cross-platform PTY wrapper with a bounded replay ring buffer."""

    def __init__(
        self,
        process: _NativePtyProcess,
        shell: str,
        buffer_limit: int = _DEFAULT_BUFFER_LIMIT,
        session_id: str | None = None,
    ) -> None:
        self.process = process
        self.shell: str = os.path.basename(shell)
        self.session_id: str = session_id or str(uuid.uuid4())
        self.name: str | None = None
        self.role: str | None = None
        self.cwd: str | None = None
        self._buffer_limit = buffer_limit
        self._output_chunks: collections.deque[bytes] = collections.deque()
        self._output_bytes: int = 0
        self.control_queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=100)

    # ── I/O ──────────────────────────────────────────────────────────────────

    def write(self, data: bytes) -> None:
        if IS_WINDOWS:
            self.process.write(data.decode("utf-8", errors="replace"))
        else:
            self.process.write(data)

    def read(self, size: int = 4096) -> bytes:
        try:
            if IS_WINDOWS:
                text = self.process.read(size)
                data = text.encode("utf-8", errors="replace") if text else b""
            else:
                data = self.process.read(size, timeout=0.2)  # type: ignore[arg-type]
        except EOFError:
            return b""
        except OSError:
            return b""

        if data:
            self._output_chunks.append(data)
            self._output_bytes += len(data)
            while self._output_bytes > self._buffer_limit and self._output_chunks:
                evicted = self._output_chunks.popleft()
                self._output_bytes -= len(evicted)

        return data

    def buffered_output(self) -> bytes:
        return b"".join(self._output_chunks)

    # ── Resize ───────────────────────────────────────────────────────────────

    def resize(self, cols: int, rows: int) -> None:
        try:
            self.process.setwinsize(rows, cols)
        except Exception:
            pass

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def is_alive(self) -> bool:
        try:
            return bool(self.process.isalive())
        except Exception:
            return False

    def kill(self) -> None:
        try:
            if IS_WINDOWS:
                self.process.terminate()
            else:
                self.process.terminate(force=True)
        except Exception:
            pass
        if IS_WINDOWS:
            sid_file = Path(tempfile.gettempdir()) / "terminal-grid" / f"{self.process.pid}.sid"
            sid_file.unlink(missing_ok=True)
