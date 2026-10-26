import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';
import { adminGuard } from './guards';

function run(session: unknown, isAdmin: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { whenReady: async () => {}, session: signal(session), isAdmin: signal(isAdmin) },
      },
    ],
  });
  return TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never)) as Promise<boolean | UrlTree>;
}

describe('adminGuard', () => {
  it('sin sesión manda a /login', async () => {
    const res = (await run(null, false)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(res)).toBe('/login');
  });

  it('con sesión pero sin rol admin manda a /login?error=forbidden', async () => {
    const res = (await run({ user: {} }, false)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(res)).toBe('/login?error=forbidden');
  });

  it('admin pasa', async () => {
    expect(await run({ user: {} }, true)).toBe(true);
  });
});
