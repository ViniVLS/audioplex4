// frontend/src/app/features/auth/auth-callback.component.ts
// Ponto de retorno do OAuth (Google/GitHub) e confirmação de email.
// O Supabase entrega os tokens via URL (hash fragment); o cliente
// (detectSessionInUrl: true) consome automaticamente ao ser criado.
// Esta rota apenas aguarda a sessão estabilizar e redireciona para home.
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: false,
  template: `
    <div class="callback-wrap">
      <mat-spinner diameter="48"></mat-spinner>
      <p>Autenticando…</p>
    </div>
  `,
  styles: [
    '.callback-wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: #888; }',
  ],
})
export class AuthCallbackComponent implements OnInit {
  private auth   = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    // Aguarda o AuthService resolver a sessão (loading === false) e navega.
    const waitForSession = () => {
      if (this.auth.loading()) {
        setTimeout(waitForSession, 50);
        return;
      }
      this.router.navigateByUrl('/');
    };
    waitForSession();
  }
}