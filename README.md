# Visibility Autopilot

## Independent development deployment

The active nonproduction version uses Convex for auth, tenant data and public audit jobs, and Cloudflare Workers for the static React client. It does not require Lovable or Supabase at runtime.

- App: https://omni-visibility-autopilot-dev.thebestofgaming2008.workers.dev
- Convex dev deployment: https://dashboard.convex.dev/t/monz/visibility-autopilot-dev/colorless-toad-83
- Branch: `convex-cloudflare-dev` (the original Lovable version remains on `main`)

The app is explicitly **development only**. Email/password signup works, but email verification and password reset are not configured. Google sign-in code is present but inactive until a Google OAuth client is registered and `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` are set in Convex. The callback is `https://colorless-toad-83.convex.site/api/auth/callback/google`. Search Console, GA4, Business Profile, email delivery, ChatGPT OAuth and publishing integrations are disconnected. No private Yabi data was imported and no production site was changed. The Cloudflare URL sends `X-Robots-Tag: noindex, nofollow`.

The public audit checks DNS before fetching, but its HTTPS fetch can resolve DNS again. A production rollout needs network-level egress controls or DNS pinning to close that rebinding gap. Keep this deployment for development only.

An opt-in Convex cron dispatches daily, read-only public audits for enabled sites. The Automations page shows the next and last run. The MCP endpoint at `https://colorless-toad-83.convex.site/mcp` serves eight tools to clients with a 30-day, revocable workspace token generated in Settings. It accepts Bearer tokens, enforces workspace boundaries and does not publish changes. ChatGPT connection is **not** online because OAuth discovery and authorization are not configured for that host.

The legacy database currently contains one real account, one Yabi site, and two completed audits, with no saved briefs, keywords, competitors, opportunities or tasks. Those records remain in the legacy database. Linking them to a new Convex account requires a verified identity; do not attach them based only on an unverified email/password signup.

To work locally, install dependencies, set `VITE_CONVEX_URL` and `CONVEX_DEPLOYMENT` for your own Convex dev deployment, run `npx convex dev`, then `npm run dev:independent`. `npm run build:independent` produces `dist-independent`, deployed with `npx wrangler deploy --config cloudflare/wrangler.dev.jsonc`. The existing Lovable/TanStack app remains available through the original `npm run dev` and `npm run build` scripts.

Checks: `npx tsc --noEmit`, `npm test`, `npm run build:independent`, `node --env-file=.env.local scripts/dev-smoke.mjs`, `node --env-file=.env.local scripts/scheduled-smoke.mjs`, and `node --env-file=.env.local scripts/mcp-smoke.mjs`. These smoke scripts create disposable dev accounts, test tenant isolation and persistent CRUD, and perform real public audits of yabilocation.com; run them only against a development deployment.

The original product prompt is preserved below for reference.

Build an actual full-stack web application named "OmniVisibility Autopilot" as an agency-first autonomous organic visibility command center. This is NOT an SEO landing page and NOT a visual-only mock. Implement working persistent CRUD and real public audits. The site yabilocation.com is the initial pilot but no access to its private analytics, code, or deployment is authorized/connected yet. Do not invent live metrics, audit findings, GSC data, ranking positions, connected-account status, or AI search citations. No billing or ads. Do not touch production sites.

USER: a technically inexperienced vibe coder operating a website agency. They will design client websites and want an AI to handle SEO/GEO/AEO, cross-search visibility, performance monitoring and implementation safely. Language English for dashboard; site-specific research French prioritized, Dutch secondary, English tertiary. For Yabi Location, business facts: Belgian monthly COMMERCIAL UTILITY VAN RENTALS, mainly B2B SMEs, tradespeople and self-employed businesses, private clients secondary. Brussels, Vilvoorde and verified commercially relevant places in ~40–50km service area, with arranged handover meeting points, no fixed customer-facing garage; not car/leisure/tourist or daily/weekend rentals, not leasing/finance. Eight vans L1H1/L2H2/L3H2. Do not invent exact price or individual fleet models. Primary contact WhatsApp/phone/form. Every content output must follow factual truthfulness and native FR/NL quality.

PRODUCT REQUIREMENTS:
1) Elegant dense professional desktop SaaS UI (think Linear/Datadog/modern Semrush), clean light theme with navy ink, whites, restrained teal accent; polished typography, no glassmorphism/glows and no overly large empty cards. Sidebar: Overview, Sites, Audits, Opportunities, Content, Keywords, Competitors, Integrations, Automations, Activity, Settings. Topbar search, site switcher, job status, concise connection banners. Mobile functional. Auth required for tenant data; support invitation later, but no cross-tenant leakage.
2) Database persistent, row-level security per user/tenant with tables (users/workspaces/memberships, sites, audits, crawl_pages, findings, opportunities, tasks, evidence, integration_connections, job_runs, change_requests, change_events, metrics_snapshots, content_briefs, keywords, competitor_sites). Provide robust migrations/indexes and least-privilege RLS. Seed only factual pilot site config if allowed; all analytics metrics should display "Not connected" / "No verified data" rather than fake numbers.
3) Site onboarding wizard: add domain, business facts, regions, languages, source repo when available; verify permissions before any write. Owner can edit truth/allowed location radius, no location doorway pages. Start with yabilocation.com automatically if possible but never claim ownership verification.
4) Real PUBLIC READ-ONLY audit: from backend/edge function, with strict SSRF protection (HTTPS only, validated domain and DNS/IP block private/local, cap redirects, body size/time, no arbitrary proxy). Fetch homepage, robots.txt, sitemap.xml; parse title, meta description, canonical, robots tags, hreflang, headings, basic Schema JSON-LD presence, OG tags, link sample, response status, redirect chain and estimated page size. Report precise URL/UTC timestamp/http status/source snippets, severity/confidence, recommendation. If server networking restrictions prevent checks, display explicit failed/unavailable state not pretend results. Use publicly accessible pages only, respect robots where applicable and rate limits. Do NOT label absence of structured data errors automatically. Never automatically submit indexation.
5) Opportunity/task queue: evidence-linked, prioritized by Impact x Confidence / Effort, with statuses discovered/triaged/approved/in_progress/verified/failed/rolled_back; clear next actions and who owns it. Mutations persisted, not localstorage-only. No fake generated actions.
6) Source integrations page: Google Search Console read-only OAuth pending Google Cloud credentials; GA4 read-only; Bing Webmaster REST OAuth/API; GitHub repo auth; Semrush optional; Google Business Profile only for eligible verified businesses; Microsoft/other providers future. Each shows actual connection status = disconnected until verified; show plain step-by-step setup including required provider client registration/consent. Never ask users to paste secrets into chat; use secured secret management. Do not implement fake OAuth callback or deceptive 'connect' buttons. Implement when credentials available; otherwise show configure action.
7) Autonomous planner: store operational policies for three modes Manual, Guarded (default), Advanced with action risk matrix. Read-only public audit automatically. In guarded mode create proposed changes and tests, but cannot publish; production site changes, public posting, GBP edits, reputation responses, social comments, bulk content creation require consent. Advanced mode limited to explicitly authorized low-risk changes backed by tests, monitoring, and rollback. Bulk link-building/spam, fabricated reviews, impersonation, fake locations, mass subreddit posting prohibited.
8) Content briefs with search intent, verified source citations, location/business applicability, recommended page type (service/product/supporting FAQ/blog), responsible E-E-A-T, no keyword stuffing, duplicate location doorway pages or generated junk. If AI generation is not configured, working template + user editable drafts. Should not claim completion when no AI API key available.
9) Jobs: create run entries with actual timestamps/errors; audit/manual rerun buttons must trigger backend work not simulate. Scheduling can be staged if hosting runtime lacks cron; do not present cron as active until verified. Audit change history view.
10) AI/citation visibility metrics must be measurement methodology and empty states until real data sources; not inferred fabricated percentage scores. Conversions and rankings as separate KPIs.
11) Include a visible 'MCP / ChatGPT' section in Settings describing a secure planned or if feasible working remote MCP Streamable HTTP server with tools: list_sites, get_site, run_public_audit, list_findings, list_tasks, propose_fix, get_job_status, and update_task_status (approval rules). If implement MCP endpoint with user OAuth securely, do so; otherwise don't claim it's online. Include a connection status UI.
12) Actually test public audit, CRUD, authentication and loading states; no random dummy graphs. Error boundaries, accessible forms, skeletons, proper feedback and tenant safety.

STACK: use Lovable's native full stack default (React/TypeScript/Tailwind/shadcn, Supabase or Lovable Cloud Postgres + edge functions when supported). Set up DB and auth. Secret keys only on server and use provider OAuth with secure scopes. If real external integrations cannot be completed without account setup, show explicit pending rather than simulated actions. The first shipped valuable vertical slice is persistent app, Yabi site setup, real public audit, evidence-rich findings and task triage, with safe guardrails. Do not create a marketing page or present fake dashboard data.

User instruction: proceed now to code and implement.

The initial implementation was built with [Lovable](https://lovable.dev).

## Historical Lovable implementation

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c307f1ac-3158-44c2-8f7c-e14c91515bc2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Current implementation

The authenticated dashboard now has all 11 navigation pages. Site facts, audits, opportunities, tasks, content briefs, keywords, competitors, workspace mode, jobs and change events use the existing Supabase tables. Public audits run through the authenticated server function and record real results or explicit failures. Provider OAuth, scheduled runs and remote MCP remain pending; their pages show that status rather than simulated connections.

Run `npx tsc --noEmit`, `npm test`, and `npm run build` before publishing. Run `npm run preview` to serve the built Cloudflare Worker locally. The audit tests cover URL and IP blocking, redirect boundaries, robots rules and evidence evaluation. A saved public audit of yabilocation.com completed on 28 October 2026 with three fetched pages and no findings. Never use production client credentials for tests.
