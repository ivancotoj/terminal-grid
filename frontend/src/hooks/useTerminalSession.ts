/**
 * useTerminalSession.ts
 * =====================
 * Custom React hook that wires together an xterm.js terminal and a WebSocket
 * connection to one PTY session managed by the backend.
 *
 * Responsibilities
 * ----------------
 * 1. Create and mount an xterm.js `Terminal` instance inside the provided
 *    container element.
 * 2. Attach `FitAddon` and fit the terminal to its container on mount, and
 *    again whenever the container is resized (via `ResizeObserver`).
 * 3. Open a WebSocket to `ws://<wsBaseUrl>/sessions/<sessionId>/stream`.
 * 4. Forward WebSocket binary/text messages to the terminal (PTY stdout).
 * 5. Forward terminal user-input events to the WebSocket (PTY stdin).
 * 6. Send a JSON resize message over the WebSocket whenever the terminal
 *    dimensions change (triggered by FitAddon after a container resize).
 * 7. Clean up everything on unmount or when `sessionId` changes.
 *
 * Usage
 * -----
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { status } = useTerminalSession({ sessionId, containerRef });
 * return <div ref={containerRef} style={{ height: "100%" }} />;
 * ```
 */

import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

// Import xterm's bundled CSS so glyphs and the scrollbar render correctly.
import "@xterm/xterm/css/xterm.css";

/** The four lifecycle states a WebSocket connection can be in. */
export type SessionStatus = "connecting" | "open" | "closed" | "error";

/** Options accepted by `useTerminalSession`. */
export interface UseTerminalSessionOptions {
  /** UUID of the PTY session (returned by POST /sessions). */
  sessionId: string;

  /**
   * Ref to the DOM element that xterm.js will mount into.
   * Must be stable across re-renders (created with `useRef`).
   */
  containerRef: React.RefObject<HTMLDivElement>;

  /**
   * Base URL of the WebSocket backend.
   * Defaults to "ws://localhost:8000".
   */
  wsBaseUrl?: string;
}

/** Values returned by the hook. */
export interface UseTerminalSessionResult {
  /** Current state of the WebSocket connection. */
  status: SessionStatus;
}

/** Default WebSocket base URL (backend dev server). */
const DEFAULT_WS_BASE = "ws://localhost:8000";

/**
 * xterm.js terminal configuration shared by all panels.
 * Colours match the Catppuccin Mocha palette used in index.css.
 */
const TERMINAL_OPTIONS = {
  cursorBlink: true,
  fontSize: 14,
  fontFamily: '"Menlo", "Monaco", "Courier New", monospace',
  lineHeight: 1.2,
  scrollback: 5000,
  theme: {
    background:    "#1e1e2e", // --bg-base
    foreground:    "#cdd6f4", // --text
    cursor:        "#f5e0dc",
    cursorAccent:  "#1e1e2e",
    selectionBackground: "#585b7066",

    // ANSI colours (Catppuccin Mocha)
    black:          "#45475a",
    red:            "#f38ba8",
    green:          "#a6e3a1",
    yellow:         "#f9e2af",
    blue:           "#89b4fa",
    magenta:        "#cba4f7",
    cyan:           "#94e2d5",
    white:          "#bac2de",
    brightBlack:    "#585b70",
    brightRed:      "#f38ba8",
    brightGreen:    "#a6e3a1",
    brightYellow:   "#f9e2af",
    brightBlue:     "#89b4fa",
    brightMagenta:  "#cba4f7",
    brightCyan:     "#94e2d5",
    brightWhite:    "#a6adc8",
  },
};

// ─────────────────────────────────────────────────────────────────────────────

export function useTerminalSession({
  sessionId,
  containerRef,
  wsBaseUrl = DEFAULT_WS_BASE,
}: UseTerminalSessionOptions): UseTerminalSessionResult {
  // ── State ─────────────────────────────────────────────────────────────────

  const [status, setStatus] = useState<SessionStatus>("connecting");

  // We store the WS ref so the onData handler (created inside the effect) can
  // always access the current WebSocket without stale closure issues.
  const wsRef = useRef<WebSocket | null>(null);

  // ── Effect: mount terminal + open WebSocket ────────────────────────────────

  useEffect(() => {
    // Guard: container must exist before we can mount xterm.
    const container = containerRef.current;
    if (!container) return;

    // Reset status on every fresh session mount.
    setStatus("connecting");

    // ── 1. Create xterm terminal ────────────────────────────────────────────
    const terminal = new Terminal(TERMINAL_OPTIONS);
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    // ── 2. ResizeObserver — fit on every size change, including the first ─────
    //
    // ResizeObserver fires once immediately on observe() and again whenever
    // the container resizes (e.g. user drags the handle). Each time we defer
    // to rAF so the browser has finished painting before we measure.
    // This also handles the initial fit: when the panel first gets real
    // dimensions the observer fires and fitAddon.fit() runs correctly.
    let initialFitFrame = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return; // skip zero-size frames
      cancelAnimationFrame(initialFitFrame);
      initialFitFrame = requestAnimationFrame(() => fitAddon.fit());
    });
    resizeObserver.observe(container);

    // ── 3. Open WebSocket ───────────────────────────────────────────────────
    const wsUrl = `${wsBaseUrl}/sessions/${sessionId}/stream`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer"; // receive PTY output as binary frames
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("open");
      // Use fitted dimensions if available; fall back to xterm's current size
      // (default 80×24) so we always send a resize and the PTY is properly sized
      // even when the container hasn't been painted yet.
      const dims = fitAddon.proposeDimensions();
      const cols = dims?.cols ?? terminal.cols;
      const rows = dims?.rows ?? terminal.rows;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    };

    // ── 4. PTY stdout → xterm ───────────────────────────────────────────────
    ws.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        // Binary frame — decode UTF-8 and write to the terminal.
        const text = new TextDecoder("utf-8", { fatal: false }).decode(
          event.data
        );
        terminal.write(text);
      } else if (typeof event.data === "string") {
        // Text frame (e.g. "[Process exited]" from the backend)
        terminal.write(event.data);
      }
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("closed");

    // ── 5. xterm user input → PTY stdin ────────────────────────────────────
    //
    // terminal.onData fires for every keystroke / paste event.  We forward
    // the raw string to the WebSocket as a text frame.  The backend detects
    // that it is NOT valid JSON and forwards it verbatim to the PTY stdin.
    const inputDisposable = terminal.onData((data: string) => {
      const sock = wsRef.current;
      if (sock && sock.readyState === WebSocket.OPEN) {
        sock.send(data);
      }
    });

    // ── 6. Terminal resize event → PTY resize ──────────────────────────────
    //
    // FitAddon calls terminal.resize() after fitAddon.fit(), which fires
    // terminal.onResize.  We forward the new dimensions as a JSON resize
    // message so the backend can call ptyprocess/winpty setwinsize().
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      const sock = wsRef.current;
      if (sock && sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    // ── 7. Cleanup ──────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(initialFitFrame);
      resizeObserver.disconnect();

      // Dispose xterm event listeners.
      inputDisposable.dispose();
      resizeDisposable.dispose();

      // Close the WebSocket (if still open).
      ws.close();
      wsRef.current = null;

      // Tear down the xterm instance and remove DOM nodes it created.
      terminal.dispose();
    };
    // sessionId and wsBaseUrl are the only values that should trigger a
    // full remount.  containerRef is a stable ref object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, wsBaseUrl]);

  return { status };
}
