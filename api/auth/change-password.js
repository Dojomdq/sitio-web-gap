import bcrypt from 'bcryptjs';
import { getSupabaseAdmin, throwIfError } from '../../lib/server/config.js';
import { handleError, methodNotAllowed, readJson, requireSameOrigin, sendJson, clearSessionCookie } from '../../lib/server/http.js';
import { requireSession } from '../../lib/server/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!requireSameOrigin(req, res)) return;
  try {
    const session = await requireSession(req, res);
    if (!session) return;
    const body = readJson(req);
    const currentPassword = String(body?.current_password || '');
    const newPassword = String(body?.new_password || '');
    if (newPassword.length < 12 || newPassword.length > 200 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return sendJson(res, 400, { error: 'Usá al menos 12 caracteres e incluí letras y números.' });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase.from('admin_users').select('id, password_hash').eq('id', session.userId).single();
    throwIfError(error);
    if (!await bcrypt.compare(currentPassword, user.password_hash)) return sendJson(res, 401, { error: 'La contraseña actual no coincide.' });

    const password_hash = await bcrypt.hash(newPassword, 12);
    const { error: updateError } = await supabase.from('admin_users').update({ password_hash }).eq('id', session.userId);
    throwIfError(updateError);
    const { error: revokeError } = await supabase.from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('admin_user_id', session.userId).is('revoked_at', null);
    throwIfError(revokeError);
    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true, reauthenticated: false });
  } catch (error) {
    return handleError(res, error);
  }
}
