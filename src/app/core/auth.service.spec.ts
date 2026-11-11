import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';

const session = { access_token: 'at', expires_in: 3600, email: 'admin@example.com', role: 'admin' };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  it('restaura la sesión con la cookie una sola vez', async () => {
    const ready = auth.whenReady();
    void auth.whenReady();
    http.expectOne({ method: 'POST', url: '/v1/auth/refresh' }).flush(session);
    await ready;
    expect(auth.isAdmin()).toBe(true);
    expect(auth.accessToken()).toBe('at');
    http.verify();
  });

  it('sin cookie válida queda sin sesión', async () => {
    const ready = auth.whenReady();
    http.expectOne('/v1/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });
    await ready;
    expect(auth.session()).toBeNull();
  });

  it('login fallido devuelve false; cerrar sesión limpia el token', async () => {
    const bad = auth.signIn('a@b.mx', 'mala');
    http.expectOne('/v1/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(await bad).toBe(false);

    const ok = auth.signIn('admin@example.com', 'secreta');
    http.expectOne('/v1/auth/login').flush(session);
    expect(await ok).toBe(true);

    const out = auth.signOut();
    expect(auth.accessToken()).toBeUndefined();
    http.expectOne('/v1/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await out;
  });
});
