-- Garante a coluna `status` em `suppliers` (idempotente).
-- Se ainda vir erro no app: Supabase → SQL Editor → executar este ficheiro; depois
-- Settings → API → "Reload schema" (ou aguardar ~1 min) para atualizar o cache do PostgREST.

alter table public.suppliers
  add column if not exists status text default 'ativo';

comment on column public.suppliers.status is 'ativo | inativo | pendente (minúsculas)';
