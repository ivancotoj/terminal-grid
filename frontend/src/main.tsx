/**
 * main.tsx — React application entry point.
 *
 * Mounts the root <App /> component into the #root div defined in index.html.
 * React.StrictMode is enabled in development to surface potential issues
 * (double-invoked effects, deprecated API usage, etc.).
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
