import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import type { Database } from '@/types/database';

const extra = Constants.expoConfig?.extra ?? {};

const SUPABASE_URL = (process.env.SUPABASE_URL ?? extra.SUPABASE_URL) as string | undefined;
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY ?? extra.SUPABASE_ANON_KEY) as
  | string
  | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env or app.json extra.',
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
