import React, { useState, useCallback } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { TerminalPanel } from "./TerminalPanel";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:8000";
const MAX_PANELS = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A leaf node represents a single terminal panel.
 * A container node holds two or more children arranged in a direction.
 */
type LayoutNode =
  | { type: "leaf"; sessionId: string; shell: string }
  | { type: "container"; direction: "horizontal" | "vertical"; children: LayoutNode[] };

// ─────────────────────────────────────────────────────────────────────────────
// Tree helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns how many leaf nodes exist in the tree. */
function countLeaves(node: LayoutNode): number {
  if (node.type === "leaf") return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

/**
 * Splits the leaf with the given sessionId.
 *
 * Strategy: walk the tree looking at containers. When a container holds the
 * target leaf as a direct child:
 *   - If the container's direction already matches, insert the new leaf right
 *     after the target (no wrapping → target leaf never remounts).
 *   - If directions differ, replace only the target leaf with a new sub-container
 *     that holds [target, newLeaf]. The target leaf object reference is reused
 *     so React does NOT remount it.
 */
function splitLeaf(
  node: LayoutNode,
  targetId: string,
  direction: "horizontal" | "vertical",
  newLeaf: LayoutNode
): LayoutNode {
  if (node.type === "leaf") return node; // leaf with no parent container — no-op

  const newChildren: LayoutNode[] = [];
  let changed = false;

  for (const child of node.children) {
    if (child.type === "leaf" && child.sessionId === targetId) {
      changed = true;
      if (node.direction === direction) {
        // Same direction: just insert sibling after target (target stays in place)
        newChildren.push(child, newLeaf);
      } else {
        // Different direction: wrap target + new leaf in a sub-container.
        // The `child` reference is reused — React sees the same object, no remount.
        newChildren.push({
          type: "container",
          direction,
          children: [child, newLeaf],
        });
      }
    } else {
      newChildren.push(splitLeaf(child, targetId, direction, newLeaf));
    }
  }

  return changed ? { ...node, children: newChildren } : node;
}

/**
 * Removes a leaf from the tree. If a container ends up with one child,
 * it is replaced by that child (collapse).
 */
function removeLeaf(node: LayoutNode, targetId: string): LayoutNode | null {
  if (node.type === "leaf") {
    return node.sessionId === targetId ? null : node;
  }
  const newChildren = node.children
    .map((child) => removeLeaf(child, targetId))
    .filter((child): child is LayoutNode => child !== null);

  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0]; // collapse single-child container
  return { ...node, children: newChildren };
}

// ─────────────────────────────────────────────────────────────────────────────
// Recursive renderer
// ─────────────────────────────────────────────────────────────────────────────

interface RenderNodeProps {
  node: LayoutNode;
  onSplit: (sessionId: string, direction: "horizontal" | "vertical") => void;
  onClose: (sessionId: string) => void;
}

const RenderNode: React.FC<RenderNodeProps> = ({ node, onSplit, onClose }) => {
  if (node.type === "leaf") {
    return (
      <TerminalPanel
        sessionId={node.sessionId}
        shell={node.shell}
        onClose={() => onClose(node.sessionId)}
        onSplitHorizontal={() => onSplit(node.sessionId, "horizontal")}
        onSplitVertical={() => onSplit(node.sessionId, "vertical")}
      />
    );
  }

  const equalSize = 100 / node.children.length;

  return (
    <PanelGroup direction={node.direction} className="panel-group">
      {node.children.map((child, index) => (
        <React.Fragment key={child.type === "leaf" ? child.sessionId : `container-${index}`}>
          {index > 0 && (
            <PanelResizeHandle className="resize-handle" />
          )}
          <Panel minSize={10} defaultSize={equalSize}>
            <RenderNode node={child} onSplit={onSplit} onClose={onClose} />
          </Panel>
        </React.Fragment>
      ))}
    </PanelGroup>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LayoutManager
// ─────────────────────────────────────────────────────────────────────────────

export const LayoutManager: React.FC = () => {
  const [root, setRoot] = useState<LayoutNode | null>(null);
  const [creating, setCreating] = useState(false);

  const totalPanels = root ? countLeaves(root) : 0;
  const canAddPanel = totalPanels < MAX_PANELS && !creating;

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Creates a new PTY session and adds it as the first panel or splits an existing one. */
  const createSession = useCallback(async (): Promise<{ sessionId: string; shell: string } | null> => {
    try {
      const response = await fetch(`${API_BASE}/sessions`, { method: "POST" });
      if (!response.ok) {
        console.error("Failed to create session:", response.statusText);
        return null;
      }
      const data: { session_id: string; shell: string } = await response.json();
      return { sessionId: data.session_id, shell: data.shell };
    } catch (err) {
      console.error("Could not reach backend:", err);
      return null;
    }
  }, []);

  /** Opens a new terminal. Root is always a container so existing panels never remount. */
  const addPanel = useCallback(async () => {
    if (!canAddPanel) return;
    setCreating(true);
    const session = await createSession();
    if (session) {
      const leaf: LayoutNode = { type: "leaf", sessionId: session.sessionId, shell: session.shell };
      setRoot((prev) => {
        if (prev === null) {
          return { type: "container", direction: "horizontal", children: [leaf] };
        }
        // Root is always a container — just append the new leaf
        if (prev.type === "container") {
          return { ...prev, children: [...prev.children, leaf] };
        }
        // Should never happen, but handle defensively
        return { type: "container", direction: "horizontal", children: [prev, leaf] };
      });
    }
    setCreating(false);
  }, [canAddPanel, createSession]);

  /**
   * Splits an existing panel in the given direction.
   * The new terminal appears alongside the target panel.
   */
  const splitPanel = useCallback(
    async (sessionId: string, direction: "horizontal" | "vertical") => {
      if (!canAddPanel) return;
      setCreating(true);
      const session = await createSession();
      if (session) {
        const newLeaf: LayoutNode = { type: "leaf", ...session };
        setRoot((prev) =>
          prev ? splitLeaf(prev, sessionId, direction, newLeaf) : prev
        );
      }
      setCreating(false);
    },
    [canAddPanel, createSession]
  );

  /** Removes a panel and kills its PTY session on the backend. */
  const closePanel = useCallback((sessionId: string) => {
    setRoot((prev) => {
      if (!prev) return null;
      const next = removeLeaf(prev, sessionId);
      // Keep root as a container so future addPanel never rewraps a leaf
      if (next === null) return null;
      if (next.type === "leaf") {
        return { type: "container", direction: "horizontal", children: [next] };
      }
      return next;
    });
    fetch(`${API_BASE}/sessions/${sessionId}`, { method: "DELETE" }).catch(() => {});
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="layout-manager">
      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="toolbar">
        <span className="app-title">terminal-grid</span>

        <button
          className="toolbar-btn btn-add"
          onClick={addPanel}
          disabled={!canAddPanel}
          title={
            totalPanels >= MAX_PANELS
              ? `Maximum ${MAX_PANELS} panels reached`
              : "Open a new terminal"
          }
        >
          {creating ? "…" : "+ New Terminal"}
        </button>

        <span className="panel-counter" aria-live="polite">
          {totalPanels}/{MAX_PANELS}
        </span>
      </div>

      {/* ── Content area ───────────────────────────────────────── */}
      {root === null ? (
        <div className="empty-state">
          <p>No terminals open.</p>
          <button className="btn-cta" onClick={addPanel}>
            Open a terminal
          </button>
        </div>
      ) : (
        <RenderNode node={root} onSplit={splitPanel} onClose={closePanel} />
      )}
    </div>
  );
};
