// frontend/src/app/features/home/home.component.ts
// Tela principal (rota protegida): contém a UI do extrator de áudio.
// Migrada de AppComponent para isolar a lógica de negócio e
// permitir que o AppComponent raiz seja apenas um layout global.
//
// Versão refatorada: 100% Edge Functions (sem Express).
// "Extrair" baixa o áudio nativo do YouTube (Opus 160k ou m4a 128k)
// e o download/conversão será feito no device (FFmpegKit no Android).

import {
  Component,
  OnInit,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { saveAs } from 'file-saver';
import { AuthService } from '../../core/services/auth.service';
import { PlayerService } from '../../core/services/player.service';
import { environment } from '../../../environments/environment';

interface VideoInfo {
    title: string;
    duration: string | number;
    formattedDuration?: string;
    thumbnail: string;
    author: string;
    views: string | number;
    formattedViews?: string;
    videoId?: string;
}

interface DownloadHistory {
    id: string;
    title: string;
    url: string;
    quality: string;
    date: Date;
    fileSize: number;
}

@Component({
    selector: 'app-home',
    standalone: false,
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
    private http   = inject(HttpClient);
    private toastr = inject(ToastrService);
    private cdr    = inject(ChangeDetectorRef);
    auth         = inject(AuthService);
    private player       = inject(PlayerService);

    youtubeUrl = new FormControl('', [
        Validators.required,
        Validators.pattern(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/),
    ]);

    videoInfo: VideoInfo | null = null;
    isLoading = false;
    isExtracting = false;
    progressMessage = '';
    audioQuality: 'high' | 'medium' | 'low' = 'high';
    audioFormat: 'mp3' | 'aac' | 'wav' | 'flac' = 'mp3';

    testVideos = [
        { title: 'Rick Astley - Never Gonna Give You Up', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { title: 'Lofi Hip Hop Radio - Beats to relax/study', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
    ];

    history: DownloadHistory[] = [];
    showHistory = false;

    get isButtonDisabled(): boolean {
        return this.isLoading || this.isExtracting || !this.youtubeUrl.value || this.youtubeUrl.invalid;
    }

    ngOnInit() {
        this.loadHistory();
    }

    private get edgeFnUrl() {
        return `${environment.supabase.url}/functions/v1`;
    }

    loadHistory() {
        const stored = localStorage.getItem('downloadHistory');
        if (stored) this.history = JSON.parse(stored);
    }

    saveToHistory(videoInfo: any, quality: string) {
        const download: DownloadHistory = {
            id: Date.now().toString(),
            title: videoInfo?.title || String(videoInfo),
            url: this.youtubeUrl.value || '',
            quality,
            date: new Date(),
            fileSize: 0,
        };
        this.history.unshift(download);
        localStorage.setItem('downloadHistory', JSON.stringify(this.history));
        this.cdr.detectChanges();
    }

    getVideoInfo() {
        if (this.youtubeUrl.invalid || !this.youtubeUrl.value) {
            this.toastr.warning('URL do YouTube inválida!', 'Atenção');
            return;
        }

        this.isLoading = true;
        this.progressMessage = 'Buscando informações do vídeo...';

        this.http.post<any>(`${this.edgeFnUrl}/video-info`, { url: this.youtubeUrl.value }).subscribe({
            next: (response) => {
                this.isLoading = false;
                this.progressMessage = '';
                this.cdr.detectChanges();
                if (response.success && response.videoInfo) {
                    this.videoInfo = { ...response.videoInfo, videoId: response.videoId };
                    this.toastr.success('Vídeo encontrado com sucesso!', 'Sucesso');
                } else {
                    this.toastr.error(response.error || 'Erro ao buscar vídeo', 'Erro');
                }
            },
            error: (error) => {
                this.isLoading = false;
                this.progressMessage = '';
                this.cdr.detectChanges();
                const errMsg = error.error?.error || 'Erro ao buscar informações do vídeo.';
                this.toastr.error(errMsg, 'Erro');
                console.error('Erro:', error);
            },
        });
    }

    extractAudio() {
        if (!this.videoInfo) {
            this.toastr.warning('Busque as informações do vídeo primeiro!', 'Atenção');
            return;
        }

        this.isExtracting = true;
        this.progressMessage = 'Extraindo áudio...';

        // A Edge Function retorna os bytes de áudio diretamente (blob)
        // com headers X-Audio-Info (container, codec, bitrate, fileName, videoInfo)
        this.http.post(`${this.edgeFnUrl}/extract-audio`, {
            url: this.youtubeUrl.value,
            trackId: this.videoInfo.videoId,
        }, { responseType: 'blob', observe: 'response' }).subscribe({
            next: (response) => {
                this.isExtracting = false;
                this.cdr.detectChanges();

                const audioInfoHeader = response.headers.get('X-Audio-Info');
                const audioInfo = audioInfoHeader ? JSON.parse(audioInfoHeader) : null;
                const blob = response.body as Blob;
                const fileName = audioInfo?.fileName ?? `audio-${this.videoInfo?.videoId}.webm`;

                this.progressMessage = `Áudio extraído (${audioInfo?.container ?? 'desconhecido'}). Iniciando download...`;
                this.toastr.success(`Áudio extraído com sucesso!`, 'Sucesso');

                this.saveToHistory(
                    audioInfo?.videoInfo ?? this.videoInfo,
                    audioInfo?.bitrate ? `${Math.round(audioInfo.bitrate / 1000)}k` : 'unknown',
                );

                // Download do arquivo de áudio bruto (webm/opus ou m4a)
                // No Android/Capacitor, futuramente será salvo via plugin nativo
                saveAs(blob, fileName);
            },
            error: (error) => {
                this.isExtracting = false;
                this.cdr.detectChanges();
                const errMsg = error.error?.error || error.message || 'Erro ao processar extração de áudio.';
                this.toastr.error(errMsg, 'Erro');
                console.error('Erro na extração:', error);
            },
        });
    }

    useTestVideo(url: string) {
        this.youtubeUrl.setValue(url);
        this.getVideoInfo();
    }

    clearAll() {
        this.youtubeUrl.reset();
        this.videoInfo = null;
        this.progressMessage = '';
    }

    toggleHistory() {
        this.showHistory = !this.showHistory;
    }

    /** Adiciona o vídeo atual à fila e começa a tocar. */
    playNow() {
        if (!this.videoInfo) return;
        const track = {
            id: this.videoInfo.videoId ?? Date.now().toString(),
            video_id: this.videoInfo.videoId ?? '',
            title: this.videoInfo.title,
            author: this.videoInfo.author,
            thumbnail: this.videoInfo.thumbnail,
            duration: typeof this.videoInfo.duration === 'string'
                ? parseInt(this.videoInfo.duration, 10)
                : this.videoInfo.duration,
            formatted_duration: this.videoInfo.formattedDuration,
            source_url: this.youtubeUrl.value ?? '',
        };
        this.player.playTrack(track as any);
    }

    onLogout() {
        this.auth.signOut();
    }
}
