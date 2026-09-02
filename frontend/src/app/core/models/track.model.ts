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
  created_at?:       string;
  updated_at?:       string;
}

export type RepeatMode = 'off' | 'one' | 'all';
