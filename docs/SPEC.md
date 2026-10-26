# Ecommerce de lentes de contacto — Especificación técnica

25 oct 2026 · Victor

## Resumen

Tienda en línea de lentes de contacto para México: backend en Go con PostgreSQL, frontend en Next.js 16, Cloudflare como capa de borde y servicios externos en plan gratuito mientras se pueda. El costo fijo estimado para producción es de unos 5 USD al mes más el dominio.

Qué vende: lentes de contacto con graduación (esfera, cilindro, eje, adición, curva base, diámetro), con receta del cliente y recompra periódica según la duración del lente.

Cómo usar este documento con Claude Code:

1. Crea dos repositorios separados: `lentes-api` (Go) y `lentes-web` (Next.js). No es monorepo.
2. Copia este documento como `docs/SPEC.md` en cada repo.
3. Abre Claude Code en el repo y usa el prompt inicial de la última sección. Trabaja una fase a la vez.
4. El contrato entre los dos repos es `openapi.yaml`, que vive en `lentes-api` y se copia o descarga en `lentes-web` para generar el cliente tipado.

## Stack

Cada pieza tiene una sola responsabilidad; la lógica de negocio vive solo en el backend en Go.

| Capa | Tecnología | Función |
|---|---|---|
| Dominio y DNS | Cloudflare Registrar o Namecheap (DNS siempre en Cloudflare) | tutienda.com y api.tutienda.com |
| Borde | Cloudflare (proxy, WAF, DDoS, caché, Turnstile) | Protege y acelera web y API |
| Frontend | Next.js 16, Tailwind CSS, shadcn/ui en Cloudflare Workers | Tienda, checkout, cuenta del cliente |
| Backend | Go 1.2x, chi, pgx v5, sqlc, goose, oapi-codegen en Railway | API REST, reglas de negocio, webhooks, tareas programadas |
| Base de datos | PostgreSQL de Supabase | Catálogo, inventario, pedidos, recetas |
| Autenticación | Supabase Auth (JWT con JWKS) | Registro, login, Google, recuperación de contraseña |
| Archivos | Cloudflare R2 (API S3) | Fotos de producto y archivos de recetas |
| Pagos | Mercado Pago (SDK oficial github.com/mercadopago/sdk-go) | Cobro con tarjeta, OXXO, SPEI; webhooks |
| Correos | Resend + React Email | Confirmación, envío, "se te acaban tus lentes" |
| Errores | Sentry (Go y Next.js) | Excepciones y trazas |
| Analítica | PostHog | Embudo de compra, eventos, grabaciones de sesión |

Decisión clave: Supabase aporta Auth y la base de datos PostgreSQL en un solo proyecto gratuito. El backend en Go se conecta a esa base con pgx y valida los JWT de Supabase; el frontend nunca escribe directo en la base.

## Infraestructura

El cliente entra a tutienda.com; Cloudflare filtra el tráfico, sirve el frontend y reenvía las llamadas de api.tutienda.com al servidor en Go. Solo la API en Go escribe en la base y habla con los servicios externos.

| Componente | Qué hace | Por qué así |
|---|---|---|
| Cloudflare DNS y proxy | Resuelve el dominio, aplica WAF y protección DDoS, cachea el catálogo | Gratis y protege la API en Railway sin exponer su URL original |
| Next.js en Workers | Renderiza la tienda en servidor (SEO) y la interfaz | Cerca del cliente, sin servidor que administrar |
| Turnstile | Reto invisible contra bots en registro, login y checkout | Gratis; Go valida cada token |
| R2 | Bucket público para fotos (img.tutienda.com) y bucket privado para recetas | Sin costo de salida; el navegador sube directo con URL prefirmada |
| API en Go (Railway) | Catálogo, carrito, checkout, pedidos, recetas, webhooks, recordatorios | Binario pequeño, poca RAM, despliegue con Dockerfile |
| Supabase | PostgreSQL + Auth | Un solo servicio gratuito para datos y login |
| Mercado Pago | Cobro y notificación de pagos | Métodos de pago locales en México |
| Resend | Correos transaccionales | 3,000 correos gratis al mes |
| Sentry y PostHog | Errores y analítica en web y API | Planes gratuitos amplios |

El login es la única excepción a "todo pasa por Go": el navegador habla directo con Supabase Auth para iniciar sesión y Go solo valida el token resultante.

## Flujos clave

### Login con Supabase

1. El frontend usa `@supabase/ssr` para registro, login (correo + contraseña y Google) y renovación de sesión.
2. Cada llamada a la API manda `Authorization: Bearer <access_token>`.
3. Go valida el JWT localmente con las claves públicas de `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` (librería `github.com/MicahParks/keyfunc/v3` + `golang-jwt/jwt/v5`), con caché y refresco de claves.
4. Go verifica `iss`, `aud = authenticated` y `exp`, y usa `sub` como `user_id`.
5. Al primer request de un usuario, Go crea su fila en `customers` (upsert por `user_id`).
6. Roles: `app_metadata.role = admin` en Supabase para el panel de administración. Nunca usar `user_metadata` para permisos.

### Compra con Mercado Pago (Checkout Pro)

1. El cliente arma el carrito; para cada ojo elige graduación válida para ese modelo.
2. `POST /v1/checkout`: Go valida precios y stock en la base (nunca confía en precios del frontend), aparta inventario 15 minutos y crea el pedido en estado `pending_payment`.
3. Go crea una preferencia de pago en Mercado Pago con `external_reference = order_id` y `notification_url = https://api.tutienda.com/v1/webhooks/mercadopago`, y devuelve el `init_point`.
4. El cliente paga en Mercado Pago y regresa a `/checkout/resultado`.
5. Mercado Pago llama al webhook. Go valida la firma `x-signature` con el secreto del webhook, consulta el pago a la API de Mercado Pago (nunca confía en el cuerpo del webhook) y actualiza el pedido a `paid`.
6. Webhook idempotente: tabla `payment_events` con el id del evento como llave única.
7. Al pasar a `paid`: descuenta inventario de forma definitiva, envía correo de confirmación (Resend) y registra el evento `order_paid` en PostHog.
8. Una tarea cada 5 minutos libera el stock apartado de pedidos sin pagar vencidos.

### Recompra ("se te acaban tus lentes")

1. Al pagarse un pedido, Go calcula `estimated_run_out_at` según duración del lente (diario, quincenal, mensual) y cantidad de piezas.
2. Tarea diaria en Go: busca pedidos con `estimated_run_out_at` dentro de 7 días y sin recordatorio enviado.
3. Envía el correo con un enlace a `/recompra/<order_id>` que precarga el mismo carrito.
4. Marca `reminder_sent_at` para no repetir.

### Receta

1. El cliente sube foto o PDF de su receta: Go genera una URL prefirmada de R2 (subida directa desde el navegador, 10 minutos de vigencia, máximo 10 MB).
2. El bucket de recetas es privado; solo se lee con URLs prefirmadas de corta duración generadas por Go para el dueño o un admin.
3. Un admin revisa y marca la receta como `approved` o `rejected`. Validar con un abogado qué exige la regulación mexicana para vender lentes con graduación.

## Backend en Go (lentes-api)

Un solo binario con dos modos: `api` (servidor HTTP) y `worker` (tareas programadas). Arquitectura por capas: handler → service → repository (sqlc).

```
lentes-api/
├── cmd/
│   ├── api/main.go          # servidor HTTP
│   └── worker/main.go       # tareas programadas (recompra, liberar stock)
├── api/openapi.yaml         # contrato de la API (fuente de verdad)
├── internal/
│   ├── config/              # carga de variables de entorno
│   ├── http/
│   │   ├── router.go        # chi + middlewares
│   │   ├── middleware/      # auth JWT, CORS, request-id, logging, recover, rate limit
│   │   └── handlers/        # products, cart, checkout, orders, prescriptions, admin, webhooks
│   ├── service/             # reglas de negocio
│   ├── repository/          # código generado por sqlc + transacciones
│   ├── auth/                # validación JWT de Supabase (JWKS)
│   ├── payments/            # cliente Mercado Pago + validación de firma
│   ├── storage/             # R2 (aws-sdk-go-v2, URLs prefirmadas)
│   ├── email/               # cliente Resend
│   ├── analytics/           # cliente PostHog (posthog-go)
│   └── domain/              # tipos y errores del dominio
├── db/
│   ├── migrations/          # goose: 0001_init.sql, ...
│   ├── queries/             # SQL para sqlc
│   └── seed/                # datos de prueba
├── sqlc.yaml
├── Dockerfile               # multi-stage, imagen final distroless
├── Makefile                 # run, test, sqlc, migrate, lint
└── .env.example
```

Librerías:

| Uso | Librería |
|---|---|
| Router | github.com/go-chi/chi/v5 |
| PostgreSQL | github.com/jackc/pgx/v5 (pgxpool) |
| Consultas tipadas | sqlc |
| Migraciones | github.com/pressly/goose/v3 |
| OpenAPI | oapi-codegen (genera tipos e interfaz strict server) |
| JWT | golang-jwt/jwt/v5 + MicahParks/keyfunc/v3 |
| Pagos | github.com/mercadopago/sdk-go |
| R2 | aws-sdk-go-v2 (s3 + presign) |
| Correos | github.com/resend/resend-go |
| Errores | github.com/getsentry/sentry-go |
| Analítica | github.com/posthog/posthog-go |
| Logs | log/slog (JSON) |
| Validación | go-playground/validator/v10 |
| Pruebas | testing + testcontainers-go (Postgres real) |

Convenciones:

- Dinero en centavos `BIGINT` (MXN), nunca float.
- Errores de la API con formato RFC 9457 (`application/problem+json`).
- Todas las rutas bajo `/v1`. Paginación por cursor.
- Transacciones con `pgx.BeginFunc` para checkout e inventario; `SELECT ... FOR UPDATE` al apartar stock.
- Conexión a Supabase: usar el pooler en modo sesión (puerto 5432) desde Railway. Si se usa el modo transacción (puerto 6543), configurar pgx con `QueryExecModeSimpleProtocol` porque no admite sentencias preparadas.
- Endpoint `GET /healthz` para Railway.
- Cierre ordenado con `signal.NotifyContext`.

## Modelo de datos (PostgreSQL)

Un producto es un modelo de lente; cada combinación de parámetros vendible es una variante (SKU) con su propio stock. Las tablas viven en el esquema `shop`, separado del esquema `auth` de Supabase.

```sql
CREATE SCHEMA shop;

-- Catálogo
CREATE TABLE shop.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE
);

CREATE TYPE shop.lens_type AS ENUM ('spherical','toric','multifocal','cosmetic');
CREATE TYPE shop.replacement AS ENUM ('daily','biweekly','monthly','quarterly','yearly');

CREATE TABLE shop.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES shop.brands(id),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  lens_type shop.lens_type NOT NULL,
  replacement shop.replacement NOT NULL,
  pieces_per_box int NOT NULL,          -- ej. 30 diarios, 6 mensuales
  material text,
  water_content_pct numeric(4,1),
  requires_prescription boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shop.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES shop.products(id) ON DELETE CASCADE,
  r2_key text NOT NULL,
  position int NOT NULL DEFAULT 0
);

-- Variante = combinación exacta de parámetros (SKU)
CREATE TABLE shop.variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES shop.products(id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE,
  sphere numeric(4,2),          -- -12.00 a +8.00, pasos de 0.25
  cylinder numeric(4,2),        -- tóricos
  axis smallint,                -- 0-180, tóricos
  addition text,                -- multifocales: LOW/MID/HIGH o +1.00...
  base_curve numeric(3,1) NOT NULL,
  diameter numeric(3,1) NOT NULL,
  color text,                   -- cosméticos
  price_cents bigint NOT NULL CHECK (price_cents > 0),
  compare_at_cents bigint,
  stock int NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reserved int NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  active boolean NOT NULL DEFAULT true,
  UNIQUE NULLS NOT DISTINCT (product_id, sphere, cylinder, axis, addition, base_curve, diameter, color)
);

-- Clientes (user_id = sub del JWT de Supabase)
CREATE TABLE shop.customers (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  phone text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shop.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES shop.customers(user_id) ON DELETE CASCADE,
  recipient text NOT NULL,
  street text NOT NULL, ext_number text NOT NULL, int_number text,
  neighborhood text NOT NULL, city text NOT NULL, state text NOT NULL,
  postal_code char(5) NOT NULL,
  phone text NOT NULL,
  is_default boolean NOT NULL DEFAULT false
);

-- Recetas
CREATE TYPE shop.rx_status AS ENUM ('pending','approved','rejected');
CREATE TABLE shop.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES shop.customers(user_id) ON DELETE CASCADE,
  r2_key text,
  od_sphere numeric(4,2), od_cylinder numeric(4,2), od_axis smallint, od_addition text,
  os_sphere numeric(4,2), os_cylinder numeric(4,2), os_axis smallint, os_addition text,
  base_curve numeric(3,1), diameter numeric(3,1),
  issued_at date, expires_at date,
  doctor_name text, doctor_license text,
  status shop.rx_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Carrito
CREATE TABLE shop.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES shop.customers(user_id) ON DELETE CASCADE,
  anonymous_token text UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TYPE shop.eye AS ENUM ('right','left','both');
CREATE TABLE shop.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES shop.carts(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES shop.variants(id),
  eye shop.eye NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0)
);

-- Pedidos
CREATE TYPE shop.order_status AS ENUM
  ('pending_payment','paid','preparing','shipped','delivered','cancelled','refunded','expired');
CREATE TABLE shop.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigserial UNIQUE,                 -- folio visible: LC-000123
  user_id uuid NOT NULL REFERENCES shop.customers(user_id),
  prescription_id uuid REFERENCES shop.prescriptions(id),
  status shop.order_status NOT NULL DEFAULT 'pending_payment',
  subtotal_cents bigint NOT NULL,
  shipping_cents bigint NOT NULL DEFAULT 0,
  discount_cents bigint NOT NULL DEFAULT 0,
  total_cents bigint NOT NULL,
  currency char(3) NOT NULL DEFAULT 'MXN',
  shipping_address jsonb NOT NULL,         -- copia inmutable de la dirección
  mp_preference_id text,
  mp_payment_id text,
  reserved_until timestamptz,
  tracking_carrier text, tracking_number text,
  estimated_run_out_at date,
  reminder_sent_at timestamptz,
  paid_at timestamptz, shipped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE shop.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES shop.orders(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES shop.variants(id),
  eye shop.eye NOT NULL,
  quantity int NOT NULL,
  unit_price_cents bigint NOT NULL,
  product_snapshot jsonb NOT NULL          -- nombre y parámetros al momento de la compra
);

-- Idempotencia de webhooks
CREATE TABLE shop.payment_events (
  id text PRIMARY KEY,                     -- id del evento de Mercado Pago
  order_id uuid REFERENCES shop.orders(id),
  type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON shop.variants (product_id) WHERE active;
CREATE INDEX ON shop.orders (user_id, created_at DESC);
CREATE INDEX ON shop.orders (estimated_run_out_at) WHERE reminder_sent_at IS NULL;
```

Notas: el stock disponible es `stock - reserved`. La API de datos de Supabase (PostgREST) no debe exponer el esquema `shop`; todo acceso pasa por Go.

## API REST

Todas las rutas bajo `https://api.tutienda.com/v1`. Auth: pública, cliente (JWT de Supabase) o admin (JWT con `app_metadata.role = admin`).

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | /products | pública | Catálogo con filtros (marca, tipo, reemplazo) y paginación |
| GET | /products/{slug} | pública | Detalle + parámetros disponibles (esferas, curvas, diámetros) |
| GET | /products/{slug}/variant | pública | Resuelve la variante por parámetros y devuelve precio y stock |
| GET | /brands | pública | Lista de marcas |
| GET | /cart | cliente o token anónimo | Carrito actual |
| POST | /cart/items | cliente o token anónimo | Agrega variante, ojo y cantidad |
| PATCH | /cart/items/{id} | cliente o token anónimo | Cambia cantidad |
| DELETE | /cart/items/{id} | cliente o token anónimo | Quita artículo |
| POST | /cart/merge | cliente | Une el carrito anónimo al iniciar sesión |
| GET | /me | cliente | Perfil |
| PUT | /me | cliente | Actualiza perfil |
| GET/POST/PUT/DELETE | /me/addresses | cliente | Direcciones |
| POST | /me/prescriptions/upload-url | cliente | URL prefirmada de R2 para subir receta |
| POST | /me/prescriptions | cliente | Registra receta con sus valores |
| GET | /me/prescriptions | cliente | Recetas del cliente |
| POST | /checkout | cliente | Valida, aparta stock, crea pedido y preferencia de Mercado Pago |
| GET | /me/orders | cliente | Historial |
| GET | /me/orders/{id} | cliente | Detalle y estado |
| POST | /me/orders/{id}/reorder | cliente | Copia el pedido al carrito |
| POST | /webhooks/mercadopago | firma x-signature | Notificaciones de pago |
| GET | /admin/orders | admin | Pedidos con filtros por estado |
| PATCH | /admin/orders/{id} | admin | Cambia estado y guía de envío |
| CRUD | /admin/products, /admin/variants | admin | Catálogo; incluye carga masiva de variantes por CSV |
| POST | /admin/uploads/image-url | admin | URL prefirmada para fotos de producto |
| GET | /admin/prescriptions | admin | Recetas pendientes de revisión |
| PATCH | /admin/prescriptions/{id} | admin | Aprueba o rechaza |
| GET | /healthz | pública | Salud del servicio |

Caché en Cloudflare: solo `GET /products*` y `GET /brands` con `Cache-Control: public, s-maxage=300`. Todo lo demás con `Cache-Control: no-store`.

## Frontend en Next.js 16 (lentes-web)

El frontend solo muestra datos y llama a la API en Go; no tiene base de datos propia ni lógica de precios. Se despliega en Cloudflare Workers (Cloudflare recomienda vinext para proyectos Next.js nuevos; OpenNext es la alternativa).

```
lentes-web/
├── app/
│   ├── (tienda)/
│   │   ├── page.tsx                    # inicio
│   │   ├── lentes/page.tsx             # catálogo con filtros
│   │   ├── lentes/[slug]/page.tsx      # producto + selector de graduación por ojo
│   │   ├── marcas/[slug]/page.tsx
│   │   ├── carrito/page.tsx
│   │   ├── checkout/page.tsx
│   │   └── checkout/resultado/page.tsx # regreso de Mercado Pago
│   ├── (cuenta)/cuenta/
│   │   ├── page.tsx, pedidos/, recetas/, direcciones/
│   ├── (auth)/login, registro, recuperar/
│   ├── auth/callback/route.ts          # OAuth de Supabase
│   ├── admin/                          # pedidos, productos, variantes, recetas
│   ├── recompra/[orderId]/page.tsx
│   ├── sitemap.ts, robots.ts
│   └── layout.tsx
├── components/ui/                      # shadcn/ui
├── components/tienda/                  # ProductCard, RxSelector, CartDrawer...
├── lib/api/                            # cliente generado desde openapi.yaml (orval)
├── lib/supabase/                       # client.ts, server.ts (@supabase/ssr)
├── emails/                             # plantillas React Email
├── instrumentation.ts                  # Sentry
└── wrangler.jsonc
```

Detalles importantes:

- Selector de graduación (`RxSelector`): un bloque por ojo (OD/OI), cada campo con solo los valores que existen para ese modelo; botón "misma graduación en ambos ojos".
- SEO: páginas de producto y catálogo renderizadas en servidor, metadatos por producto, datos estructurados `Product` (JSON-LD), sitemap.
- Cliente de API: orval genera hooks y tipos desde `openapi.yaml`; TanStack Query para caché en el navegador.
- Formularios: react-hook-form + zod.
- Turnstile: en registro, login y checkout; el token se envía a Go, que lo valida con la API de Cloudflare.
- Imágenes: servidas desde un dominio público de R2 (img.tutienda.com), con caché de Cloudflare.
- PostHog: `posthog-js` con eventos `product_viewed`, `add_to_cart`, `checkout_started`; `order_paid` se envía desde Go.
- Sentry: `@sentry/nextjs`.

Plantillas de correo (React Email): se diseñan en `lentes-web/emails/`, se exportan a HTML con `email export` y Go las rellena con `html/template` antes de enviarlas por Resend. Plantillas: confirmación de pedido, pedido enviado, receta aprobada/rechazada y recordatorio de recompra.

## Variables de entorno

Ningún secreto va en el repositorio; solo `.env.example` con valores vacíos. En producción viven en Railway (API) y en los secretos del Worker (web).

`lentes-api` (Railway):

```
APP_ENV=production
PORT=8080
PUBLIC_WEB_URL=https://tutienda.com
CORS_ALLOWED_ORIGINS=https://tutienda.com

DATABASE_URL=postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres?sslmode=require
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_JWKS_URL=https://<ref>.supabase.co/auth/v1/.well-known/jwks.json

MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_PUBLIC=lentes-img
R2_BUCKET_PRIVATE=lentes-recetas
R2_PUBLIC_BASE_URL=https://img.tutienda.com

RESEND_API_KEY=
EMAIL_FROM="Tu Tienda <pedidos@tutienda.com>"

TURNSTILE_SECRET_KEY=
SENTRY_DSN=
POSTHOG_API_KEY=
POSTHOG_HOST=https://us.i.posthog.com
```

`lentes-web` (Cloudflare Workers):

```
NEXT_PUBLIC_API_URL=https://api.tutienda.com/v1
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
NEXT_PUBLIC_MP_PUBLIC_KEY=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_IMG_URL=https://img.tutienda.com
```

Usa credenciales de prueba de Mercado Pago y un proyecto de Supabase separado para desarrollo.

## Planes gratuitos y costo real

Todo puede arrancar gratis excepto el servidor de Go: Railway regala solo 1 USD de crédito al mes, insuficiente para una API encendida 24/7, así que producción requiere el plan Hobby de 5 USD/mes. Costo fijo estimado: 5 USD/mes + dominio (aprox. 10–15 USD/año para un .com).

| Servicio | Plan | Lo que incluye gratis | Límite a vigilar |
|---|---|---|---|
| Railway | Hobby 5 USD/mes | Prueba de 5 USD única; después plan Free con 1 USD/mes | El plan Free no alcanza para producción |
| Supabase | Free | 500 MB de base de datos, 50,000 usuarios activos/mes, 2 proyectos | Pausa tras 1 semana sin actividad (una tienda activa no se pausa) |
| Cloudflare Workers | Free | 100,000 solicitudes/día; archivos estáticos ilimitados | 10 ms de CPU por solicitud; si Next.js lo rebasa, Workers Paid cuesta 5 USD/mes |
| Cloudflare R2 | Free | 10 GB, 1 M escrituras y 10 M lecturas al mes, salida gratis | Suficiente para miles de fotos y recetas |
| Resend | Free | 3,000 correos/mes | Máximo 100 por día; 1 dominio |
| Sentry | Developer | 5,000 errores/mes, 1 usuario | Alertas solo por correo |
| PostHog | Free | 1 M eventos/mes, 5,000 grabaciones de sesión | Fija un límite de gasto en 0 |
| Mercado Pago | Sin mensualidad | — | Comisión por cada venta |

Cuándo pagar: Supabase Pro (25 USD/mes) cuando la base pase de 400 MB o quieras respaldos diarios; Resend Pro (20 USD/mes) cuando pases de 100 correos al día.

Cifras verificadas en octubre de 2026; revisa las páginas de precios antes de lanzar.

## Plan de trabajo con Claude Code

Cada fase termina con pruebas pasando y algo desplegado; no se empieza la siguiente sin cerrar la anterior.

- [ ] Fase 0 — Cuentas: dominio, Cloudflare (DNS), Supabase (dev y prod), Railway, R2 (2 buckets), Resend (verificar dominio), Mercado Pago (credenciales de prueba), Sentry, PostHog.
- [ ] Fase 1 — Base del backend: estructura de carpetas, config, chi, /healthz, Dockerfile, migración inicial con goose, sqlc, openapi.yaml inicial, deploy en Railway con api.tutienda.com.
- [ ] Fase 2 — Catálogo: endpoints de productos, marcas y variantes; seed con 3 marcas y modelos reales; carga masiva de variantes por CSV.
- [ ] Fase 3 — Auth: middleware JWT con JWKS de Supabase, customers, /me, direcciones, rol admin.
- [ ] Fase 4 — Frontend base: Next.js 16 + Tailwind + shadcn/ui, cliente orval, catálogo, página de producto con RxSelector, login con Supabase, deploy en Cloudflare.
- [ ] Fase 5 — Carrito y checkout: carrito anónimo y con sesión, apartado de stock, pedido, Mercado Pago Checkout Pro, webhook con firma e idempotencia.
- [ ] Fase 6 — Recetas: subida a R2 con URL prefirmada, revisión en admin.
- [ ] Fase 7 — Correos y recompra: plantillas React Email, Resend, worker de recordatorios.
- [ ] Fase 8 — Observabilidad y seguridad: Sentry, PostHog, Turnstile, reglas WAF y rate limit en Cloudflare, revisión de CORS y headers.
- [ ] Fase 9 — Panel admin y lanzamiento: pedidos, guías de envío, inventario; pruebas de compra completas en modo prueba y luego en producción.

### Prompt inicial para Claude Code (repo lentes-api)

```
Lee docs/SPEC.md completo. Es la especificación del backend de un ecommerce
de lentes de contacto en Go 1.2x con chi, pgx v5, sqlc, goose y oapi-codegen,
usando PostgreSQL de Supabase y desplegado en Railway.

Trabaja solo en la Fase 1 del plan:
1. Crea la estructura de carpetas exacta de la sección "Backend en Go".
2. Configuración desde variables de entorno con validación al arrancar.
3. Router chi con middlewares: request-id, logging slog JSON, recover, CORS.
4. GET /healthz que verifique la conexión a la base.
5. Migración 0001_init.sql con el esquema de "Modelo de datos".
6. sqlc.yaml y consultas básicas de productos.
7. api/openapi.yaml con /healthz y /products.
8. Dockerfile multi-stage (imagen final distroless) y Makefile.
9. Pruebas con testcontainers-go para el repositorio de productos.

Antes de escribir código, muéstrame un plan breve y espera mi confirmación.
No agregues dependencias fuera de las listadas sin preguntarme.
Dinero siempre en centavos (int64). Nunca hardcodees secretos.
```

### Prompt inicial para Claude Code (repo lentes-web)

```
Lee docs/SPEC.md completo. Es el frontend de un ecommerce de lentes de
contacto en Next.js 16 + Tailwind CSS + shadcn/ui, desplegado en Cloudflare
Workers. La API es un backend en Go separado; su contrato está en openapi.yaml.

Trabaja solo en la Fase 4: estructura de carpetas, cliente orval generado
desde openapi.yaml, catálogo, página de producto con RxSelector (graduación
por ojo) y login con @supabase/ssr. El frontend no calcula precios ni accede
a la base de datos. Muéstrame un plan breve antes de escribir código.
```
