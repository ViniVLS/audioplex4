-- =====================================================================
-- Migration 002: Row Level Security (RLS)
-- =====================================================================
-- Habilita RLS em todas as tabelas e cria policies que garantem que
-- cada usuário só consegue ler/inserir/atualizar/deletar os PRÓPRIOS
-- dados. Nenhuma policy permissiva: sempre auth.uid() = user_id.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- tracks
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- queue_items
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- download_history
-- ---------------------------------------------------------------------
alter table public.download_history enable row level security;

drop policy if exists "download_history_select_own" on public.download_history;
drop policy if exists "download_history_insert_own" on public.download_history;
drop policy if exists "download_history_delete_own" on public.download_history;

-- Histórico é append-only: sem update.
create policy "download_history_select_own"
    on public.download_history for select
    using (auth.uid() = user_id);

create policy "download_history_insert_own"
    on public.download_history for insert
    with check (auth.uid() = user_id);

create policy "download_history_delete_own"
    on public.download_history for delete
    using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- player_preferences
-- ---------------------------------------------------------------------
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
