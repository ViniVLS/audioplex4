import { Injectable, inject, signal } from '@angular/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FfmpegConverter } from '../plugins/ffmpeg-converter';
import { MediaSaver } from '../plugins/media-saver';
import { Track } from '../models/track.model';

export interface OfflineTrack {
  trackId: string;
  videoId: string;
  title: string;
  author?: string;
  thumbnail?: string;
  duration?: number;
  localPath: string;
  localFormat: 'mp3' | 'aac';
  localBitrate: '256k' | '320k';
  localSize: number;
  createdAt: string;
}

export interface ConvertProgress {
  stage: 'downloading' | 'converting' | 'saving' | 'done' | 'error';
  percent?: number;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class OfflineLibraryService {
  private _tracks = signal<OfflineTrack[]>([]);
  readonly tracks = this._tracks.asReadonly();

  private readonly LIBRARY_FILE = 'offline-library.json';
  private readonly RAW_DIR = 'raw-audio';

  constructor() {
    void this.loadLibrary();
  }

  async extractAndSave(
    track: Track,
    audioBlob: Blob,
    targetFormat: 'mp3' | 'aac' = 'mp3',
    targetBitrate: '256k' | '320k' = '320k',
    onProgress?: (p: ConvertProgress) => void,
  ): Promise<OfflineTrack | null> {
    try {
      onProgress?.({ stage: 'downloading', message: 'Salvando áudio bruto...' });

      // 1. Salvar blob bruto no filesystem interno
      const rawBytes = await this.blobToBase64(audioBlob);
      const rawExt = this.guessRawExtension(audioBlob.type);
      const rawPath = `${this.RAW_DIR}/${track.video_id}.${rawExt}`;

      await Filesystem.writeFile({
        path: rawPath,
        data: rawBytes,
        directory: Directory.Data,
        // base64 é o padrão quando encoding não é especificado (v7)
      });

      onProgress?.({ stage: 'converting', message: `Convertendo para ${targetFormat.toUpperCase()} ${targetBitrate}...` });

      // 2. Converter via FFmpegKit
      const inputFullPath = await this.getFullPath(rawPath, Directory.Data);
      const outputFileName = `${track.video_id}.${targetFormat}`;
      const outputPath = `${this.RAW_DIR}/${outputFileName}`;
      const outputFullPath = await this.getFullPath(outputPath, Directory.Data);

      const convertResult = await FfmpegConverter.convert({
        inputPath: inputFullPath,
        outputPath: outputFullPath,
        codec: targetFormat === 'mp3' ? 'libmp3lame' : 'aac',
        bitrate: targetBitrate,
        sampleRate: 44100,
        channels: 2,
      });

      onProgress?.({ stage: 'saving', message: 'Salvando na biblioteca...' });

      // 3. Salvar na pasta pública Downloads
      try {
        await MediaSaver.saveToDownloads({
          filePath: outputFullPath,
          fileName: `${this.sanitizeFileName(track.title)}.${targetFormat}`,
          mimeType: targetFormat === 'mp3' ? 'audio/mpeg' : 'audio/aac',
        });
      } catch (mediaErr) {
        console.warn('MediaSaver falhou (pode ser permissão):', mediaErr);
      }

      // 4. Criar registro na biblioteca offline
      const offlineTrack: OfflineTrack = {
        trackId: track.id,
        videoId: track.video_id,
        title: track.title,
        author: track.author,
        thumbnail: track.thumbnail,
        duration: track.duration,
        localPath: outputFullPath,
        localFormat: targetFormat,
        localBitrate: targetBitrate,
        localSize: convertResult.outputSize,
        createdAt: new Date().toISOString(),
      };

      // 5. Atualizar biblioteca
      const existing = this._tracks().filter(t => t.trackId !== track.id);
      const updated = [...existing, offlineTrack];
      this._tracks.set(updated);
      await this.saveLibrary(updated);

      // 6. Limpar arquivo bruto
      try {
        await Filesystem.deleteFile({ path: rawPath, directory: Directory.Data });
      } catch (_) { /* ignore */ }

      onProgress?.({ stage: 'done', message: 'Áudio salvo com sucesso!' });
      return offlineTrack;

    } catch (err) {
      console.error('extractAndSave error:', err);
      onProgress?.({ stage: 'error', message: String(err) });
      return null;
    }
  }

  async removeOffline(trackId: string): Promise<boolean> {
    const track = this._tracks().find(t => t.trackId === trackId);
    if (!track) return false;

    try {
      if (track.localPath) {
        await Filesystem.deleteFile({ path: track.localPath, directory: Directory.Data });
      }
    } catch (_) { /* ignore */ }

    const updated = this._tracks().filter(t => t.trackId !== trackId);
    this._tracks.set(updated);
    await this.saveLibrary(updated);
    return true;
  }

  isOffline(videoId: string): boolean {
    return this._tracks().some(t => t.videoId === videoId);
  }

  getOfflineTrack(videoId: string): OfflineTrack | undefined {
    return this._tracks().find(t => t.videoId === videoId);
  }

  getLocalPlaybackUrl(videoId: string): string | null {
    const track = this.getOfflineTrack(videoId);
    return track?.localPath ?? null;
  }

  async getOfflineTracks(): Promise<OfflineTrack[]> {
    return this._tracks();
  }

  private async loadLibrary(): Promise<void> {
    try {
      const content = await Filesystem.readFile({
        path: this.LIBRARY_FILE,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      const data = JSON.parse(content.data as string) as OfflineTrack[];
      this._tracks.set(data);
    } catch (_) {
      this._tracks.set([]);
    }
  }

  private async saveLibrary(tracks: OfflineTrack[]): Promise<void> {
    await Filesystem.writeFile({
      path: this.LIBRARY_FILE,
      data: JSON.stringify(tracks),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  }

  private async getFullPath(path: string, directory: Directory): Promise<string> {
    const uri = await Filesystem.getUri({ path, directory });
    return uri.uri;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private guessRawExtension(mimeType: string): string {
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
    if (mimeType.includes('ogg')) return 'ogg';
    return 'webm';
  }

  private sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }
}
