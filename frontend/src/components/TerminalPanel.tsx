/**
 * TerminalPanel.tsx
 * =================
 * A single terminal pane that embeds one xterm.js terminal instance and
 * connects it to one backend PTY session over WebSocket.
 *
 * Layout (top to bottom)
 * ----------------------
 *  ┌─────────────────────────────────────────────┐
 *  │  [bash]                           ● [✕]     │  ← .terminal-header
 *  ├─────────────────────────────────────────────┤
 *  │                                             │
 *  │  xterm.js canvas                            │  ← .terminal-body
 *  │                                             │
 *  └─────────────────────────────────────────────┘
 *
 * Props
 * -----
 * - sessionId : UUID of the PTY session (from backend POST /sessions)
 * - shell     : Human-readable shell name shown in the header badge
 * - onClose   : Callback invoked when the user clicks the close button
 */

import React, { useRef } from "react";
import { useTerminalSession, SessionStatus } from "../hooks/useTerminalSession";

// ─────────────────────────────────────────────────────────────────────────────

interface TerminalPanelProps {
  /** UUID that identifies this PTY session on the backend. */
  sessionId: string;

  /**
   * Shell basename shown in the header badge (e.g. "bash", "cmd.exe").
   * Received from the backend when the session was created.
   */
  shell: string;

  /** Called when the user clicks the ✕ close button. */
  onClose: () => void;

  /** Called when the user splits this panel horizontally (side by side). */
  onSplitHorizontal?: () => void;

  /** Called when the user splits this panel vertically (one above the other). */
  onSplitVertical?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Human-readable label and title attribute for each connection status dot.
 * Used for accessibility (screen readers) and hover tooltips.
 */
const STATUS_LABELS: Record<SessionStatus, string> = {
  connecting: "Connecting…",
  open:       "Connected",
  closed:     "Disconnected",
  error:      "Connection error",
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * TerminalPanel
 * -------------
 * Renders one resizable terminal pane.  Uses `useTerminalSession` to manage
 * the xterm.js instance and the WebSocket connection lifecycle.
 *
 * The panel takes up 100% of its parent's height so that
 * react-resizable-panels can control its width/height freely.
 */
export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  sessionId,
  shell,
  onClose,
  onSplitHorizontal,
  onSplitVertical,
}) => {
  /**
   * The DOM element that xterm.js will render its canvas into.
   * Passed to `useTerminalSession` so the hook can call `terminal.open(el)`.
   */
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Initialise the xterm terminal + WebSocket connection.
   * The hook handles all setup and teardown internally.
   */
  const { status } = useTerminalSession({ sessionId, containerRef });

  return (
    <div className="terminal-panel">
      {/* ── Panel header ─────────────────────────────────────── */}
      <div className="terminal-header">
        {/* Shell name badge — shows which process is running */}
        <span className="shell-badge" aria-label={`Shell: ${shell}`}>
          {shell}
        </span>

        {/*
          Connection status dot.
          - Orange  → connecting
          - Green   → open / healthy
          - Grey    → closed (process exited or WS disconnected)
          - Red     → connection error
        */}
        <span
          className={`status-dot status-${status}`}
          title={STATUS_LABELS[status]}
          aria-label={STATUS_LABELS[status]}
          role="status"
        />

        {onSplitHorizontal && (
          <button
            className="split-btn"
            onClick={onSplitHorizontal}
            title="Split right"
            aria-label="Split horizontally"
          >
            ↔
          </button>
        )}

        {onSplitVertical && (
          <button
            className="split-btn"
            onClick={onSplitVertical}
            title="Split down"
            aria-label="Split vertically"
          >
            ↕
          </button>
        )}

        {/* Close button — calls parent's onClose which kills the session */}
        <button
          className="close-btn"
          onClick={onClose}
          title="Close terminal"
          aria-label="Close terminal"
        >
          ✕
        </button>
      </div>

      {/*
        ── Terminal body ─────────────────────────────────────────
        This div is the mount point for xterm.js.  It must:
          - Fill the remaining height of .terminal-panel (flex: 1)
          - Have min-height: 0 so flexbox doesn't overflow
          - Have overflow: hidden so the xterm canvas doesn't bleed out
        All of these are set in index.css under .terminal-body.
      */}
      <div className="terminal-body" ref={containerRef} />
    </div>
  );
};
