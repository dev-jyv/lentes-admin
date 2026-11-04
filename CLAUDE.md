# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Admin panel (internal SPA, no SSR) for a contact-lens store. Angular 22, zoneless, Tailwind v4, Vitest, pnpm. UI text and docs are in Spanish. Decisions live in `docs/ADMIN.md` (phases A1–A5, status); general spec in `docs/SPEC.md`. Sibling repos `lentes-api` and `lentes-web` are separate (not a monorepo).

## Commands

- `pnpm start --port 4301` — dev server (uses `environment.development.ts`)
- `pnpm build` / `pnpm test` (Vitest via `ng test`)
- Single test: `pnpm test --include src/app/core/money.spec.ts`
- `pnpm api:gen` — regenerate API clients with orval; `pnpm api:sync` — first copies `../lentes-api/api/openapi.yaml` into `openapi/openapi.yaml`

## Architecture

- **Generated API client** (`orval.config.ts`, `clean: true`, so never hand-edit): `src/app/api/generated` from `openapi/openapi.yaml` (copy of `lentes-api`'s contract, the source of truth; `pnpm api:sync`). The API has no tags, so every operation lives on `DefaultService`.
- **`core/api.interceptor.ts`**: generated URLs are relative (`/v1/...`). Interceptor prefixes `environment.apiUrl` and adds the Supabase Bearer.
- **Auth** (`core/auth.service.ts`, `core/guards.ts`): Supabase session in signals; admin only if `app_metadata.role === 'admin'` (never `user_metadata`). Guard is UX only; API enforces 403. Empty `supabaseUrl` makes app open at `/login` instead of crashing. Supabase URL/key are blank in `environment*.ts`; fill locally, no secrets in repo.
- **Routing**: all feature routes lazy-load default-exported components under `features/<area>/`, nested in `layout/shell` behind `adminGuard` (`app.routes.ts`).
- **Texts (`core/i18n.ts`, `src/i18n/es-MX.json`)**: all static UI text lives in the JSON and is read through i18next, the same library as `lentes-web`. In templates use the pipe `{{ 'key' | t: { value } }}` (import `TPipe`); in TypeScript use `t('key')`.
- **`core/`** holds pure helpers with specs: `money.ts` (money is integer cents; UI captures pesos, convert here, never floats), `problem.ts` (RFC 9457 `problem+json` errors to messages), `order-flow.ts` (allowed order status transitions), `stock.ts`, `slug.ts`, etc.

## Code Style and Angular Rules

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection
