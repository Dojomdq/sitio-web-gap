import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const username = String(process.env.GAP_ADMIN_USERNAME || 'Chino').trim();
const password = String(process.env.GAP_ADMIN_PASSWORD || '');

if (!url || !key) throw new Error('Completá SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.');
if (!/^[A-Za-z0-9_.-]{1,80}$/.test(username)) throw new Error('GAP_ADMIN_USERNAME solo puede incluir letras, números, punto, guion o guion bajo.');
if (password.length < 12 || password.length > 200 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
  throw new Error('GAP_ADMIN_PASSWORD debe tener 12 caracteres como mínimo e incluir letras y números.');
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: existing, error: lookupError } = await supabase.from('admin_users').select('id').eq('username', username).maybeSingle();
if (lookupError) throw lookupError;
if (existing) throw new Error('Ese usuario ya existe. El bootstrap no modifica credenciales existentes.');

const password_hash = await bcrypt.hash(password, 12);
const { error } = await supabase.from('admin_users').insert({ username, password_hash });
if (error) throw error;
console.log(`Usuario ${username} creado. La contraseña quedó guardada con hash bcrypt.`);
