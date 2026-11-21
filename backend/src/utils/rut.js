/**
 * Validador y formateador de RUT Chileno (Algoritmo Módulo 11)
 * Incluye sanitización estricta para evitar inyecciones.
 */

export function limpiarRUT(rut) {
  if (!rut || typeof rut !== 'string') return '';
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

export function validarRUT(rut) {
  const clean = limpiarRUT(rut);
  if (clean.length < 8 || clean.length > 9) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  let sum = 0;
  let mul = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }

  const res = 11 - (sum % 11);
  const expectedDv = res === 11 ? '0' : res === 10 ? 'K' : res.toString();

  return dv === expectedDv;
}

export function formatearRUT(rut) {
  const clean = limpiarRUT(rut);
  if (!clean || clean.length < 2) return rut;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  // Agrega puntos cada 3 dígitos
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedBody}-${dv}`;
}
