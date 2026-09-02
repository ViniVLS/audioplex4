import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.audioplex4',
  appName: 'AudioPlex4',
  webDir: 'frontend/dist/frontend',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    CapacitorMedia: {
      // Player de mídia nativo (ExoPlayer) — mantém áudio em background.
      // A notificação de mídia e os controles de lock screen são
      // gerenciados pelo plugin automaticamente.
    },
  },
};

export default config;