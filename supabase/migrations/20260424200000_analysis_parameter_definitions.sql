-- Parâmetros de análise personalizados (além dos definidos em código em PARAM_DEFS).
-- `acceptable_limits.parameter_key` e `analysis_methods.parameter_key` podem referenciar estes valores.

create table if not exists public.analysis_parameter_definitions (
  id uuid primary key default gen_random_uuid(),
  parameter_key text not null unique,
  label text not null,
  unit text not null,
  default_method text,
  created_at timestamptz not null default now()
);

comment on table public.analysis_parameter_definitions is 'Parâmetros extra para limites e para a tabela de resultados na nova análise.';
