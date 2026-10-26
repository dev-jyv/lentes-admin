import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

// PROVISIONAL: rutas que la API real aún no publica se desvían al mock (ver docs/ADMIN.md).
const PROVISIONAL = /^\/v1\/admin\/(inventory|reports|variants\/[^/]+\/stock-adjustments)/;

// Las rutas generadas por orval son relativas (/v1/...): se les antepone la URL de la API y el Bearer.
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/v1')) return next(req);
  const token = inject(AuthService).accessToken();
  return next(
    req.clone({
      url: `${PROVISIONAL.test(req.url) && environment.provisionalApiUrl ? environment.provisionalApiUrl : environment.apiUrl}${req.url}`,
      setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    }),
  );
};
