# Sistema visual del admin (Pupila)

Homologado con lentes-web (`../lentes-web/docs/BRAND.md`, `app/globals.css`). Los tokens viven en `src/styles.css`; las piezas compartidas, en `@layer components` del mismo archivo. Usar esas clases antes de escribir utilidades sueltas.

## Dirección

- Herramienta de trabajo del equipo de la tienda: preparar pedidos, revisar recetas, mantener catálogo. Denso pero tranquilo.
- Paleta marino + azul + menta + amarillo (la de web). Un solo acento de acción: `--blue` (`#0066e0`; `#4d9dff` en oscuro). Menta solo como indicador (sección activa, íconos del login, avatar). Amarillo (`sun`) solo para atención (contadores, stock bajo, estado "pagado").
- Texto blanco solo sobre `--blue` o más oscuro; sobre menta y amarillo el texto va en marino (`text-navy`).
- Tipografías: Bricolage Grotesque (títulos, `font-display`), Figtree (texto), IBM Plex Mono (valores ópticos, utilidad `optic`).
- Tema claro/oscuro con `data-theme` en `<html>`.

## Superficies y profundidad

- Estrategia: sombras sutiles, sin bordes en tarjetas.
- Lienzo `--bg` `#f6f8fc` (tinte azul leve para que las tarjetas blancas se distingan); tarjeta `--surface` blanco. Oscuro: `#07111f` / `#0e1c2f`.
- `--lift` (tarjetas, `.panel`, `shadow-lift`): anillo 1px marino 6% + dos sombras suaves. En oscuro solo el anillo blanco 6%.
- `--lift-strong` (`.panel-raised`, login, hoja "Más"): para lo que se eleva sobre la página.
- Bordes de campos: `--input` (`#d5dce8`), un paso más fuerte que `--line` (`#e4e9f2`).
- Franja marino `--band`: barra lateral, panel de marca del login, tooltips. Oscura en ambos temas.

## Jerarquía y espaciado

- Base 4 px. Página: `py-6` móvil, `lg:py-10`. Contenedor máx. 1280 px (`container-page`).
- `.page-head`: título + `.page-sub` a la izquierda, acciones a la derecha; `mb-6 lg:mb-8`.
- `.page-title`: 28 → 36 px, tracking −0.02em, peso 800.
- `.eyebrow` / grupos del menú / encabezados de tabla: 11 px, 600, mayúsculas, tracking 0.06–0.08em, color atenuado.
- Cifras: `tabular-nums`; valores ópticos con `optic`.

## Componentes

- `.btn`: píldora, alto 40 px, `px-4.5`, 14/600, `scale(0.97)` al presionar. Variantes `.btn-primary`, `.btn-secondary` (contorno), `.btn-ghost`, `.btn-danger`; tamaños `.btn-lg` (48 px), `.btn-sm` (32 px), `.btn-icon`.
- `.field`: alto 44 px, radio `xl` (12 px), `px-3.5`. `select.field` lleva flecha SVG propia (una por tema). En login, `min-h-12 text-base`.
- `.panel`: radio 2xl, `shadow-lift`. `.panel-raised`: formularios de alta/edición abiertos.
- `.data-table`: encabezado en mayúsculas pequeñas con borde inferior; filas `py-3.5`, hover `bg-blue-soft/60`; `.stack` la vuelve tarjetas bajo 600 px.
- `.chip`: píldora; seleccionado = marino sólido con texto blanco (en oscuro, tinta sobre fondo).
- `.alert-error` / `.alert-ok`: radio xl, fondo 8% y borde 20% del color semántico.
- Contadores: `bg-sun text-navy font-bold`, píldora.

## Barra lateral (firma)

- 256 px, fondo `--sidebar` = marino. Logo con los tonos de tema oscuro (clase `.sidebar` redefine `--logo-*`).
- Ítem: alto 40 px, radio xl, texto `white/75`; hover `white/6`; activo `bg-sidebar-accent` (blanco 8%) + barra menta de 4 px pegada al borde izquierdo + ícono menta.
- Etiquetas de grupo `white/60` (contraste ≈ 6:1 sobre marino). Foco: anillo menta 70%.
- Pie: tarjeta `white/5` con inicial del correo en círculo menta, cerrar sesión y cambio de tema.
- En oscuro se agrega `border-r` sutil porque el marino casi iguala el fondo.
- Móvil: cabecera blanca, pestañas inferiores (5) y hoja "Más" con fondo `navy/50` difuminado.

## Login

- Igual que `AuthShell` de lentes-web: tarjeta de dos columnas (máx. 1024 px, radio 3xl, `shadow-lift-strong`). Izquierda marino con iris recortado en la esquina, título y cuatro tareas con ícono menta; derecha el formulario. En móvil solo la tarjeta del formulario.

## Movimiento

- Transiciones de 150 ms sobre color/sombra/transform (nunca `transition: all`), curva `ease-out-soft`. `prefers-reduced-motion` las desactiva todas.
