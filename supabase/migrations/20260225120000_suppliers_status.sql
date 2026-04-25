-- Execute no SQL Editor do Supabase se ainda não existir a coluna.
alter table public.suppliers
  add column if not exists status text default 'ativo';

comment on column public.suppliers.status is 'ativo | inativo | pendente (minúsculas)';
