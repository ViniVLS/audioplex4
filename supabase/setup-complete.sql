-- =====================================================================
-- AudioPlex4 — Setup Completo do Banco de Dados
-- =====================================================================
-- Execute este arquivo inteiro no SQL Editor do Supabase Dashboard:
--   https://supabase.com/dashboard → seu projeto → SQL Editor
--
-- OU via CLI:
--   supabase db push  (se tiver supabase CLI instalado)
-- =====================================================================

-- =====================================================================
-- MIGRATION 001: Core Schema
-- =====================================================================

-- profiles
create table if not exists public.profiles (
    id            uuid primary key references auth.users(id) on delete cascade,
    display_name  text,
    avatar_url    text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público do usuário (1:1 com auth.users).';

-- tracks
create table if not exists public.tracks (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references auth.users(id) on delete cascade,
    video_id            text not null,
    title               text not null,
    author              text,
    thumbnail           text,
    duration            integer,
    formatted_duration  text,
    source_url          text not null,
    format              text,
    bitrate             text,
    file_size_bytes     bigint,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    constraint tracks_user_video_unique unique (user_id, video_id)
);

create index if not exists tracks_user_id_idx       on public.tracks(user_id);
create index if not exists tracks_user_created_idx  on public.tracks(user_id, created_at desc);

comment on table public.tracks is 'Faixas (metadados) extraídas ou buscadas pelo usuário.';

-- queue_items
create table if not exists public.queue_items (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    track_id    uuid not null references public.tracks(id) on delete cascade,
    position    integer not null,
    added_at    timestamptz not null default now(),
    constraint queue_items_user_track_unique unique (user_id, track_id)
);

create index if not exists queue_items_user_position_idx
    on public.queue_items(user_id, position);

comment on table public.queue_items is 'Fila de reprodução do usuário (ordenada por position).';

-- download_history
create table if not exists public.download_history (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,
    track_id          uuid references public.tracks(id) on delete set null,
    quality           text,
    format            text,
    file_size_bytes   bigint,
    downloaded_at     timestamptz not null default now()
);

create index if not exists download_history_user_idx
    on public.download_history(user_id, downloaded_at desc);

comment on table public.download_history is 'Histórico de downloads/extrações do usuário.';

-- player_preferences
create table if not exists public.player_preferences (
    user_id                  uuid primary key references auth.users(id) on delete cascade,
    volume                   numeric(3,2) not null default 0.80 check (volume >= 0 and volume <= 1),
    muted                    boolean     not null default false,
    repeat_mode              text        not null default 'off' check (repeat_mode in ('off','one','all')),
    shuffle                  boolean     not null default false,
    current_track_id         uuid references public.tracks(id) on delete set null,
    current_position_seconds numeric     not null default 0,
    updated_at               timestamptz not null default now()
);

comment on table public.player_preferences is 'Preferências persistidas do player do usuário.';

-- =====================================================================
-- MIGRATION 002: Row Level Security (RLS)
-- =====================================================================

-- profiles
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own"  on public.profiles;
drop policy if exists "profiles_insert_own"  on public.profiles;
drop policy if exists "profiles_update_own"  on public.profiles;
drop policy if exists "profiles_delete_own"  on public.profiles;

create policy "profiles_select_own"
    on public.profiles for select
    using (auth.uid() = id);

create policy "profiles_insert_own"
    on public.profiles for insert
    with check (auth.uid() = id);

create policy "profiles_update_own"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

create policy "profiles_delete_own"
    on public.profiles for delete
    using (auth.uid() = id);

-- tracks
alter table public.tracks enable row level security;

drop policy if exists "tracks_select_own" on public.tracks;
drop policy if exists "tracks_insert_own" on public.tracks;
drop policy if exists "tracks_update_own" on public.tracks;
drop policy if exists "tracks_delete_own" on public.tracks;

create policy "tracks_select_own"
    on public.tracks for select
    using (auth.uid() = user_id);

create policy "tracks_insert_own"
    on public.tracks for insert
    with check (auth.uid() = user_id);

create policy "tracks_update_own"
    on public.tracks for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "tracks_delete_own"
    on public.tracks for delete
    using (auth.uid() = user_id);

-- queue_items
alter table public.queue_items enable row level security;

drop policy if exists "queue_items_select_own" on public.queue_items;
drop policy if exists "queue_items_insert_own" on public.queue_items;
drop policy if exists "queue_items_update_own" on public.queue_items;
drop policy if exists "queue_items_delete_own" on public.queue_items;

create policy "queue_items_select_own"
    on public.queue_items for select
    using (auth.uid() = user_id);

create policy "queue_items_insert_own"
    on public.queue_items for insert
    with check (auth.uid() = user_id);

create policy "queue_items_update_own"
    on public.queue_items for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "queue_items_delete_own"
    on public.queue_items for delete
    using (auth.uid() = user_id);

-- download_history
alter table public.download_history enable row level security;

drop policy if exists "download_history_select_own" on public.download_history;
drop policy if exists "download_history_insert_own" on public.download_history;
drop policy if exists "download_history_delete_own" on public.download_history;

create policy "download_history_select_own"
    on public.download_history for select
    using (auth.uid() = user_id);

create policy "download_history_insert_own"
    on public.download_history for insert
    with check (auth.uid() = user_id);

create policy "download_history_delete_own"
    on public.download_history for delete
    using (auth.uid() = user_id);

-- player_preferences
alter table public.player_preferences enable row level security;

drop policy if exists "player_prefs_select_own" on public.player_preferences;
drop policy if exists "player_prefs_insert_own" on public.player_preferences;
drop policy if exists "player_prefs_update_own" on public.player_preferences;
drop policy if exists "player_prefs_delete_own" on public.player_preferences;

create policy "player_prefs_select_own"
    on public.player_preferences for select
    using (auth.uid() = user_id);

create policy "player_prefs_insert_own"
    on public.player_preferences for insert
    with check (auth.uid() = user_id);

create policy "player_prefs_update_own"
    on public.player_preferences for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "player_prefs_delete_own"
    on public.player_preferences for delete
    using (auth.uid() = user_id);

-- =====================================================================
-- MIGRATION 003: Triggers & Helper Functions
-- =====================================================================

-- Função genérica: atualiza updated_at = now()
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at         on public.profiles;
drop trigger if exists trg_tracks_updated_at           on public.tracks;
drop trigger if exists trg_player_prefs_updated_at     on public.player_preferences;

create trigger trg_profiles_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

create trigger trg_tracks_updated_at
    before update on public.tracks
    for each row execute function public.set_updated_at();

create trigger trg_player_prefs_updated_at
    before update on public.player_preferences
    for each row execute function public.set_updated_at();

-- Trigger: cria profile + prefs padrão ao registrar novo auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, display_name, avatar_url)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
        new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (id) do nothing;

    insert into public.player_preferences (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Helper: próxima posição disponível na fila do usuário
create or replace function public.next_queue_position(p_user_id uuid)
returns integer
language sql
stable
as $$
    select coalesce(max(position), -1) + 1
    from public.queue_items
    where user_id = p_user_id;
$$;

-- Helper: reordena a fila após delete para manter positions contíguos
create or replace function public.compact_queue(p_user_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
    with ordered as (
        select id,
               row_number() over (order by position, added_at) - 1 as new_pos
        from public.queue_items
        where user_id = p_user_id
    )
    update public.queue_items q
    set position = o.new_pos
    from ordered o
    where q.id = o.id
      and q.position <> o.new_pos;
end;
$$;

-- =====================================================================
-- MIGRATION 004: Realtime Subscriptions
-- =====================================================================

do $$
begin
    if not exists (
        select 1 from pg_publication where pubname = 'supabase_realtime'
    ) then
        create publication supabase_realtime;
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'queue_items'
    ) then
        alter publication supabase_realtime add table public.queue_items;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'player_preferences'
    ) then
        alter publication supabase_realtime add table public.player_preferences;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'tracks'
    ) then
        alter publication supabase_realtime add table public.tracks;
    end if;
end
$$;

alter table public.queue_items       replica identity full;
alter table public.player_preferences replica identity full;
alter table public.tracks            replica identity full;

-- =====================================================================
-- FIM — Setup completo do banco de dados
-- =====================================================================
