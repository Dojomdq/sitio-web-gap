import { getSupabaseAdmin } from '../lib/server/config.js';
import { handleError, methodNotAllowed, sendJson } from '../lib/server/http.js';
import { presentationPayload, readPresentationPaths } from '../lib/server/presentation.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const paths = await readPresentationPaths(getSupabaseAdmin());
    return sendJson(res, 200, { images: presentationPayload(paths) });
  } catch (error) {
    return handleError(res, error);
  }
}
