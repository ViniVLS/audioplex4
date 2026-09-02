-- =====================================================================
-- Migration 001: Core Schema
-- YouTube Audio Extractor - PLMP3
-- =====================================================================
-- Cria as tabelas principais do sistema:
--   - profiles          : perfil público do usuário (1:1 com auth.users)
--   - tracks            : metadados de faixas extraídas/buscadas
--   - queue_items       : fila de reprodução do usuário
--   - download_history  : histórico de extrações/downloads
--   - player_preferences: preferências do player (volume, repeat, etc.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
    id            uuid primary key references auth.users(id) on delete cascade,
    display_name  text,
    avatar_url    text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público do usuário (1:1 com auth.users).';

-- ---------------------------------------------------------------------
-- 2. tracks
-- ---------------------------------------------------------------------
create table if not exists public.tracks (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references auth.users(id) on delete cascade,
    video_id            text not null,
    title               text not null,
    author              text,
    thumbnail           text,
    duration            integer,                -- em segundos
    formatted_duration  text,
    source_url          text not null,
    format              text,                   -- mp3, aac, wav, flac
    bitrate             text,                   -- 128k, 256k, 320k
    file_size_bytes     bigint,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),

    -- Garante que o mesmo vídeo não seja duplicado por usuário
    constraint tracks_user_video_unique unique (user_id, video_id)
);

create index if not exists tracks_user_id_idx       on public.tracks(user_id);
create index if not exists tracks_user_created_idx  on public.tracks(user_id, created_at desc);

comment on table public.tracks is 'Faixas (metadados) extraídas ou buscadas pelo usuário.';

-- ---------------------------------------------------------------------
-- 3. queue_items
-- ---------------------------------------------------------------------
create table if not exists public.queue_items (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    track_id    uuid not null references public.tracks(id) on delete cascade,
    position    integer not null,
    added_at    timestamptz not null default now(),

    -- Impede o mesmo track aparecer duas vezes na fila
    constraint queue_items_user_track_unique unique (user_id, track_id)
);

create index if not exists queue_items_user_position_idx
    on public.queue_items(user_id, position);

comment on table public.queue_items is 'Fila de reprodução do usuário (ordenada por position).';

-- ---------------------------------------------------------------------
-- 4. download_history
-- ---------------------------------------------------------------------
create table if not exists public.download_history (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,
    track_id          uuid references public.tracks(id) on delete set null,
    quality           text,                  -- high / medium / low (ou 320k/256k/128k)
    format            text,                  -- mp3, aac, wav, flac
    file_size_bytes   bigint,
    downloaded_at     timestamptz not null default now()
);

create index if not exists download_history_user_idx
    on public.download_history(user_id, downloaded_at desc);

comment on table public.download_history is 'Histórico de downloads/extrações do usuário.';

-- ---------------------------------------------------------------------
-- 5. player_preferences
-- ---------------------------------------------------------------------
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
