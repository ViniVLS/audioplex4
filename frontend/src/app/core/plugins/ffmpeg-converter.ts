import { registerPlugin } from '@capacitor/core';

export interface ConvertOptions {
  inputPath: string;
  outputPath: string;
  codec?: string;
  bitrate?: string;
  sampleRate?: number;
  channels?: number;
}

export interface ConvertResult {
  success: boolean;
  outputPath: string;
  outputSize: number;
}

export interface FileInfo {
  duration: number;
  bitrate: number;
  streams: number;
}

export interface FfmpegConverterPlugin {
  convert(options: ConvertOptions): Promise<ConvertResult>;
  getInfo(options: { path: string }): Promise<FileInfo>;
}

const FfmpegConverter = registerPlugin<FfmpegConverterPlugin>('FfmpegConverter', {
  web: () => import('./ffmpeg-converter-web').then(m => new m.FfmpegConverterWeb()),
});

export { FfmpegConverter };
