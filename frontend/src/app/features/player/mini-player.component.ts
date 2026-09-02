// frontend/src/app/features/player/mini-player.component.ts
// Barra inferior fixa com capa, controles básicos e progresso.
// Estilo Amazon Music / Spotify.
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlayerService } from '../../core/services/player.service';

@Component({
  selector: 'app-mini-player',
  standalone: false,
  templateUrl: './mini-player.component.html',
  styleUrls: ['./mini-player.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiniPlayerComponent {
  player = inject(PlayerService);

  readonly hasTrack = computed(() => !!this.player.currentTrack());

  formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  onSeek(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.player.seek(value);
  }

  onVolume(event: Event): void {
    const value = +(event.target as HTMLInputElement).value / 100;
    this.player.setVolume(value);
  }
}
