import { getSupabaseAdmin, publicImageUrl } from '../lib/server/config.js';
import { publicEvent } from '../lib/server/events.js';
import { handleError, methodNotAllowed, sendJson } from '../lib/server/http.js';

const PUBLIC_FIELDS = 'id, slug, title, artist_name, category, main_image_path, short_description, description, event_date, doors_at, ends_at, venue_name, address, visitor_info, ticket_url, ticket_provider, ticket_button_text, ticket_status';

function withImage(event) {
  return { ...event, main_image_url: publicImageUrl(event.main_image_path) };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const supabase = getSupabaseAdmin();
    const slug = String(req.query?.slug || '').trim();

    if (slug) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return sendJson(res, 400, { error: 'Evento no válido.' });
      const { data, error } = await supabase
        .from('events')
        .select(PUBLIC_FIELDS)
        .eq('slug', slug)
        .eq('publication_status', 'published')
        .maybeSingle();
      if (error) throw error;
      if (!data) return sendJson(res, 404, { error: 'No encontramos ese evento.' });
      const { data: gallery, error: galleryError } = await supabase
        .from('event_gallery')
        .select('image_path, alt_text, display_order')
        .eq('event_id', data.id)
        .order('display_order', { ascending: true });
      if (galleryError) throw galleryError;
      return sendJson(res, 200, publicEvent(withImage(data), (gallery || []).map((image) => ({
        url: publicImageUrl(image.image_path),
        alt_text: image.alt_text,
        display_order: image.display_order,
      }))));
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('events')
      .select(PUBLIC_FIELDS)
      .eq('publication_status', 'published')
      .gte('event_date', now)
      .order('event_date', { ascending: true })
      .order('display_order', { ascending: true })
      .limit(100);
    if (error) throw error;
    const events = (data || []).map((event) => publicEvent(withImage(event)));
    return sendJson(res, 200, { events });
  } catch (error) {
    return handleError(res, error);
  }
}
