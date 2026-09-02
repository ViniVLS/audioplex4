// frontend/src/app/core/services/supabase.service.ts
// Wrapper singleton do cliente Supabase.
// Carregado lazy para evitar overhead no SSR/testes.
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private _client: SupabaseClient | null = null;

  get client(): SupabaseClient {
    if (!this._client) {
      this._client = createClient(environment.supabase.url, environment.supabase.anonKey, {
        auth: {
          persistSession:       true,
          autoRefreshToken:     true,
          detectSessionInUrl:   true,
          storageKey:           'plmp3.auth',
          storage:              window.localStorage,
        },
        realtime: {
          params: { eventsPerSecond: 5 },
        },
        global: {
          headers: { 'x-application-name': 'plmp3-frontend' },
        },
      });
    }
    return this._client;
  }
}
