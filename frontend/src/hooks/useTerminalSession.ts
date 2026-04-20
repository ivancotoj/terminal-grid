import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

import "@xterm/xterm/css/xterm.css";

export type SessionStatus = "connecting" | "open" | "closed" | "error";
export type SessionRole = "orchestrator" | "agent";

export interface AgentInfo {
  session_id: string;
  name: string | null;
  shell: string;
  role: string | null;
  cwd: string | null;
}

export interface TopologyData {
  orchestrator: AgentInfo | null;
  agents: AgentInfo[];
}

export interface UseTerminalSessionOptions {
  sessionId: string;
  containerRef: React.RefObject<HTMLDivElement>;
  wsBaseUrl?: string;
}

export interface UseTerminalSessionResult {
  status: SessionStatus;
  injected: boolean;
  role: SessionRole | null;
  sessionName: string | null;
  topology: TopologyData | null;
}

const DEFAULT_WS_BASE = "ws://localhost:8000";

const TERMINAL_OPTIONS = {
  cursorBlink: true,
  fontSize: 14,
  fontFamily: '"Menlo", "Monaco", "Courier New", monospace',
  lineHeight: 1.2,
  scrollback: 5000,
  scrollOnUserInput: true,
  overviewRulerWidth: 0,
  theme: {
    background:    "#1e1e2e",
    foreground:    "#cdd6f4",
    cursor:        "#f5e0dc",
    cursorAccent:  "#1e1e2e",
    selectionBackground: "#585b7066",
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

export function useTerminalSession({
  sessionId,
  containerRef,
  wsBaseUrl = DEFAULT_WS_BASE,
}: UseTerminalSessionOptions): UseTerminalSessionResult {
  const [status, setStatus] = useState<SessionStatus>("connecting");
  const [injected, setInjected] = useState(false);
  const [role, setRole] = useState<SessionRole | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [topology, setTopology] = useState<TopologyData | null>(null);

  const injectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamReadyRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setStatus("connecting");
    setRole(null);
    setSessionName(null);
    setTopology(null);
    streamReadyRef.current = false;
    const streamReadyFallback = setTimeout(() => { streamReadyRef.current = true; }, 2000);

    const terminal = new Terminal(TERMINAL_OPTIONS);
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    let initialFitFrame = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return;
      cancelAnimationFrame(initialFitFrame);
      initialFitFrame = requestAnimationFrame(() => fitAddon.fit());
    });
    resizeObserver.observe(container);

    const wsUrl = `${wsBaseUrl}/sessions/${sessionId}/stream`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("open");
      const dims = fitAddon.proposeDimensions();
      const cols = dims?.cols ?? terminal.cols;
      const rows = dims?.rows ?? terminal.rows;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        const text = new TextDecoder("utf-8", { fatal: false }).decode(event.data);
        terminal.write(text);
      } else if (typeof event.data === "string") {
        try {
          const ctrl = JSON.parse(event.data) as Record<string, unknown>;

          if (ctrl.__ctrl__ === "stream_ready") {
            clearTimeout(streamReadyFallback);
            streamReadyRef.current = true;
            return;
          }

          if (ctrl.__ctrl__ === "inject") {
            if (injectedTimerRef.current) clearTimeout(injectedTimerRef.current);
            setInjected(true);
            injectedTimerRef.current = setTimeout(() => setInjected(false), 3000);
            return;
          }

          if (ctrl.__ctrl__ === "registered") {
            setRole((ctrl.role as SessionRole) ?? null);
            setSessionName((ctrl.name as string) ?? null);
            return;
          }

          if (ctrl.__ctrl__ === "topology") {
            setTopology(ctrl.data as TopologyData);
            return;
          }
        } catch {
          // not JSON — fall through to terminal
        }
        terminal.write(event.data);
      }
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("closed");

    const inputDisposable = terminal.onData((data: string) => {
      if (!streamReadyRef.current) return;
      const sock = wsRef.current;
      if (sock && sock.readyState === WebSocket.OPEN) {
        sock.send(data);
      }
    });

    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      const sock = wsRef.current;
      if (sock && sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    return () => {
      clearTimeout(streamReadyFallback);
      cancelAnimationFrame(initialFitFrame);
      if (injectedTimerRef.current) clearTimeout(injectedTimerRef.current);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      resizeDisposable.dispose();
      ws.close();
      wsRef.current = null;
      terminal.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, wsBaseUrl]);

  return { status, injected, role, sessionName, topology };
}
