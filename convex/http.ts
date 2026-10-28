import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { handleMcp } from "./mcpHttp";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({ path: "/mcp", method: "POST", handler: handleMcp });
http.route({ path: "/mcp", method: "GET", handler: handleMcp });

export default http;
