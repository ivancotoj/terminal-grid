# terminal-grid

A local multi-terminal web application — open up to 8 independent shell sessions in a
resizable split-panel browser window. No database, no auth, runs entirely on localhost.

```
┌──────────────┬──────────────┬──────────────┐
│  bash  [×]   │  bash  [×]   │  bash  [×]   │
│              │              │              │
│  $ _         │  $ _         │  $ _         │
│              │              │              │
└──────────────┴──────────────┴──────────────┘
┌──────────────┬──────────────┬──────────────┐
│  bash  [×]   │  bash  [×]   │  bash  [×]   │
│              │              │              │
│  $ _         │  $ _         │  $ _         │
│              │              │              │
└──────────────┴──────────────┴──────────────┘
```

## Tech stack

| Layer    | Tech                                               |
|----------|----------------------------------------------------|
| Backend  | Python 3.11 · FastAPI · WebSockets · ptyprocess    |
| Frontend | React 18 · TypeScript · xterm.js · react-resizable-panels |
| Bundler  | Vite                                               |

---

## Prerequisites

| Tool       | Minimum version |
|------------|-----------------|
| Python     | 3.11            |
| Node.js    | 18              |
| npm        | 9               |

---

## Running the backend

```bash
cd backend

# 1 — create & activate a virtual environment
python -m venv .venv

# Linux / macOS
source .venv/bin/activate

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# Windows (cmd)
.venv\Scripts\activate.bat

# 2 — install dependencies
pip install -r requirements.txt

# 3 — start the dev server (auto-reloads on file change)
python -m app.main
```

The API will be available at `http://localhost:8000`.
Interactive docs at `http://localhost:8000/docs`.

---

## Running the frontend

Open a **second terminal** in the project root:

```bash
cd frontend

# 1 — install npm dependencies (first run only)
npm install

# 2 — start the Vite dev server
npm run dev
```

Then open **`http://localhost:5173`** in your browser.

---

## Usage

| Action                    | How                                               |
|---------------------------|---------------------------------------------------|
| Open a new terminal       | Click **+ New Terminal** in the toolbar           |
| Resize panels             | Drag the vertical divider between panels          |
| Switch split direction    | Click **↔ Horizontal** / **↕ Vertical** toggle    |
| Close a terminal          | Click the **✕** button in the panel header        |

---

## Project structure

```
terminal-grid/
├── README.md
├── backend/
│   ├── main.py          ← FastAPI app, PTY management, WebSocket stream
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── index.css
        ├── hooks/
        │   └── useTerminalSession.ts   ← WS lifecycle + xterm init
        └── components/
            ├── TerminalPanel.tsx        ← single xterm.js panel
            └── LayoutManager.tsx        ← split-panel orchestrator
```

---

## API reference

| Method    | Path                         | Description                        |
|-----------|------------------------------|------------------------------------|
| `POST`    | `/sessions`                  | Spawn a new PTY; returns `session_id` + `shell` |
| `DELETE`  | `/sessions/{id}`             | Kill and remove a PTY session      |
| `WS`      | `/sessions/{id}/stream`      | Bidirectional PTY I/O stream       |

### WebSocket protocol

Messages sent **from the client** to the server:

```jsonc
// Resize event — must be valid JSON with type "resize"
{ "type": "resize", "cols": 220, "rows": 50 }

// Anything else is forwarded as-is to the PTY stdin (keystrokes, etc.)
```

Messages sent **from the server** to the client are raw bytes from the PTY stdout.
