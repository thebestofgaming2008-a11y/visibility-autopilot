import React, { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import "./style.css";

const url = import.meta.env["VITE_CONVEX_URL"];
if (!url) throw new Error("VITE_CONVEX_URL is required");
const client = new ConvexReactClient(url);

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  override state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  override render() {
    if (this.state.error) return <main className="loading"><div className="panel"><h1>Something went wrong</h1><p className="error" role="alert">{this.state.error}</p><button onClick={() => location.reload()}>Reload app</button></div></main>;
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary><ConvexAuthProvider client={client}><App /></ConvexAuthProvider></ErrorBoundary>
  </React.StrictMode>,
);
