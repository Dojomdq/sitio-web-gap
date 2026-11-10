import { getSupabaseAdmin, throwIfError } from '../../lib/server/config.js';
import { handleError, methodNotAllowed, requireSameOrigin, sendJson } from '../../lib/server/http.js';
import { requireSession } from '../../lib/server/session.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return methodNotAllowed(res, ['DELETE']);
  if (!requireSameOrigin(req, res)) return;
  try {
    const session = await requireSession(req, res);
    if (!session) return;
    const id = String(req.query?.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return sendJson(res, 400, { error: 'Imagen no válida.' });
    const supabase = getSupabaseAdmin();
    const { data: image, error } = await supabase.from('event_gallery').select('id, image_path').eq('id', id).maybeSingle();
    throwIfError(error);
    if (!image) return sendJson(res, 404, { error: 'No encontramos esa imagen.' });
    const { error: storageError } = await supabase.storage.from('gap-eventos').remove([image.image_path]);
    throwIfError(storageError);
    const { error: deleteError } = await supabase.from('event_gallery').delete().eq('id', id);
    throwIfError(deleteError);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return handleError(res, error);
  }
}
