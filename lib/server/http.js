export function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

export function methodNotAllowed(res, methods) {
  res.setHeader('Allow', methods.join(', '));
  sendJson(res, 405, { error: 'Método no permitido.' });
}

export function isSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return false;

  try {
    const parsed = new URL(origin);
    const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    return parsed.host.toLowerCase() === String(host).toLowerCase() && parsed.protocol === `${forwardedProto}:`;
  } catch {
    return false;
  }
}

export function requireSameOrigin(req, res) {
  if (isSameOrigin(req)) return true;
  sendJson(res, 403, { error: 'Origen de solicitud no permitido.' });
  return false;
}

export function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return null;
}

export function handleError(res, error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  if (status >= 500) console.error('GAP API error:', error?.message || 'unknown error');
  sendJson(res, status, { error: status >= 500 ? 'No se pudo completar la solicitud.' : error.message });
}

export function parseCookie(req, name) {
  const header = String(req.headers.cookie || '');
  for (const item of header.split(';')) {
    const index = item.indexOf('=');
    if (index < 0) continue;
    if (item.slice(0, index).trim() === name) {
      try { return decodeURIComponent(item.slice(index + 1).trim()); }
      catch { return null; }
    }
  }
  return null;
}

export function setSessionCookie(res, token, maxAgeSeconds) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

export const SESSION_COOKIE = '__Host-gap_session';
