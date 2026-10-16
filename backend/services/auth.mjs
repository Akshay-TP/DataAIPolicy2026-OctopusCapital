import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { assert } from '../middleware/http.mjs';

export function createAuth({demo, password, secureCookie}) {
  const sessions = new Map(), attempts = new Map();
  const salt = randomBytes(16), hash = scryptSync(password || 'demo', salt, 64);
  function userFor(req) {
    const token = (req.headers.cookie || '').split('; ').find(x => x.startsWith('fl_session='))?.slice(11);
    const user = sessions.get(token);
    if (user && user.expires > Date.now()) return {token, ...user};
    if (token) sessions.delete(token);
    return null;
  }
  function login(req, res, b) {
    const key=req.socket.remoteAddress, a=attempts.get(key)||{count:0,until:0};
    if(a.until<Date.now()){a.count=0;a.until=Date.now()+60000;}
    assert(a.count<10,'Too many attempts. Try again in a minute.',429);a.count++;attempts.set(key,a);
    assert(demo ? b.demo===true : typeof b.password==='string' && b.password.length<1024 && timingSafeEqual(scryptSync(b.password,salt,64),hash),'Incorrect password',401);
    const token=randomBytes(32).toString('hex'), user={name:demo?'Maya Santos':'Administrator',role:'admin',expires:Date.now()+8*3600000};
    sessions.set(token,user);
    res.setHeader('Set-Cookie',`fl_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookie?'; Secure':''}`);
    return {user,demo};
  }
  function logout(res, user) { sessions.delete(user.token);res.setHeader('Set-Cookie','fl_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); }
  return {userFor, login, logout};
}
