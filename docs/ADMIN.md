# lentes-admin — decisiones de administración

Panel interno para operar la tienda. Es un repositorio aparte de `lentes-web` y `lentes-api` (no monorepo).
Aquí se registran todas las decisiones de administración; `docs/SPEC.md` es la especificación general del proyecto.

## Stack

| Pieza | Elección | Motivo |
|---|---|---|
| Framework | Angular 22 (standalone, zoneless, signals, Signal Forms) | Panel con muchos formularios y tablas; el equipo lo separó de la tienda |
| Estilos | Tailwind CSS v4 | Mismo sistema de utilidades que `lentes-web` |
| Cliente API | orval (`client: angular`) generado desde `openapi/openapi.yaml` | Mismo enfoque que `lentes-web`; tipos y servicio `DefaultService` |
| Auth | Supabase Auth (`@supabase/supabase-js`) | La misma cuenta/JWT que valida la API |
| Pruebas | Vitest (`ng test`) | Viene con Angular 22 |

Sin SSR: es un SPA interno, no necesita SEO.

## Contrato con la API

- Fuente de verdad: `lentes-api/api/openapi.yaml`. Se copia a `openapi/openapi.yaml` con `pnpm api:sync` (copia y regenera).
- Las rutas generadas son relativas (`/v1/...`); `core/api.interceptor.ts` antepone `environment.apiUrl` y el `Authorization: Bearer`.
- La API responde errores como RFC 9457 (`application/problem+json`); `core/problem.ts` los convierte en mensajes.
- Dinero siempre en centavos (entero). El panel captura pesos y convierte con `core/money.ts`; nunca guarda floats.

## Autenticación y roles

- Login con correo y contraseña contra Supabase.
- Solo entra quien tenga `app_metadata.role = admin` (`core/guards.ts`). **Nunca** `user_metadata`: el propio usuario puede editarlo.
- El guard es comodidad de interfaz. La seguridad real es la API, que exige el rol en cada ruta `/v1/admin/*` (responde 403 si no).
- Asignar el rol: en Supabase, editar `raw_app_meta_data` del usuario con `{"role": "admin"}` (solo desde el panel de Supabase o SQL con service role; no hay autoservicio).
- Recomendado en producción: poner el panel detrás de **Cloudflare Access** además del login (segunda capa, sin código).

## Alcance por fases

| Fase | Contenido | Estado | Depende de la API |
|---|---|---|---|
| A1 | Marcas, productos, variantes (precio, existencia, activo), carga masiva por CSV | Hecha | Existe (`/v1/admin/brands`, `products`, `variants`, `variants/import`) |
| A2 | Pedidos: lista con filtro por estado, detalle, cambio de estado, guía de envío (paquetería + número) | Pendiente | Falta `GET /v1/admin/orders`, `PATCH /v1/admin/orders/{id}` |
| A3 | Recetas: cola de pendientes, ver archivo (URL prefirmada de R2), aprobar/rechazar con motivo | Pendiente | Faltan `GET /v1/admin/prescriptions`, `PATCH /v1/admin/prescriptions/{id}` |
| A4 | Subida de fotos de producto a R2 y orden de galería | Pendiente | Falta `POST /v1/admin/uploads/image-url` |
| A5 | Inventario: ajustes con motivo, historial, alertas de stock bajo; reportes de ventas y recompra | Pendiente | Por definir |

Una fase no empieza hasta que su endpoint exista en `lentes-api/api/openapi.yaml`.

## Decisiones tomadas

1. **El admin salió de `lentes-web`.** Se eliminaron `app/admin` y la revisión de recetas de la tienda. La tienda solo tiene cliente final.
2. **Existencia visible como `stock`, `reserved` y disponible.** `reserved` es lo apartado por pedidos sin pagar (15 min); el panel lo muestra pero no se edita.
3. **Retirar = `active=false`**, no borrar. Preserva historial de pedidos (`order_items` referencia variantes).
4. **CSV todo o nada:** si una fila falla no se aplica nada y se muestran los errores por fila. Un archivo, máx. 5 MB / 5,000 filas.
5. **Slug automático** a partir del nombre al crear; al editar no cambia (rompería URLs e indexación).
6. **Sin datos de recetas en analítica ni en logs del panel.** Las recetas son datos de salud; se ven solo en la pantalla de revisión (fase A3).

## Pendientes de decisión (necesitan tu confirmación)

- Reglas para **aprobar/rechazar recetas** (qué valida el revisor, vigencia máxima, si exige cédula) — validar con el abogado, según el SPEC.
- **Quién puede qué:** hoy un solo rol `admin`. ¿Hace falta separar `operador` (pedidos/envíos) de `catalogo`?
- **Reembolsos y cancelaciones:** ¿se hacen desde el panel (llamando a Mercado Pago vía API) o directo en Mercado Pago?
- **Paqueterías** soportadas y si se genera la guía desde el panel o se captura a mano.
- **Auditoría:** registrar quién cambió qué (precio, stock, estado de pedido). Recomendado desde A2.

## Entornos

`src/environments/environment.development.ts` (local) y `environment.ts` (producción). Todos los valores son públicos
(la *publishable key* de Supabase no es un secreto). No se guarda ningún secreto en este repo.

| Valor | Local | Producción |
|---|---|---|
| `apiUrl` | `http://localhost:8080` | `https://api.tutienda.com` |
| `supabaseUrl` / `supabaseKey` | proyecto de **desarrollo** | proyecto de producción |

La API debe permitir el origen del panel en `CORS_ALLOWED_ORIGINS` (p. ej. `https://admin.tutienda.com` y `http://localhost:4301` en local).

## Comandos

```bash
pnpm install
pnpm start            # ng serve (usa --port si 4200 está ocupado)
pnpm test             # ng test (Vitest)
pnpm build            # dist/lentes-admin/browser
pnpm api:sync         # copia ../lentes-api/api/openapi.yaml y regenera el cliente
```

## Despliegue sugerido

Archivos estáticos (`dist/lentes-admin/browser`) en Cloudflare Workers/Pages en `admin.tutienda.com`, con fallback a `index.html`
para las rutas del SPA y Cloudflare Access delante. Sin servidor propio.
