import { registerPlugin } from '@capacitor/core';

export interface SaveToDownloadsOptions {
  filePath: string;
  fileName: string;
  mimeType?: string;
}

export interface SaveToDownloadsResult {
  success: boolean;
  uri: string;
  fileName: string;
  fileSize: number;
}

export interface GetDownloadsPathResult {
  success: boolean;
  path: string;
}

export interface FileItem {
  name: string;
  path: string;
  size: number;
  lastModified: number;
}

export interface ListDownloadsResult {
  success: boolean;
  files: FileItem[];
}

export interface MediaSaverPlugin {
  saveToDownloads(options: SaveToDownloadsOptions): Promise<SaveToDownloadsResult>;
  getDownloadsPath(): Promise<GetDownloadsPathResult>;
  listDownloads(): Promise<ListDownloadsResult>;
}

const MediaSaver = registerPlugin<MediaSaverPlugin>('MediaSaver', {
  web: () => import('./media-saver-web').then(m => new m.MediaSaverWeb()),
});

export { MediaSaver };
