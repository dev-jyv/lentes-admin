import { defineConfig } from 'orval';

const output = (dir: string) => ({
  mode: 'tags-split' as const,
  target: `./src/app/api/${dir}`,
  schemas: `./src/app/api/${dir}/model`,
  client: 'angular' as const,
  clean: true,
});

export default defineConfig({
  // Contrato real: copia de lentes-api/api/openapi.yaml (fuente de verdad). `pnpm api:sync` la actualiza.
  lentes: { input: './openapi/openapi.yaml', output: output('generated') },
  // PROVISIONAL: lo que el admin necesita y la API aún no publica. Se elimina al llegar los endpoints reales.
  provisional: { input: './openapi/provisional/admin-ops.yaml', output: output('provisional') },
});
