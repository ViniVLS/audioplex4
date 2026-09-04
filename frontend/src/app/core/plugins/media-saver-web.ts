import { WebPlugin } from '@capacitor/core';
import type {
  MediaSaverPlugin,
  SaveToDownloadsOptions,
  SaveToDownloadsResult,
  GetDownloadsPathResult,
  ListDownloadsResult,
} from './media-saver';

export class MediaSaverWeb extends WebPlugin implements MediaSaverPlugin {
  async saveToDownloads(_options: SaveToDownloadsOptions): Promise<SaveToDownloadsResult> {
    throw this.unavailable('MediaSaver não está disponível no navegador.');
  }

  async getDownloadsPath(): Promise<GetDownloadsPathResult> {
    throw this.unavailable('MediaSaver não está disponível no navegador.');
  }

  async listDownloads(): Promise<ListDownloadsResult> {
    throw this.unavailable('MediaSaver não está disponível no navegador.');
  }
}
