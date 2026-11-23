// URL base del backend de EveCost
// En desarrollo local (npm run dev) usa http://localhost:4000
// En producción (Vercel) usa https://control-de-eventos-evecost-production.up.railway.app
export const API_URL = import.meta.env.VITE_API_URL || 'https://control-de-eventos-evecost-production.up.railway.app';
