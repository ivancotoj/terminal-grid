# terminal-grid · backend

FastAPI backend that spawns and streams pseudo-terminal (PTY) sessions over WebSocket. Cross-platform: uses **winpty** on Windows and **ptyprocess** on Unix.

---

## Requirements

- Python 3.11+
- Dependencies listed in `requirements.txt`

---

## Setup

```bash
# 1. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Unix

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env as needed
```

---

## Running

```bash
python -m app.main
```

The server starts on `http://127.0.0.1:8000` by default.

---

## Configuration

All settings are driven by environment variables with the `APP_` prefix. Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|---|---|---|
| `APP_HOST` | `127.0.0.1` | Bind address |
| `APP_PORT` | `8000` | Listen port |
| `APP_RELOAD` | `false` | Enable auto-reload (dev only) |
| `APP_LOG_LEVEL` | `INFO` | Log level: DEBUG, INFO, WARNING, ERROR |
| `APP_CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed origins |
| `APP_DEFAULT_SHELL` | *(auto)* | Override shell (e.g. `powershell.exe`, `/bin/zsh`). Empty = auto-detect |
| `APP_PTY_BUFFER_LIMIT` | `65536` | Replay ring-buffer size per session in bytes (64 KiB) |

---

## API

### REST

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check → `{"status": "ok"}` |
| `POST` | `/sessions` | Spawn a new PTY session → `{"session_id": "...", "shell": "..."}` |
| `DELETE` | `/sessions/{session_id}` | Kill a PTY session |

### WebSocket

```
ws://host/sessions/{session_id}/stream
```

**On connect:** recent PTY output is replayed immediately (up to `APP_PTY_BUFFER_LIMIT` bytes), so the shell prompt is always visible even on reconnect.

**Client → Server messages:**

| Payload | Action |
|---|---|
| `{"type": "resize", "cols": N, "rows": N}` | Resize the PTY window |
| Anything else (text or binary) | Forwarded verbatim to the shell stdin |

**Server → Client:** raw PTY output as binary frames. On process exit, sends `\r\n[Process exited]\r\n`.

**Close code `4004`** — session ID not found.

---

## Project Structure

```
backend/
├── app/
│   ├── __main__.py          # python -m app entrypoint
│   ├── factory.py           # create_app() — FastAPI assembly
│   ├── lifespan.py          # Startup/shutdown hooks (kills PTYs on exit)
│   ├── core/
│   │   ├── config.py        # Settings via pydantic-settings (APP_ prefix)
│   │   └── logging.py       # Logging configuration
│   ├── pty/
│   │   ├── platform.py      # Platform detection + native PTY import
│   │   ├── session.py       # PtySession — cross-platform PTY wrapper
│   │   └── factory.py       # spawn_pty_session()
│   ├── services/
│   │   └── session_registry.py  # In-memory session store (on app.state)
│   ├── schemas/
│   │   └── sessions.py      # Pydantic models: SessionResponse, ResizeMessage, …
│   ├── api/
│   │   ├── deps.py          # FastAPI dependencies (get_registry)
│   │   └── routes/
│   │       ├── health.py    # GET /health
│   │       ├── sessions.py  # POST/DELETE /sessions
│   │       └── stream.py    # WebSocket /sessions/{id}/stream
│   └── ws/
│       └── bridge.py        # pty_to_ws / ws_to_pty / run_bridge coroutines
├── tests/
├── .env.example
└── requirements.txt
```

---

## Notes

- Sessions are in-memory only — they do not survive a server restart.
- On server shutdown, all active PTY processes are terminated automatically (no orphan shells).
- The `APP_CORS_ORIGINS` wildcard (`*`) should be replaced with explicit origins in production.
