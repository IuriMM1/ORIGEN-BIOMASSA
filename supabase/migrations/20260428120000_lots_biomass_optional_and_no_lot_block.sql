-- Deixar de bloquear a remoção de tipos de biomassa por causa de lotes:
-- `lots.biomass_type_id` passa a NULL quando o tipo é apagado.
-- `classifications.lot_id` pode ser NULL (classificação sem lote).

do $$
declare
  r record;
begin
  if to_regclass('public.lots') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'lots' and column_name = 'biomass_type_id'
     ) then
    for r in
      select c.conname
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      join pg_class cf on cf.oid = c.confrelid
      join pg_namespace nf on nf.oid = cf.relnamespace
      where c.contype = 'f'
        and n.nspname = 'public' and cl.relname = 'lots'
        and nf.nspname = 'public' and cf.relname = 'biomass_types'
    loop
      execute format('alter table public.lots drop constraint if exists %I', r.conname);
    end loop;

    alter table public.lots alter column biomass_type_id drop not null;

    begin
      alter table public.lots
        add constraint lots_biomass_type_id_fkey
        foreign key (biomass_type_id) references public.biomass_types (id) on delete set null;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

do $$
begin
  if to_regclass('public.classifications') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'classifications' and column_name = 'lot_id'
     ) then
    alter table public.classifications alter column lot_id drop not null;
  end if;
exception
  when others then null;
end $$;
