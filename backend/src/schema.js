import { db } from './db.js';

export async function initDatabase() {
  if (db.isPostgres) {
    console.log('[DB] Conectado a PostgreSQL en la nube. Las tablas son administradas por Supabase.');
    try {
      const existingEvents = await db.query('SELECT id FROM events LIMIT 1');
      if (existingEvents.length === 0) {
        const defaultEventId = '11111111-1111-1111-1111-111111111111';
        await db.run(
          `INSERT INTO events (id, name, event_date, has_bar, is_configured)
           VALUES ($1, $2, NOW() + INTERVAL '7 days', false, false)`,
          [defaultEventId, 'Nuevo Evento de Productora']
        );
        await db.run(
          `INSERT INTO ticket_tiers (id, event_id, name, price, capacity)
           VALUES ($1, $2, 'Preventa General', 10000, 200)`,
          [db.generateUUID(), defaultEventId]
        );
        await db.run(
          `INSERT INTO ticket_tiers (id, event_id, name, price, capacity)
           VALUES ($1, $2, 'Puerta General', 15000, 100)`,
          [db.generateUUID(), defaultEventId]
        );
        await db.run(
          `INSERT INTO ticket_tiers (id, event_id, name, price, capacity)
           VALUES ($1, $2, 'VIP Exclusivo', 25000, 50)`,
          [db.generateUUID(), defaultEventId]
        );
        console.log('[DB] Evento inicial creado en PostgreSQL.');
      }
    } catch (err) {
      console.warn('[DB Warning al verificar eventos iniciales]:', err.message);
    }
    return;
  }

  console.log('[DB] Inicializando esquema SQLite local...');

  // Tabla 1: Productoras
  await db.run(`
    CREATE TABLE IF NOT EXISTS producers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      logo_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Tabla 2: Eventos
  await db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      producer_id TEXT,
      name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      has_bar INTEGER DEFAULT 0,
      is_configured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (producer_id) REFERENCES producers(id) ON DELETE SET NULL
    );
  `);

  // Tabla 3: Tipos de Entradas (Tiers)
  await db.run(`
    CREATE TABLE IF NOT EXISTS ticket_tiers (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      capacity INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );
  `);

  // Tabla 4: Asistentes y Entradas QR
  await db.run(`
    CREATE TABLE IF NOT EXISTS attendees (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      tier_id TEXT,
      tier_name TEXT,
      full_name TEXT NOT NULL,
      rut TEXT NOT NULL,
      email TEXT NOT NULL,
      price_paid REAL NOT NULL,
      qr_token TEXT UNIQUE NOT NULL,
      is_checked_in INTEGER DEFAULT 0,
      checked_in_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id) ON DELETE SET NULL
    );
  `);

  // Tabla 5: Finanzas (Ingresos y Gastos)
  await db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      type TEXT CHECK (type IN ('INCOME', 'EXPENSE')) NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'TRANSFER',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );
  `);

  // Tabla 6: Inventario de Barra
  await db.run(`
    CREATE TABLE IF NOT EXISTS bar_inventory (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      unit_cost REAL NOT NULL,
      sale_price REAL NOT NULL,
      initial_stock INTEGER NOT NULL,
      current_stock INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );
  `);

  // Tabla 7: Ventas de Barra (POS rÃ¡pido)
  await db.run(`
    CREATE TABLE IF NOT EXISTS bar_sales (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'CARD',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES bar_inventory(id) ON DELETE CASCADE
    );
  `);

  // Tabla 8: Arqueo / Cierre de Barra
  await db.run(`
    CREATE TABLE IF NOT EXISTS bar_closings (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      total_sales_calculated REAL NOT NULL,
      actual_cash_reported REAL NOT NULL,
      discrepancy REAL NOT NULL,
      items_breakdown TEXT,
      notes TEXT,
      closed_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );
  `);

  // Asegurar columna items_breakdown en bases de datos existentes
  try {
    await db.run('ALTER TABLE bar_closings ADD COLUMN items_breakdown TEXT');
  } catch {
    // Ya existe la columna
  }

  // Tabla 9: AuditorÃ­a de Ciberseguridad (Logs Inmutables)
  await db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Tabla 10: Destinatarios de Cortesías (personal, DJs, invitados)
  await db.run(`
    CREATE TABLE IF NOT EXISTS bar_courtesy_recipients (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      courtesy_budget INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );
  `);

  // Asegurar columnas en bases de datos existentes
  try { await db.run('ALTER TABLE bar_courtesy_recipients ADD COLUMN notes TEXT'); } catch {}
  try { await db.run('ALTER TABLE bar_courtesy_recipients ADD COLUMN courtesy_budget INTEGER DEFAULT 0'); } catch {}

  // Tabla 11: Registro de Entregas de Cortesías
  await db.run(`
    CREATE TABLE IF NOT EXISTS bar_courtesies (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_role TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES bar_inventory(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES bar_courtesy_recipients(id) ON DELETE CASCADE
    );
  `);

    // Insertar un evento por defecto sin configurar si no existe ninguno
  const existingEvents = await db.query('SELECT id FROM events LIMIT 1');
  if (existingEvents.length === 0) {
    const defaultEventId = '11111111-1111-1111-1111-111111111111';
    await db.run(
      `INSERT INTO events (id, name, event_date, has_bar, is_configured)
       VALUES ($1, $2, datetime('now', '+7 days'), 0, 0)`,
      [defaultEventId, 'Nuevo Evento de Productora']
    );

    // Tipos de entrada base
    await db.run(
      `INSERT INTO ticket_tiers (id, event_id, name, price, capacity)
       VALUES ($1, $2, 'Preventa General', 10000, 200)`,
      [db.generateUUID(), defaultEventId]
    );
    await db.run(
      `INSERT INTO ticket_tiers (id, event_id, name, price, capacity)
       VALUES ($1, $2, 'Puerta General', 15000, 100)`,
      [db.generateUUID(), defaultEventId]
    );
    await db.run(
      `INSERT INTO ticket_tiers (id, event_id, name, price, capacity)
       VALUES ($1, $2, 'VIP Exclusivo', 25000, 50)`,
      [db.generateUUID(), defaultEventId]
    );

    console.log('[DB] Evento inicial creado para el primer inicio (ID: 11111111-1111-1111-1111-111111111111)');
  }

  console.log('[DB] Esquema verificado y tablas listas.');
}

