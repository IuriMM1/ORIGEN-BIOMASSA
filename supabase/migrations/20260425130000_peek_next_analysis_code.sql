-- Pré-visualização do próximo código ANA-ORI sem incrementar o contador (para UI antes de guardar).

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
