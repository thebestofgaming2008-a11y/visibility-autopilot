import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { handleMcp } from "./mcpHttp";
import { callback as gscCallback } from "./gscHttp";
import { callback as ga4Callback } from "./ga4Http";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({ path: "/mcp", method: "POST", handler: handleMcp });
http.route({ path: "/mcp", method: "GET", handler: handleMcp });
http.route({ path: "/gsc/callback", method: "GET", handler: gscCallback });
http.route({ path: "/ga4/callback", method: "GET", handler: ga4Callback });

export default http;
