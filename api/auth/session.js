import { findSession } from '../../lib/server/session.js';
import { handleError, methodNotAllowed, sendJson } from '../../lib/server/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = await findSession(req);
    if (!session) return sendJson(res, 401, { authenticated: false });
    return sendJson(res, 200, { authenticated: true, username: session.username });
  } catch (error) {
    return handleError(res, error);
  }
}
