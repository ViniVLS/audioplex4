// frontend/src/app/core/services/audio-engine.service.ts
// Wrapper sobre HTMLAudioElement. Conecta o <audio> ao PlayerService.
//
// O componente <app-audio-host> no layout raiz hospeda o <audio>.

import { Injectable, inject, NgZone, signal } from '@angular/core';
import { PlayerService } from './player.service';
import { environment } from '../../../environments/environment';
import { Track } from '../models/track.model';

@Injectable({ providedIn: 'root' })
export class AudioEngineService {
  private player = inject(PlayerService);
  private zone   = inject(NgZone);

  private audio: HTMLAudioElement | null = null;
  private lastVideoId: string | null = null;

  // Flag de unsubscribe para mutation observer
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

  /** Chamado pelo componente host para injetar o elemento <audio>. */
  attach(audio: HTMLAudioElement): void {
    this.audio = audio;
    audio.addEventListener('timeupdate',     this.onTimeUpdate);
    audio.addEventListener('durationchange', this.onDurationChange);
    audio.addEventListener('waiting',        this.onWaiting);
    audio.addEventListener('playing',        this.onPlaying);
    audio.addEventListener('ended',          this.onEnded);
    audio.addEventListener('error',          this.onError);
  }

  detach(): void {
    if (!this.audio) return;
    this.audio.removeEventListener('timeupdate',     this.onTimeUpdate);
    this.audio.removeEventListener('durationchange', this.onDurationChange);
    this.audio.removeEventListener('waiting',        this.onWaiting);
    this.audio.removeEventListener('playing',        this.onPlaying);
    this.audio.removeEventListener('ended',          this.onEnded);
    this.audio.removeEventListener('error',          this.onError);
    this.audio = null;
  }

  /** Carrega a faixa (resolve streamUrl via Edge Function). */
  async load(track: Track): Promise<void> {
    if (!this.audio) return;
    if (this.lastVideoId === track.video_id) return; // já carregada

    this.player.setBuffering(true);
    this.lastVideoId = track.video_id;

    const streamUrl = this.buildStreamUrl(track);
    this.audio.src = streamUrl;
    this.audio.load();
  }

  play(): Promise<void> {
    return this.audio?.play() ?? Promise.resolve();
  }

  pause(): void {
    this.audio?.pause();
  }

  seek(seconds: number): void {
    if (this.audio) this.audio.currentTime = seconds;
  }

  setVolume(volume: number): void {
    if (this.audio) this.audio.volume = volume;
  }

  setMuted(muted: boolean): void {
    if (this.audio) this.audio.muted = muted;
  }

  private buildStreamUrl(track: Track): string {
    // Sempre usa a Edge Function (Supabase) — Express removido.
    return `${environment.supabase.url}/functions/v1/stream?videoId=${track.video_id}`;
  }
}
