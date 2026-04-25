-- Coletas e classificações sem obrigatoriedade de lote.

do $$
begin
  if to_regclass('public.sample_collections') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'sample_collections' and column_name = 'lot_id'
     ) then
    alter table public.sample_collections alter column lot_id drop not null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.classifications') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'classifications' and column_name = 'lab_analysis_id'
    ) then
      alter table public.classifications
        add column lab_analysis_id uuid references public.lab_analyses (id) on delete set null;
    end if;
  end if;
end $$;
