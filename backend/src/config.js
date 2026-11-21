import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  qrSecretKey: process.env.QR_SECRET_KEY || 'default_super_secret_key_change_me_in_production',
  supabaseUrl: process.env.SUPABASE_URL || 'https://tuhlujpblmlgcdghduwz.supabase.co',
  supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_g5QDJrZV6hVxmDZX5dfYmQ_qKwqwhAP',
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromEmail: process.env.SMTP_FROM_EMAIL || 'tickets@productora.cl',
  },
  dataDir: path.resolve(__dirname, '../data')
};
