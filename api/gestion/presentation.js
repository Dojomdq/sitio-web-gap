import { randomUUID } from 'node:crypto';
import Busboy from 'busboy';
import { getSupabaseAdmin, publicImageUrl, throwIfError } from '../../lib/server/config.js';
import { handleError, methodNotAllowed, readJson, requireSameOrigin, sendJson } from '../../lib/server/http.js';
import { isPresentationImagePath, PRESENTATION_BUCKET, PRESENTATION_IMAGE_LIMIT, presentationPayload, readPresentationPaths, writePresentationPaths } from '../../lib/server/presentation.js';
import { requireSession } from '../../lib/server/session.js';

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MIME_EXT = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);

function isRealImage(buffer, mime) {
  if (mime === 'image/jpeg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/webp') return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

function readMultipart(req) {
  return new Promise((resolve, reject) => {
    let parser;
    try { parser = Busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_FILE_BYTES } }); }
    catch { reject(Object.assign(new Error('El formulario de imagen no es válido.'), { statusCode: 400 })); return; }
    let image = null;
    let tooLarge = false;
    let invalidFile = false;
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
      resolve(image);
    });
    req.pipe(parser);
  });
}

async function readRequestJson(req) {
  const parsed = readJson(req);
  if (parsed) return parsed;
  if (req.body !== undefined) return null;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST', 'PUT', 'DELETE']);
  if (req.method !== 'GET' && !requireSameOrigin(req, res)) return;
  try {
    const session = await requireSession(req, res);
    if (!session) return;
    const supabase = getSupabaseAdmin();
    const paths = await readPresentationPaths(supabase);

    if (req.method === 'GET') return sendJson(res, 200, { images: presentationPayload(paths) });

    if (req.method === 'POST') {
      if (paths.length >= PRESENTATION_IMAGE_LIMIT) return sendJson(res, 409, { error: 'La portada ya tiene 3 fotos. Quitá una antes de agregar otra.' });
      const contentLength = Number(req.headers['content-length'] || 0);
      if (contentLength > MAX_FILE_BYTES + 64 * 1024) return sendJson(res, 413, { error: 'La imagen supera el máximo permitido.' });
      const image = await readMultipart(req);
      const path = `presentation/gallery/${randomUUID()}.${MIME_EXT.get(image.mime)}`;
      const { error: uploadError } = await supabase.storage.from(PRESENTATION_BUCKET).upload(path, image.buffer, {
        contentType: image.mime, cacheControl: '31536000', upsert: false,
      });
      throwIfError(uploadError);
      try {
        const next = [...paths, path];
        await writePresentationPaths(supabase, next);
        return sendJson(res, 201, { images: presentationPayload(next) });
      } catch (error) {
        await supabase.storage.from(PRESENTATION_BUCKET).remove([path]);
        throw error;
      }
    }

    const body = await readRequestJson(req);
    if (!body) return sendJson(res, 400, { error: 'La solicitud no tiene un formato válido.' });

    if (req.method === 'PUT') {
      const next = body.images;
      if (!Array.isArray(next) || next.length !== paths.length || new Set(next).size !== next.length || next.some((path) => !isPresentationImagePath(path)) || next.some((path) => !paths.includes(path))) {
        return sendJson(res, 400, { error: 'El orden de las fotos no es válido.' });
      }
      await writePresentationPaths(supabase, next);
      return sendJson(res, 200, { images: presentationPayload(next) });
    }

    const path = body.path;
    if (!isPresentationImagePath(path) || !paths.includes(path)) return sendJson(res, 404, { error: 'No encontramos esa foto de portada.' });
    const next = paths.filter((item) => item !== path);
    await writePresentationPaths(supabase, next);
    const { error: removeError } = await supabase.storage.from(PRESENTATION_BUCKET).remove([path]);
    throwIfError(removeError);
    return sendJson(res, 200, { images: presentationPayload(next) });
  } catch (error) {
    return handleError(res, error);
  }
}
