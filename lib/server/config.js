import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

let adminClient;

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const error = new Error('Supabase server configuration is missing');
    error.statusCode = 503;
    throw error;
  }

  adminClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: { headers: { 'X-Client-Info': 'gap-vercel-functions' } },
  });
  return adminClient;
}

export function publicImageUrl(path) {
  if (!path) return null;
  const { data } = getSupabaseAdmin().storage.from('gap-eventos').getPublicUrl(path);
  return data.publicUrl;
}

export function imageUrls(paths = []) {
  return paths.map((path) => publicImageUrl(path)).filter(Boolean);
}

export function throwIfError(error) {
  if (!error) return;
  const wrapped = new Error('The data service could not complete the request');
  wrapped.statusCode = 502;
  wrapped.cause = error;
  throw wrapped;
}
