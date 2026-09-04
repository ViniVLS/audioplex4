// frontend/src/app/core/services/audio-engine.service.ts
// Motor de áudio: usa o player nativo (Media3/ExoPlayer) no Android/iOS e
// HTMLAudioElement no navegador. Conecta o <audio>/player ao PlayerService.
//
// Suporte offline: usa arquivo local se disponível (Capacitor Filesystem).
// Streaming: anexa o access token na query (?token=...) pois nem o <audio>
// nem o ExoPlayer conseguem enviar o header Authorization.

import { Injectable, inject, NgZone } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PlayerService } from './player.service';
import { OfflineLibraryService } from './offline-library.service';
import { AuthService } from './auth.service';
import { BackgroundAudio } from '../plugins/background-audio';
import { environment } from '../../../environments/environment';
import { Track } from '../models/track.model';

export interface NativePollState {
  playing: boolean;
  position: number; // ms
  duration: number; // ms
}

@Injectable({ providedIn: 'root' })
export class AudioEngineService {
  private player     = inject(PlayerService);
  private zone       = inject(NgZone);
  private offlineLib = inject(OfflineLibraryService);
  private auth       = inject(AuthService);

  private readonly isNative = Capacitor.isNativePlatform();

  private audio: HTMLAudioElement | null = null;
  private lastVideoId: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastVolume = 0.8;
  private lastMuted = false;

  // ------------------- HTMLAudio (web) -------------------
  private onTimeUpdate = () => {
    if (!this.audio) return;
    this.zone.run(() => this.player.setCurrentTime(this.audio!.currentTime));
  };

  private onDurationChange = () => {
    if (!this.audio) return;
    this.zone.run(() => this.player.setDuration(this.audio!.duration || 0));
  };

  private onWaiting = () => this.zone.run(() => this.player.setBuffering(true));
  private onPlaying = () => this.zone.run(() => this.player.setBuffering(false));
  private onEnded   = () => this.zone.run(() => this.player.next());

  private onError = () => {
    console.error('Audio error:', this.audio?.error);
    this.zone.run(() => this.player.setBuffering(false));
  };

  /** Chamado pelo componente host para injetar o elemento <audio> (web). */
  attach(audio: HTMLAudioElement): void {
    if (this.isNative) return;
    // Clean up old listeners before attaching to new element
    this.detach();
    this.audio = audio;
    audio.addEventListener('timeupdate',     this.onTimeUpdate);
    audio.addEventListener('durationchange', this.onDurationChange);
    audio.addEventListener('waiting',        this.onWaiting);
    audio.addEventListener('playing',        this.onPlaying);
    audio.addEventListener('ended',          this.onEnded);
    audio.addEventListener('error',          this.onError);
  }

  detach(): void {
    this.stopNativePolling();
    if (!this.audio) return;
    this.audio.removeEventListener('timeupdate',     this.onTimeUpdate);
    this.audio.removeEventListener('durationchange', this.onDurationChange);
    this.audio.removeEventListener('waiting',        this.onWaiting);
    this.audio.removeEventListener('playing',        this.onPlaying);
    this.audio.removeEventListener('ended',          this.onEnded);
    this.audio.removeEventListener('error',          this.onError);
    this.audio = null;
  }

  // ------------------- Load / play -------------------
  async load(track: Track): Promise<void> {
    if (this.lastVideoId === track.video_id) return;
    this.lastVideoId = track.video_id;
    this.player.setBuffering(true);

    const streamUrl = await this.buildStreamUrl(track);

    if (this.isNative) {
      try {
        await BackgroundAudio.setSource({ url: streamUrl, title: track.title });
        this.startNativePolling();
        return;
      } catch (err) {
        console.warn('BackgroundAudio falhou, usando HTMLAudio:', err);
      }
    }

    if (!this.audio) {
      console.warn('AudioEngine: audio element not attached. Call attach() first.');
      return;
    }
    this.audio.src = streamUrl;
    this.audio.load();
  }

  async play(): Promise<void> {
    if (this.isNative) {
      await BackgroundAudio.play().catch((e) => console.warn('play nativo:', e));
      return;
    }
    return this.audio?.play() ?? Promise.resolve();
  }

  pause(): void {
    if (this.isNative) {
      this.stopNativePolling();
      void BackgroundAudio.pause().catch(() => {});
      return;
    }
    this.audio?.pause();
  }

  seek(seconds: number): void {
    if (this.isNative) {
      void BackgroundAudio.seek({ seconds }).catch(() => {});
      return;
    }
    if (this.audio) this.audio.currentTime = seconds;
  }

  setVolume(volume: number): void {
    this.lastVolume = volume;
    if (this.isNative) {
      const v = this.lastMuted ? 0 : volume;
      void BackgroundAudio.setVolume({ volume: v }).catch(() => {});
      return;
    }
    if (this.audio) this.audio.volume = volume;
  }

  setMuted(muted: boolean): void {
    this.lastMuted = muted;
    if (this.isNative) {
      void BackgroundAudio.setVolume({ volume: muted ? 0 : this.lastVolume }).catch(() => {});
      return;
    }
    if (this.audio) this.audio.muted = muted;
  }

  // ------------------- Offline / stream -------------------
  hasOfflineAudio(track: Track): boolean {
    return this.offlineLib.isOffline(track.video_id);
  }

  /** Retorna a URL de streaming (local ou remoto), com token na query. */
  private async buildStreamUrl(track: Track): Promise<string> {
    const localPath = this.offlineLib.getLocalPlaybackUrl(track.video_id);
    if (localPath) {
      return this.isNative ? localPath : Capacitor.convertFileSrc(localPath);
    }

    const token = await this.auth.getAccessToken();
    const query = token ? `&token=${encodeURIComponent(token)}` : '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `/api/stream?videoId=${track.video_id}${query}`;
    }
    return `${environment.supabase.url}/functions/v1/stream?videoId=${track.video_id}${query}`;
  }

  // ------------------- Polling (nativo) -------------------
  private startNativePolling(): void {
    this.stopNativePolling();
    this.pollTimer = setInterval(async () => {
      try {
        const s = await BackgroundAudio.getState();
        this.zone.run(() => {
          const position = s.position ?? 0;
          const duration = s.duration ?? 0;
          const positionSec = position / 1000;
          const durationSec = duration / 1000;

          if (durationSec > 0) this.player.setDuration(durationSec);
          this.player.setCurrentTime(positionSec);
          this.player.setBuffering(false);

          if (s.playing && position > 0 && duration > 0 && position >= duration - 500) {
            // Chegou ao fim da faixa.
            this.stopNativePolling();
            this.player.next();
          }
        });
      } catch (err) {
        console.warn('getState nativo:', err);
      }
    }, 1000);
  }

  private stopNativePolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}