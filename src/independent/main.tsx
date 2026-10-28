import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import "./style.css";

const url = import.meta.env["VITE_CONVEX_URL"];
if (!url) throw new Error("VITE_CONVEX_URL is required");
const client = new ConvexReactClient(url);
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexAuthProvider client={client}>
      <App />
    </ConvexAuthProvider>
  </React.StrictMode>,
);
