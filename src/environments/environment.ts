// Producción. Todos los valores son públicos; el login pasa por la API, que es la única que habla con Supabase.
// Ningún secreto va en este repositorio.
export const environment = {
  production: true,
  apiUrl: 'https://lentes-api-production.up.railway.app',
  imgUrl: 'https://pub-90197bf5a56f40bdb2590bcead9006d4.r2.dev',
};
