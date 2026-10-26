// Producción. Todos los valores son públicos (la publishable key de Supabase no es secreta).
// Rellenar al desplegar; ningún secreto va en este repositorio.
export const environment = {
  production: true,
  apiUrl: 'https://api.tutienda.com',
  supabaseUrl: '',
  supabaseKey: '',
  // PROVISIONAL: URL del mock para /v1/admin/orders y /v1/admin/prescriptions hasta que lentes-api los publique. Vacío = usar apiUrl.
  provisionalApiUrl: '',
  imgUrl: 'https://img.tutienda.com',
};
