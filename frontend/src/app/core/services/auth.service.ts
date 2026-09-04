// frontend/src/app/core/services/auth.service.ts
// Serviço de autenticação. Usa Signals do Angular 21 para reatividade.
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
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

    // Deep links de OAuth (apenas nativo Android/iOS)
    if (Capacitor.isNativePlatform()) {
      this.setupDeepLinks();
    }
  }

  // URL de retorno do OAuth: deep link no nativo, callback no browser.
  private get redirectUrl(): string {
    return Capacitor.isNativePlatform()
      ? 'com.audioplex4://auth/callback'
      : `${window.location.origin}/auth/callback`;
  }

  // Captura o retorno do OAuth via deep link (com.audioplex4://auth/callback).
  private setupDeepLinks(): void {
    App.addListener('appUrlOpen', ({ url }) => {
      void this.processOAuthRedirect(url).then((ok) => {
        if (ok) this.router.navigateByUrl('/');
      });
    });

    // Caso o app seja aberto a frio já na URL de retorno.
    App.getLaunchUrl()
      .then((launch) => {
        if (launch?.url) {
          void this.processOAuthRedirect(launch.url).then((ok) => {
            if (ok) this.router.navigateByUrl('/');
          });
        }
      })
      .catch(() => { /* sem URL de launch */ });
  }

  async processOAuthRedirect(url: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.auth.getSessionFromUrl({ url });
      if (error) {
        console.error('OAuth redirect error:', error);
        return false;
      }
      if (data?.session) {
        this._session.set(data.session);
      }
      return !!data?.session;
    } catch (e) {
      console.error('processOAuthRedirect error:', e);
      return false;
    }
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
        emailRedirectTo: this.redirectUrl,
      },
    });
    return { error: error?.message };
  }

  async signInWithGoogle(): Promise<{ error?: string }> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: this.redirectUrl },
    });
    return { error: error?.message };
  }

  async signInWithGitHub(): Promise<{ error?: string }> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: this.redirectUrl },
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
