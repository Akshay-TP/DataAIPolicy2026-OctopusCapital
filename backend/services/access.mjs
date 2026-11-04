import {SUPPORT_COLLECTIONS} from '../../shared/support.mjs';
import { assert } from '../middleware/http.mjs';
export function requireRole(user,...roles){assert(roles.includes(user.role),'Your role cannot perform this action',403);}
export function groupAccess(user,groupId){assert(user.role!=='officer'||user.groupIds.includes(groupId),'Group is not assigned to this officer',403);}
export function memberAccess(s,user,id){const m=s.members.find(m=>m.id===id);assert(m,'Member not found',404);groupAccess(user,m.groupId);return m;}
export function scopedWorkspace(s,user,staff) {
  const allowed=user.role==='officer'?s.groups.filter(g=>user.groupIds.includes(g.id)):s.groups;
  const members=s.members.filter(m=>allowed.some(g=>g.id===m.groupId)),ids=new Set(members.map(m=>m.id));
  const visits=s.visits.filter(v=>ids.has(v.memberId)),visitIds=new Set(visits.map(v=>v.id));
  const people=(s.supportPeople||[]).filter(p=>allowed.some(g=>g.id===p.groupId)),personIds=new Set(people.map(p=>p.id));
  const support=Object.fromEntries(SUPPORT_COLLECTIONS.map(key=>[key,key==='supportPeople'?people:(s[key]||[]).filter(r=>personIds.has(r.personId))]));
  return {...s,...support,groups:allowed,members,visits,checkins:(s.checkins||[]).filter(c=>ids.has(c.memberId)),supportPlans:(s.supportPlans||[]).filter(p=>ids.has(p.memberId)),scenarios:(s.scenarios||[]).filter(e=>ids.has(e.memberId)),cashflow:(s.cashflow||[]).filter(e=>ids.has(e.memberId)),loans:s.loans.filter(l=>ids.has(l.memberId)),followups:s.followups.filter(f=>ids.has(f.memberId)),revisions:s.revisions.filter(r=>visitIds.has(r.visitId)),audit:user.role==='officer'?[]:s.audit,staff:staff.filter(u=>user.role!=='officer'||u.id===user.id).map(({id,name,role,username,active,groupIds})=>({id,name,role,username,active,groupIds}))};
}
