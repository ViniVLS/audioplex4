// frontend/src/app/features/auth/login.component.ts
// Tela de login/signup com email/senha + Google + GitHub.
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private fb        = inject(FormBuilder);
  private auth      = inject(AuthService);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  private toastr    = inject(ToastrService);

  loading = signal(false);
  oauthLoading = signal<'google' | 'github' | null>(null);
  errorMsg = signal<string | null>(null);

  loginForm: FormGroup = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  signupForm: FormGroup = this.fb.group({
    displayName: ['', [Validators.minLength(2)]],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async onLogin() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMsg.set(null);

    const { email, password } = this.loginForm.value;
    const { error } = await this.auth.signInWithEmail(email!, password!);

    this.loading.set(false);

    if (error) {
      this.errorMsg.set(this.translateError(error));
      return;
    }

    this.toastr.success('Login realizado com sucesso!', 'Bem-vindo');
    this.navigateAfterAuth();
  }

  async onSignup() {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMsg.set(null);

    const { email, password, displayName } = this.signupForm.value;
    const { error } = await this.auth.signUpWithEmail(email!, password!, displayName || undefined);

    this.loading.set(false);

    if (error) {
      this.errorMsg.set(this.translateError(error));
      return;
    }

    this.toastr.success(
      'Conta criada! Verifique seu email para confirmar (se habilitado).',
      'Sucesso',
    );
    this.navigateAfterAuth();
  }

  async onGoogle() {
    this.oauthLoading.set('google');
    const { error } = await this.auth.signInWithGoogle();
    this.oauthLoading.set(null);
    if (error) this.toastr.error(error, 'Falha no Google');
  }

  async onGitHub() {
    this.oauthLoading.set('github');
    const { error } = await this.auth.signInWithGitHub();
    this.oauthLoading.set(null);
    if (error) this.toastr.error(error, 'Falha no GitHub');
  }

  private navigateAfterAuth() {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
    this.router.navigateByUrl(returnUrl);
  }

  private translateError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Email ou senha incorretos.';
    if (msg.includes('Email not confirmed'))         return 'Confirme seu email antes de entrar.';
    if (msg.includes('User already registered'))     return 'Este email já está cadastrado.';
    if (msg.includes('Password should be'))          return 'Senha deve ter no mínimo 6 caracteres.';
    return msg;
  }
}
