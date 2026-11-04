import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { assert } from '../middleware/http.mjs';

export function hashPassword(password) {
  const salt=randomBytes(16).toString('hex');
  return {salt,passwordHash:scryptSync(password,salt,64).toString('hex')};
}
function matches(password,credential) {
  if(typeof password!=='string'||password.length>1024)return false;
  return timingSafeEqual(scryptSync(password,credential.salt,64),Buffer.from(credential.passwordHash,'hex'));
}
export function createAuth({demo,password,secureCookie,repository}) {
  const sessions=new Map(),attempts=new Map();
  const root=hashPassword(password||'demo'),dummy=hashPassword('invalid-user-password');
  const bootstrap=()=>({id:'admin',username:'admin',name:demo?'Asha Patil':'Administrator',role:'admin',groupIds:[],active:true});
  function userFor(req) {
    const token=(req.headers.cookie||'').split('; ').find(x=>x.startsWith('fl_session='))?.slice(11);
    const session=sessions.get(token);
    if(!session||session.expires<=Date.now()){if(token)sessions.delete(token);return null;}
    const user=session.id==='admin'?bootstrap():repository.listStaff().find(u=>u.id===session.id&&u.active);
    if(!user){sessions.delete(token);return null;}
    return {token,...user,expires:session.expires};
  }
  function login(req,res,b) {
    const key=req.socket.remoteAddress,a=attempts.get(key)||{count:0,until:0};
    if(a.until<Date.now()){a.count=0;a.until=Date.now()+60000;}
    assert(a.count<10,'Too many attempts. Try again in a minute.',429);a.count++;attempts.set(key,a);
    let user;
    if(demo&&b.demo===true) user=bootstrap();
    else if(!b.username||b.username==='admin') {assert(matches(b.password,root),'Incorrect username or password',401);user=bootstrap();}
    else {
      const found=repository.listStaff(true).find(u=>u.username.toLowerCase()===String(b.username).toLowerCase());
      const valid=matches(b.password,found||dummy);assert(found?.active&&valid,'Incorrect username or password',401);
      user=repository.listStaff().find(u=>u.id===found.id);
    }
    const token=randomBytes(32).toString('hex'),expires=Date.now()+8*3600000;sessions.set(token,{id:user.id,expires});
    res.setHeader('Set-Cookie',`fl_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookie?'; Secure':''}`);
    return {user:{...user,expires},demo};
  }
  function logout(res,user){sessions.delete(user.token);res.setHeader('Set-Cookie','fl_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');}
  return {userFor,login,logout};
}
