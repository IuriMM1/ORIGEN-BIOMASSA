-- Amostras (AMO-ORI-XXXX), códigos de análise (ANA-ORI-XXXX) e ligação sem lote obrigatório.

create table if not exists public.lab_samples (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  quadrant text,
  created_at timestamptz not null default now()
);

create table if not exists public.origen_counters (
  counter_key text primary key,
  value bigint not null default 0
);

insert into public.origen_counters (counter_key, value)
values ('analysis', 0), ('sample', 0)
on conflict (counter_key) do nothing;

create or replace function public.origen_next_counter(p_key text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v bigint;
begin
  insert into public.origen_counters (counter_key, value)
  values (p_key, 1)
  on conflict (counter_key)
  do update set value = public.origen_counters.value + 1
  returning value into v;
  return v;
end;
$$;

create or replace function public.next_analysis_code()
returns text
language sql
security definer
set search_path = public
as $$
  select 'ANA-ORI-' || lpad(public.origen_next_counter('analysis')::text, 4, '0');
$$;

create or replace function public.next_sample_code()
returns text
language sql
security definer
set search_path = public
as $$
  select 'AMO-ORI-' || lpad(public.origen_next_counter('sample')::text, 4, '0');
$$;

comment on table public.lab_samples is 'Amostras de laboratório; código AMO-ORI-XXXX gerado por next_sample_code().';

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'lab_analyses'
  ) then
    alter table public.lab_analyses alter column lot_id drop not null;
    alter table public.lab_analyses add column if not exists analysis_code text;
    alter table public.lab_analyses add column if not exists sample_id uuid references public.lab_samples (id) on delete set null;
    alter table public.lab_analyses add column if not exists biomass_type_id uuid references public.biomass_types (id) on delete set null;
    alter table public.lab_analyses add column if not exists supplier_id uuid references public.suppliers (id) on delete set null;
    create unique index if not exists lab_analyses_analysis_code_key on public.lab_analyses (analysis_code) where analysis_code is not null;
  end if;
end $$;

grant execute on function public.next_analysis_code() to anon, authenticated, service_role;
grant execute on function public.next_sample_code() to anon, authenticated, service_role;

-- Pré-visualização na UI (não incrementa o contador; ver também 20260425130000_peek_next_analysis_code.sql).
create or replace function public.peek_next_analysis_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'ANA-ORI-' || lpad(
    (coalesce(
      (select c.value from public.origen_counters c where c.counter_key = 'analysis' limit 1),
      0
    ) + 1)::text,
    4,
    '0'
  );
$$;

grant execute on function public.peek_next_analysis_code() to anon, authenticated, service_role;
