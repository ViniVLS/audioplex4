import { registerPlugin } from '@capacitor/core';

export interface BackgroundAudioState {
  playing: boolean;
  position: number; // ms
  duration: number; // ms
}

export interface BackgroundAudioPlugin {
  setSource(options: { url: string; title?: string }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(options: { seconds: number }): Promise<void>;
  setVolume(options: { volume: number }): Promise<void>;
  isPlaying(): Promise<{ playing: boolean }>;
  getState(): Promise<BackgroundAudioState>;
  stop(): Promise<void>;
}

const BackgroundAudio = registerPlugin<BackgroundAudioPlugin>('BackgroundAudio', {
  web: () => import('./background-audio-web').then((m) => new m.BackgroundAudioWeb()),
});

export { BackgroundAudio };