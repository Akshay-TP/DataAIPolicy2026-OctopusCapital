import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { assert } from '../middleware/http.mjs';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return { salt, passwordHash: scryptSync(password, salt, 64).toString('hex') };
}
function matches(password, credential) {
  if (typeof password !== 'string' || password.length > 1024) return false;
  return timingSafeEqual(scryptSync(password, credential.salt, 64), Buffer.from(credential.passwordHash, 'hex'));
}
const MAX_SESSIONS = 5000;
// Number of trusted reverse proxies in front of the app (e.g. 1 on Render). 0 = use the socket address.
const TRUSTED_PROXY_HOPS = Math.max(0, Number.parseInt(process.env.TRUSTED_PROXY_HOPS || '0', 10) || 0);
function clientAddress(req) {
  if (TRUSTED_PROXY_HOPS) {
    const hops = String(req.headers['x-forwarded-for'] || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);
    // Count from the right: entries added by our own proxies are trustworthy, anything further left is client-supplied.
    const client = hops[hops.length - TRUSTED_PROXY_HOPS];
    if (client) return client;
  }
  return req.socket.remoteAddress;
}
export function createAuth({ demo, password, secureCookie, repository, cookieName = 'fl_session' }) {
  if (!/^[a-zA-Z0-9_]{1,50}$/.test(cookieName)) throw new Error('Invalid session cookie name');
  const sessions = new Map(),
    attempts = new Map();
  const clearedCookie = `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie ? '; Secure' : ''}`;
  function sweep() {
    const now = Date.now();
    for (const [token, session] of sessions) if (session.expires <= now) sessions.delete(token);
    for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key);
  }
  const root = hashPassword(password || 'demo'),
    dummy = hashPassword('invalid-user-password');
  const bootstrap = () => ({
    id: 'admin',
    username: 'admin',
    name: demo ? 'Asha Patil' : 'Administrator',
    role: 'admin',
    groupIds: [],
    active: true,
  });
  function userFor(req) {
    const token = (req.headers.cookie || '')
      .split(';')
      .map(x => x.trim())
      .find(x => x.startsWith(cookieName + '='))
      ?.slice(cookieName.length + 1);
    const session = token ? sessions.get(token) : undefined;
    if (!session || session.expires <= Date.now()) {
      if (token) sessions.delete(token);
      return null;
    }
    const user =
      session.id === 'admin' ? bootstrap() : repository.listStaff().find(u => u.id === session.id && u.active);
    if (!user) {
      sessions.delete(token);
      return null;
    }
    return { token, ...user, expires: session.expires };
  }
  function login(req, res, b) {
    sweep();
    const key = clientAddress(req),
      a = attempts.get(key) || { count: 0, until: 0 };
    if (a.until < Date.now()) {
      a.count = 0;
      a.until = Date.now() + 60000;
    }
    const passwordless = demo && b.demo === true; // no secret to guess, so it is not throttled
    if (!passwordless) {
      assert(a.count < 10, 'Too many attempts. Try again in a minute.', 429);
      a.count++;
      attempts.set(key, a);
    }
    let user;
    if (passwordless) user = bootstrap();
    else if (!b.username || b.username === 'admin') {
      assert(matches(b.password, root), 'Incorrect username or password', 401);
      user = bootstrap();
    } else {
      const found = repository.listStaff(true).find(u => u.username.toLowerCase() === String(b.username).toLowerCase());
      const valid = matches(b.password, found || dummy);
      assert(found?.active && valid, 'Incorrect username or password', 401);
      user = repository.listStaff().find(u => u.id === found.id);
    }
    while (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value); // evict oldest
    const token = randomBytes(32).toString('hex'),
      expires = Date.now() + 8 * 3600000;
    sessions.set(token, { id: user.id, expires });
    res.setHeader(
      'Set-Cookie',
      `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookie ? '; Secure' : ''}`
    );
    return { user: { ...user, expires }, demo };
  }
  function logout(res, user) {
    sessions.delete(user.token);
    res.setHeader('Set-Cookie', clearedCookie);
  }
  /** End every session of an account, e.g. after its password is reset. */
  function revokeSessions(userId, exceptToken) {
    for (const [token, session] of sessions) if (session.id === userId && token !== exceptToken) sessions.delete(token);
  }
  return { userFor, login, logout, revokeSessions };
}
