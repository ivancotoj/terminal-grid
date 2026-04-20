# terminal-grid — frontend

React + TypeScript SPA that renders a resizable grid of browser-based terminals, each backed by a PTY session managed by the FastAPI backend.

## Tech stack

| Package                  | Version  | Role                                      |
|--------------------------|----------|-------------------------------------------|
| React                    | 18       | UI framework                              |
| TypeScript               | 5.5      | Type safety                               |
| Vite                     | 5        | Dev server & bundler                      |
| @xterm/xterm             | 5.5      | Terminal emulator                         |
| @xterm/addon-fit         | 0.10     | Auto-resize xterm to container dimensions |
| react-resizable-panels   | 2.1      | Draggable split panels                    |

## Setup

```bash
# From the frontend/ directory
npm install
npm run dev
```

Opens at **`http://localhost:5173`** (browser auto-opens).

## Scripts

| Command            | Description                          |
|--------------------|--------------------------------------|
| `npm run dev`      | Start Vite dev server with HMR       |
| `npm run build`    | Type-check then emit production build |
| `npm run preview`  | Serve the production build locally   |
| `npm run typecheck`| Type-check without emitting files    |

## Source layout

```
src/
├── App.tsx                          — Root component; renders LayoutManager
├── main.tsx                         — React entry point
├── index.css                        — Global styles (Catppuccin Mocha palette)
├── components/
│   ├── LayoutManager.tsx            — Toolbar + recursive panel tree
│   └── TerminalPanel.tsx            — Single xterm.js panel with header
└── hooks/
    └── useTerminalSession.ts        — xterm init, WebSocket lifecycle, PTY resize
```

## Architecture

The UI is built around a recursive `LayoutNode` tree:

- **Leaf** — a single terminal panel (`sessionId`, `shell`)
- **Container** — holds two or more children arranged `"horizontal"` or `"vertical"`

`LayoutManager` owns the tree in React state and passes `onSplit` / `onClose` callbacks down through `RenderNode`, which maps the tree to `react-resizable-panels` groups recursively.

### `useTerminalSession` hook

Each `TerminalPanel` calls this hook, which:

1. Mounts an xterm.js `Terminal` into a `div` ref.
2. Attaches `FitAddon` and a `ResizeObserver` to keep terminal dimensions in sync with the container.
3. Opens a WebSocket to `ws://localhost:8000/sessions/{sessionId}/stream`.
4. Pipes WebSocket binary frames → `terminal.write()` (PTY stdout).
5. Pipes `terminal.onData` → WebSocket text frames (PTY stdin).
6. Sends `{ type: "resize", cols, rows }` JSON frames on every terminal resize.
7. Cleans up all listeners, the WebSocket, and the xterm instance on unmount.

### WebSocket message format

| Direction       | Format                                          |
|-----------------|-------------------------------------------------|
| Client → Server | JSON `{ "type": "resize", "cols": N, "rows": N }` or raw keystrokes |
| Server → Client | Binary (ArrayBuffer) — raw PTY stdout bytes     |

## Configuration

The backend base URLs are hardcoded constants at the top of each file:

| File                      | Constant         | Default                    |
|---------------------------|------------------|----------------------------|
| `LayoutManager.tsx`       | `API_BASE`       | `http://localhost:8000`    |
| `useTerminalSession.ts`   | `DEFAULT_WS_BASE`| `ws://localhost:8000`      |

The Vite dev server does **not** proxy API calls — the backend enables CORS for all origins, so absolute URLs are used directly.

## Limits

- Maximum **8** terminal panels open simultaneously (`MAX_PANELS` in `LayoutManager.tsx`).
- Minimum panel size: **10%** of the panel group.
- Scrollback buffer: **5000** lines per terminal.
