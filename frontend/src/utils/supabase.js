import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tuhlujpblmlgcdghduwz.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_g5QDJrZV6hVxmDZX5dfYmQ_qKwqwhAP';

export const supabase = createClient(supabaseUrl, supabaseKey);
