-- Logo do fornecedor (URL pública no Storage) + bucket público para imagens

alter table public.suppliers
  add column if not exists logo_url text;

comment on column public.suppliers.logo_url is 'URL pública da logotipo no Storage (bucket supplier-logos).';

-- Bucket de logos (leitura pública para <img>; escrita com utilizador autenticado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-logos',
  'supplier-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Políticas em storage.objects (ignorar se já existirem nomes iguais: executar uma vez limpo)
drop policy if exists "supplier_logos_select_public" on storage.objects;
create policy "supplier_logos_select_public"
  on storage.objects for select
  using (bucket_id = 'supplier-logos');

drop policy if exists "supplier_logos_insert_authenticated" on storage.objects;
create policy "supplier_logos_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'supplier-logos');

drop policy if exists "supplier_logos_update_authenticated" on storage.objects;
create policy "supplier_logos_update_authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'supplier-logos')
  with check (bucket_id = 'supplier-logos');

drop policy if exists "supplier_logos_delete_authenticated" on storage.objects;
create policy "supplier_logos_delete_authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'supplier-logos');
