import { getSupabaseAdmin, throwIfError } from '../../lib/server/config.js';
import { validateEventInput } from '../../lib/server/events.js';
import { handleError, methodNotAllowed, readJson, requireSameOrigin, sendJson } from '../../lib/server/http.js';
import { requireSession } from '../../lib/server/session.js';

function validId(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '')); }

export default async function handler(req, res) {
  if (!['PUT', 'DELETE'].includes(req.method)) return methodNotAllowed(res, ['PUT', 'DELETE']);
  if (!requireSameOrigin(req, res)) return;

  try {
    const session = await requireSession(req, res);
    if (!session) return;
    const id = String(req.query?.id || '');
    if (!validId(id)) return sendJson(res, 400, { error: 'Evento no válido.' });
    const supabase = getSupabaseAdmin();

    if (req.method === 'PUT') {
      const value = validateEventInput(readJson(req), { partial: true });
      const { data, error } = await supabase.from('events').update(value).eq('id', id).select('*').maybeSingle();
      if (error?.code === '23505') return sendJson(res, 409, { error: 'Ya existe un evento con ese enlace.' });
      throwIfError(error);
      if (!data) return sendJson(res, 404, { error: 'No encontramos ese evento.' });
      return sendJson(res, 200, { event: data });
    }

    const { data: event, error: eventError } = await supabase.from('events').select('id, main_image_path').eq('id', id).maybeSingle();
    throwIfError(eventError);
    if (!event) return sendJson(res, 404, { error: 'No encontramos ese evento.' });
    const { data: gallery, error: galleryError } = await supabase.from('event_gallery').select('image_path').eq('event_id', id);
    throwIfError(galleryError);
    const paths = [...new Set([event.main_image_path, ...(gallery || []).map((image) => image.image_path)].filter(Boolean))];
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from('gap-eventos').remove(paths);
      if (storageError) throw storageError;
    }
    const { error } = await supabase.from('events').delete().eq('id', id);
    throwIfError(error);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return handleError(res, error);
  }
}
