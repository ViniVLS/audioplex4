// frontend/src/app/app.ts
// Componente raiz. Hospeda o <audio> global, o router-outlet, o
// mini-player, o now-playing e o queue-drawer.
//
// Sincroniza PlayerService <-> AudioEngineService via Signals (effect).
// IMPORTANTE: effect() precisa ser criado no injection context
// (construtor ou com { injector }), nunca em ngAfterViewInit.
import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  effect,
  inject,
} from '@angular/core';
import { PlayerService } from './core/services/player.service';
import { AudioEngineService } from './core/services/audio-engine.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrls: ['./app.scss'],
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('audioEl', { static: true })
  audioRef!: ElementRef<HTMLAudioElement>;

  private player = inject(PlayerService);
  private engine = inject(AudioEngineService);

  /** Guarda o último videoId carregado para evitar reload desnecessário. */
  private lastLoadedVideoId: string | null = null;

  constructor() {
    // --- Effect: reage a troca de faixa + play/pause ---
    effect(() => {
      const track     = this.player.currentTrack();
      const isPlaying = this.player.isPlaying();

      if (!track) {
        this.engine.pause();
        this.lastLoadedVideoId = null;
        return;
      }

      const needsLoad = this.lastLoadedVideoId !== track.video_id;

      if (needsLoad) {
        this.lastLoadedVideoId = track.video_id;
        void this.engine.load(track).then(() => {
          this.player.updateMediaSessionMetadata(track);
          if (isPlaying) this.safePlay();
        });
        return;
      }

      // Mesma faixa: apenas alterna play/pause
      if (isPlaying) this.safePlay();
      else this.engine.pause();
    });

    // --- Effect: reage a volume / mute ---
    effect(() => {
      this.engine.setVolume(this.player.volume());
      this.engine.setMuted(this.player.muted());
    });
  }

  ngAfterViewInit(): void {
    // Anexa o <audio> ao engine (após o ViewChild estar disponível)
    this.engine.attach(this.audioRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.engine.detach();
    this.player.teardown();
  }

  /** play() pode ser rejeitado por política de autoplay do browser. */
  private safePlay(): void {
    this.engine.play().catch((err) => {
      console.warn('Autoplay bloqueado pelo browser:', err?.name ?? err);
      this.player.forcePause();
    });
  }
}
