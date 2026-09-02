// frontend/src/app/core/models/user.model.ts
export interface AppUser {
  id:         string;
  email:      string;
  provider:   'email' | 'google' | 'github';
  created_at: string;
}

export interface Profile {
  id:           string;
  display_name: string | null;
  avatar_url:   string | null;
  created_at:   string;
  updated_at:   string;
}

export interface PlayerPreferences {
  user_id:                  string;
  volume:                   number;     // 0..1
  muted:                    boolean;
  repeat_mode:              'off' | 'one' | 'all';
  shuffle:                  boolean;
  current_track_id:         string | null;
  current_position_seconds: number;
  updated_at:               string;
}
