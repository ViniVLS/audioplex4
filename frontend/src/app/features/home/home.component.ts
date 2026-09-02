// frontend/src/app/features/home/home.component.ts
// Tela principal (rota protegida): contém a UI do extrator de áudio.
// Migrada de AppComponent para isolar a lógica de negócio e
// permitir que o AppComponent raiz seja apenas um layout global.

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
        this.checkServerHealth();
        this.loadHistory();
    }

    private get apiBase() {
        return environment.apiBaseUrl;
    }

    private get authHeaders() {
        // AuthInterceptor injeta o token; este método é apenas para
        // garantir compatibilidade com o backend local Express durante dev.
        return { headers: { Authorization: `Bearer ${(this.auth as any).rawUser?.id ?? ''}` } };
    }

    checkServerHealth() {
        this.http.get<{ status: string; message: string }>(`${this.apiBase}/api/health`)
            .subscribe({
                next: (res) => console.log('✅ Backend OK:', res),
                error: (err) => {
                    this.toastr.warning('Backend local offline. Algumas funções podem não funcionar.', 'Aviso');
                    console.warn('⚠️ Backend offline:', err);
                },
            });
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

    getQualityLabel(quality: string): string {
        const labels: Record<string, string> = {
            high:   '320 kbps - Studio (Máxima Fidelidade)',
            medium: '256 kbps - Alta Fidelidade',
            low:    '128 kbps - Qualidade Compacta',
        };
        return labels[quality] || quality;
    }

    getVideoInfo() {
        if (this.youtubeUrl.invalid || !this.youtubeUrl.value) {
            this.toastr.warning('URL do YouTube inválida!', 'Atenção');
            return;
        }

        this.isLoading = true;
        this.progressMessage = 'Buscando informações do vídeo...';

        // Tenta Edge Function primeiro; cai para Express local em dev.
        const useEdge = !environment.production;
        const url = useEdge
            ? `${this.apiBase}/api/video-info`  // Express local em dev
            : `__SUPABASE_URL__/functions/v1/video-info`; // produção

        this.http.post<any>(url, { url: this.youtubeUrl.value }).subscribe({
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
        this.progressMessage = 'Extraindo áudio e convertendo...';

        const useEdge = !environment.production;
        const url = useEdge
            ? `${this.apiBase}/api/extract-audio`
            : `__SUPABASE_URL__/functions/v1/extract-audio`;

        this.http.post<any>(url, {
            url: this.youtubeUrl.value,
            quality: this.audioQuality,
            format: this.audioFormat,
        }).subscribe({
            next: (response) => {
                this.isExtracting = false;
                this.cdr.detectChanges();
                if (response.success) {
                    this.progressMessage = 'Conversão finalizada! Iniciando download...';
                    this.toastr.success('Áudio extraído e convertido com sucesso!', 'Sucesso');
                    this.saveToHistory(response.videoInfo || response.videoInfo?.title, this.audioQuality);
                    this.downloadAudio(response.downloadUrl, response.fileName || response.videoInfo?.title);
                } else {
                    this.toastr.error(response.error || 'Erro na extração', 'Erro');
                }
            },
            error: (error) => {
                this.isExtracting = false;
                this.cdr.detectChanges();
                const errMsg = error.error?.error || 'Erro ao processar extração de áudio.';
                this.toastr.error(errMsg, 'Erro');
                console.error('Erro:', error);
            },
        });
    }

    downloadAudio(downloadUrl: string, title: string) {
        const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : downloadUrl;
        const fileName = title.endsWith('.mp3') ? title : `${title}.mp3`;

        fetch(fullUrl)
            .then((response) => {
                if (!response.ok) throw new Error('Falha na resposta do download');
                return response.blob();
            })
            .then((blob) => {
                saveAs(blob, fileName);
                this.toastr.success('Download do MP3 iniciado!', 'Sucesso');
            })
            .catch((error) => {
                console.error('Erro no download:', error);
                this.toastr.error('Erro ao baixar arquivo MP3', 'Erro');
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
