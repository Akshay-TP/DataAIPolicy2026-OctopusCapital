import { randomUUID } from 'node:crypto';
import { assert,str,money,date } from '../middleware/http.mjs';
import { cents,amount } from './schedules.mjs';
import { localDate } from './dates.mjs';
export function captureVisit(s,b,user) {
  if(b.capturedBy)assert(b.capturedBy===user.id,'This offline record belongs to a different staff account',403);
  assert(str(b.id,1,80)&&s.members.some(m=>m.id===b.memberId)&&date(b.date)&&b.date<=localDate(s.config.timeZone),'Valid member and visit date required');
  const existing=s.visits.find(v=>v.id===b.id);
  if(existing) {
    assert(['memberId','date','attendance','paid','savings','utilisation','note'].every(key=>existing[key]===b[key])&&(existing.loanId||null)===(b.loanId||null),'Visit identifier already used with different contents',409);
    return {visit:existing,created:false};
  }
  assert(!s.visits.some(v=>v.memberId===b.memberId&&v.date===b.date),'A visit already exists for this member on this date',409);
  validateObservation(b);
  const loan=b.loanId?s.loans.find(l=>l.id===b.loanId&&l.memberId===b.memberId):null;
  assert(!b.loanId||loan,'Loan not found');assert(loan||b.paid===0,'Select a loan to record repayment');
  assert(!loan||b.date>=loan.date,'Visit precedes loan start date');
  const balance=loan?cents(loan.principal)-s.visits.filter(v=>v.loanId===loan.id).reduce((n,v)=>n+cents(v.paid),0):0;
  assert(cents(b.paid)<=balance,'Payment exceeds remaining principal');
  const visit={id:b.id,memberId:b.memberId,loanId:loan?.id||null,date:b.date,attendance:b.attendance,due:loan?amount(Math.min(cents(loan.installment),balance)):0,paid:b.paid,savings:b.savings,utilisation:b.utilisation,note:b.note.trim(),officer:user.name,createdAt:new Date().toISOString(),version:1};
  s.visits.push(visit);return {visit,created:true};
}
export function validateObservation(b) {
  assert(['present','absent','excused','not-recorded'].includes(b.attendance)&&['not-checked','verified','follow-up'].includes(b.utilisation),'Invalid visit status');
  assert(money(b.paid)&&money(b.savings)&&str(b.note,0,1000),'Invalid amounts or note');
}
export function correctVisit(s,v,b,user) {
  assert(b.version===v.version,'This record has changed. Reload before correcting it.',409);
  assert(str(b.reason,5,500),'Explain why the record needs correcting (5–500 characters)');
  validateObservation(b);assert(v.loanId||b.paid===0,'This visit has no loan payment');
  const loan=s.loans.find(l=>l.id===v.loanId);
  if(loan)assert(s.visits.filter(x=>x.loanId===loan.id&&x.id!==v.id).reduce((n,x)=>n+cents(x.paid),cents(b.paid))<=cents(loan.principal),'Correction would overpay this loan');
  const before={...v};Object.assign(v,{attendance:b.attendance,paid:b.paid,savings:b.savings,utilisation:b.utilisation,note:b.note.trim(),version:v.version+1});
  const revision={id:randomUUID(),visitId:v.id,at:new Date().toISOString(),actor:user.name,reason:b.reason.trim(),before,after:{...v}};
  s.revisions.push(revision);return revision;
}
