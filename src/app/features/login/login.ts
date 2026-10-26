import { Component, inject, input, signal } from '@angular/core';
import { form, FormField, required, email } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormField],
  template: `
    <main class="mx-auto mt-24 w-full max-w-sm p-4">
      <div class="mb-6 flex items-center gap-2">
        <svg viewBox="0 0 32 32" aria-hidden="true" class="size-7" fill="none">
          <circle cx="16" cy="16" r="14.2" stroke="var(--teal)" stroke-width="1.6" />
          <circle cx="16" cy="16" r="8.4" fill="var(--amber-soft)" stroke="var(--amber)" stroke-width="1.6" />
          <circle cx="16" cy="16" r="3.6" fill="var(--ink)" />
          <circle cx="14.4" cy="14.4" r="1.1" fill="#fff" opacity="0.9" />
        </svg>
        <span class="font-display text-xl font-extrabold tracking-tight">pupila</span>
      </div>
      <h1 class="mb-6 text-2xl">Admin · Iniciar sesión</h1>
      @if (error() === 'forbidden') {
        <p role="alert" class="mb-4 text-sm text-destructive">Esta cuenta no tiene permisos de administrador.</p>
      }
      <form class="space-y-4" (submit)="submit($event)">
        <div>
          <label for="email" class="mb-1 block text-sm">Correo</label>
          <input id="email" type="email" autocomplete="email" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.email" />
        </div>
        <div>
          <label for="password" class="mb-1 block text-sm">Contraseña</label>
          <input id="password" type="password" autocomplete="current-password" class="w-full rounded-lg border border-input px-3 py-2" [formField]="model.password" />
        </div>
        @if (failed()) {
          <p role="alert" class="text-sm text-destructive">Correo o contraseña incorrectos.</p>
        }
        <button type="submit" class="w-full rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" [disabled]="busy()">
          Entrar
        </button>
      </form>
    </main>
  `,
})
export default class Login {
  /** ?error=forbidden, enlazado por withComponentInputBinding. */
  readonly error = input<string>();
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  private readonly state = signal({ email: '', password: '' });
  protected readonly model = form(this.state, (f) => {
    required(f.email);
    email(f.email);
    required(f.password);
  });

  protected async submit(event: Event) {
    event.preventDefault();
    if (this.model().invalid()) return;
    this.busy.set(true);
    this.failed.set(false);
    const { email, password } = this.state();
    const ok = await this.auth.signIn(email, password);
    this.busy.set(false);
    if (!ok) return this.failed.set(true);
    await this.router.navigateByUrl('/');
  }
}
