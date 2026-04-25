-- Perfis de aplicação: nome, cargo, contactos, empresa, papel (admin | usuario), último acesso.

create table if not exists public.app_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  job_title text,
  phone text,
  company text,
  role text not null default 'usuario' check (role in ('admin', 'usuario')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_profiles_role_idx on public.app_profiles (role);
create index if not exists app_profiles_company_idx on public.app_profiles (company);

alter table public.app_profiles enable row level security;

-- Leitura: qualquer utilizador autenticado (lista "Usuários").
drop policy if exists "app_profiles_select_authenticated" on public.app_profiles;
create policy "app_profiles_select_authenticated"
  on public.app_profiles for select
  to authenticated
  using (true);

-- Inserção: apenas a própria linha (registo após signUp, se necessário).
drop policy if exists "app_profiles_insert_own" on public.app_profiles;
create policy "app_profiles_insert_own"
  on public.app_profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Atualização: o próprio perfil.
drop policy if exists "app_profiles_update_own" on public.app_profiles;
create policy "app_profiles_update_own"
  on public.app_profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

comment on table public.app_profiles is 'Metadados e papel (admin/usuario) por utilizador; email espelhado do auth no registo.';

create or replace function public.app_profiles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_profiles_set_updated_at on public.app_profiles;
create trigger app_profiles_set_updated_at
  before update on public.app_profiles
  for each row execute function public.app_profiles_set_updated_at();

-- Ao criar utilizador no auth, criar/atualizar perfil a partir dos metadados do signUp.
create or replace function public.handle_new_user_app_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
begin
  r := coalesce(nullif(trim(new.raw_user_meta_data ->> 'role'), ''), 'usuario');
  if r not in ('admin', 'usuario') then
    r := 'usuario';
  end if;

  insert into public.app_profiles (id, email, full_name, job_title, phone, company, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'job_title'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'company'), ''),
    r
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    job_title = excluded.job_title,
    phone = excluded.phone,
    company = excluded.company,
    role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_app_profile on auth.users;
create trigger on_auth_user_created_app_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_app_profile();

-- Utilizadores já existentes sem linha em app_profiles (papel por omissão: usuario).
insert into public.app_profiles (id, email, full_name, role)
select u.id, u.email, coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1)), 'usuario'
from auth.users u
where not exists (select 1 from public.app_profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Garantir um administrador: a conta mais antiga passa a admin (ajuste manual se preferir outro).
update public.app_profiles u
set role = 'admin'
from (
  select id from public.app_profiles order by created_at asc nulls last limit 1
) o
where u.id = o.id
  and not exists (select 1 from public.app_profiles x where x.role = 'admin');

-- Atualizar cache do PostgREST (API) para reconhecer a nova tabela.
notify pgrst, 'reload schema';
