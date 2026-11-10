import { getSupabaseAdmin, publicImageUrl, throwIfError } from '../../lib/server/config.js';
import { validateEventInput } from '../../lib/server/events.js';
import { handleError, methodNotAllowed, readJson, requireSameOrigin, sendJson } from '../../lib/server/http.js';
import { requireSession } from '../../lib/server/session.js';

const ADMIN_FIELDS = 'id, slug, title, artist_name, category, main_image_path, short_description, description, event_date, doors_at, ends_at, venue_name, address, visitor_info, ticket_url, ticket_provider, ticket_button_text, ticket_status, publication_status, display_order, created_at, updated_at';

async function attachGallery(supabase, events) {
  if (!events.length) return [];
  const { data: photos, error } = await supabase
    .from('event_gallery')
    .select('id, event_id, image_path, alt_text, display_order')
    .in('event_id', events.map((event) => event.id))
    .order('display_order', { ascending: true });
  throwIfError(error);
  const byId = new Map();
  for (const photo of photos || []) {
    if (!byId.has(photo.event_id)) byId.set(photo.event_id, []);
    byId.get(photo.event_id).push({ ...photo, image_url: publicImageUrl(photo.image_path) });
  }
  return events.map((event) => ({
    ...event,
    main_image_url: publicImageUrl(event.main_image_path),
    gallery: byId.get(event.id) || [],
  }));
}

export default async function handler(req, res) {
  try {
    const session = await requireSession(req, res);
    if (!session) return;
    const supabase = getSupabaseAdmin();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('events')
        .select(ADMIN_FIELDS)
        .order('event_date', { ascending: true })
        .order('display_order', { ascending: true });
      throwIfError(error);
      return sendJson(res, 200, { events: await attachGallery(supabase, data || []) });
    }

    if (req.method === 'POST') {
      if (!requireSameOrigin(req, res)) return;
      const input = readJson(req);
      const value = validateEventInput(input);
      const { data, error } = await supabase.from('events').insert(value).select(ADMIN_FIELDS).single();
      if (error?.code === '23505') return sendJson(res, 409, { error: 'Ya existe un evento con ese enlace.' });
      throwIfError(error);
      return sendJson(res, 201, { event: { ...data, main_image_url: publicImageUrl(data.main_image_path), gallery: [] } });
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (error) {
    return handleError(res, error);
  }
}
