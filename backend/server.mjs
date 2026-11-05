import { loadAuthority } from './services/certificates.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRepository } from '../database/repository.mjs';
import { createAuth } from './services/auth.mjs';
import { createApiRouter } from './routes/api.mjs';
import { ApiError, assert, json } from './middleware/http.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 3000),
  host = process.env.HOST || '127.0.0.1';
const demo = process.env.DEMO_MODE !== 'false' && process.env.NODE_ENV !== 'production';
const loopback = ['127.0.0.1', '::1', 'localhost'].includes(host);
// Demo mode intentionally offers a passwordless admin login so reviewers can explore it.
// That is safe only with synthetic data, so say so loudly when it is network-reachable.
if (demo && !loopback)
  console.warn('NOTICE: demo mode is network-reachable. Anyone can sign in; keep it to synthetic data only.');
if (!demo && !loopback && process.env.COOKIE_SECURE !== 'true')
  console.warn(
    'WARNING: COOKIE_SECURE is not true. Serve FieldLedger over HTTPS and set COOKIE_SECURE=true before handling real records.'
  );
if (!demo && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12))
  throw new Error('Set ADMIN_PASSWORD to at least 12 characters when demo mode is disabled.');
const dataDir = resolve(process.env.DATA_DIR || resolve(root, demo ? 'data/india-demo' : 'private-data')),
  repository = openRepository({ dataDir, demo }),
  authority = loadAuthority({ demo, dataDir });
const auth = createAuth({
  demo,
  password: process.env.ADMIN_PASSWORD,
  cookieName: process.env.SESSION_COOKIE_NAME || 'fl_session',
  secureCookie: process.env.COOKIE_SECURE === 'true',
  repository,
});
const routeApi = createApiRouter({ repository, auth, demo, authority });
const files = {
  '/certificates.js': 'certificates.js',
  '/shared/certificates.mjs': 'certificates.mjs',
  '/vendor/jsqr.js': 'jsQR.js',
  '/support.js': 'support.js',
  '/shared/support.mjs': 'support.mjs',
  '/shared/offline-model.mjs': 'offline-model.mjs',
  '/household.js': 'household.js',
  '/shared/health.mjs': 'health.mjs',
  '/shared/catalog.mjs': 'catalog.mjs',
  '/': 'index.html',
  '/app.js': 'app.js',
  '/features.js': 'features.js',
  '/offline.js': 'offline.js',
  '/i18n.js': 'i18n.js',
  '/translations.js': 'translations.js',
  '/styles.css': 'styles.css',
  '/sw.js': 'sw.js',
  '/manifest.webmanifest': 'manifest.webmanifest',
};
const types = {
  '.mjs': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (process.env.COOKIE_SECURE === 'true')
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  try {
    let url;
    try {
      url = new URL(req.url, 'http://' + req.headers.host);
    } catch {
      throw new ApiError('Bad request', 400);
    }
    const path = url.pathname;
    if (path === '/healthz') return json(res, 200, { ok: true });
    if (path.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(req.method)) {
        assert(req.headers['content-type']?.startsWith('application/json'), 'JSON content type required', 415);
        const expectedOrigin =
          process.env.APP_ORIGIN || `${process.env.COOKIE_SECURE === 'true' ? 'https' : 'http'}://${req.headers.host}`;
        if (req.headers.origin) assert(req.headers.origin === expectedOrigin, 'Origin rejected', 403);
        else
          assert(
            ['same-origin', 'none', undefined].includes(req.headers['sec-fetch-site']),
            'Cross-site request rejected',
            403
          );
      }
      return await routeApi(req, res, url);
    }
    assert(['GET', 'HEAD'].includes(req.method), 'Method not allowed', 405);
    assert(files[path], 'Not found', 404);
    const file = await readFile(
      path === '/vendor/jsqr.js'
        ? resolve(root, 'node_modules/jsqr/dist/jsQR.js')
        : path.startsWith('/shared/')
          ? resolve(root, 'shared', files[path])
          : resolve(root, 'frontend/public', files[path])
    );
    res.writeHead(200, { 'Content-Type': types[extname(files[path])], 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : file);
  } catch (e) {
    json(res, e.status || 500, { error: e.status ? e.message : 'An unexpected server error occurred' });
    if (!e.status) console.error(e);
  }
});
server.listen(port, host, () =>
  console.log(
    'FieldLedger: http://' +
      host +
      ':' +
      server.address().port +
      ' (' +
      (demo ? 'synthetic demo' : 'private workspace') +
      ')'
  )
);
function shutdown() {
  server.close(() => {
    repository.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
