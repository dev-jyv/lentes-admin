import { computed, Service, signal } from '@angular/core';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Service()
export class AuthService {
  // Sin configuración de Supabase (p. ej. entorno nuevo) la app abre en /login en vez de romperse.
  private readonly supabase: SupabaseClient | null = environment.supabaseUrl
    ? createClient(environment.supabaseUrl, environment.supabaseKey)
    : null;
  private readonly _session = signal<Session | null>(null);
  private readonly _ready = signal(false);

  readonly session = this._session.asReadonly();
  readonly ready = this._ready.asReadonly();
  readonly email = computed(() => this._session()?.user.email ?? '');
  // Solo app_metadata: user_metadata lo puede editar el propio usuario. La API vuelve a verificar el rol.
  readonly isAdmin = computed(() => this._session()?.user.app_metadata?.['role'] === 'admin');

  constructor() {
    if (!this.supabase) {
      this._ready.set(true);
      return;
    }
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
      this._ready.set(true);
    });
    void this.supabase.auth.getSession().then(({ data }) => {
      this._session.set(data.session);
      this._ready.set(true);
    });
  }

  accessToken(): string | undefined {
    return this._session()?.access_token;
  }

  async signIn(email: string, password: string): Promise<boolean> {
    if (!this.supabase) return false;
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    return !error;
  }

  async signOut(): Promise<void> {
    await this.supabase?.auth.signOut();
  }

  /** Espera a que Supabase restaure la sesión antes de decidir en un guard. */
  async whenReady(): Promise<void> {
    if (this._ready()) return;
    await new Promise<void>((resolve) => {
      const id = setInterval(() => {
        if (this._ready()) {
          clearInterval(id);
          resolve();
        }
      }, 25);
    });
  }
}
