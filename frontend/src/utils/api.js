// URL base del backend — se configura via variable de entorno en producción
// En Vercel: VITE_API_URL=https://tu-backend.up.railway.app
// En local: automáticamente usa localhost:4000
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
