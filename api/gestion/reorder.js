import { getSupabaseAdmin, throwIfError } from '../../lib/server/config.js';
import { handleError, methodNotAllowed, readJson, requireSameOrigin, sendJson } from '../../lib/server/http.js';
import { requireSession } from '../../lib/server/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!requireSameOrigin(req, res)) return;
  try {
    const session = await requireSession(req, res);
    if (!session) return;
    const ids = readJson(req)?.ids;
    if (!Array.isArray(ids) || ids.length > 200 || new Set(ids).size !== ids.length || ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
      return sendJson(res, 400, { error: 'El orden recibido no es válido.' });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('events').select('id');
    throwIfError(error);
    const existing = new Set((data || []).map((event) => event.id));
    if (ids.length !== existing.size || ids.some((id) => !existing.has(id))) return sendJson(res, 409, { error: 'La lista de eventos cambió. Actualizá el panel.' });
    for (let index = 0; index < ids.length; index += 1) {
      const { error: updateError } = await supabase.from('events').update({ display_order: index }).eq('id', ids[index]);
      throwIfError(updateError);
    }
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return handleError(res, error);
  }
}
