alter table public.opportunities add column finding_code text;
create index on public.opportunities(site_id, finding_code);