/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as capabilities from "../capabilities.js";
import type * as crons from "../crons.js";
import type * as ga4 from "../ga4.js";
import type * as ga4Http from "../ga4Http.js";
import type * as ga4Internal from "../ga4Internal.js";
import type * as gsc from "../gsc.js";
import type * as gscCrypto from "../gscCrypto.js";
import type * as gscHttp from "../gscHttp.js";
import type * as gscInternal from "../gscInternal.js";
import type * as http from "../http.js";
import type * as legacyImport from "../legacyImport.js";
import type * as mcpHttp from "../mcpHttp.js";
import type * as mcpOps from "../mcpOps.js";
import type * as mcpTokens from "../mcpTokens.js";
import type * as publicAudit from "../publicAudit.js";
import type * as publicAuditFetch from "../publicAuditFetch.js";
import type * as scheduling from "../scheduling.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  capabilities: typeof capabilities;
  crons: typeof crons;
  ga4: typeof ga4;
  ga4Http: typeof ga4Http;
  ga4Internal: typeof ga4Internal;
  gsc: typeof gsc;
  gscCrypto: typeof gscCrypto;
  gscHttp: typeof gscHttp;
  gscInternal: typeof gscInternal;
  http: typeof http;
  legacyImport: typeof legacyImport;
  mcpHttp: typeof mcpHttp;
  mcpOps: typeof mcpOps;
  mcpTokens: typeof mcpTokens;
  publicAudit: typeof publicAudit;
  publicAuditFetch: typeof publicAuditFetch;
  scheduling: typeof scheduling;
  workspace: typeof workspace;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
