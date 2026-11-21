import crypto from 'crypto';
import { config } from '../config.js';

/**
 * Genera la firma criptográfica HMAC-SHA256 para una entrada.
 * Combina eventId + attendeeId + rut con la clave secreta.
 */
export function generarFirmaQR(eventId, attendeeId, rut) {
  return crypto
    .createHmac('sha256', config.qrSecretKey)
    .update(`${eventId}:${attendeeId}:${rut.toUpperCase()}`)
    .digest('hex')
    .slice(0, 32); // 32 caracteres hexadecimales de alta entropía
}

/**
 * Verifica si la firma de un QR recibido es legítima.
 * Usa timingSafeEqual para evitar ataques de temporización (timing attacks).
 */
export function verificarFirmaQR(eventId, attendeeId, rut, firmaRecibida) {
  try {
    const firmaEsperada = generarFirmaQR(eventId, attendeeId, rut);
    const bufEsperada = Buffer.from(firmaEsperada, 'utf8');
    const bufRecibida = Buffer.from(firmaRecibida, 'utf8');

    if (bufEsperada.length !== bufRecibida.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufEsperada, bufRecibida);
  } catch {
    return false;
  }
}
