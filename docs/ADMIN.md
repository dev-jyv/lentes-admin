# lentes-admin — decisiones de administración

Panel interno para operar la tienda. Es un repositorio aparte de `lentes-web` y `lentes-api` (no monorepo).
Aquí se registran todas las decisiones de administración; `docs/SPEC.md` es la especificación general del proyecto.

## Stack

| Pieza | Elección | Motivo |
|---|---|---|
| Framework | Angular 22 (standalone, zoneless, signals, Signal Forms) | Panel con muchos formularios y tablas; el equipo lo separó de la tienda |
| Estilos | Tailwind CSS v4 | Mismo sistema de utilidades que `lentes-web` |
| Cliente API | orval (`client: angular`) generado desde `openapi/openapi.yaml` | Mismo enfoque que `lentes-web`; tipos y servicio `DefaultService` |
| Auth | Endpoints `/v1/auth/*` de la API (que habla con Supabase Auth) | El panel no conoce Supabase; la misma cuenta/JWT que valida la API |
| Pruebas | Vitest (`ng test`) | Viene con Angular 22 |

Sin SSR: es un SPA interno, no necesita SEO.

## Contrato con la API

- Fuente de verdad: `lentes-api/api/openapi.yaml`. Se copia a `openapi/openapi.yaml` con `pnpm api:sync` (copia y regenera).
- Las rutas generadas son relativas (`/v1/...`); `core/api.interceptor.ts` antepone `environment.apiUrl` y el `Authorization: Bearer`.
- La API responde errores como RFC 9457 (`application/problem+json`); `core/problem.ts` los convierte en mensajes.
- Dinero siempre en centavos (entero). El panel captura pesos y convierte con `core/money.ts`; nunca guarda floats.

## Autenticación y roles

- Login con correo y contraseña contra la API (`POST /v1/auth/login`); la API es la única que habla con Supabase Auth.
- El access token vive solo en memoria y se manda como Bearer. El refresh token es una cookie httpOnly de la API
  (`lentes_rt`, `SameSite=None; Secure`, `Path=/v1/auth`): al recargar, el panel restaura la sesión con `POST /v1/auth/refresh`
  y la renueva un minuto antes de que venza. Cerrar sesión (`POST /v1/auth/logout`) revoca el token y borra la cookie.
- Solo entra quien tenga `app_metadata.role = admin` (`core/guards.ts`). **Nunca** `user_metadata`: el propio usuario puede editarlo.
- El guard es comodidad de interfaz. La seguridad real es la API, que exige el rol en cada ruta `/v1/admin/*` (responde 403 si no).
- Asignar el rol: en Supabase, editar `raw_app_meta_data` del usuario con `{"role": "admin"}` (solo desde el panel de Supabase o SQL con service role; no hay autoservicio).
- Recomendado en producción: poner el panel detrás de **Cloudflare Access** además del login (segunda capa, sin código).

## Alcance por fases

| Fase | Contenido | Estado | Depende de la API |
|---|---|---|---|
| A1 | Marcas, productos, variantes (precio, existencia, activo), carga masiva por CSV | Hecha | Existe (`/v1/admin/brands`, `products`, `variants`, `variants/import`) |
| A2 | Pedidos: lista con filtro por estado, detalle, cambio de estado, guía de envío (paquetería + número) | **Hecha contra el contrato real** (`lentes-api` B7) | Existe (`GET/PATCH /v1/admin/orders`) |
| A3 | Recetas: pendientes/aprobadas/rechazadas, ver archivo (URL prefirmada de R2), aprobar o rechazar con motivo | **Hecha contra el contrato real** (`lentes-api` B6) | Existe (`GET/PATCH /v1/admin/prescriptions`) |
| A4 | Fotos de producto: subida a R2 con URL prefirmada, orden de galería, eliminar | **Hecha contra el contrato real** (`lentes-api` B8) | Existe (`/v1/admin/uploads/image-url`, `/v1/admin/products/{id}/images*`) |
| A5 | Inventario (ajustes con motivo e historial, stock bajo) y reportes (ventas, recompra) | **Real** (`lentes-api`: inventario B9, reportes B10) | `/v1/admin/variants/{id}/stock-adjustments`, `/v1/admin/inventory/low-stock`, `/v1/admin/reports/sales` y `/repurchase` |
| A6 | Contenido de la tienda (SPEC 15): pantalla "Home" con barra, heroes (con imagen o ilustración de marca), secundarios, megamenú, mosaico y promesas | **Contra el contrato real, sin desplegar** (`lentes-api` rama `feature/catalog-values`) | `/v1/admin/home/banners*` con `menu`, `slot`, `icon` y `art` |
| A7 | Catálogos de atributos (SPEC 16): pantalla "Catálogos"; formularios de producto y variante con opciones del catálogo | **Contra el contrato real, sin desplegar** (misma rama) | `/v1/admin/catalogs*` |
| A8 | Micas por pasos (SPEC 17): pestañas "Necesidades visuales" (paquetes, con `frame_only` y etiqueta) y "Tratamientos"; tratamiento y su precio en el detalle del pedido | **Contra el contrato real, sin desplegar** (`lentes-api` rama `feature/lens-treatments`) | `/v1/admin/lens-treatments*`, `badge` en `/v1/admin/lens-packages*` |

Regla: una fase se **cierra** cuando su endpoint existe en `lentes-api/api/openapi.yaml`. Si el endpoint aún no existe, la UI se construye
contra una propuesta de contrato (que pasa a `lentes-api` al publicarse) para no frenar al admin.

### Contrato

Todo el admin usa el contrato real (`openapi/openapi.yaml`, copia de `lentes-api`; `pnpm api:sync`). Ya no hay contrato provisional ni mock.

- **Reportes (publicados):** reglas y pendientes en `lentes-api/docs/ADMIN_REPORTS.md`. La conversión del recordatorio se atribuye **por tiempo** (otra compra después del recordatorio), no por clic en el enlace.
- **Pedidos (ya publicados):** las transiciones, la guía obligatoria al enviar, la corrección de guía y el `409` ante un cambio inválido o concurrente siguen el contrato real. Cancelar repone el inventario pero **no reembolsa** (reglas y pendientes: `lentes-api/docs/ADMIN_ORDERS.md`). La confirmación de cancelar avisa que el reembolso es manual; falta decidir el flujo de reembolso.
- **Recetas (ya publicadas):** la revisión sigue el contrato real. Rechazar exige `reject_reason` (lo ve el cliente), aprobar una receta vencida o revisar dos veces responde 409, y la cola trae el correo del cliente y `file_url` (lectura prefirmada de 10 min). Reglas y pendientes legales: `lentes-api/docs/PRESCRIPTIONS.md`.

## Decisiones tomadas

1. **El admin salió de `lentes-web`.** Se eliminaron `app/admin` y la revisión de recetas de la tienda. La tienda solo tiene cliente final.
2. **Existencia visible como `stock`, `reserved` y disponible.** `reserved` es lo apartado por pedidos sin pagar (15 min); el panel lo muestra pero no se edita.
3. **Retirar = `active=false`**, no borrar. Preserva historial de pedidos (`order_items` referencia variantes).
4. **CSV todo o nada:** si una fila falla no se aplica nada y se muestran los errores por fila. Un archivo, máx. 5 MB / 5,000 filas.
5. **Slug automático** a partir del nombre al crear; al editar no cambia (rompería URLs e indexación).
6. **Estados de pedido (A2):** el panel ofrece paid→preparing|cancelled, preparing→shipped|cancelled, shipped→delivered (`core/order-flow.ts`, con pruebas).
   `pending_payment` y `expired` los maneja el sistema (webhook y tarea de expiración), no el panel. **Reembolsos no se hacen desde el panel** (decisión pendiente abajo).
7. **Enviar exige guía:** paquetería y número de guía obligatorios para pasar a `shipped`. La paquetería es texto libre con sugerencias (Estafeta, DHL, FedEx, Paquetexpress, Redpack, Correos de México).
8. **Cancelar pide confirmación** (libera el inventario apartado; no se deshace).
9. **Rechazar una receta exige motivo** (se le muestra al cliente). Aprobar/rechazar solo aplica a recetas pendientes; una vez revisadas quedan de solo lectura.
10. **La existencia no se edita directo (A5).** Al editar una variante, `stock` queda bloqueado; se cambia con "Ajustar existencia": cantidad con signo, motivo
    (recepción, corrección por conteo, merma, devolución, otro) y nota (obligatoria con "otro"). Cada ajuste queda en una bitácora de solo agregar con quién, cuándo y
    cuánto quedó. No se puede dejar la existencia negativa. Alta, edición y carga masiva de variantes también dejan su renglón (motivos `initial`, `edit`, `import`; los pone el sistema, no se eligen).
11. **Stock bajo = disponible (stock − apartado) ≤ umbral**, 5 por defecto y editable en pantalla. Lo apartado por pedidos sin pagar cuenta como no disponible.
12. **Imágenes (A4):** JPG, PNG o WebP, máx. 5 MB cada una; la primera es la principal. Se ordena con botones (no arrastrar: es accesible por teclado). Eliminar pide confirmación.
    El archivo en R2 no se borra desde el panel; eso lo decide la API (ver pendientes).
13. **Reportes (A5):** ventas cuentan pedidos pagados en adelante (sin cancelados ni reembolsados), fechas en America/Mexico_City. "Recompra" = clientes que repiten
    y conversión de recordatorios (pedidos que vinieron del enlace ÷ recordatorios enviados). Si no hay base, se muestra "—" en vez de 0%.
14. **Sin datos de recetas en analítica ni en logs del panel.** Las recetas son datos de salud; se ven solo en la pantalla de revisión (fase A3).
15. **Banners de toda la tienda (A6, SPEC 15).** El formulario pide solo los campos de la ubicación (`core/banner-form.ts`, con pruebas) y valida lo mismo que la API antes de enviar.
    El megamenú se lista por menú (hasta 4 tarjetas vigentes cada uno; la API reordena todas las tarjetas juntas, así que se envía el orden completo).
    El mosaico se ve como una cuadrícula que imita el home, con la foto vigente de cada celda o el aviso "Sin foto: se muestra un bloque de color";
    no se reordena porque cada celda tiene un solo banner vigente (un segundo vigente responde `409` y se muestra su mensaje).
    Las promesas eligen un ícono de un conjunto cerrado con vista previa; junto a "Entrega" se avisa que solo se use con promesas que la tienda cumple (`docs/BRAND.md` de `lentes-web`).
16. **Catálogos (A7, SPEC 16).** Etiquetas, orden y visibilidad salen de `GET /v1/admin/catalogs`, que el panel pide una vez por sesión (`core/catalogs.ts`, `CatalogStore`)
    y la pantalla Catálogos mantiene al día; el i18n del panel ya no tiene etiquetas de atributos. Tipo de lente y reemplazo no admiten valores nuevos.
    Se ordena con botones, como las imágenes. "Borrar" solo aparece en valores sin uso que no son de sistema; si la API responde `409`, se muestra su mensaje.
    Un color nuevo exige muestra (`#rrggbb` o `conic-gradient` de 2 a 12 colores). En los formularios, un valor oculto no se ofrece para altas;
    al editar un producto que ya lo tiene aparece como "(oculto)" y se conserva.
17. **Micas (A8, SPEC 17).** La pantalla tiene dos pestañas. "Necesidades visuales" son los paquetes: admiten "Solo armazón" (`frame_only`)
    y una etiqueta opcional (máx. 24, p. ej. "Comprar en set"); si requiere receta lo decide la API (solo visión sencilla y progresiva).
    "Tratamientos" se crean, editan, ordenan con botones y se desactivan con "Activo"; **no se borran** porque los pedidos los citan.
    Cada uno pide nombre (máx. 60), slug, descripción opcional (máx. 160), ícono de un conjunto cerrado, etiqueta opcional, precio extra
    y al menos una necesidad (Sin graduación, Visión sencilla, Visión progresiva; nunca "Solo armazón"). Validación en `core/lens-treatments.ts`, con pruebas.
    Las etiquetas de necesidad son las de la tienda: "Solo armazón", "Sin graduación", "Visión sencilla", "Visión progresiva".

## Pendientes de decisión (necesitan tu confirmación)

- **Bitácora de ajustes (resuelto en la API):** ajuste + stock en una transacción con la fila bloqueada, de solo agregar (trigger en la base) y con el correo de quien lo hizo. **Cerrado:** alta, edición y CSV escriben su diferencia en la bitácora (y rechazan dejar menos que lo apartado); ver `lentes-api/docs/ADMIN_INVENTORY.md`.
- **Imágenes eliminadas:** la API borra el registro y **conserva** el archivo en R2 (no destructivo); ver `lentes-api/docs/ADMIN_IMAGES.md` para decidir si se borra el objeto y si se purga la caché de Cloudflare (los cambios tardan hasta 5 min en verse en la tienda).
- **Umbral de stock bajo:** 5 es un valor por defecto; ¿distinto por producto (diarios vs. mensuales)?
- **Reportes:** confirmar la zona horaria de corte (America/Mexico_City) y si el ingreso incluye envío.
- Reglas para **aprobar/rechazar recetas** (qué valida el revisor, vigencia máxima, si exige cédula) — validar con el abogado, según el SPEC.
- **Quién puede qué:** hoy un solo rol `admin`. ¿Hace falta separar `operador` (pedidos/envíos) de `catalogo`?
- **Reembolsos y cancelaciones:** ¿se hacen desde el panel (llamando a Mercado Pago vía API) o directo en Mercado Pago?
- **Paqueterías** soportadas y si se genera la guía desde el panel o se captura a mano.
- **Auditoría:** registrar quién cambió qué (precio, stock, estado de pedido). Recomendado desde A2.

## Entornos

`src/environments/environment.development.ts` (local) y `environment.ts` (producción). Todos los valores son públicos;
el panel no lleva URL ni clave de Supabase. No se guarda ningún secreto en este repo.

| Valor | Local | Producción |
|---|---|---|
| `apiUrl` | `http://localhost:8080` | `https://api.tutienda.com` |

La API debe permitir el origen del panel en `CORS_ALLOWED_ORIGINS` (p. ej. `https://admin.tutienda.com` y `http://localhost:4301` en local) y tener `SUPABASE_SECRET_KEY` (con forwarding de IP activo en Supabase); sin ella el login responde 503.

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
