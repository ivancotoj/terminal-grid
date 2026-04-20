/**
 * App.tsx — Root React component.
 *
 * Thin wrapper that renders the LayoutManager, which owns the entire
 * terminal-grid UI.  Keeping App.tsx minimal makes it easy to add global
 * providers (theme, error boundary, etc.) here later without touching the
 * layout logic.
 */

import React from "react";
import { LayoutManager } from "./components/LayoutManager";

const App: React.FC = () => {
  return (
    /* The outer div fills the viewport height (set in index.css). */
    <div className="app">
      <LayoutManager />
    </div>
  );
};

export default App;
