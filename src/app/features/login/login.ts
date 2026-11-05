import { Component, inject, input, signal } from '@angular/core';
import { form, FormField, required, email } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { TPipe } from '../../core/i18n';

@Component({
  selector: 'app-login',
  imports: [FormField, TPipe],
  template: `
    <div class="bg-band text-white">
      <p class="container-page flex min-h-10 items-center justify-center py-1 text-sm font-medium">{{ 'shell.band' | t }}</p>
    </div>
    <main class="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-sm flex-col justify-center px-4 py-10">
      <div class="panel p-6 shadow-[0_8px_32px_rgb(14_34_48/0.08)] sm:p-8">
        <div class="mb-6 flex items-center gap-2">
          <svg viewBox="0 0 32 32" aria-hidden="true" class="size-7" fill="none">
            <circle cx="16" cy="16" r="14.2" stroke="var(--teal)" stroke-width="1.6" />
            <circle cx="16" cy="16" r="8.4" fill="var(--amber-soft)" stroke="var(--amber)" stroke-width="1.6" />
            <circle cx="16" cy="16" r="3.6" fill="var(--ink)" />
            <circle cx="14.4" cy="14.4" r="1.1" fill="#fff" opacity="0.9" />
          </svg>
          <span class="font-display text-xl font-extrabold tracking-tight">{{ 'brand.wordmark' | t }}</span>
        </div>
        <h1 class="mb-6 text-2xl">{{ 'login.title' | t }}</h1>
        @if (error() === 'forbidden') {
          <p role="alert" class="alert-error mb-4">{{ 'login.forbidden' | t }}</p>
        }
        <form class="space-y-4" (submit)="submit($event)">
          <div>
            <label for="email" class="field-label">{{ 'login.email' | t }}</label>
            <input id="email" type="email" autocomplete="email" class="field w-full" [formField]="model.email" />
          </div>
          <div>
            <label for="password" class="field-label">{{ 'login.password' | t }}</label>
            <input id="password" type="password" autocomplete="current-password" class="field w-full" [formField]="model.password" />
          </div>
          @if (failed()) {
            <p role="alert" class="alert-error">{{ 'login.failed' | t }}</p>
          }
          <button type="submit" class="btn btn-primary w-full" [disabled]="busy()">
            {{ 'login.submit' | t }}
          </button>
        </form>
      </div>
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
