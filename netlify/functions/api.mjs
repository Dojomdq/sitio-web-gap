import { Readable } from 'node:stream';
import publicEvents from '../../api/events.js';
import login from '../../api/auth/login.js';
import session from '../../api/auth/session.js';
import logout from '../../api/auth/logout.js';
import changePassword from '../../api/auth/change-password.js';
import manageEvents from '../../api/gestion/events.js';
import manageEvent from '../../api/gestion/event.js';
import uploadImage from '../../api/gestion/upload.js';
import reorderEvents from '../../api/gestion/reorder.js';
import manageGalleryImage from '../../api/gestion/gallery.js';
import managePresentation from '../../api/gestion/presentation.js';
import publicPresentation from '../../api/presentation.js';

const handlers = new Map([
  ['/api/events', publicEvents],
  ['/api/auth/login', login],
  ['/api/auth/session', session],
  ['/api/auth/logout', logout],
  ['/api/auth/change-password', changePassword],
  ['/api/gestion/events', manageEvents],
  ['/api/gestion/event', manageEvent],
  ['/api/gestion/upload', uploadImage],
  ['/api/gestion/reorder', reorderEvents],
  ['/api/gestion/gallery', manageGalleryImage],
  ['/api/gestion/presentation', managePresentation],
  ['/api/presentation', publicPresentation],
]);

function requestUrl(event, headers) {
  const host = headers.host || 'localhost';
  const rawUrl = event.rawUrl || event.rawURL || event.path || '/';
  return new URL(rawUrl, `https://${host}`);
}

function apiPath(pathname) {
  const functionPrefix = '/.netlify/functions/api';
  if (pathname === functionPrefix) return '/api';
  if (pathname.startsWith(`${functionPrefix}/`)) return `/api/${pathname.slice(functionPrefix.length + 1)}`;
  return pathname;
}

function makeRequest(event, url, headers) {
  const source = event.body || '';
  const bodyBuffer = event.isBase64Encoded
    ? Buffer.from(source, 'base64')
    : Buffer.from(source, 'utf8');
  const req = Readable.from([bodyBuffer]);
  req.method = String(event.httpMethod || event.method || 'GET').toUpperCase();
  req.headers = headers;
  req.url = `${url.pathname}${url.search}`;
  req.query = Object.fromEntries(url.searchParams.entries());
  req.body = bodyBuffer.toString('utf8');
  req.socket = {
    remoteAddress: headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || 'unknown',
  };
  return req;
}

function makeResponse() {
  const headers = {};
  let body = '';
  let ended = false;
  return {
    headers,
    get statusCode() { return this._statusCode || 200; },
    set statusCode(value) { this._statusCode = value; },
    setHeader(name, value) { headers[String(name).toLowerCase()] = value; },
    end(value = '') {
      if (ended) return;
      ended = true;
      body = Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
    },
    result() {
      const cookie = headers['set-cookie'];
      const responseHeaders = { ...headers };
      delete responseHeaders['set-cookie'];
      return {
        statusCode: this.statusCode,
        headers: responseHeaders,
        ...(cookie ? { multiValueHeaders: { 'set-cookie': Array.isArray(cookie) ? cookie : [cookie] } } : {}),
        body,
      };
    },
  };
}

export const handler = async (event) => {
  const headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([name, value]) => [name.toLowerCase(), String(value)]),
  );
  const url = requestUrl(event, headers);
  const path = apiPath(url.pathname);
  const route = handlers.get(path);
  if (!route) {
    return { statusCode: 404, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ error: 'No encontramos esta ruta.' }) };
  }

  const req = makeRequest(event, url, headers);
  const res = makeResponse();
  try {
    await route(req, res);
  } catch (error) {
    console.error('GAP Netlify function error:', error?.message || 'unknown error');
    if (!res.headers['content-type']) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'No se pudo completar la solicitud.' }));
  }
  return res.result();
};
