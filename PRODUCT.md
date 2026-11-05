# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Equipo pequeño de la tienda, con un solo rol `admin` (`app_metadata.role`). Se reparten el trabajo: pedidos y envíos, revisión de recetas y catálogo. Trabajan a menudo desde el teléfono (revisar una receta o mover un pedido fuera del escritorio), además del escritorio.

## Product Purpose

Panel interno (SPA, sin SEO) para operar una tienda en línea de lentes de contacto en México. Su objetivo es que el equipo complete rápido y sin errores las tareas diarias de la tienda. No es parte de la experiencia del cliente: la tienda (`lentes-web`) solo atiende al cliente final.

## Positioning

Herramienta interna hecha a la medida del contrato de `lentes-api`. Respeta las reglas del negocio de lentes con graduación: recetas con motivo de rechazo visible para el cliente, variantes con parámetros ópticos, `stock` / `reserved` / disponible, y dinero siempre en centavos.

## Operating Context

Todas estas tareas son frecuentes e importantes por igual:

- **Pedidos y envíos:** lista filtrada por estado, detalle, transiciones permitidas (`core/order-flow.ts`) y guía obligatoria al enviar (paquetería y número). Un cambio inválido o concurrente responde `409`. Cancelar repone el inventario pero no reembolsa: el reembolso es manual en Mercado Pago.
- **Revisión de recetas:** cola de pendientes, aprobadas y rechazadas. El archivo se abre con una URL prefirmada de R2 válida 10 min. Rechazar exige un motivo que ve el cliente. Tiene riesgo legal y de salud.
- **Catálogo e inventario:** marcas, productos, variantes, micas, carga masiva por CSV, fotos de producto, ajustes de stock con motivo e historial, y stock bajo.
- **Reportes y contenido de inicio:** ventas y recompra, banners del inicio (hasta 5) y productos destacados.

Se usa en escritorio y en teléfono. Está publicado en `admin.tutienda.com` detrás de Cloudflare Access, además del login de Supabase.

## Capabilities and Constraints

- Angular 22 (zoneless, signals, Signal Forms) con Tailwind v4. Cliente de API generado con orval (nunca se edita a mano).
- Todo el texto de la interfaz está en español (es-MX) y vive en `src/i18n/es-MX.json`.
- Dinero en centavos enteros: la interfaz captura pesos y convierte con `core/money.ts`.
- Retirar un producto = `active=false`, nunca borrar, para preservar el historial de pedidos.
- Los errores llegan como `problem+json` y se muestran con `core/problem.ts`.
- Pendiente de decidir (ver `docs/ADMIN.md`): separar roles (operador / catálogo), flujo de reembolso, paqueterías soportadas, auditoría de quién cambió qué, umbral de stock bajo por producto y reglas legales para revisar recetas.

## Brand Commitments

Todavía no hay nombre de tienda definitivo; `tutienda.com` es un marcador de posición. El panel sigue el estilo de la tienda `lentes-web`, como se aplicó en el commit `c18c1f2`. No hay más compromisos de marca.

## Evidence on Hand

No hay datos reales de clientes, testimonios ni métricas. Las especificaciones están en `docs/ADMIN.md` y `docs/SPEC.md`. No inventar nombres de marca, cifras ni contenido.

## Product Principles

1. Las acciones riesgosas (rechazar una receta, cancelar un pedido, ajustar stock) son explícitas, piden confirmación y explican su consecuencia.
2. La interfaz refleja las reglas de la API (transiciones de estado, `409`, centavos) en lugar de reinventarlas.
3. Cada tarea frecuente se puede completar en un teléfono.
4. Velocidad de lectura antes que expresión: listas fáciles de recorrer y estados claros.

## Accessibility & Inclusion

Debe pasar todas las revisiones de AXE y cumplir WCAG AA: foco, contraste y ARIA.
