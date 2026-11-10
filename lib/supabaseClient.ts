import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Public Supabase configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and a publishable or anon key.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
