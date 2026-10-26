# lentes-admin

Panel de administración de la tienda de lentes de contacto (Angular 22 + Tailwind).
Las decisiones de administración están en [`docs/ADMIN.md`](docs/ADMIN.md); la especificación general en [`docs/SPEC.md`](docs/SPEC.md).

```bash
pnpm install
pnpm start --port 4301
pnpm test
```

Contrato: `openapi/openapi.yaml` (copia de `lentes-api/api/openapi.yaml`; `pnpm api:sync`).
