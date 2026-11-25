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
export async function emitirYEnviarTicket({ attendee, event, producer }, { asyncEmail = false } = {}) {
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
  const hasProducerLogo = Boolean(producer.logo_url);
  const isLogoBase64 = Boolean(producer.logo_url && producer.logo_url.startsWith('data:image/'));

  // Header del logo: Imagen de la productora o distintivo tipográfico premium
  const logoHeaderHtml = hasProducerLogo
    ? `<div style="text-align: center; padding: 24px 20px 12px 20px;">
        <img src="${isLogoBase64 ? 'cid:producer-logo.png' : producer.logo_url}" alt="${producerName}" style="max-height: 85px; max-width: 220px; object-fit: contain; display: inline-block; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));" />
       </div>`
    : `<div style="text-align: center; padding: 24px 20px 8px 20px;">
        <div style="display: inline-block; width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #10b981 0%, #047857 100%); line-height: 52px; font-weight: 900; font-size: 20px; color: #ffffff; letter-spacing: 1px; box-shadow: 0 6px 16px rgba(16,185,129,0.3);">
          ${producerName.substring(0, 2).toUpperCase()}
        </div>
       </div>`;

  const emailHtml = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Entrada Digital Oficial - ${eventName}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #07090e; margin: 0; padding: 28px 12px; color: #f1f5f9; -webkit-font-smoothing: antialiased;">
    <div style="max-width: 460px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 45px rgba(0,0,0,0.65);">
      
      <!-- CABECERA DE LA PRODUCTORA CON LOGO -->
      <div style="background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 100%); border-bottom: 1px solid #1e293b; text-align: center;">
        ${logoHeaderHtml}
        
        <div style="padding: 0 24px 20px 24px;">
          <span style="display: inline-block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2.5px; color: #10b981; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25); padding: 4px 12px; border-radius: 999px; margin-bottom: 8px;">
            Entrada Digital Oficial
          </span>
          <h1 style="color: #ffffff; margin: 6px 0 2px 0; font-size: 21px; font-weight: 800; letter-spacing: -0.3px;">
            ${producerName}
          </h1>
          <p style="color: #94a3b8; margin: 0; font-size: 13px; font-weight: 500;">
            Presenta: <strong style="color: #e2e8f0;">${eventName}</strong>
          </p>
        </div>
      </div>

      <!-- SEPARADOR ESTILO TICKET PERFORADO -->
      <div style="position: relative; height: 20px; background: #0f172a; border-top: 1px dashed #334155; margin-top: -1px;"></div>

      <!-- CÓDIGO QR AL MEDIO (PROTAGONISTA DEL TICKET) -->
      <div style="padding: 10px 24px 24px 24px; text-align: center;">
        <div style="background: #ffffff; padding: 18px; border-radius: 20px; display: inline-block; box-shadow: 0 12px 28px rgba(0,0,0,0.45); border: 1px solid #e2e8f0; margin: 0 auto;">
          <img src="cid:ticket-qr.png" alt="Código QR de Acceso" style="width: 220px; height: 220px; display: block; margin: 0 auto;" />
          <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; color: #64748b; margin-top: 8px; letter-spacing: 1px;">
            ID: ${attendee.id.substring(0, 8).toUpperCase()} • FIRMA VÁLIDA
          </div>
        </div>

        <p style="font-size: 11px; color: #64748b; margin: 10px 0 20px 0; font-family: ui-monospace, SFMono-Regular, monospace;">
          Firma Criptográfica: ${signature.slice(0, 20)}...
        </p>

        <!-- FICHA DE DATOS DEL ASISTENTE -->
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 16px; text-align: left; margin-bottom: 20px;">
          <div style="display: table; width: 100%; margin-bottom: 12px;">
            <div style="display: table-cell; vertical-align: top;">
              <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Titular Acreditado</span>
              <div style="font-size: 15px; font-weight: 700; color: #ffffff; margin-top: 2px;">${attendeeName}</div>
            </div>
            <div style="display: table-cell; text-align: right; vertical-align: top;">
              <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Tipo de Entrada</span>
              <div style="font-size: 14px; font-weight: 800; color: #38bdf8; margin-top: 2px;">${tierName}</div>
            </div>
          </div>

          <div style="display: table; width: 100%; padding-top: 10px; border-top: 1px solid #334155;">
            <div style="display: table-cell; vertical-align: top;">
              <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">RUT (Cédula de Identidad)</span>
              <div style="font-size: 16px; font-family: ui-monospace, SFMono-Regular, monospace; font-weight: 800; color: #10b981; margin-top: 2px;">${attendeeRut}</div>
            </div>
            <div style="display: table-cell; text-align: right; vertical-align: top;">
              <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Monto Pagado</span>
              <div style="font-size: 15px; font-weight: 800; color: #ffffff; margin-top: 2px;">$${pricePaid} CLP</div>
            </div>
          </div>
        </div>

        <!-- AVISO DE CONTROL EN PUERTA -->
        <div style="background: rgba(16, 185, 129, 0.08); border-left: 4px solid #10b981; padding: 12px 14px; border-radius: 0 10px 10px 0; text-align: left; margin-bottom: 16px;">
          <div style="font-size: 11.5px; line-height: 1.5; color: #cbd5e1;">
            <strong style="color: #34d399;">⚠️ Control de Acceso:</strong> Esta entrada es personal e intransferible. En puerta se escaneará este código QR y deberás exhibir tu carnet de identidad para validar el RUT.
          </div>
        </div>
      </div>

      <!-- PIE DE PÁGINA CORPORATIVO -->
      <div style="background: #090e17; padding: 16px 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b;">
        <div style="margin-bottom: 4px;">
          Emitido por <strong>${producerName}</strong>
          ${producer.contact_email ? ` • Soporte: <a href="mailto:${escapeHtml(producer.contact_email)}" style="color: #10b981; text-decoration: none;">${escapeHtml(producer.contact_email)}</a>` : ''}
        </div>
        <div style="font-size: 10px; color: #475569;">
          Cifrado criptográfico anti-fraude y verificación en tiempo real
        </div>
      </div>

    </div>
  </body>
  </html>
  `;

  let emailSent = false;
  let emailPreviewUrl = null;

  // Función de envío por API Brevo (HTTPS) — funciona en Railway sin restricciones de puertos SMTP
  const sendEmail = async () => {
    const brevoKey = process.env.BREVO_API_KEY;

    if (brevoKey) {
      // --- Vía Brevo API (producción en Railway) ---
      try {
        // El QR va como adjunto en base64 (quitamos el prefijo data:image/png;base64,)
        const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');

        const attachments = [
          {
            name: 'ticket-qr.png',
            content: qrBase64
          }
        ];

        if (isLogoBase64) {
          const logoRawBase64 = producer.logo_url.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
          attachments.push({
            name: 'producer-logo.png',
            content: logoRawBase64
          });
        }

        const payload = {
          sender: {
            name: producer.name || 'EveCost',
            email: config.smtp.fromEmail || config.smtp.user || 'psicosisproduccionesiqq@gmail.com'
          },
          to: [{ email: attendee.email, name: attendee.full_name }],
          replyTo: { email: producer.contact_email || config.smtp.fromEmail },
          subject: `Tu Entrada QR - ${event.name} (${producer.name})`,
          htmlContent: emailHtml,
          attachment: attachments
        };

        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          throw new Error(`Brevo API ${resp.status}: ${errBody}`);
        }

        emailSent = true;
        console.log(`[Brevo] Correo enviado a ${attendee.email}`);
      } catch (err) {
        console.warn(`[Brevo Warning] No se pudo enviar correo: ${err.message}`);
      }

    } else if (config.smtp.user && config.smtp.pass) {
      // --- Fallback SMTP (desarrollo local) ---
      try {
        const nodemailer = (await import('nodemailer')).default;
        const transporter = nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.port === 465,
          auth: { user: config.smtp.user, pass: config.smtp.pass },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 10000
        });
        const mailAttachments = [{ filename: 'ticket-qr.png', path: qrDataUrl, cid: 'ticket-qr.png' }];
        if (isLogoBase64) {
          mailAttachments.push({ filename: 'producer-logo.png', path: producer.logo_url, cid: 'producer-logo.png' });
        }

        await transporter.sendMail({
          from: `"${producer.name}" <${config.smtp.fromEmail}>`,
          replyTo: producer.contact_email || config.smtp.fromEmail,
          to: attendee.email,
          subject: `Tu Entrada QR - ${event.name} (${producer.name})`,
          html: emailHtml,
          attachments: mailAttachments
        });
        emailSent = true;
      } catch (err) {
        console.warn(`[SMTP Warning] No se pudo enviar correo: ${err.message}`);
      }

    } else {
      console.log(`[Modo Desarrollo] Sin credenciales de email. QR generado en memoria para ${attendee.email}`);
    }
  };

  if (asyncEmail) {
    // Enviar correo en background (sin bloquear la respuesta HTTP)
    sendEmail().catch(err => console.warn('[SMTP Background]', err.message));
    emailSent = null; // null = pendiente de envío
  } else {
    await sendEmail();
  }

  return {
    qrPayload,
    signature,
    qrDataUrl,
    emailSent
  };
}
