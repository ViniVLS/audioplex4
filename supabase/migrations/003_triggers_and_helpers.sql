-- =====================================================================
-- Migration 003: Triggers & Helper Functions
-- =====================================================================
-- - updated_at automático em todas as tabelas relevantes
-- - profiles: cria perfil automaticamente ao registrar usuário
-- - player_preferences: cria prefs padrão ao primeiro acesso
-- - queue_items: helper para inserir na próxima posição disponível
-- =====================================================================

-- ---------------------------------------------------------------------
-- Função genérica: atualiza updated_at = now()
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Trigger: cria profile + prefs padrão ao registrar novo auth.users
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Helper: próxima posição disponível na fila do usuário
-- ---------------------------------------------------------------------
create or replace function public.next_queue_position(p_user_id uuid)
returns integer
language sql
stable
as $$
    select coalesce(max(position), -1) + 1
    from public.queue_items
    where user_id = p_user_id;
$$;

-- ---------------------------------------------------------------------
-- Helper: reordena a fila após delete para manter positions contíguos
-- ---------------------------------------------------------------------
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
