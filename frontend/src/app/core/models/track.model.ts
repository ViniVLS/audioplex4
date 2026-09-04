// frontend/src/app/core/models/track.model.ts
// Modelo de faixa (track) usado em todo o frontend.
// Deve refletir o shape de public.tracks do Supabase.
export interface Track {
  id:                string;
  user_id?:          string;
  video_id:          string;
  title:             string;
  author?:           string;
  thumbnail?:        string;
  duration?:         number;          // segundos
  formatted_duration?: string;
  source_url:        string;
  format?:           'm4a' | 'webm' | 'mp3' | 'aac';
  bitrate?:          '128k' | '160k' | '256k' | '320k';
  file_size_bytes?:  number;

  // Offline support
  local_path?:       string;          // caminho interno (Capacitor Filesystem)
  local_format?:     'mp3' | 'aac';   // formato convertido no device
  local_bitrate?:    '256k' | '320k'; // bitrate convertido no device
  local_size?:       number;          // tamanho do arquivo convertido
  is_offline?:       boolean;         // true = tem arquivo local disponível

  created_at?:       string;
  updated_at?:       string;
}

export type RepeatMode = 'off' | 'one' | 'all';
