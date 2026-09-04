import { WebPlugin } from '@capacitor/core';
import type { BackgroundAudioPlugin, BackgroundAudioState } from './background-audio';

export class BackgroundAudioWeb extends WebPlugin implements BackgroundAudioPlugin {
  async setSource(_options: { url: string; title?: string }): Promise<void> {
    throw this.unavailable('BackgroundAudio não está disponível no navegador.');
  }

  async play(): Promise<void> {
    throw this.unavailable('BackgroundAudio não está disponível no navegador.');
  }

  async pause(): Promise<void> {
    throw this.unavailable('BackgroundAudio não está disponível no navegador.');
  }

  async seek(_options: { seconds: number }): Promise<void> {
    throw this.unavailable('BackgroundAudio não está disponível no navegador.');
  }

  async setVolume(_options: { volume: number }): Promise<void> {
    throw this.unavailable('BackgroundAudio não está disponível no navegador.');
  }

  async isPlaying(): Promise<{ playing: boolean }> {
    throw this.unavailable('BackgroundAudio não está disponível no navegador.');
  }

  async getState(): Promise<BackgroundAudioState> {
    throw this.unavailable('BackgroundAudio não está disponível no navegador.');
  }

  async stop(): Promise<void> {
    throw this.unavailable('BackgroundAudio não está disponível no navegador.');
  }
}