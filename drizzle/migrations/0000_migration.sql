
-- Core tenancy
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, display_name text, created_at timestamptz not null default now()
);
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null, autopilot_mode text not null default 'guarded' check (autopilot_mode in ('manual','guarded','advanced')),
  created_by uuid not null, created_at timestamptz not null default now()
);
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null, role text not null default 'owner' check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now(), unique (workspace_id, user_id)
);
create index on public.memberships(user_id);

create or replace function public.is_member(_ws uuid) returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from public.memberships where workspace_id=_ws and user_id=auth.uid()) $$;
create or replace function public.can_edit(_ws uuid) returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from public.memberships where workspace_id=_ws and user_id=auth.uid() and role in ('owner','admin','editor')) $$;
create or replace function public.is_ws_admin(_ws uuid) returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from public.memberships where workspace_id=_ws and user_id=auth.uid() and role in ('owner','admin')) $$;

-- Sites
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain text not null, display_name text not null,
  business_facts jsonb not null default '{}'::jsonb,
  regions text[] not null default '{}', service_radius_km int,
  languages text[] not null default '{fr,nl,en}',
  source_repo text, ownership_verified boolean not null default false,
  write_access_verified boolean not null default false,
  allow_location_pages boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workspace_id, domain)
);
create index on public.sites(workspace_id);

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','partial')),
  started_at timestamptz, finished_at timestamptz, error text, summary jsonb not null default '{}'::jsonb,
  created_by uuid, created_at timestamptz not null default now()
);
create index on public.audits(site_id, created_at desc);

create table public.crawl_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  url text not null, kind text not null default 'page', http_status int, fetched_at timestamptz not null default now(),
  redirect_chain jsonb not null default '[]'::jsonb, bytes int, duration_ms int, content_type text,
  parsed jsonb not null default '{}'::jsonb, error text
);
create index on public.crawl_pages(audit_id);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  code text not null, title text not null, severity text not null check (severity in ('info','low','medium','high','critical')),
  confidence text not null check (confidence in ('low','medium','high')),
  category text not null, url text, recommendation text not null, detail text,
  created_at timestamptz not null default now()
);
create index on public.findings(site_id, created_at desc);
create index on public.findings(audit_id);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id uuid references public.findings(id) on delete cascade,
  url text not null, observed_at timestamptz not null, http_status int, snippet text, source text not null default 'public_fetch',
  created_at timestamptz not null default now()
);
create index on public.evidence(finding_id);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  finding_id uuid references public.findings(id) on delete set null,
  title text not null, description text,
  impact int not null default 3 check (impact between 1 and 5),
  confidence int not null default 3 check (confidence between 1 and 5),
  effort int not null default 3 check (effort between 1 and 5),
  status text not null default 'discovered' check (status in ('discovered','triaged','approved','in_progress','verified','failed','rolled_back','dismissed')),
  risk text not null default 'medium' check (risk in ('low','medium','high','prohibited')),
  owner text not null default 'agency', next_action text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.opportunities(site_id, status);
create unique index opportunities_finding_uq on public.opportunities(finding_id) where finding_id is not null;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  title text not null, status text not null default 'todo' check (status in ('todo','doing','done','blocked')),
  assignee text, due_date date, created_at timestamptz not null default now()
);
create index on public.tasks(opportunity_id);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  provider text not null, status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error')),
  verified_at timestamptz, notes text, created_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  kind text not null, status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  trigger text not null default 'manual', started_at timestamptz, finished_at timestamptz, error text,
  ref_id uuid, created_by uuid, created_at timestamptz not null default now()
);
create index on public.job_runs(workspace_id, created_at desc);

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  title text not null, proposed_change text not null, test_plan text, rollback_plan text,
  risk text not null default 'medium' check (risk in ('low','medium','high')),
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','applied','rolled_back')),
  requires_consent boolean not null default true, created_by uuid, approved_by uuid,
  created_at timestamptz not null default now()
);

create table public.change_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity text not null, entity_id uuid, action text not null, detail jsonb not null default '{}'::jsonb,
  actor uuid, created_at timestamptz not null default now()
);
create index on public.change_events(workspace_id, created_at desc);

create table public.metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  source text not null, metric text not null, value numeric, period_start date, period_end date,
  captured_at timestamptz not null default now()
);

create table public.content_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  title text not null, language text not null default 'fr', search_intent text,
  page_type text not null default 'service' check (page_type in ('service','product','faq','blog','supporting')),
  target_query text, applicability text, sources jsonb not null default '[]'::jsonb,
  outline text, draft text, status text not null default 'draft' check (status in ('draft','review','approved','archived')),
  ai_generated boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.keywords (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  term text not null, language text not null default 'fr', intent text, notes text,
  source text not null default 'manual', created_at timestamptz not null default now(),
  unique (site_id, term, language)
);

create table public.competitor_sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  domain text not null, notes text, created_at timestamptz not null default now(),
  unique (site_id, domain)
);

-- Grants + RLS
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

grant select, insert, update on public.workspaces to authenticated;
grant all on public.workspaces to service_role;
alter table public.workspaces enable row level security;
create policy "ws read" on public.workspaces for select to authenticated using (public.is_member(id));
create policy "ws insert" on public.workspaces for insert to authenticated with check (created_by = auth.uid());
create policy "ws update" on public.workspaces for update to authenticated using (public.is_ws_admin(id));

grant select, insert, delete on public.memberships to authenticated;
grant all on public.memberships to service_role;
alter table public.memberships enable row level security;
create policy "mem read" on public.memberships for select to authenticated using (public.is_member(workspace_id));
create policy "mem admin insert" on public.memberships for insert to authenticated with check (public.is_ws_admin(workspace_id));
create policy "mem admin delete" on public.memberships for delete to authenticated using (public.is_ws_admin(workspace_id));

do $$
declare t text;
begin
  foreach t in array array['sites','audits','crawl_pages','findings','evidence','opportunities','tasks','integration_connections','job_runs','change_requests','metrics_snapshots','content_briefs','keywords','competitor_sites']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "member read" on public.%I for select to authenticated using (public.is_member(workspace_id))', t);
    execute format('create policy "editor insert" on public.%I for insert to authenticated with check (public.can_edit(workspace_id))', t);
    execute format('create policy "editor update" on public.%I for update to authenticated using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id))', t);
    execute format('create policy "admin delete" on public.%I for delete to authenticated using (public.is_ws_admin(workspace_id))', t);
  end loop;
end $$;

-- change_events: append-only audit log
grant select, insert on public.change_events to authenticated;
grant all on public.change_events to service_role;
alter table public.change_events enable row level security;
create policy "member read" on public.change_events for select to authenticated using (public.is_member(workspace_id));
create policy "member insert" on public.change_events for insert to authenticated with check (public.is_member(workspace_id) and actor = auth.uid());

-- Signup: profile + personal workspace + factual pilot site config (unverified)
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare ws uuid;
begin
  insert into public.profiles(id,email) values (new.id,new.email);
  insert into public.workspaces(name,created_by) values ('My agency', new.id) returning id into ws;
  insert into public.memberships(workspace_id,user_id,role) values (ws,new.id,'owner');
  insert into public.sites(workspace_id,domain,display_name,business_facts,regions,service_radius_km,languages)
  values (ws,'yabilocation.com','Yabi Location',
    jsonb_build_object(
      'country','Belgium',
      'offering','Monthly commercial utility van rentals',
      'audience_primary','B2B: SMEs, tradespeople, self-employed businesses',
      'audience_secondary','Private clients',
      'fleet','8 vans in L1H1, L2H2 and L3H2 sizes (individual models not specified)',
      'handover','Arranged handover meeting points; no fixed customer-facing garage',
      'contact','WhatsApp, phone, contact form',
      'not_offered','Car, leisure or tourist rentals; daily or weekend rentals; leasing or financing',
      'pricing','Not specified — do not publish exact prices'),
    array['Brussels','Vilvoorde'], 45, array['fr','nl','en']);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
