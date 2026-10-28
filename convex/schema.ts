import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const nullableText = v.optional(v.union(v.string(), v.null()));
const nullableNumber = v.optional(v.union(v.number(), v.null()));
const timestamp = v.string();

export default defineSchema({
  ...authTables,
  workspaces: defineTable({
    name: v.string(),
    autopilot_mode: v.union(v.literal("manual"), v.literal("guarded"), v.literal("advanced")),
    created_by: v.id("users"),
    created_at: timestamp,
  }).index("by_created_by", ["created_by"]),
  memberships: defineTable({
    workspace_id: v.id("workspaces"),
    user_id: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("editor"), v.literal("viewer")),
    created_at: timestamp,
  })
    .index("by_user_id", ["user_id"])
    .index("by_workspace_id_and_user_id", ["workspace_id", "user_id"]),
  sites: defineTable({
    workspace_id: v.id("workspaces"),
    domain: v.string(),
    display_name: v.string(),
    business_facts: v.any(),
    regions: v.array(v.string()),
    service_radius_km: nullableNumber,
    languages: v.array(v.string()),
    source_repo: nullableText,
    ownership_verified: v.boolean(),
    write_access_verified: v.boolean(),
    allow_location_pages: v.boolean(),
    created_at: timestamp,
    updated_at: timestamp,
  })
    .index("by_workspace_id", ["workspace_id"])
    .index("by_workspace_id_and_domain", ["workspace_id", "domain"]),
  audit_schedules: defineTable({
    workspace_id: v.id("workspaces"),
    site_id: v.id("sites"),
    enabled: v.boolean(),
    interval_hours: v.number(),
    next_run_at: v.union(v.number(), v.null()),
    last_run_at: v.union(v.number(), v.null()),
    last_error: v.union(v.string(), v.null()),
    updated_at: timestamp,
  })
    .index("by_site_id", ["site_id"])
    .index("by_enabled_and_next_run_at", ["enabled", "next_run_at"]),
  mcp_tokens: defineTable({
    workspace_id: v.id("workspaces"),
    user_id: v.id("users"),
    token_hash: v.string(),
    label: v.string(),
    created_at: timestamp,
    expires_at: v.number(),
    revoked_at: nullableText,
  })
    .index("by_token_hash", ["token_hash"])
    .index("by_workspace_id", ["workspace_id"]),
  audits: defineTable({
    workspace_id: v.id("workspaces"),
    site_id: v.id("sites"),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("completed"), v.literal("failed"), v.literal("partial")),
    started_at: nullableText,
    finished_at: nullableText,
    error: nullableText,
    summary: v.any(),
    created_by: v.optional(v.id("users")),
    created_at: timestamp,
  }).index("by_site_id", ["site_id"]),
  crawl_pages: defineTable({
    workspace_id: v.id("workspaces"),
    audit_id: v.id("audits"),
    url: v.string(),
    kind: v.string(),
    http_status: nullableNumber,
    fetched_at: timestamp,
    redirect_chain: v.any(),
    bytes: nullableNumber,
    duration_ms: nullableNumber,
    content_type: nullableText,
    parsed: v.any(),
    error: nullableText,
  }).index("by_audit_id", ["audit_id"]),
  findings: defineTable({
    workspace_id: v.id("workspaces"),
    site_id: v.id("sites"),
    audit_id: v.id("audits"),
    code: v.string(),
    title: v.string(),
    severity: v.union(v.literal("info"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    confidence: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    category: v.string(),
    url: nullableText,
    recommendation: v.string(),
    detail: nullableText,
    created_at: timestamp,
  })
    .index("by_site_id", ["site_id"])
    .index("by_audit_id", ["audit_id"]),
  evidence: defineTable({
    workspace_id: v.id("workspaces"),
    finding_id: v.optional(v.id("findings")),
    url: v.string(),
    observed_at: timestamp,
    http_status: nullableNumber,
    snippet: nullableText,
    source: v.string(),
    created_at: timestamp,
  }).index("by_finding_id", ["finding_id"]),
  opportunities: defineTable({
    workspace_id: v.id("workspaces"),
    site_id: v.id("sites"),
    finding_id: v.optional(v.id("findings")),
    finding_code: nullableText,
    title: v.string(),
    description: nullableText,
    impact: v.number(),
    confidence: v.number(),
    effort: v.number(),
    status: v.string(),
    risk: v.string(),
    owner: v.string(),
    next_action: nullableText,
    created_at: timestamp,
    updated_at: timestamp,
  })
    .index("by_site_id", ["site_id"])
    .index("by_site_id_and_finding_code", ["site_id", "finding_code"]),
  tasks: defineTable({
    workspace_id: v.id("workspaces"),
    opportunity_id: v.optional(v.id("opportunities")),
    title: v.string(),
    status: v.union(v.literal("todo"), v.literal("doing"), v.literal("done"), v.literal("blocked")),
    assignee: nullableText,
    due_date: nullableText,
    created_at: timestamp,
  })
    .index("by_opportunity_id", ["opportunity_id"])
    .index("by_workspace_id", ["workspace_id"]),
  integration_connections: defineTable({
    workspace_id: v.id("workspaces"),
    site_id: v.optional(v.id("sites")),
    provider: v.string(),
    status: v.string(),
    verified_at: nullableText,
    notes: nullableText,
    created_at: timestamp,
  })
    .index("by_workspace_id", ["workspace_id"])
    .index("by_site_id", ["site_id"]),
  job_runs: defineTable({
    workspace_id: v.id("workspaces"),
    site_id: v.optional(v.id("sites")),
    kind: v.string(),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("succeeded"), v.literal("failed")),
    trigger: v.string(),
    started_at: nullableText,
    finished_at: nullableText,
    error: nullableText,
    ref_id: nullableText,
    created_by: v.optional(v.id("users")),
    created_at: timestamp,
  })
    .index("by_workspace_id", ["workspace_id"])
    .index("by_site_id", ["site_id"]),
  change_requests: defineTable({
    workspace_id: v.id("workspaces"),
    site_id: v.id("sites"),
    opportunity_id: v.optional(v.id("opportunities")),
    title: v.string(),
    proposed_change: v.string(),
    test_plan: nullableText,
    rollback_plan: nullableText,
    risk: v.string(),
    status: v.string(),
    requires_consent: v.boolean(),
    created_by: v.optional(v.id("users")),
    approved_by: v.optional(v.id("users")),
    created_at: timestamp,
  }).index("by_site_id", ["site_id"]),
  change_events: defineTable({
    workspace_id: v.id("workspaces"),
    entity: v.string(),
    entity_id: nullableText,
    action: v.string(),
    detail: v.any(),
    actor: v.optional(v.id("users")),
    created_at: timestamp,
  }).index("by_workspace_id", ["workspace_id"]),
  metrics_snapshots: defineTable({
    workspace_id: v.id("workspaces"),
    site_id: v.id("sites"),
    source: v.string(),
    metric: v.string(),
    value: nullableNumber,
    period_start: nullableText,
    period_end: nullableText,
    captured_at: timestamp,
  }).index("by_site_id", ["site_id"]),
  content_briefs: defineTable({
    workspace_id: v.id("workspaces"),
    site_id: v.id("sites"),
    title: v.string(),
    language: v.string(),
    search_intent: nullableText,
    page_type: v.union(v.literal("service"), v.literal("product"), v.literal("faq"), v.literal("blog"), v.literal("supporting")),
    target_query: nullableText,
    applicability: nullableText,
    sources: v.any(),
    outline: nullableText,
    draft: nullableText,
    status: v.union(v.literal("draft"), v.literal("review"), v.literal("approved"), v.literal("archived")),
    ai_generated: v.boolean(),
    created_at: timestamp,
    updated_at: timestamp,
  }).index("by_site_id", ["site_id"]),
  keywords: defineTable({
    workspace_id: v.id("workspaces"),
    site_id: v.id("sites"),
    term: v.string(),
    language: v.string(),
    intent: nullableText,
    notes: nullableText,
    source: v.string(),
    created_at: timestamp,
  })
    .index("by_site_id", ["site_id"])
    .index("by_site_id_and_term_and_language", ["site_id", "term", "language"]),
  competitor_sites: defineTable({
    workspace_id: v.id("workspaces"),
    site_id: v.id("sites"),
    domain: v.string(),
    notes: nullableText,
    created_at: timestamp,
  })
    .index("by_site_id", ["site_id"])
    .index("by_site_id_and_domain", ["site_id", "domain"]),
});
