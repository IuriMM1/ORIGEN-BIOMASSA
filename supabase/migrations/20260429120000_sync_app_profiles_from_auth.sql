-- Preenche empresa, telefone, cargo e e-mail em app_profiles a partir de auth.users (metadados),
-- para contas criadas antes do trigger ou com campos vazios.

update public.app_profiles p
set
  email = coalesce(nullif(trim(p.email), ''), u.email),
  company = coalesce(nullif(trim(p.company), ''), nullif(trim(u.raw_user_meta_data ->> 'company'), '')),
  job_title = coalesce(nullif(trim(p.job_title), ''), nullif(trim(u.raw_user_meta_data ->> 'job_title'), '')),
  phone = coalesce(nullif(trim(p.phone), ''), nullif(trim(u.raw_user_meta_data ->> 'phone'), '')),
  full_name = coalesce(
    nullif(trim(p.full_name), ''),
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
where u.id = p.id;

notify pgrst, 'reload schema';
