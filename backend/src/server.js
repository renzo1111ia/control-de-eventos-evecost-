import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { db } from './db.js';
import { initDatabase } from './schema.js';
import { validarRUT, formatearRUT, limpiarRUT } from './utils/rut.js';
import { generarFirmaQR, verificarFirmaQR } from './utils/crypto.js';
import { emitirYEnviarTicket } from './utils/mailer.js';

const app = express();

// ==========================================
// 🛡️ CAPA DE CIBERSEGURIDAD Y MIDDLEWARES
// ==========================================
app.use(helmet({
  contentSecurityPolicy: false, // Permitir carga de recursos locales/estilos en desarrollo
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiter general para proteger la API de ataques DoS
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes desde esta IP, por favor intente nuevamente en un minuto.' }
});
app.use('/api/', generalLimiter);

// Rate limiter estricto para el escaneo de entradas (protege contra ataques de fuerza bruta de tokens QR)
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // 2 escaneos por segundo máximo por dispositivo
  message: { status: 'ERROR', message: 'Tasa de escaneo excedida. Espere unos segundos.' }
});

// Helper de auditoría de seguridad
async function registrarAuditoria(eventId, action, details, req) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    await db.run(
      `INSERT INTO audit_logs (id, event_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [db.generateUUID(), eventId, action, typeof details === 'string' ? details : JSON.stringify(details), String(ip)]
    );
  } catch (err) {
    console.error('[Audit Error]', err.message);
  }
}

// ==========================================
// 📌 RUTAS: GESTIÓN DE EVENTOS Y PRODUCTORAS
// ==========================================

// 1. Listar todos los eventos
app.get('/api/events', async (req, res) => {
  try {
    const events = await db.query(`
      SELECT e.*, p.name AS producer_name, p.contact_email AS producer_email, p.logo_url AS producer_logo
      FROM events e
      LEFT JOIN producers p ON e.producer_id = p.id
      ORDER BY e.created_at DESC
    `);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Crear un nuevo evento
app.post('/api/events', async (req, res) => {
  try {
    const { name, eventDate, producerId } = req.body;
    const eventId = db.generateUUID();
    const date = eventDate || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    await db.run(
      `INSERT INTO events (id, producer_id, name, event_date, has_bar, is_configured)
       VALUES ($1, $2, $3, $4, 0, 0)`,
      [eventId, producerId || null, name || 'Nuevo Evento', date]
    );

    // Tipos de entrada por defecto
    await db.run(
      `INSERT INTO ticket_tiers (id, event_id, name, price, capacity)
       VALUES ($1, $2, 'General', 10000, 200),
              ($3, $2, 'VIP', 20000, 50)`,
      [db.generateUUID(), eventId, db.generateUUID()]
    );

    await registrarAuditoria(eventId, 'CREATE_EVENT', `Evento creado: ${name}`, req);

    const created = await db.get('SELECT * FROM events WHERE id = $1', [eventId]);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2b. Eliminar evento completo
app.delete('/api/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await db.get('SELECT * FROM events WHERE id = $1', [eventId]);
    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM attendees WHERE event_id = $1', [eventId]);
      await tx.run('DELETE FROM ticket_tiers WHERE event_id = $1', [eventId]);
      await tx.run('DELETE FROM transactions WHERE event_id = $1', [eventId]);
      await tx.run('DELETE FROM bar_sales WHERE event_id = $1', [eventId]);
      await tx.run('DELETE FROM bar_courtesies WHERE event_id = $1', [eventId]);
      await tx.run('DELETE FROM bar_courtesy_recipients WHERE event_id = $1', [eventId]);
      await tx.run('DELETE FROM bar_closings WHERE event_id = $1', [eventId]);
      await tx.run('DELETE FROM bar_inventory WHERE event_id = $1', [eventId]);
      await tx.run('DELETE FROM audit_logs WHERE event_id = $1', [eventId]);
      await tx.run('DELETE FROM events WHERE id = $1', [eventId]);
    });

    res.json({ success: true, message: `Evento "${event.name}" eliminado correctamente.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Obtener estado de un evento (Incluye si ya fue configurado en el popup)
app.get('/api/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await db.get(`
      SELECT e.*, p.name AS producer_name, p.contact_email AS producer_email, p.logo_url AS producer_logo
      FROM events e
      LEFT JOIN producers p ON e.producer_id = p.id
      WHERE e.id = $1
    `, [eventId]);

    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    const tiers = await db.query('SELECT * FROM ticket_tiers WHERE event_id = $1 ORDER BY price ASC', [eventId]);
    res.json({ ...event, tiers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3b. Listar tipos de entrada de un evento
app.get('/api/events/:eventId/tiers', async (req, res) => {
  try {
    const { eventId } = req.params;
    const tiers = await db.query('SELECT * FROM ticket_tiers WHERE event_id = $1 ORDER BY price ASC', [eventId]);
    res.json(tiers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3c. Crear nuevo tipo de entrada
app.post('/api/events/:eventId/tiers', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { name, price, capacity } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'El nombre y el precio de la entrada son obligatorios.' });
    }

    const tierId = db.generateUUID();
    const numPrice = parseFloat(price) || 0;
    const numCapacity = parseInt(capacity, 10) || 100;

    await db.run(`
      INSERT INTO ticket_tiers (id, event_id, name, price, capacity)
      VALUES ($1, $2, $3, $4, $5)
    `, [tierId, eventId, name.trim(), numPrice, numCapacity]);

    await registrarAuditoria(eventId, 'CREATE_TICKET_TIER', { name, price: numPrice, capacity: numCapacity }, req);

    const created = await db.get('SELECT * FROM ticket_tiers WHERE id = $1', [tierId]);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3d. Eliminar tipo de entrada
app.delete('/api/events/:eventId/tiers/:tierId', async (req, res) => {
  try {
    const { eventId, tierId } = req.params;
    const tier = await db.get('SELECT * FROM ticket_tiers WHERE id = $1 AND event_id = $2', [tierId, eventId]);
    if (!tier) {
      return res.status(404).json({ error: 'Tipo de entrada no encontrado.' });
    }

    // Desvincular asistentes existentes para mantener integridad
    await db.run('UPDATE attendees SET tier_id = NULL WHERE tier_id = $1 AND event_id = $2', [tierId, eventId]);
    await db.run('DELETE FROM ticket_tiers WHERE id = $1 AND event_id = $2', [tierId, eventId]);

    await registrarAuditoria(eventId, 'DELETE_TICKET_TIER', { tierId, name: tier.name }, req);
    res.json({ success: true, message: `Tipo de entrada "${tier.name}" eliminado.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. CONFIGURACIÓN ÚNICA DEL POPUP (Productora + Switch de Barra)
// Se ejecuta una sola vez al entrar por primera vez a un evento nuevo
app.post('/api/events/:eventId/setup', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { producerName, producerEmail, eventName, hasBar } = req.body;

    if (!producerName || !producerEmail) {
      return res.status(400).json({ error: 'El nombre y correo de la productora son obligatorios.' });
    }
    if (hasBar === undefined || hasBar === null) {
      return res.status(400).json({ error: 'Debes definir si el evento contará con barra o no.' });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Buscar o crear productora
      let producer = await tx.get('SELECT id FROM producers WHERE LOWER(name) = LOWER($1)', [producerName.trim()]);
      let producerId;

      if (producer) {
        producerId = producer.id;
        await tx.run('UPDATE producers SET contact_email = $1 WHERE id = $2', [producerEmail.trim(), producerId]);
      } else {
        producerId = db.generateUUID();
        await tx.run(
          'INSERT INTO producers (id, name, contact_email) VALUES ($1, $2, $3)',
          [producerId, producerName.trim(), producerEmail.trim()]
        );
      }

      // 2. Actualizar evento y marcar is_configured = 1 (¡No vuelve a preguntar jamás!)
      await tx.run(`
        UPDATE events
        SET producer_id = $1,
            name = COALESCE($2, name),
            has_bar = $3,
            is_configured = 1
        WHERE id = $4
      `, [producerId, eventName ? eventName.trim() : null, hasBar ? 1 : 0, eventId]);

      const updated = await tx.get(`
        SELECT e.*, p.name AS producer_name, p.contact_email AS producer_email
        FROM events e
        JOIN producers p ON e.producer_id = p.id
        WHERE e.id = $1
      `, [eventId]);

      return updated;
    });

    await registrarAuditoria(eventId, 'SETUP_EVENT', { producerName, hasBar: Boolean(hasBar) }, req);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 🎟️ RUTAS: ASISTENTES Y EMISIÓN DE TICKETS QR
// ==========================================

// 5. Listar asistentes del evento
app.get('/api/events/:eventId/attendees', async (req, res) => {
  try {
    const { eventId } = req.params;
    const attendees = await db.query(`
      SELECT * FROM attendees
      WHERE event_id = $1
      ORDER BY created_at DESC
    `, [eventId]);
    res.json(attendees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Registrar asistente + Validar RUT + Sumar Ingreso + Enviar Correo con QR y Remitente de la Productora
app.post('/api/events/:eventId/attendees', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { fullName, rut, email, tierId, pricePaid } = req.body;

    if (!fullName || !rut || !email) {
      return res.status(400).json({ error: 'Nombre, RUT y Correo son obligatorios.' });
    }

    // 🔒 Validación estricta de RUT chileno (Módulo 11)
    if (!validarRUT(rut)) {
      return res.status(400).json({ error: 'El RUT ingresado no es válido (falla dígito verificador).' });
    }
    const rutLimpio = formatearRUT(rut);

    // Obtener datos del evento y su productora
    const event = await db.get(`
      SELECT e.*, p.name AS producer_name, p.contact_email AS producer_email
      FROM events e
      LEFT JOIN producers p ON e.producer_id = p.id
      WHERE e.id = $1
    `, [eventId]);

    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    // Obtener información de la entrada (tier)
    let tierName = 'General';
    let finalPrice = Number(pricePaid) || 0;
    if (tierId) {
      const tier = await db.get('SELECT * FROM ticket_tiers WHERE id = $1 AND event_id = $2', [tierId, eventId]);
      if (tier) {
        tierName = tier.name;
        if (!pricePaid) finalPrice = tier.price;
      }
    }

    const attendeeId = db.generateUUID();
    const signature = generarFirmaQR(eventId, attendeeId, rutLimpio);

    const result = await db.transaction(async (tx) => {
      // 1. Guardar asistente
      await tx.run(`
        INSERT INTO attendees (id, event_id, tier_id, tier_name, full_name, rut, email, price_paid, qr_token, is_checked_in)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
      `, [attendeeId, eventId, tierId || null, tierName, fullName.trim(), rutLimpio, email.trim().toLowerCase(), finalPrice, signature]);

      // 2. Registrar automáticamente el INGRESO en finanzas
      await tx.run(`
        INSERT INTO transactions (id, event_id, type, category, description, amount, payment_method)
        VALUES ($1, $2, 'INCOME', 'Entradas', $3, $4, 'VENTA_ONLINE')
      `, [db.generateUUID(), eventId, `Entrada ${tierName} - ${fullName.trim()} (${rutLimpio})`, finalPrice]);

      return {
        id: attendeeId,
        event_id: eventId,
        tier_name: tierName,
        full_name: fullName.trim(),
        rut: rutLimpio,
        email: email.trim().toLowerCase(),
        price_paid: finalPrice,
        qr_token: signature
      };
    });

    // 3. Generar QR y enviar correo con el nombre de la productora
    const ticketDelivery = await emitirYEnviarTicket({
      attendee: result,
      event: { id: eventId, name: event.name },
      producer: { name: event.producer_name || 'Productora', contact_email: event.producer_email }
    });

    await registrarAuditoria(eventId, 'ISSUE_TICKET', { attendeeId, rut: rutLimpio, pricePaid: finalPrice }, req);

    res.json({
      success: true,
      attendee: result,
      qrDataUrl: ticketDelivery.qrDataUrl,
      emailSent: ticketDelivery.emailSent
    });
  } catch (err) {
    console.error('[Error Attendees]', err);
    res.status(500).json({ error: err.message });
  }
});

// 6b. Eliminar asistente / entrada emitida por error
app.delete('/api/events/:eventId/attendees/:attendeeId', async (req, res) => {
  try {
    const { eventId, attendeeId } = req.params;
    const attendee = await db.get('SELECT * FROM attendees WHERE id = $1 AND event_id = $2', [attendeeId, eventId]);
    if (!attendee) {
      return res.status(404).json({ error: 'Asistente no encontrado' });
    }

    await db.transaction(async (tx) => {
      // 1. Eliminar asistente
      await tx.run('DELETE FROM attendees WHERE id = $1 AND event_id = $2', [attendeeId, eventId]);

      // 2. Eliminar la transacción de ingreso si existía
      await tx.run(`
        DELETE FROM transactions 
        WHERE event_id = $1 
          AND type = 'INCOME' 
          AND category = 'Entradas' 
          AND description LIKE $2
      `, [eventId, `%${attendee.rut}%`]);
    });

    await registrarAuditoria(eventId, 'DELETE_ATTENDEE', { attendeeId, fullName: attendee.full_name, rut: attendee.rut }, req);
    res.json({ success: true, message: 'Asistente eliminado correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 📱 RUTAS: CONTROL DE ACCESO / ESCÁNER EN PUERTA
// ==========================================

// 7. Escanear código QR en puerta (Validación criptográfica + Protección anti-repetición)
app.post('/api/events/:eventId/scan', scanLimiter, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { qrRawData } = req.body;

    if (!qrRawData) {
      return res.status(400).json({ status: 'ERROR', message: 'No se recibieron datos del QR.' });
    }

    let parsed;
    let isManualRut = false;
    let manualRutFormatted = null;

    try {
      parsed = typeof qrRawData === 'string' ? JSON.parse(qrRawData) : qrRawData;
    } catch {
      // Respaldo en puerta: Si el asistente no tiene batería o la pantalla rota, el guardia puede ingresar su RUT
      if (typeof qrRawData === 'string' && validarRUT(qrRawData.trim())) {
        isManualRut = true;
        manualRutFormatted = formatearRUT(qrRawData.trim());
      } else {
        return res.status(400).json({ status: 'INVALID', message: 'Código QR ilegible o formato incorrecto.' });
      }
    }

    let attendee;

    if (isManualRut) {
      // Búsqueda directa por RUT acreditado
      attendee = await db.get('SELECT * FROM attendees WHERE rut = $1 AND event_id = $2', [manualRutFormatted, eventId]);
      if (!attendee) {
        return res.status(404).json({
          status: 'NOT_FOUND',
          message: 'RUT NO ENCONTRADO EN LA LISTA',
          details: `El RUT ${manualRutFormatted} no registra entradas compradas para este evento.`
        });
      }
    } else {
      const { tid, eid, sig } = parsed;

      // 1. Validar si el código pertenece a este evento
      if (eid !== eventId) {
        return res.status(400).json({
          status: 'WRONG_EVENT',
          message: 'ESTA ENTRADA PERTENECE A OTRO EVENTO',
          details: 'El código QR no corresponde al evento seleccionado actualmente.'
        });
      }

      // 2. Buscar al asistente
      attendee = await db.get('SELECT * FROM attendees WHERE id = $1 AND event_id = $2', [tid, eventId]);
      if (!attendee) {
        return res.status(404).json({
          status: 'NOT_FOUND',
          message: 'ENTRADA NO ENCONTRADA EN EL SISTEMA',
          details: 'Este código QR no existe en la base de datos de este evento.'
        });
      }

      // 3. 🔒 Verificación Criptográfica de Integridad (Evita falsificación de firmas)
      const esFirmaValida = verificarFirmaQR(eventId, attendee.id, attendee.rut, sig);
      if (!esFirmaValida) {
        await registrarAuditoria(eventId, 'SECURITY_ALERT_FAKE_QR', { tid, attemptedSig: sig }, req);
        return res.status(403).json({
          status: 'FAKE',
          message: '¡CÓDIGO QR ADULTERADO O FALSIFICADO!',
          details: 'La firma criptográfica no coincide con la clave de seguridad del evento.'
        });
      }
    }

    // 4. 🔒 Control Anti-Repetición (Evita que ingresen 2 personas con la misma entrada)
    if (attendee.is_checked_in) {
      return res.json({
        status: 'ALREADY_USED',
        message: '¡ENTRADA YA UTILIZADA ANTERIORMENTE!',
        checkedInAt: attendee.checked_in_at,
        attendee: {
          full_name: attendee.full_name,
          rut: attendee.rut,
          tier_name: attendee.tier_name
        }
      });
    }

    // 5. Marcar ingreso con timestamp
    const nowIso = new Date().toISOString();
    await db.run(
      'UPDATE attendees SET is_checked_in = 1, checked_in_at = $1 WHERE id = $2',
      [nowIso, attendee.id]
    );

    await registrarAuditoria(eventId, 'CHECK_IN_SUCCESS', { attendeeId: attendee.id, rut: attendee.rut }, req);

    // Retorna datos en grande para el personal de seguridad
    res.json({
      status: 'VALID',
      message: 'ACCESO AUTORIZADO',
      attendee: {
        id: attendee.id,
        full_name: attendee.full_name,
        rut: attendee.rut, // Mostrar en pantalla grande para comparar con carnet físico
        tier_name: attendee.tier_name,
        price_paid: attendee.price_paid
      }
    });
  } catch (err) {
    console.error('[Scan Error]', err);
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// ==========================================
// 🍸 RUTAS: STOCK DE BARRA Y ARQUEO DE CAJA
// ==========================================

// 8. Listar inventario de barra
app.get('/api/events/:eventId/bar', async (req, res) => {
  try {
    const { eventId } = req.params;
    const inventory = await db.query('SELECT * FROM bar_inventory WHERE event_id = $1 ORDER BY product_name ASC', [eventId]);
    const sales = await db.query('SELECT * FROM bar_sales WHERE event_id = $1 ORDER BY created_at DESC LIMIT 50', [eventId]);
    const closings = await db.query('SELECT * FROM bar_closings WHERE event_id = $1 ORDER BY closed_at DESC', [eventId]);
    const courtesyRecipients = await db.query('SELECT * FROM bar_courtesy_recipients WHERE event_id = $1 ORDER BY name ASC', [eventId]);
    const courtesies = await db.query('SELECT * FROM bar_courtesies WHERE event_id = $1 ORDER BY created_at DESC LIMIT 100', [eventId]);
    res.json({ inventory, sales, closings, courtesyRecipients, courtesies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Cargar producto a stock inicial (Costo se suma automáticamente a GASTOS)
app.post('/api/events/:eventId/bar', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { productName, unitCost, salePrice, initialStock } = req.body;

    if (!productName || unitCost === undefined || salePrice === undefined || !initialStock) {
      return res.status(400).json({ error: 'Todos los campos del producto son obligatorios.' });
    }

    const productId = db.generateUUID();
    const qty = parseInt(initialStock, 10);
    const cost = parseFloat(unitCost);
    const price = parseFloat(salePrice);
    const totalCost = cost * qty;

    const result = await db.transaction(async (tx) => {
      // 1. Guardar en inventario
      await tx.run(`
        INSERT INTO bar_inventory (id, event_id, product_name, unit_cost, sale_price, initial_stock, current_stock)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [productId, eventId, productName.trim(), cost, price, qty, qty]);

      // 2. Sumar automáticamente a los GASTOS del evento
      await tx.run(`
        INSERT INTO transactions (id, event_id, type, category, description, amount, payment_method)
        VALUES ($1, $2, 'EXPENSE', 'Compra Barra', $3, $4, 'PROVEEDOR')
      `, [db.generateUUID(), eventId, `Stock Inicial Barra: ${qty}x ${productName.trim()}`, totalCost]);

      return await tx.get('SELECT * FROM bar_inventory WHERE id = $1', [productId]);
    });

    await registrarAuditoria(eventId, 'ADD_BAR_STOCK', { productName, qty, totalCost }, req);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9b. Eliminar producto de barra registrado por error
app.delete('/api/events/:eventId/bar/:productId', async (req, res) => {
  try {
    const { eventId, productId } = req.params;
    const item = await db.get('SELECT * FROM bar_inventory WHERE id = $1 AND event_id = $2', [productId, eventId]);
    if (!item) {
      return res.status(404).json({ error: 'Producto no encontrado en inventario.' });
    }

    await db.transaction(async (tx) => {
      // 1. Eliminar cortesías y ventas asociadas a este producto
      await tx.run('DELETE FROM bar_courtesies WHERE product_id = $1 AND event_id = $2', [productId, eventId]);
      await tx.run('DELETE FROM bar_sales WHERE product_id = $1 AND event_id = $2', [productId, eventId]);

      // 2. Eliminar producto del inventario
      await tx.run('DELETE FROM bar_inventory WHERE id = $1 AND event_id = $2', [productId, eventId]);

      // 3. Eliminar gasto asociado a su compra inicial en transacciones
      await tx.run(`
        DELETE FROM transactions 
        WHERE event_id = $1 
          AND type = 'EXPENSE' 
          AND category = 'Compra Barra' 
          AND description LIKE $2
      `, [eventId, `%${item.product_name}%`]);
    });

    await registrarAuditoria(eventId, 'DELETE_BAR_PRODUCT', { productId, productName: item.product_name }, req);
    res.json({ success: true, message: 'Producto eliminado del inventario correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Registrar venta rápida de barra (POS de barra)
app.post('/api/events/:eventId/bar/sale', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { productId, quantity, paymentMethod } = req.body;

    const qty = parseInt(quantity, 10) || 1;
    const method = paymentMethod || 'CARD';

    const saleResult = await db.transaction(async (tx) => {
      const item = await tx.get('SELECT * FROM bar_inventory WHERE id = $1 AND event_id = $2', [productId, eventId]);
      if (!item) throw new Error('Producto no encontrado en inventario.');
      if (item.current_stock < qty) throw new Error(`Stock insuficiente. Solo quedan ${item.current_stock} unidades.`);

      const totalSale = item.sale_price * qty;

      // Descontar stock
      await tx.run('UPDATE bar_inventory SET current_stock = current_stock - $1 WHERE id = $2', [qty, productId]);

      // Registrar venta
      const saleId = db.generateUUID();
      await tx.run(`
        INSERT INTO bar_sales (id, event_id, product_id, product_name, quantity, unit_price, total_amount, payment_method)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [saleId, eventId, productId, item.product_name, qty, item.sale_price, totalSale, method]);

      // Sumar a INGRESOS de finanzas
      await tx.run(`
        INSERT INTO transactions (id, event_id, type, category, description, amount, payment_method)
        VALUES ($1, $2, 'INCOME', 'Venta Barra', $3, $4, $5)
      `, [db.generateUUID(), eventId, `Venta Barra: ${qty}x ${item.product_name}`, totalSale, method]);

      return { saleId, productName: item.product_name, quantity: qty, totalSale };
    });

    res.json({ success: true, ...saleResult });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 11. Arqueo y Cierre de Barra (Detecta mermas y descuadres de dinero calculando lo que sobró vs lo recaudado)
app.post('/api/events/:eventId/bar/closing', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { actualCashReported, itemsBreakdown, notes } = req.body;

    let theoreticalIncome = 0;

    // Si viene el desglose físico de lo que sobró por producto:
    if (Array.isArray(itemsBreakdown) && itemsBreakdown.length > 0) {
      itemsBreakdown.forEach(item => {
        const initial = Number(item.initialStock || 0);
        const leftover = Math.max(0, Number(item.leftoverStock || 0));
        const consumed = Math.max(0, initial - leftover);
        const itemRevenue = consumed * Number(item.salePrice || 0);
        theoreticalIncome += itemRevenue;
      });

      // Actualizar el stock actual en inventario con lo que sobró físicamente
      for (const item of itemsBreakdown) {
        if (item.productId && item.leftoverStock !== undefined) {
          await db.run(
            'UPDATE bar_inventory SET current_stock = $1 WHERE id = $2 AND event_id = $3',
            [Math.max(0, Number(item.leftoverStock)), item.productId, eventId]
          );
        }
      }
    } else {
      // Fallback: según ventas POS registradas
      const salesSum = await db.get(`
        SELECT COALESCE(SUM(total_amount), 0) AS total_sales
        FROM bar_sales
        WHERE event_id = $1
      `, [eventId]);
      theoreticalIncome = Number(salesSum.total_sales || 0);
    }

    const actualCash = Number(actualCashReported || 0);
    const discrepancy = actualCash - theoreticalIncome; // Negativo = faltante / robo / merma

    const closingId = db.generateUUID();
    await db.run(`
      INSERT INTO bar_closings (id, event_id, total_sales_calculated, actual_cash_reported, discrepancy, items_breakdown, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      closingId,
      eventId,
      theoreticalIncome,
      actualCash,
      discrepancy,
      itemsBreakdown ? JSON.stringify(itemsBreakdown) : null,
      notes || ''
    ]);

    await registrarAuditoria(eventId, 'BAR_CLOSING', {
      theoreticalIncome,
      actualCash,
      discrepancy,
      status: discrepancy === 0 ? 'CUADRADO' : discrepancy < 0 ? 'FALTANTE' : 'SOBRANTE'
    }, req);

    res.json({
      success: true,
      closingId,
      theoreticalIncome,
      actualCash,
      discrepancy,
      status: discrepancy === 0 ? 'CUADRADO' : discrepancy < 0 ? 'FALTANTE' : 'SOBRANTE'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 💰 RUTAS: FINANZAS, INGRESOS Y GASTOS (KPIs)
// ==========================================

// 12. Obtener resumen financiero completo
app.get('/api/events/:eventId/finances', async (req, res) => {
  try {
    const { eventId } = req.params;

    const transactions = await db.query(`
      SELECT * FROM transactions
      WHERE event_id = $1
      ORDER BY created_at DESC
    `, [eventId]);

    let totalIncome = 0;
    let totalExpense = 0;
    const incomeByCategory = {};
    const expenseByCategory = {};

    transactions.forEach(tx => {
      const amt = Number(tx.amount || 0);
      if (tx.type === 'INCOME') {
        totalIncome += amt;
        incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + amt;
      } else {
        totalExpense += amt;
        expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + amt;
      }
    });

    const netMargin = totalIncome - totalExpense;
    const breakEvenReached = totalIncome >= totalExpense;
    const breakEvenPercentage = totalExpense > 0 ? Math.min(Math.round((totalIncome / totalExpense) * 100), 999) : 100;

    res.json({
      summary: {
        totalIncome,
        totalExpense,
        netMargin,
        breakEvenReached,
        breakEvenPercentage,
        isProfitable: netMargin > 0
      },
      breakdown: {
        incomeByCategory,
        expenseByCategory
      },
      transactions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Registrar ingreso o gasto manual
app.post('/api/events/:eventId/transactions', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { type, category, description, amount, paymentMethod } = req.body;

    if (!type || !category || amount === undefined) {
      return res.status(400).json({ error: 'Tipo, categoría y monto son obligatorios.' });
    }

    const txId = db.generateUUID();
    const numAmount = parseFloat(amount);

    await db.run(`
      INSERT INTO transactions (id, event_id, type, category, description, amount, payment_method)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [txId, eventId, type, category, description || '', numAmount, paymentMethod || 'TRANSFER']);

    await registrarAuditoria(eventId, 'ADD_TRANSACTION', { type, category, numAmount }, req);

    const created = await db.get('SELECT * FROM transactions WHERE id = $1', [txId]);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Eliminar transacción
app.delete('/api/events/:eventId/transactions/:txId', async (req, res) => {
  try {
    const { eventId, txId } = req.params;
    await db.run('DELETE FROM transactions WHERE id = $1 AND event_id = $2', [txId, eventId]);
    await registrarAuditoria(eventId, 'DELETE_TRANSACTION', { txId }, req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 🎁 RUTAS: CONTROL DE CORTESÍAS DE BARRA
// ==========================================

// 15a. Listar destinatarios de cortesías del evento
app.get('/api/events/:eventId/bar/courtesy-recipients', async (req, res) => {
  try {
    const { eventId } = req.params;
    const recipients = await db.query(
      'SELECT * FROM bar_courtesy_recipients WHERE event_id = $1 ORDER BY name ASC',
      [eventId]
    );
    res.json(recipients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15b. Registrar nuevo destinatario de cortesía
app.post('/api/events/:eventId/bar/courtesy-recipients', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { name, role, notes, courtesyBudget } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'El nombre y el rol son obligatorios.' });
    }

    const validRoles = ['PRODUCCION', 'DJ', 'INVITADO', 'OTRO'];
    if (!validRoles.includes(role.toUpperCase())) {
      return res.status(400).json({ error: `Rol inválido. Opciones: ${validRoles.join(', ')}` });
    }

    const recipientId = db.generateUUID();
    await db.run(
      `INSERT INTO bar_courtesy_recipients (id, event_id, name, role, courtesy_budget, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [recipientId, eventId, name.trim(), role.toUpperCase(), parseInt(courtesyBudget, 10) || 0, notes || null]
    );

    await registrarAuditoria(eventId, 'ADD_COURTESY_RECIPIENT', { name, role, courtesyBudget }, req);

    const created = await db.get('SELECT * FROM bar_courtesy_recipients WHERE id = $1', [recipientId]);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15c. Eliminar destinatario de cortesía
app.delete('/api/events/:eventId/bar/courtesy-recipients/:recipientId', async (req, res) => {
  try {
    const { eventId, recipientId } = req.params;
    await db.run(
      'DELETE FROM bar_courtesy_recipients WHERE id = $1 AND event_id = $2',
      [recipientId, eventId]
    );
    await registrarAuditoria(eventId, 'DELETE_COURTESY_RECIPIENT', { recipientId }, req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15d. Registrar entrega de cortesía (descuenta stock, NO suma a ingresos)
app.post('/api/events/:eventId/bar/courtesy', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { productId, recipientId, quantity, notes } = req.body;

    if (!productId || !recipientId || !quantity) {
      return res.status(400).json({ error: 'Producto, destinatario y cantidad son obligatorios.' });
    }

    const qty = parseInt(quantity, 10);
    if (qty < 1) return res.status(400).json({ error: 'La cantidad debe ser al menos 1.' });

    const result = await db.transaction(async (tx) => {
      const item = await tx.get('SELECT * FROM bar_inventory WHERE id = $1 AND event_id = $2', [productId, eventId]);
      if (!item) throw new Error('Producto no encontrado en el inventario.');
      if (item.current_stock < qty) throw new Error(`Stock insuficiente. Solo quedan ${item.current_stock} unidades de ${item.product_name}.`);

      const recipient = await tx.get('SELECT * FROM bar_courtesy_recipients WHERE id = $1 AND event_id = $2', [recipientId, eventId]);
      if (!recipient) throw new Error('Destinatario no encontrado. Regístralo primero en Control de Cortesías.');

      // Descontar stock (la cortesía sí consume producto físicamente)
      await tx.run('UPDATE bar_inventory SET current_stock = current_stock - $1 WHERE id = $2', [qty, productId]);

      // Registrar la cortesía (SIN sumar a ingresos financieros)
      const courtesyId = db.generateUUID();
      await tx.run(
        `INSERT INTO bar_courtesies (id, event_id, product_id, product_name, recipient_id, recipient_name, recipient_role, quantity, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [courtesyId, eventId, productId, item.product_name, recipientId, recipient.name, recipient.role, qty, notes || null]
      );

      return { courtesyId, productName: item.product_name, recipientName: recipient.name, quantity: qty };
    });

    await registrarAuditoria(eventId, 'BAR_COURTESY', result, req);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 15e. Anular entrega de cortesía por error (devuelve el stock al producto)
app.delete('/api/events/:eventId/bar/courtesy/:courtesyId', async (req, res) => {
  try {
    const { eventId, courtesyId } = req.params;
    const courtesy = await db.get('SELECT * FROM bar_courtesies WHERE id = $1 AND event_id = $2', [courtesyId, eventId]);
    if (!courtesy) {
      return res.status(404).json({ error: 'Cortesía no encontrada' });
    }

    await db.transaction(async (tx) => {
      // 1. Devolver el stock al inventario
      await tx.run('UPDATE bar_inventory SET current_stock = current_stock + $1 WHERE id = $2 AND event_id = $3', [
        courtesy.quantity,
        courtesy.product_id,
        eventId
      ]);

      // 2. Eliminar el registro
      await tx.run('DELETE FROM bar_courtesies WHERE id = $1 AND event_id = $2', [courtesyId, eventId]);
    });

    await registrarAuditoria(eventId, 'CANCEL_COURTESY', courtesy, req);
    res.json({ success: true, message: 'Cortesía anulada y stock devuelto.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 🔐 RUTAS: AUDITORÍA DE CIBERSEGURIDAD
// ==========================================

// 16. Auditoría de Ciberseguridad
app.get('/api/events/:eventId/audit', async (req, res) => {
  try {
    const { eventId } = req.params;
    const logs = await db.query(
      'SELECT * FROM audit_logs WHERE event_id = $1 ORDER BY created_at DESC LIMIT 100',
      [eventId]
    );
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Iniciar servidor tras migrar base de datos
initDatabase().then(() => {
  app.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 API Control Productoras escuchando en http://localhost:${config.port}`);
    console.log(`🔒 Ciberseguridad: HMAC-SHA256, Helmet, Rate-Limit activo`);
    console.log(`💾 Base de Datos: ${db.isPostgres ? 'PostgreSQL' : 'SQLite Local (data/eventos.db)'}`);
    console.log(`=======================================================`);
  });
}).catch(err => {
  console.error('Error fatal al iniciar la base de datos:', err);
});

