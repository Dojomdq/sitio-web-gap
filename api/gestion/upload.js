import { randomUUID } from 'node:crypto';
import Busboy from 'busboy';
import { getSupabaseAdmin, publicImageUrl, throwIfError } from '../../lib/server/config.js';
import { handleError, methodNotAllowed, requireSameOrigin, sendJson } from '../../lib/server/http.js';
import { requireSession } from '../../lib/server/session.js';

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MIME_EXT = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function isRealImage(buffer, mime) {
  if (mime === 'image/jpeg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/webp') return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

function readMultipart(req) {
  return new Promise((resolve, reject) => {
    let parser;
    try { parser = Busboy({ headers: req.headers, limits: { files: 1, fields: 3, fileSize: MAX_FILE_BYTES } }); }
    catch { reject(Object.assign(new Error('El formulario de imagen no es válido.'), { statusCode: 400 })); return; }

    const fields = {};
    let image = null;
    let tooLarge = false;
    let invalidFile = false;
    parser.on('field', (name, value) => {
      if (['event_id', 'purpose', 'alt_text'].includes(name)) fields[name] = value;
    });
    parser.on('file', (name, stream, info) => {
      if (name !== 'image' || image) { invalidFile = true; stream.resume(); return; }
      const chunks = [];
      const mime = String(info.mimeType || '').toLowerCase();
      if (!MIME_EXT.has(mime)) invalidFile = true;
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('limit', () => { tooLarge = true; });
      stream.on('end', () => { image = { buffer: Buffer.concat(chunks), mime }; });
    });
    parser.on('filesLimit', () => { invalidFile = true; });
    parser.on('error', reject);
    parser.on('finish', () => {
      if (tooLarge) return reject(Object.assign(new Error('La imagen supera el máximo de 3 MB.'), { statusCode: 413 }));
      if (invalidFile || !image || !isRealImage(image.buffer, image.mime)) return reject(Object.assign(new Error('Subí una imagen JPG, PNG o WebP válida.'), { statusCode: 400 }));
      resolve({ fields, image });
    });
    req.pipe(parser);
  });
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!requireSameOrigin(req, res)) return;
  try {
    const session = await requireSession(req, res);
    if (!session) return;
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > MAX_FILE_BYTES + 64 * 1024) return sendJson(res, 413, { error: 'La imagen supera el máximo permitido.' });

    const { fields, image } = await readMultipart(req);
    const eventId = String(fields.event_id || '');
    const purpose = String(fields.purpose || '');
    if (!/^[0-9a-f-]{36}$/i.test(eventId) || !['main', 'gallery'].includes(purpose)) {
      return sendJson(res, 400, { error: 'Faltan datos del evento o el tipo de imagen.' });
    }

    const supabase = getSupabaseAdmin();
    const { data: event, error: eventError } = await supabase.from('events').select('id, main_image_path').eq('id', eventId).maybeSingle();
    throwIfError(eventError);
    if (!event) return sendJson(res, 404, { error: 'No encontramos ese evento.' });

    const path = `events/${eventId}/${randomUUID()}.${MIME_EXT.get(image.mime)}`;
    const { error: uploadError } = await supabase.storage.from('gap-eventos').upload(path, image.buffer, {
      contentType: image.mime,
      cacheControl: '31536000',
      upsert: false,
    });
    throwIfError(uploadError);

    if (purpose === 'main') {
      const { error } = await supabase.from('events').update({ main_image_path: path }).eq('id', eventId);
      if (error) {
        await supabase.storage.from('gap-eventos').remove([path]);
        throwIfError(error);
      }
      if (event.main_image_path) {
        const { error: oldFileError } = await supabase.storage.from('gap-eventos').remove([event.main_image_path]);
        if (oldFileError) console.warn('Could not remove replaced event image');
      }
      return sendJson(res, 201, { path, url: publicImageUrl(path) });
    }

    const { data: last, error: listError } = await supabase
      .from('event_gallery')
      .select('display_order')
      .eq('event_id', eventId)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(listError);
    const { data, error } = await supabase.from('event_gallery').insert({
      event_id: eventId,
      image_path: path,
      alt_text: String(fields.alt_text || '').slice(0, 240),
      display_order: Number(last?.display_order ?? -1) + 1,
    }).select('id, image_path, alt_text, display_order').single();
    if (error) {
      await supabase.storage.from('gap-eventos').remove([path]);
      throwIfError(error);
    }
    return sendJson(res, 201, { image: { ...data, image_url: publicImageUrl(path) } });
  } catch (error) {
    return handleError(res, error);
  }
}
