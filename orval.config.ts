import { defineConfig } from 'orval';

// Contrato: copia de lentes-api/api/openapi.yaml (fuente de verdad). `pnpm api:sync` la actualiza.
export default defineConfig({
  lentes: {
    input: './openapi/openapi.yaml',
    output: {
      mode: 'tags-split',
      target: './src/app/api/generated',
      schemas: './src/app/api/generated/model',
      client: 'angular',
      clean: true,
    },
  },
});
