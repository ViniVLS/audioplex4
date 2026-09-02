// frontend/src/app/core/interceptors/auth.interceptor.ts
// Anexa o Bearer token em todas as requisições HTTP para Edge Functions.
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { from, switchMap } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Não anexa token em requisições externas (CDN, etc.)
  const isExternal = req.url.startsWith('http') && !req.url.includes('supabase.co');
  if (isExternal) {
    return next(req);
  }

  return from(auth.getAccessToken()).pipe(
    switchMap((token) => {
      if (!token) return next(req);
      const cloned = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
      return next(cloned);
    }),
  );
};
