import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from './config.js';
import { parseCookie, sendJson, SESSION_COOKIE } from './http.js';

const SESSION_HOURS = 8;

function sessionSecret() {
  const secret = process.env.GAP_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error('GAP_SESSION_SECRET must contain at least 32 characters');
    error.statusCode = 503;
    throw error;
  }
  return secret;
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function loginLimitKey(username, ipAddress) {
  return createHmac('sha256', sessionSecret())
    .update(`${String(username).toLowerCase()}|${ipAddress || 'unknown'}`)
    .digest('hex');
}

export function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.socket?.remoteAddress || 'unknown');
}

export async function clearLoginLimit(keyHash) {
  const { error } = await getSupabaseAdmin().rpc('clear_admin_login_attempt', { p_key_hash: keyHash });
  if (error) throw error;
}

export async function createSession(adminUserId) {
  const supabase = getSupabaseAdmin();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('admin_sessions').insert({
    admin_user_id: adminUserId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
  });
  if (error) throw error;
  return { token, expiresAt, maxAge: SESSION_HOURS * 60 * 60 };
}

export async function findSession(req) {
  const token = parseCookie(req, SESSION_COOKIE);
  if (!token || token.length < 32 || token.length > 128) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('admin_sessions')
    .select('id, admin_user_id, expires_at, admin_users!inner(id, username, is_active)')
    .eq('token_hash', hashToken(token))
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw error;

  const user = data?.admin_users;
  if (!data || !user?.is_active) return null;
  return { sessionId: data.id, userId: user.id, username: user.username };
}

export async function requireSession(req, res) {
  const session = await findSession(req);
  if (session) return session;
  sendJson(res, 401, { error: 'La sesión venció. Iniciá sesión nuevamente.' });
  return null;
}

export async function revokeSession(req) {
  const token = parseCookie(req, SESSION_COOKIE);
  if (!token) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('admin_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', hashToken(token))
    .is('revoked_at', null);
  if (error) throw error;
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
