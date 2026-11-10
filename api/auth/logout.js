import { clearSessionCookie, handleError, methodNotAllowed, requireSameOrigin, sendJson } from '../../lib/server/http.js';
import { revokeSession } from '../../lib/server/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!requireSameOrigin(req, res)) return;
  try {
    await revokeSession(req);
    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return handleError(res, error);
  }
}
