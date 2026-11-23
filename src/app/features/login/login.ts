import { Component, inject, input, signal } from '@angular/core';
import { form, FormField, required, email } from '@angular/forms/signals';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { t, TPipe } from '../../core/i18n';

@Component({
  selector: 'app-login',
  imports: [FormField, NgTemplateOutlet, TPipe],
  template: `
    <main class="grid min-h-dvh place-items-center px-4 py-8 lg:py-14">
      <div class="grid w-full max-w-5xl overflow-hidden rounded-3xl lg:grid-cols-2 lg:bg-card lg:shadow-lift-strong">
        <!-- Panel de marca (escritorio), igual que el acceso de lentes-web: marino con el iris recortado en la esquina. -->
        <aside class="relative hidden overflow-hidden bg-band p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div aria-hidden="true" class="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full border border-white/10">
            <div class="absolute inset-12 rounded-full border border-white/10"></div>
            <div class="absolute inset-28 rounded-full bg-blue-vivid/25 blur-2xl"></div>
          </div>
          <div class="flex items-center gap-2.5">
            <ng-container [ngTemplateOutlet]="logo" [ngTemplateOutletContext]="{ $implicit: 'size-10 brand-on-dark' }" />
            <span class="font-display text-2xl font-extrabold tracking-tight">{{ 'brand.wordmark' | t }}</span>
            <span class="rounded-full bg-white/10 px-2 py-0.5 text-[0.6875rem] font-semibold tracking-[0.06em] text-white/80 uppercase">{{ 'shell.adminTag' | t }}</span>
          </div>
          <div class="relative space-y-6">
            <p class="font-display text-3xl leading-tight font-bold text-balance">{{ 'login.shellTitle' | t }}</p>
            <ul class="space-y-3">
              @for (p of perks; track p.key) {
                <li class="flex items-center gap-3 text-white/85">
                  <span class="grid size-9 shrink-0 place-items-center rounded-full bg-white/10">
                    <svg viewBox="0 0 24 24" aria-hidden="true" class="size-4 text-mint" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="p.icon" /></svg>
                  </span>
                  {{ p.label }}
                </li>
              }
            </ul>
          </div>
        </aside>

        <div class="panel mx-auto w-full max-w-md p-6 sm:p-8 lg:rounded-none lg:bg-transparent lg:px-10 lg:py-14 lg:shadow-none">
          <div class="mb-8 flex items-center gap-2 lg:hidden">
            <ng-container [ngTemplateOutlet]="logo" [ngTemplateOutletContext]="{ $implicit: 'size-8' }" />
            <span class="font-display text-xl font-extrabold tracking-tight">{{ 'brand.wordmark' | t }}</span>
            <span class="pill py-0.5 text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{{ 'shell.adminTag' | t }}</span>
          </div>
          <h1 class="text-3xl tracking-[-0.02em]">{{ 'login.title' | t }}</h1>
          <p class="mt-2 text-pretty text-muted-foreground">{{ 'login.subtitle' | t }}</p>
          @if (error() === 'forbidden') {
            <p role="alert" class="alert-error mt-6">{{ 'login.forbidden' | t }}</p>
          }
          <form class="mt-8 space-y-5" (submit)="submit($event)">
            <div>
              <label for="email" class="field-label">{{ 'login.email' | t }}</label>
              <input id="email" type="email" autocomplete="email" class="field min-h-12 w-full text-base" [formField]="model.email" />
            </div>
            <div>
              <label for="password" class="field-label">{{ 'login.password' | t }}</label>
              <div class="relative">
                <input id="password" [type]="shown() ? 'text' : 'password'" autocomplete="current-password" class="field min-h-12 w-full pr-12 text-base" [formField]="model.password" />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-xl text-muted-foreground hover:text-foreground"
                  [attr.aria-label]="(shown() ? 'login.hidePassword' : 'login.showPassword') | t"
                  [attr.aria-pressed]="shown()"
                  (click)="shown.set(!shown())"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" class="size-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                    <circle cx="12" cy="12" r="3" />
                    @if (shown()) { <path d="M4 4l16 16" /> }
                  </svg>
                </button>
              </div>
            </div>
            @if (failed()) {
              <p role="alert" class="alert-error">{{ 'login.failed' | t }}</p>
            }
            <button type="submit" class="btn btn-primary btn-lg w-full" [disabled]="busy()" [attr.aria-busy]="busy()">
              @if (busy()) {
                <span class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true"></span>
              }
              {{ 'login.submit' | t }}
            </button>
          </form>
        </div>
      </div>
    </main>

    <ng-template #logo let-cls>
      <svg viewBox="0 0 32 32" aria-hidden="true" class="shrink-0 {{ cls }}" fill="none">
        <circle cx="16" cy="16" r="14.2" stroke="var(--logo-ring)" stroke-width="1.6" />
        <circle cx="16" cy="16" r="8.4" fill="var(--logo-iris-soft)" stroke="var(--logo-iris)" stroke-width="1.6" />
        <circle cx="16" cy="16" r="3.6" fill="var(--logo-pupil)" />
        <circle cx="14.4" cy="14.4" r="1.1" fill="#fff" opacity="0.9" />
      </svg>
    </ng-template>
  `,
  styles: `
    /* Sobre marino, el logo usa sus tonos de tema oscuro, igual que en la barra lateral. */
    .brand-on-dark {
      --logo-ring: #43c3d2;
      --logo-iris: #f0b85a;
      --logo-iris-soft: #3a2c15;
      --logo-pupil: #e4edf0;
    }
  `,
})
export default class Login {
  /** ?error=forbidden, enlazado por withComponentInputBinding. */
  readonly error = input<string>();
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly shown = signal(false);
  // Íconos de línea 1.6 en retícula de 24, los mismos del menú lateral.
  protected readonly perks = [
    { key: 'orders', label: t('login.perks.orders'), icon: 'M5 8h14l-1.2 12H6.2zM9 8V6.5a3 3 0 0 1 6 0V8' },
    { key: 'prescriptions', label: t('login.perks.prescriptions'), icon: 'M7 3h7l4 4v14H7zM14 3v4h4M10 14.5l1.8 1.8 3.2-3.8' },
    { key: 'catalog', label: t('login.perks.catalog'), icon: 'M3.5 12.5V4h8.5l8.5 8.5-8 8zM8 8.5h.01' },
    { key: 'store', label: t('login.perks.store'), icon: 'M4 10 5.5 4h13L20 10M4 10v10h16V10M4 10h16M10 20v-5h4v5' },
  ];

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
