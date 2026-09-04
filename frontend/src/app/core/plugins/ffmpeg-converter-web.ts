import { WebPlugin } from '@capacitor/core';
import type { FfmpegConverterPlugin, ConvertOptions, ConvertResult, FileInfo } from './ffmpeg-converter';

export class FfmpegConverterWeb extends WebPlugin implements FfmpegConverterPlugin {
  async convert(_options: ConvertOptions): Promise<ConvertResult> {
    throw this.unavailable('FFmpegConverter não está disponível no navegador.');
  }

  async getInfo(_options: { path: string }): Promise<FileInfo> {
    throw this.unavailable('FFmpegConverter não está disponível no navegador.');
  }
}
