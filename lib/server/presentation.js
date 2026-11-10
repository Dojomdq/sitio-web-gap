import { publicImageUrl, throwIfError } from './config.js';

export const PRESENTATION_BUCKET = 'gap-eventos';
export const PRESENTATION_MANIFEST = 'presentation/gallery.json';
export const PRESENTATION_IMAGE_LIMIT = 3;

const isPresentationPath = (path) => typeof path === 'string'
  && /^presentation\/gallery\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(path);

export async function readPresentationPaths(supabase) {
  const { data, error } = await supabase.storage
    .from(PRESENTATION_BUCKET)
    .download(PRESENTATION_MANIFEST);

  if (error) {
    const status = Number(error.statusCode || error.status || 0);
    if (status === 404 || /not found|no such object/i.test(error.message || '')) return [];
    throwIfError(error);
  }

  let manifest;
  try {
    manifest = JSON.parse(await data.text());
  } catch {
    const error = new Error('La lista de fotos de portada no tiene un formato válido.');
    error.statusCode = 502;
    throw error;
  }

  if (!Array.isArray(manifest?.images)) return [];
  return manifest.images.filter(isPresentationPath).slice(0, PRESENTATION_IMAGE_LIMIT);
}

export async function writePresentationPaths(supabase, images) {
  const { error } = await supabase.storage
    .from(PRESENTATION_BUCKET)
    .upload(PRESENTATION_MANIFEST, JSON.stringify({ images }), {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: true,
    });
  throwIfError(error);
}

export function presentationPayload(paths) {
  return paths.map((path) => ({ path, url: publicImageUrl(path) }));
}

export function isPresentationImagePath(path) {
  return isPresentationPath(path);
}
