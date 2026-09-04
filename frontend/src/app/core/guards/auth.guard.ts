// frontend/src/app/core/guards/auth.guard.ts
// Guard para rotas que exigem usuário autenticado.
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

const GUARD_TIMEOUT_MS = 10_000;

function waitForAuth(auth: AuthService): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!auth.loading()) { resolve(); return; }
    let resolved = false;
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      clearInterval(interval);
      clearTimeout(timeout);
    };
    const timeout = setTimeout(() => { cleanup(); resolve(); }, GUARD_TIMEOUT_MS);
    const interval = setInterval(() => {
      if (!auth.loading()) { cleanup(); resolve(); }
    }, 50);
  });
}

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await waitForAuth(auth);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await waitForAuth(auth);

  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};
