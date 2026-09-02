// frontend/src/app/core/guards/auth.guard.ts
// Guard para rotas que exigem usuário autenticado.
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Aguarda o carregamento inicial da sessão
  if (auth.loading()) {
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (!auth.loading()) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  // Redireciona para login preservando URL de retorno
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.loading()) {
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (!auth.loading()) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  // Se já está logado, redireciona para home
  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};
