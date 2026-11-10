import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '../../lib/server/config.js';
import { handleError, methodNotAllowed, readJson, requireSameOrigin, sendJson, setSessionCookie } from '../../lib/server/http.js';
import { clearLoginLimit, clientIp, createSession, loginLimitKey } from '../../lib/server/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!requireSameOrigin(req, res)) return;

  try {
    const body = readJson(req);
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '');
    if (!/^[A-Za-z0-9_.-]{1,80}$/.test(username) || !password || password.length > 200) {
      return sendJson(res, 400, { error: 'Ingresá usuario y contraseña.' });
    }

    const supabase = getSupabaseAdmin();
    const limitKey = loginLimitKey(username, clientIp(req));
    const { data: allowed, error: limitError } = await supabase.rpc('consume_admin_login_attempt', { p_key_hash: limitKey });
    if (limitError) throw limitError;
    if (!allowed) return sendJson(res, 429, { error: 'Demasiados intentos. Esperá 15 minutos y volvé a probar.' });

    const { data: user, error } = await supabase
      .from('admin_users')
      .select('id, username, password_hash, is_active')
      .eq('username', username)
      .maybeSingle();
    if (error) throw error;
    const valid = user?.is_active && await bcrypt.compare(password, user.password_hash);
    if (!valid) return sendJson(res, 401, { error: 'Usuario o contraseña incorrectos.' });

    await clearLoginLimit(limitKey);
    const session = await createSession(user.id);
    const { error: updateError } = await supabase.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
    if (updateError) throw updateError;
    setSessionCookie(res, session.token, session.maxAge);
    return sendJson(res, 200, { ok: true, username: user.username, expires_at: session.expiresAt });
  } catch (error) {
    return handleError(res, error);
  }
}
