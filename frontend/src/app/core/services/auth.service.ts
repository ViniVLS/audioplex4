// frontend/src/app/core/services/auth.service.ts
// Serviço de autenticação. Usa Signals do Angular 21 para reatividade.
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { AppUser } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService).client;
  private router   = inject(Router);

  // Estado reativo via Signals
  private _session = signal<Session | null>(null);
  private _loading = signal<boolean>(true);

  readonly session = this._session.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isAuthenticated = computed(() => !!this._session()?.user);

  readonly currentUser = computed<AppUser | null>(() => {
    const u = this._session()?.user;
    if (!u) return null;
    return {
      id:         u.id,
      email:      u.email ?? '',
      provider:   (u.app_metadata?.provider as AppUser['provider']) ?? 'email',
      created_at: u.created_at,
    };
  });

  constructor() {
    // Carrega sessão existente
    this.supabase.auth.getSession().then(({ data }) => {
      this._session.set(data.session);
      this._loading.set(false);
    });

    // Escuta mudanças (login, logout, token refresh)
    this.supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      this._session.set(session);
      this._loading.set(false);
    });
  }

  // ----------------------- Métodos públicos -----------------------

  async signInWithEmail(email: string, password: string): Promise<{ error?: string }> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  }

  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<{ error?: string }> {
    const { error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName ?? null },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error?.message };
  }

  async signInWithGoogle(): Promise<{ error?: string }> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error?.message };
  }

  async signInWithGitHub(): Promise<{ error?: string }> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error?.message };
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this._session.set(null);
    this.router.navigate(['/login']);
  }

  // Access token atual (para Edge Functions / backend)
  async getAccessToken(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  // Refresh manual (normalmente automático)
  async refreshSession(): Promise<void> {
    await this.supabase.auth.refreshSession();
  }

  // Helper: User cru do Supabase
  get rawUser(): User | null {
    return this._session()?.user ?? null;
  }
}
