import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { config } from '../config.js';
import { generarFirmaQR } from './crypto.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Genera el payload del QR y envía el correo al asistente.
 */
export async function emitirYEnviarTicket({ attendee, event, producer }) {
  const signature = generarFirmaQR(event.id, attendee.id, attendee.rut);

  const qrPayload = JSON.stringify({
    tid: attendee.id,
    eid: event.id,
    sig: signature
  });

  // Generar imagen QR en Base64
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 320,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  const producerName = escapeHtml(producer.name || 'Productora');
  const eventName = escapeHtml(event.name || 'Evento');
  const attendeeName = escapeHtml(attendee.full_name);
  const attendeeRut = escapeHtml(attendee.rut);
  const tierName = escapeHtml(attendee.tier_name || 'General');
  const pricePaid = Number(attendee.price_paid || 0).toLocaleString('es-CL');

  const emailHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Tu Entrada para ${eventName}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f3f4f6;">
    <div style="max-width: 480px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; text-align: center;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 800; color: #022c22; background: rgba(255,255,255,0.25); padding: 4px 10px; border-radius: 999px;">Entrada Oficial</span>
        <h1 style="color: #ffffff; margin: 8px 0 2px 0; font-size: 22px; font-weight: 800;">${producerName}</h1>
        <p style="color: #ecfdf5; margin: 0; font-size: 14px; opacity: 0.95;">Presenta: <strong>${eventName}</strong></p>
      </div>

      <div style="padding: 24px;">
        <div style="background: #1f2937; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <div style="margin-bottom: 8px;">
            <span style="font-size: 11px; color: #9ca3af; text-transform: uppercase;">Titular</span>
            <div style="font-size: 16px; font-weight: 700; color: #ffffff;">${attendeeName}</div>
          </div>
          <div style="margin-bottom: 8px;">
            <span style="font-size: 11px; color: #9ca3af; text-transform: uppercase;">RUT (Acreditación obligatoria en puerta)</span>
            <div style="font-size: 18px; font-family: monospace; font-weight: 800; color: #34d399;">${attendeeRut}</div>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid #374151; padding-top: 8px; margin-top: 8px;">
            <div>
              <span style="font-size: 11px; color: #9ca3af; text-transform: uppercase;">Sector / Tipo</span>
              <div style="font-size: 14px; font-weight: 600; color: #e5e7eb;">${tierName}</div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; color: #9ca3af; text-transform: uppercase;">Pagado</span>
              <div style="font-size: 14px; font-weight: 700; color: #10b981;">$${pricePaid} CLP</div>
            </div>
          </div>
        </div>

        <div style="background: #ffffff; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
          <img src="cid:ticketqr" alt="Código QR de Acceso" style="width: 240px; height: 240px; display: block; margin: 0 auto;" />
          <p style="color: #6b7280; font-size: 11px; margin: 8px 0 0 0; font-family: monospace;">Firma digital: ${signature.slice(0, 16)}...</p>
        </div>

        <div style="background: #182234; border-left: 4px solid #10b981; padding: 12px 14px; border-radius: 0 8px 8px 0; font-size: 12px; color: #93c5fd;">
          ⚠️ <strong>Importante:</strong> Esta entrada es personal e intransferible. En la puerta se escaneará este código y deberás exhibir tu cédula de identidad para verificar el RUT.
        </div>
      </div>

      <div style="background: #0d131f; padding: 14px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #1f2937;">
        Organizado por <strong>${producerName}</strong> • Soporte: ${escapeHtml(producer.contact_email || 'No especificado')}
      </div>
    </div>
  </body>
  </html>
  `;

  let emailSent = false;
  let emailPreviewUrl = null;

  // Intentar enviar si SMTP está configurado
  if (config.smtp.user && config.smtp.pass && config.smtp.host !== 'smtp.ejemplo.cl') {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass
        }
      });

      await transporter.sendMail({
        from: `"${producer.name}" <${config.smtp.fromEmail}>`,
        replyTo: producer.contact_email || config.smtp.fromEmail,
        to: attendee.email,
        subject: `Tu Entrada QR - ${event.name} (${producer.name})`,
        html: emailHtml,
        attachments: [
          {
            filename: 'ticket-qr.png',
            path: qrDataUrl,
            cid: 'ticketqr'
          }
        ]
      });
      emailSent = true;
    } catch (err) {
      console.warn(`[SMTP Warning] No se pudo conectar a SMTP: ${err.message}. El QR fue generado exitosamente.`);
    }
  } else {
    console.log(`[Modo Desarrollo] SMTP no configurado. QR generado en memoria para ${attendee.email}`);
  }

  return {
    qrPayload,
    signature,
    qrDataUrl,
    emailSent
  };
}
