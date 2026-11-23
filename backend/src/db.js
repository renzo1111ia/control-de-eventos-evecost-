import Database from 'better-sqlite3';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from './config.js';

let isPostgres = false;
let pgPool = null;
let sqliteDb = null;

const cleanDbUrl = (config.databaseUrl || '').trim().replace(/^['"]|['"]$/g, '');

if (cleanDbUrl && cleanDbUrl.startsWith('postgres')) {
  isPostgres = true;
  pgPool = new pg.Pool({
    connectionString: cleanDbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });
  console.log('[DB] Conectado a PostgreSQL (Supabase SSL)');
} else {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
  const dbPath = path.join(config.dataDir, 'eventos.db');
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
  console.log(`[DB] Conectado a SQLite Local: ${dbPath}`);
}

function normalizeQuery(sql) {
  if (isPostgres) return sql;
  return sql.replace(/\$\d+/g, '?');
}

export const db = {
  isPostgres,

  generateUUID() {
    return crypto.randomUUID();
  },

  async query(sql, params = []) {
    if (isPostgres) {
      const res = await pgPool.query(sql, params);
      return res.rows;
    } else {
      const normalized = normalizeQuery(sql);
      const stmt = sqliteDb.prepare(normalized);
      if (normalized.trim().toUpperCase().startsWith('SELECT')) {
        return stmt.all(...params);
      } else {
        const info = stmt.run(...params);
        return info;
      }
    }
  },

  async get(sql, params = []) {
    if (isPostgres) {
      const res = await pgPool.query(sql, params);
      return res.rows[0] || null;
    } else {
      const normalized = normalizeQuery(sql);
      const stmt = sqliteDb.prepare(normalized);
      return stmt.get(...params) || null;
    }
  },

  async run(sql, params = []) {
    if (isPostgres) {
      const res = await pgPool.query(sql, params);
      return res;
    } else {
      const normalized = normalizeQuery(sql);
      const stmt = sqliteDb.prepare(normalized);
      return stmt.run(...params);
    }
  },

  async transaction(fn) {
    if (isPostgres) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const txDb = {
          query: (sql, params) => client.query(sql, params).then(r => r.rows),
          get: (sql, params) => client.query(sql, params).then(r => r.rows[0] || null),
          run: (sql, params) => client.query(sql, params)
        };
        const result = await fn(txDb);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      sqliteDb.exec('BEGIN');
      try {
        const txDb = {
          query: async (sql, params = []) => {
            const norm = normalizeQuery(sql);
            const stmt = sqliteDb.prepare(norm);
            return norm.trim().toUpperCase().startsWith('SELECT') ? stmt.all(...params) : stmt.run(...params);
          },
          get: async (sql, params = []) => {
            const norm = normalizeQuery(sql);
            return sqliteDb.prepare(norm).get(...params) || null;
          },
          run: async (sql, params = []) => {
            const norm = normalizeQuery(sql);
            return sqliteDb.prepare(norm).run(...params);
          }
        };
        const result = await fn(txDb);
        sqliteDb.exec('COMMIT');
        return result;
      } catch (err) {
        sqliteDb.exec('ROLLBACK');
        throw err;
      }
    }
  }
};
