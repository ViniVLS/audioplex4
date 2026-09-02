// frontend/src/app/core/services/player.service.ts
// PlayerService singleton (Signals-based) — núcleo do player integrado.
//
// Responsabilidades:
//   - Manter fila do usuário (sincronizada com Supabase + Realtime).
//   - Controlar faixa atual, posição, volume, repeat, shuffle.
//   - Expor Observable/Signal<PlayerState> para os componentes.
//   - Persistir prefs no Supabase (debounced).
//   - Auto-advance ao fim da faixa (com repeat/shuffle).
//   - MediaSession API (teclas de mídia do SO).
//
// A engine de áudio (<audio> HTML) é wrapper do AudioEngineService.

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Track, RepeatMode } from '../models/track.model';

export interface QueueItem {
  id:        string;   // queue_items.id
  position:  number;
  track:     Track;
}

export interface PlayerState {
  currentTrack:    Track | null;
  currentIndex:    number;        // índice na fila
  queue:           QueueItem[];
  isPlaying:       boolean;
  isBuffering:     boolean;
  currentTime:     number;        // segundos
  duration:        number;        // segundos
  volume:          number;        // 0..1
  muted:           boolean;
  repeat:          RepeatMode;
  shuffle:         boolean;
  expanded:        boolean;       // mini-player → now-playing
  drawerOpen:      boolean;       // queue-drawer
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private supabase = inject(SupabaseService).client;
  private auth     = inject(AuthService);

  // --------- Estado reativo (Signals) ---------
  private _currentTrack = signal<Track | null>(null);
  private _currentIndex = signal<number>(-1);
  private _queue        = signal<QueueItem[]>([]);
  private _isPlaying    = signal<boolean>(false);
  private _isBuffering  = signal<boolean>(false);
  private _currentTime  = signal<number>(0);
  private _duration     = signal<number>(0);
  private _volume       = signal<number>(0.80);
  private _muted        = signal<boolean>(false);
  private _repeat       = signal<RepeatMode>('off');
  private _shuffle      = signal<boolean>(false);
  private _expanded     = signal<boolean>(false);
  private _drawerOpen   = signal<boolean>(false);

  // --------- Seletores públicos ---------
  readonly currentTrack = this._currentTrack.asReadonly();
  readonly currentIndex = this._currentIndex.asReadonly();
  readonly queue        = this._queue.asReadonly();
  readonly isPlaying    = this._isPlaying.asReadonly();
  readonly isBuffering  = this._isBuffering.asReadonly();
  readonly currentTime  = this._currentTime.asReadonly();
  readonly duration     = this._duration.asReadonly();
  readonly volume       = this._volume.asReadonly();
  readonly muted        = this._muted.asReadonly();
  readonly repeat       = this._repeat.asReadonly();
  readonly shuffle      = this._shuffle.asReadonly();
  readonly expanded     = this._expanded.asReadonly();
  readonly drawerOpen   = this._drawerOpen.asReadonly();

  readonly hasNext     = computed(() => this._currentIndex() < this._queue().length - 1 || this._repeat() === 'all');
  readonly hasPrevious = computed(() => this._currentIndex() > 0 || this._currentTime() > 3);
  readonly progress    = computed(() => {
    const d = this._duration();
    return d > 0 ? (this._currentTime() / d) * 100 : 0;
  });

  // --------- Subscription cleanup ---------
  private realtimeChannel: ReturnType<typeof this.supabase.channel> | null = null;

  /** Evita bootstrap duplicado quando o signal de auth re-emite. */
  private bootstrapped = false;

  constructor() {
    // Reage a mudanças de auth: carrega fila ao logar, limpa ao deslogar.
    effect(() => {
      const isAuth = this.auth.isAuthenticated();

      if (isAuth && !this.bootstrapped) {
        this.bootstrapped = true;
        void this.bootstrap();
      } else if (!isAuth && this.bootstrapped) {
        this.bootstrapped = false;
        this.teardown();
      }
    });
  }

  // ============================================================
  // Public API
  // ============================================================

  /** Inicializa: busca fila do Supabase e inscreve no Realtime. */
  async bootstrap(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    await Promise.all([this.loadQueue(), this.loadPreferences()]);
    this.subscribeRealtime();
  }

  /** Reproduz a faixa: se já existe na fila, só pula; senão, adiciona. */
  async playTrack(track: Track): Promise<void> {
    // 1. Toca direto se já está na fila
    const existingIdx = this._queue().findIndex((q) => q.track.video_id === track.video_id);
    if (existingIdx >= 0) {
      this._currentIndex.set(existingIdx);
      this._currentTrack.set(this._queue()[existingIdx].track);
      this._isPlaying.set(true);
      this._expanded.set(true);
      return;
    }

    // 2. Senão, adiciona via queue-add
    const result = await this.addToQueue(track);
    if (result) {
      this._currentIndex.set(this._queue().length - 1);
      this._currentTrack.set(track);
      this._isPlaying.set(true);
      this._expanded.set(true);
    }
  }

  async addToQueue(track: Track): Promise<boolean> {
    if (!this.auth.isAuthenticated()) return false;

    const { data, error } = await this.supabase.functions.invoke<{
      success: boolean;
      track: Track;
      queueItem: { id: string; position: number };
    }>('queue-add', { body: track });

    if (error || !data?.success) {
      console.error('addToQueue error:', error ?? data);
      return false;
    }

    // Recarrega fila (idempotente — pode não ter sido inserido se já existia)
    await this.loadQueue();
    return true;
  }

  async removeFromQueue(queueItemId: string): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    // Como ainda não temos queue-delete-Item, recarregamos a fila após delete via track
    // Simplificação: remove localmente + deleta a track (cascata remove da fila)
    const { error } = await this.supabase
      .from('queue_items')
      .delete()
      .eq('id', queueItemId);

    if (error) {
      console.error('removeFromQueue error:', error);
      return;
    }
    await this.loadQueue();
  }

  /** Toca a faixa pelo índice na fila atual (usado pelo QueueDrawer). */
  playFromQueueIndex(index: number): void {
    const q = this._queue();
    if (index >= 0 && index < q.length) {
      this._currentIndex.set(index);
      this._currentTrack.set(q[index].track);
      this._isPlaying.set(true);
      this._expanded.set(true);
      this.closeDrawer();
    }
  }

  async clearQueue(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    await this.supabase.functions.invoke('queue-clear');
    this._queue.set([]);
    this._currentIndex.set(-1);
    this._currentTrack.set(null);
    this._isPlaying.set(false);
  }

  async reorderQueue(items: Array<{ id: string; position: number }>): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    await this.supabase.functions.invoke('queue-reorder', { body: { items } });
    await this.loadQueue();
  }

  // --------- Controles de transporte ---------
  togglePlay(): void {
    if (!this._currentTrack()) {
      // Sem faixa carregada: tenta tocar a primeira da fila
      const q = this._queue();
      if (q.length > 0) {
        this.playFromQueueIndex(0);
        return;
      }
      return;
    }
    this._isPlaying.update((p) => !p);
    this.updateMediaSessionPlaybackState();
  }

  /** Força pausa (mantendo a faixa). Usado quando autoplay é bloqueado. */
  forcePause(): void {
    this._isPlaying.set(false);
    this.updateMediaSessionPlaybackState();
  }

  next(): void {
    const q = this._queue();
    const i = this._currentIndex();

    if (q.length === 0) return;

    // Repeat-one: reinicia a mesma
    if (this._repeat() === 'one') {
      this.seek(0);
      return;
    }

    // Shuffle: pega um índice aleatório diferente
    if (this._shuffle() && q.length > 1) {
      let next = Math.floor(Math.random() * q.length);
      if (next === i) next = (next + 1) % q.length;
      this._currentIndex.set(next);
      this._currentTrack.set(q[next].track);
      this._isPlaying.set(true);
      return;
    }

    // Próximo normal
    if (i < q.length - 1) {
      this._currentIndex.set(i + 1);
      this._currentTrack.set(q[i + 1].track);
      this._isPlaying.set(true);
    } else if (this._repeat() === 'all') {
      this._currentIndex.set(0);
      this._currentTrack.set(q[0].track);
      this._isPlaying.set(true);
    } else {
      // Fim da fila: para
      this._isPlaying.set(false);
      this._currentTime.set(this._duration());
    }
  }

  previous(): void {
    // Voltar pro início se > 3s
    if (this._currentTime() > 3) {
      this.seek(0);
      return;
    }
    const i = this._currentIndex();
    if (i > 0) {
      this._currentIndex.set(i - 1);
      this._currentTrack.set(this._queue()[i - 1].track);
      this._isPlaying.set(true);
    } else {
      this.seek(0);
    }
  }

  seek(seconds: number): void {
    this._currentTime.set(Math.max(0, Math.min(seconds, this._duration())));
    this.persistCurrentPosition();
  }

  setVolume(volume: number): void {
    this._volume.set(Math.max(0, Math.min(1, volume)));
    if (volume > 0 && this._muted()) this._muted.set(false);
    this.persistPreferences();
  }

  toggleMute(): void {
    this._muted.update((m) => !m);
    this.persistPreferences();
  }

  cycleRepeat(): void {
    const order: RepeatMode[] = ['off', 'all', 'one'];
    const next = order[(order.indexOf(this._repeat()) + 1) % order.length];
    this._repeat.set(next);
    this.persistPreferences();
  }

  toggleShuffle(): void {
    this._shuffle.update((s) => !s);
    this.persistPreferences();
  }

  // --------- UI state ---------
  toggleExpanded(): void { this._expanded.update((e) => !e); }
  closeExpanded(): void  { this._expanded.set(false); }
  toggleDrawer(): void  { this._drawerOpen.update((d) => !d); }
  closeDrawer(): void   { this._drawerOpen.set(false); }

  // --------- Tempo / buffer (chamado pelo AudioEngineService) ---------
  setCurrentTime(t: number): void { this._currentTime.set(t); }
  setDuration(d: number): void    { this._duration.set(d); }
  setBuffering(b: boolean): void  { this._isBuffering.set(b); }

  // ============================================================
  // Internals
  // ============================================================

  private async loadQueue(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;

    const { data, error } = await this.supabase.functions.invoke<{
      success: boolean;
      queue: QueueItem[];
    }>('queue-list');

    if (error || !data?.success) {
      console.error('loadQueue error:', error);
      return;
    }

    this._queue.set(data.queue ?? []);
  }

  private async loadPreferences(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;

    const { data, error } = await this.supabase.functions.invoke<{
      success: boolean;
      preferences: {
        volume: number;
        muted: boolean;
        repeat_mode: RepeatMode;
        shuffle: boolean;
        current_position_seconds: number;
        current_track_id: string | null;
      };
    }>('preferences-get');

    if (error || !data?.success) return;

    const p = data.preferences;
    this._volume.set(p.volume);
    this._muted.set(p.muted);
    this._repeat.set(p.repeat_mode);
    this._shuffle.set(p.shuffle);

    // Restaura track e posição
    if (p.current_track_id) {
      const idx = this._queue().findIndex((q) => q.track.id === p.current_track_id);
      if (idx >= 0) {
        this._currentIndex.set(idx);
        this._currentTrack.set(this._queue()[idx].track);
        this._currentTime.set(p.current_position_seconds);
      }
    }
  }

  private persistPreferencesTimeout: ReturnType<typeof setTimeout> | null = null;
  private persistPreferences(): void {
    if (this.persistPreferencesTimeout) clearTimeout(this.persistPreferencesTimeout);
    this.persistPreferencesTimeout = setTimeout(async () => {
      if (!this.auth.isAuthenticated()) return;
      await this.supabase.functions.invoke('preferences-update', {
        body: {
          volume:        this._volume(),
          muted:         this._muted(),
          repeatMode:    this._repeat(),
          shuffle:       this._shuffle(),
        },
      });
    }, 500);
  }

  private persistCurrentPosition(): void {
    if (this.persistPreferencesTimeout) clearTimeout(this.persistPreferencesTimeout);
    this.persistPreferencesTimeout = setTimeout(async () => {
      if (!this.auth.isAuthenticated()) return;
      await this.supabase.functions.invoke('preferences-update', {
        body: {
          currentTrackId:        this._currentTrack()?.id ?? null,
          currentPositionSeconds: this._currentTime(),
        },
      });
    }, 1000);
  }

  private subscribeRealtime(): void {
    if (this.realtimeChannel) return;

    this.realtimeChannel = this.supabase
      .channel('player-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'queue_items' },
        (payload) => this.handleQueueChange(payload))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'player_preferences' },
        (payload) => this.handlePrefsChange(payload))
      .subscribe();
  }

  private async handleQueueChange(payload: any): Promise<void> {
    // Recarrega fila (debounced)
    setTimeout(() => this.loadQueue(), 200);
  }

  private handlePrefsChange(payload: any): void {
    const next = payload.new;
    if (!next) return;
    if (next.volume    !== undefined) this._volume.set(next.volume);
    if (next.muted     !== undefined) this._muted.set(next.muted);
    if (next.repeat_mode) this._repeat.set(next.repeat_mode);
    if (next.shuffle   !== undefined) this._shuffle.set(next.shuffle);
  }

  // --------- MediaSession API ---------
  private updateMediaSessionPlaybackState(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = this._isPlaying() ? 'playing' : 'paused';
  }

  updateMediaSessionMetadata(track: Track): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const artwork = track.thumbnail
      ? [{ src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }]
      : [];

    navigator.mediaSession.metadata = new MediaMetadata({
      title:  track.title,
      artist: track.author ?? '',
      album:  'PLMP3',
      artwork,
    });

    navigator.mediaSession.setActionHandler('play',        () => this.togglePlay());
    navigator.mediaSession.setActionHandler('pause',       () => this.togglePlay());
    navigator.mediaSession.setActionHandler('nexttrack',   () => this.next());
    navigator.mediaSession.setActionHandler('previoustrack', () => this.previous());
  }

  /** Cleanup no logout. */
  teardown(): void {
    this.realtimeChannel?.unsubscribe();
    this.realtimeChannel = null;
    this._queue.set([]);
    this._currentIndex.set(-1);
    this._currentTrack.set(null);
    this._isPlaying.set(false);
  }
}
