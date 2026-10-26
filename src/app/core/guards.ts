import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  if (!auth.session()) return router.createUrlTree(['/login']);
  // Con sesión pero sin rol admin: fuera. La API también rechaza con 403.
  if (!auth.isAdmin()) return router.createUrlTree(['/login'], { queryParams: { error: 'forbidden' } });
  return true;
};
