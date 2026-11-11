import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

// Las rutas generadas por orval son relativas (/v1/...): se les antepone la URL de la API y el Bearer.
// /v1/auth/* va con credenciales para que el navegador mande y guarde la cookie httpOnly del refresh token.
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/v1')) return next(req);
  const token = inject(AuthService).accessToken();
  return next(
    req.clone({
      url: `${environment.apiUrl}${req.url}`,
      setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      withCredentials: req.url.startsWith('/v1/auth/'),
    }),
  );
};
