-- Cadastros de configuração para análises (executar no Supabase SQL Editor ou via CLI).
-- Limites por tipo de biomassa alimentam a coluna "Limite aceitável" em "Criar nova análise".

create table if not exists public.analysis_responsibles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  professional_reg text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.laboratories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  norm_reference text,
  description text,
  parameter_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.acceptable_limits (
  id uuid primary key default gen_random_uuid(),
  biomass_type_id uuid not null references public.biomass_types (id) on delete cascade,
  parameter_key text not null,
  unit text not null,
  limit_min text,
  limit_max text,
  applies_to text not null default 'Todos os lotes',
  created_at timestamptz not null default now(),
  unique (biomass_type_id, parameter_key)
);

create index if not exists acceptable_limits_biomass_type_id_idx on public.acceptable_limits (biomass_type_id);

comment on table public.analysis_responsibles is 'Responsáveis pela análise (dropdown na nova análise).';
comment on table public.laboratories is 'Laboratórios (dropdown na nova análise).';
comment on table public.analysis_methods is 'Métodos; parameter_key opcional (um, cin, mv, cf, pcs, dens, imp) filtra por parâmetro.';
comment on table public.acceptable_limits is 'Limites aceitáveis por tipo de biomassa e parâmetro.';
