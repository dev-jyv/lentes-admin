// Producción. Todos los valores son públicos; el login pasa por la API, que es la única que habla con Supabase.
// Rellenar al desplegar; ningún secreto va en este repositorio.
export const environment = {
  production: true,
  apiUrl: 'https://api.tutienda.com',
  imgUrl: 'https://img.tutienda.com',
};
