// frontend/src/app/features/player/now-playing.component.ts
// Modal estilo Amazon Music "Now Playing" - capa grande, controles completos.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { saveAs } from 'file-saver';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { PlayerService } from '../../core/services/player.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-now-playing',
  standalone: false,
  templateUrl: './now-playing.component.html',
  styleUrls: ['./now-playing.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NowPlayingComponent {
  private http = inject(HttpClient);

  player = inject(PlayerService);

  qualityMenuOpen = signal(false);
  extractingQuality: 'high' | 'medium' | 'low' = 'high';
  extractingFormat: 'mp3' | 'aac' = 'mp3';

  readonly currentTrack = this.player.currentTrack;
  readonly isPlaying = this.player.isPlaying;
  readonly progress = this.player.progress;
  readonly currentTime = this.player.currentTime;
  readonly duration = this.player.duration;

  formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  onSeek(event: Event): void {
    const percent = +(event.target as HTMLInputElement).value;
    const duration = this.player.duration();
    const seconds = (percent / 100) * duration;
    this.player.seek(seconds);
  }

  onVolume(event: Event): void {
    const value = +(event.target as HTMLInputElement).value / 100;
    this.player.setVolume(value);
  }

  close(): void {
    this.player.closeExpanded();
    this.qualityMenuOpen.set(false);
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  openExtractMenu(): void {
    this.qualityMenuOpen.set(true);
  }

  async extractCurrent(): Promise<void> {
    const track = this.player.currentTrack();
    if (!track) return;

    const edgeFnUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? '/api'
        : `${environment.supabase.url}/functions/v1`;

    try {
      const response = await this.http.post(`${edgeFnUrl}/extract-audio`, {
        url: track.source_url,
        trackId: track.video_id,
      }, { responseType: 'blob', observe: 'response' }).toPromise();

      if (response) {
        const audioInfoHeader = response.headers.get('X-Audio-Info');
        const audioInfo = audioInfoHeader ? JSON.parse(audioInfoHeader) : null;
        const blob = response.body as Blob;
        const fileName = audioInfo?.fileName ?? `${track.title}.webm`;
        saveAs(blob, fileName);
      }
    } catch (err) {
      console.error('Extraction failed:', err);
    }

    this.qualityMenuOpen.set(false);
  }
}