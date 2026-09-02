-- =====================================================================
-- Migration 004: Realtime Subscriptions
-- =====================================================================
-- Habilita Supabase Realtime para que mudanças em queue_items,
-- player_preferences e tracks sejam propagadas em tempo real entre
-- dispositivos do mesmo usuário.
-- =====================================================================

-- Garante que a publicação existe (criada por padrão em projetos novos).
-- Se a publicação não existir, cria:
do $$
begin
    if not exists (
        select 1 from pg_publication where pubname = 'supabase_realtime'
    ) then
        create publication supabase_realtime;
    end if;
end
$$;

-- Adiciona tabelas à publicação (idempotente)
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

-- REPLICA IDENTITY FULL: garante que o payload do evento contenha
-- a linha inteira (necessário para o front reconstruir o estado).
alter table public.queue_items       replica identity full;
alter table public.player_preferences replica identity full;
alter table public.tracks            replica identity full;
