import { computed, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DefaultService } from '../api/generated/default/default.service';
import type { AuthSession } from '../api/generated/model';

/**
 * Sesión a través de la API (que habla con Supabase Auth). El access token vive solo en memoria;
 * el refresh token es una cookie httpOnly de la API que este código nunca ve.
 */
@Service()
export class AuthService {
  private readonly api = inject(DefaultService);
  private readonly _session = signal<AuthSession | null>(null);
  private restoring?: Promise<void>;
  private refreshTimer?: ReturnType<typeof setTimeout>;

  readonly session = this._session.asReadonly();
  readonly email = computed(() => this._session()?.email ?? '');
  // La API toma el rol de app_metadata (nunca user_metadata) y vuelve a verificarlo en cada petición.
  readonly isAdmin = computed(() => this._session()?.role === 'admin');

  accessToken(): string | undefined {
    return this._session()?.access_token;
  }

  async signIn(email: string, password: string): Promise<boolean> {
    try {
      this.start(await firstValueFrom(this.api.login({ email, password })));
      return true;
    } catch {
      return false;
    }
  }

  async signOut(): Promise<void> {
    this.stop();
    await firstValueFrom(this.api.logout()).catch(() => undefined);
  }

  /** Restaura la sesión con la cookie (una sola vez) antes de decidir en un guard. */
  whenReady(): Promise<void> {
    // Perezoso, no en el constructor: el interceptor inyecta este servicio y crearía un ciclo.
    this.restoring ??= this.refresh();
    return this.restoring;
  }

  private async refresh(): Promise<void> {
    try {
      this.start(await firstValueFrom(this.api.refreshSession()));
    } catch {
      this.stop();
    }
  }

  private start(session: AuthSession) {
    this._session.set(session);
    clearTimeout(this.refreshTimer);
    // Renueva un minuto antes de que venza el access token.
    this.refreshTimer = setTimeout(() => void this.refresh(), Math.max(session.expires_in - 60, 10) * 1000);
  }

  private stop() {
    clearTimeout(this.refreshTimer);
    this._session.set(null);
  }
}
