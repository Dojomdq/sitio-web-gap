create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists admin_sessions_active_idx
  on public.admin_sessions(token_hash, expires_at)
  where revoked_at is null;

create table if not exists public.admin_login_limits (
  key_hash text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  artist_name text not null,
  category text not null default 'Show',
  main_image_path text,
  short_description text not null,
  description text not null,
  event_date timestamptz not null,
  doors_at timestamptz,
  ends_at timestamptz,
  venue_name text not null default 'GAP',
  address text not null default 'Av. Constitución 5780, Mar del Plata',
  visitor_info text not null default '',
  ticket_url text,
  ticket_provider text,
  ticket_button_text text not null default 'COMPRAR ENTRADAS',
  ticket_status text not null default 'coming_soon'
    check (ticket_status in ('available', 'sold_out', 'coming_soon')),
  publication_status text not null default 'draft'
    check (publication_status in ('draft', 'published', 'hidden')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_ticket_url_https check (ticket_url is null or ticket_url ~ '^https://'),
  constraint event_end_after_start check (ends_at is null or ends_at >= event_date),
  constraint event_doors_before_end check (doors_at is null or ends_at is null or ends_at >= doors_at)
);

create index if not exists events_public_upcoming_idx
  on public.events(event_date asc, display_order asc)
  where publication_status = 'published';

create table if not exists public.event_gallery (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  image_path text not null,
  alt_text text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(event_id, image_path)
);

create index if not exists event_gallery_order_idx
  on public.event_gallery(event_id, display_order, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create or replace function public.consume_admin_login_attempt(p_key_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_attempts integer;
begin
  insert into public.admin_login_limits as limits(key_hash, attempts, window_started_at)
  values (p_key_hash, 1, now())
  on conflict (key_hash) do update
    set attempts = case
      when limits.window_started_at < now() - interval '15 minutes' then 1
      else limits.attempts + 1
    end,
    window_started_at = case
      when limits.window_started_at < now() - interval '15 minutes' then now()
      else limits.window_started_at
    end
  returning attempts into current_attempts;
  return current_attempts <= 5;
end;
$$;

create or replace function public.clear_admin_login_attempt(p_key_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.admin_login_limits where key_hash = p_key_hash;
$$;

alter table public.admin_users enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_login_limits enable row level security;
alter table public.events enable row level security;
alter table public.event_gallery enable row level security;

revoke all on public.admin_users, public.admin_sessions, public.admin_login_limits,
  public.events, public.event_gallery from anon, authenticated;
grant all on public.admin_users, public.admin_sessions, public.admin_login_limits,
  public.events, public.event_gallery to service_role;

revoke all on function public.consume_admin_login_attempt(text) from public, anon, authenticated;
revoke all on function public.clear_admin_login_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_admin_login_attempt(text) to service_role;
grant execute on function public.clear_admin_login_attempt(text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gap-eventos', 'gap-eventos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket URLs are readable by visitors. Mutating storage operations are
-- performed only by server functions after validating the private GAP session.
