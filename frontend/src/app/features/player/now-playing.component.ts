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
  extractingFormat: 'mp3' | 'aac' | 'wav' | 'flac' = 'mp3';

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
    const value = +(event.target as HTMLInputElement).value;
    this.player.seek(value);
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

    const useEdge = !environment.production;
    const url = useEdge
      ? `${environment.apiBaseUrl}/api/extract-audio`
      : `${environment.supabase.url}/functions/v1/extract-audio`;

    const response = await this.http.post<any>(url, {
      url: track.source_url,
      quality: this.extractingQuality,
      format: this.extractingFormat,
    }).toPromise();

    if (response?.success) {
      this.downloadAudio(response.downloadUrl, response.fileName || track.title);
    } else {
      console.error('Extraction failed:', response?.error);
    }

    this.qualityMenuOpen.set(false);
  }

  private downloadAudio(downloadUrl: string, title: string): void {
    const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : downloadUrl;
    const fileName = title.endsWith('.mp3') ? title : `${title}.mp3`;

    fetch(fullUrl)
      .then((r) => {
        if (!r.ok) throw new Error('Download failed');
        return r.blob();
      })
      .then((blob) => saveAs(blob, fileName))
      .catch((err) => console.error('Download error:', err));
  }
}