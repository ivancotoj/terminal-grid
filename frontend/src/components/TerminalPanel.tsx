import React, { useRef } from "react";
import { useTerminalSession, SessionStatus } from "../hooks/useTerminalSession";

interface TerminalPanelProps {
  sessionId: string;
  shell: string;
  onClose: () => void;
  onSplitHorizontal?: () => void;
  onSplitVertical?: () => void;
}

const STATUS_LABELS: Record<SessionStatus, string> = {
  connecting: "Connecting…",
  open:       "Connected",
  closed:     "Disconnected",
  error:      "Connection error",
};

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  sessionId,
  shell,
  onClose,
  onSplitHorizontal,
  onSplitVertical,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { status, injected, role, sessionName, topology } = useTerminalSession({
    sessionId,
    containerRef,
  });

  const displayName = sessionName ?? shell;

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <span className="shell-badge" aria-label={`Shell: ${shell}`}>
          {displayName}
        </span>

        {role && (
          <span className={`role-badge role-${role}`} title={role}>
            {role === "orchestrator" ? "ORCH" : "AGENT"}
          </span>
        )}

        {injected && (
          <span className="inject-badge" title="Input received from another agent">
            ⬇ inject
          </span>
        )}

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

        <button
          className="close-btn"
          onClick={onClose}
          title="Close terminal"
          aria-label="Close terminal"
        >
          ✕
        </button>
      </div>

      {/* Agent bar — always rendered on orchestrator panels to avoid layout shift */}
      {role === "orchestrator" && (
        <div className="agent-bar">
          <span className="agent-bar-label">agents</span>
          {topology?.agents.length ? (
            topology.agents.map((agent) => (
              <span key={agent.session_id} className="agent-pill" title={agent.cwd ?? ""}>
                {agent.name ?? agent.session_id.slice(0, 8)}
              </span>
            ))
          ) : (
            <span className="agent-bar-empty">none</span>
          )}
        </div>
      )}

      <div className="terminal-body" ref={containerRef} />
    </div>
  );
};
