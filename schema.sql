-- DrishtipatBD schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  body text not null default '',
  image_url text not null default '',
  author text not null default 'দৃষ্টিপাতBD',
  category_id uuid references public.categories(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published')),
  featured boolean not null default false,
  breaking boolean not null default false,
  views integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.categories (name, slug) values
 ('জাতীয়','national'),('আন্তর্জাতিক','international'),('রাজনীতি','politics'),
 ('খেলাধুলা','sports'),('ধর্ম ও জীবন','religion-life'),('সংস্কৃতি','culture'),
 ('অনলাইনে কেনাকাটা','online-shopping'),('অনলাইনে আয়','online-income')
on conflict (name) do nothing;

insert into public.site_settings (key,value) values
 ('general','{"tagline":"সত্যের পক্ষে, জনস্বার্থে","facebook":"","youtube":"","email":"","breaking":"দৃষ্টিপাতBD-তে আপনাকে স্বাগতম। সর্বশেষ সংবাদ পেতে সঙ্গে থাকুন।"}'::jsonb),
 ('ads','{"header":"","top":"","side":"","bottom":"","notes":""}'::jsonb),
 ('links','{"items":[]}'::jsonb)
on conflict (key) do nothing;

create or replace function public.is_drish_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_drish_admin() from public;
grant execute on function public.is_drish_admin() to anon, authenticated;

alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.articles enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "admin list own admin row" on public.admin_users;
create policy "admin list own admin row" on public.admin_users
for select to authenticated using (user_id = auth.uid());

drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories
for select to anon, authenticated using (true);
drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories
for all to authenticated using (public.is_drish_admin()) with check (public.is_drish_admin());

drop policy if exists "public read published articles" on public.articles;
create policy "public read published articles" on public.articles
for select to anon, authenticated using (status = 'published');
drop policy if exists "admins read all articles" on public.articles;
create policy "admins read all articles" on public.articles
for select to authenticated using (public.is_drish_admin());
drop policy if exists "admins insert articles" on public.articles;
create policy "admins insert articles" on public.articles
for insert to authenticated with check (public.is_drish_admin());
drop policy if exists "admins update articles" on public.articles;
create policy "admins update articles" on public.articles
for update to authenticated using (public.is_drish_admin()) with check (public.is_drish_admin());
drop policy if exists "admins delete articles" on public.articles;
create policy "admins delete articles" on public.articles
for delete to authenticated using (public.is_drish_admin());

drop policy if exists "public read general settings" on public.site_settings;
create policy "public read general settings" on public.site_settings
for select to anon, authenticated using (key in ('general','ads','links'));
drop policy if exists "admins read settings" on public.site_settings;
create policy "admins read settings" on public.site_settings
for select to authenticated using (public.is_drish_admin());
drop policy if exists "admins insert settings" on public.site_settings;
create policy "admins insert settings" on public.site_settings
for insert to authenticated with check (public.is_drish_admin());
drop policy if exists "admins update settings" on public.site_settings;
create policy "admins update settings" on public.site_settings
for update to authenticated using (public.is_drish_admin()) with check (public.is_drish_admin());

grant usage on schema public to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select on public.articles to anon, authenticated;
grant insert, update, delete on public.articles to authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
grant select on public.admin_users to authenticated;
