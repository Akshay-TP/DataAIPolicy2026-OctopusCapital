import { randomUUID } from 'node:crypto';
import { assert,str,date,json } from '../middleware/http.mjs';
import { requireRole,groupAccess,memberAccess } from '../services/access.mjs';
import { captureVisit,correctVisit } from '../services/visits.mjs';
import { schedule,cents,amount } from '../services/schedules.mjs';
import { hashPassword } from '../services/auth.mjs';
import { encryptBackup } from '../services/backup.mjs';
import { parseCsv } from '../services/csv.mjs';
import { enrollMember } from '../services/members.mjs';
import { localDate } from '../services/dates.mjs';
import { LANGUAGES } from '../../shared/catalog.mjs';

export function operations({req,res,url,b,s,user,repository,demo,audit}) {
  const path=url.pathname,method=req.method;
  function save(message){audit(s,user,message);repository.save(s);}
  if(path==='/api/staff'&&method==='POST') {
    requireRole(user,'admin');
    assert(str(b.name)&&typeof b.username==='string'&&/^[a-zA-Z0-9._-]{3,40}$/.test(b.username)&&b.username.toLowerCase()!=='admin','Name and a unique username (3–40 letters, digits, dots or hyphens) required');
    assert(['admin','supervisor','officer'].includes(b.role)&&typeof b.password==='string'&&b.password.length>=12&&b.password.length<=200,'Select a role and a password of 12–200 characters');
    assert(Array.isArray(b.groupIds)&&b.groupIds.every(id=>s.groups.some(g=>g.id===id)),'Check assigned groups');
    assert(!repository.listStaff().some(u=>u.username.toLowerCase()===b.username.toLowerCase()),'Username already exists',409);
    repository.saveStaff({id:randomUUID(),name:b.name.trim(),username:b.username,role:b.role,...hashPassword(b.password),active:true,groupIds:[...new Set(b.groupIds)]});save(`Created staff account ${b.username} (${b.role})`);json(res,201,{ok:true});return true;
  }
  let m=path.match(/^\/api\/staff\/([^/]+)$/);
  if(m&&method==='PATCH') {
    requireRole(user,'admin');const account=repository.listStaff(true).find(u=>u.id===m[1]);assert(account,'Staff account not found',404);
    assert(['admin','supervisor','officer'].includes(b.role)&&typeof b.active==='boolean'&&Array.isArray(b.groupIds)&&b.groupIds.every(id=>s.groups.some(g=>g.id===id)),'Check account settings');
    assert(account.id!==user.id||b.active&&b.role==='admin','You cannot disable or demote your own account');
    if(b.password){assert(str(b.password,12,200),'Password must have 12–200 characters');Object.assign(account,hashPassword(b.password));}
    repository.saveStaff({...account,role:b.role,active:b.active,groupIds:[...new Set(b.groupIds)]});save(`Updated staff account ${account.username}`);json(res,200,{ok:true});return true;
  }
  if(path==='/api/meetings'&&method==='POST') {
    groupAccess(user,b.groupId);assert(s.groups.some(g=>g.id===b.groupId)&&date(b.date),'Valid group and date required');
    assert(Array.isArray(b.visits)&&b.visits.length>0&&b.visits.length<=100,'Select 1–100 members');
    assert(new Set(b.visits.map(v=>v.memberId)).size===b.visits.length,'Each member can appear only once');
    const records=[];for(const entry of b.visits){const member=memberAccess(s,user,entry.memberId);assert(member.groupId===b.groupId,'Member belongs to another group');records.push(captureVisit(s,{...entry,date:b.date},user).visit);}
    save(`Recorded group meeting ${b.groupId} on ${b.date} (${records.length} members)`);json(res,201,{visits:records});return true;
  }
  m=path.match(/^\/api\/visits\/([^/]+)(?:\/(receipt|history))?$/);
  if(m) {
    const visit=s.visits.find(v=>v.id===m[1]);assert(visit,'Visit not found',404);const member=memberAccess(s,user,visit.memberId);
    if(!m[2]&&method==='PATCH'){requireRole(user,'admin','supervisor');const revision=correctVisit(s,visit,b,user);save(`Corrected visit ${visit.id}: ${b.reason}`);json(res,200,{visit,revision});return true;}
    if(m[2]==='history'&&method==='GET'){json(res,200,{visit,revisions:s.revisions.filter(r=>r.visitId===visit.id)});return true;}
    if(m[2]==='receipt'&&method==='GET') {
      const loan=s.loans.find(l=>l.id===visit.loanId);
      const balanceOnDate=loan?amount(Math.max(0,cents(loan.principal)-s.visits.filter(v=>v.loanId===loan.id&&v.date<=visit.date).reduce((n,v)=>n+cents(v.paid),0))):null;
      json(res,200,{number:`FL-${visit.id}`,version:visit.version,organization:s.settings.name,currency:visit.currency,member:{id:member.id,name:member.name},date:visit.date,officer:visit.officer,paid:visit.paid,savings:visit.savings,total:amount(cents(visit.paid)+cents(visit.savings)),loanId:visit.loanId,loanBalanceOnDate:balanceOnDate,corrected:visit.version>1});return true;
    }
  }
  m=path.match(/^\/api\/loans\/([^/]+)\/schedule$/);
  if(m&&method==='GET') {const loan=s.loans.find(l=>l.id===m[1]);assert(loan,'Loan not found',404);memberAccess(s,user,loan.memberId);assert(Math.ceil(loan.principal/loan.installment)<=600,'This legacy loan exceeds the 600-installment schedule limit');json(res,200,schedule(loan,s.visits,localDate(s.config.timeZone)));return true;}
  if(path==='/api/followups'&&method==='POST') {
    const member=memberAccess(s,user,b.memberId);assert(str(b.title)&&date(b.dueDate)&&str(b.notes,0,1000),'Title, date and valid notes required');
    const target=b.assigneeId==='admin'?{id:'admin',name:demo?'Asha Patil':'Administrator',role:'admin',active:true}:repository.listStaff().find(u=>u.id===b.assigneeId);
    assert(target?.active&&(target.role!=='officer'||target.groupIds.includes(member.groupId)),'Select an active officer assigned to this group or a supervisor');
    if(user.role==='officer')assert(target.id===user.id,'Field officers can assign follow-ups only to themselves',403);
    const at=new Date().toISOString(),followup={id:randomUUID(),memberId:member.id,title:b.title.trim(),assigneeId:target.id,assignee:target.name,dueDate:b.dueDate,status:'open',notes:b.notes.trim(),resolution:'',createdBy:user.name,createdAt:at,updatedAt:at,version:1};
    s.followups.push(followup);save(`Created follow-up ${followup.id} for ${member.id}`);json(res,201,followup);return true;
  }
  m=path.match(/^\/api\/followups\/([^/]+)$/);
  if(m&&method==='PATCH') {
    const f=s.followups.find(f=>f.id===m[1]);assert(f,'Follow-up not found',404);memberAccess(s,user,f.memberId);
    assert(!s.supportPlans.some(p=>p.followupId===f.id),'Update this case through its household support plan',409);
    assert(user.role!=='officer'||f.assigneeId===user.id,'Only the assigned officer or supervisor can update this case',403);
    assert(b.version===f.version,'This case has changed. Reload it first.',409);
    assert(['open','in-progress','resolved'].includes(b.status)&&str(b.resolution,0,1000),'Invalid case update');assert(b.status!=='resolved'||str(b.resolution,5,1000),'Describe how the issue was resolved');
    Object.assign(f,{status:b.status,resolution:b.resolution.trim(),updatedAt:new Date().toISOString(),version:f.version+1});save(`Updated follow-up ${f.id} to ${f.status}`);json(res,200,f);return true;
  }
  if(path==='/api/import/members'&&method==='POST') {
    requireRole(user,'admin','supervisor');assert(typeof b.commit==='boolean','Choose preview or import');
    const rows=parseCsv(b.csv),errors=[],candidates=[];
    rows.forEach((row,index)=>{try {
      assert(!s.members.some(m=>m.name.toLowerCase()===row.name?.toLowerCase()&&m.groupId===row.groupId)&&!candidates.some(m=>m.name.toLowerCase()===row.name?.toLowerCase()&&m.groupId===row.groupId),'Duplicate member name in this group');
      for(const key of ['income','expenses','household','earners'])assert(row[key]!==undefined&&row[key]!=='',`${key} is required`);
      const customFields=Object.fromEntries(s.config.questions.filter(q=>row['question:'+q.label]!==undefined&&row['question:'+q.label]!=='').map(q=>[q.id,q.type==='number'?Number(row['question:'+q.label]):row['question:'+q.label]]));
      candidates.push(enrollMember(s,{...row,customFields,income:Number(row.income),expenses:Number(row.expenses),household:Number(row.household),earners:Number(row.earners)},user));
    }catch(e){errors.push({row:index+2,error:e.message});}});
    if(!b.commit){json(res,200,{valid:candidates.length,total:rows.length,errors,preview:candidates.slice(0,5)});return true;}
    assert(!errors.length,'Fix the CSV errors before importing');s.members.push(...candidates);save(`Imported ${candidates.length} members from CSV`);json(res,201,{imported:candidates.length});return true;
  }
  if(path==='/api/backup'&&method==='POST') {
    requireRole(user,'admin');assert(str(b.password,12,200),'Use a backup passphrase of 12–200 characters');
    save('Created encrypted workspace backup');json(res,200,encryptBackup({schema:7,createdAt:new Date().toISOString(),workspace:s,staff:repository.listStaff(true)},b.password));return true;
  }
  if(path==='/api/config'&&method==='POST') {
    requireRole(user,'admin');assert(LANGUAGES.some(l=>l.code===b.language)&&Array.isArray(b.acceptedIds)&&b.acceptedIds.length>0&&b.acceptedIds.length<=15&&b.acceptedIds.every(id=>str(id,1,80)),'Choose a supported language and 1–15 accepted ID types');
    const timeZone=b.timeZone||s.config.timeZone;assert(str(timeZone,1,80),'Choose a time zone');try{localDate(timeZone);}catch{assert(false,'Invalid time zone');}
    assert(Array.isArray(b.questions)&&b.questions.length<=10&&b.questions.every(q=>str(q.label,1,80)&&['text','number'].includes(q.type)&&typeof q.required==='boolean'),'Up to 10 valid custom questions supported');
    const questions=b.questions.map(q=>({id:q.id&&s.config.questions.some(old=>old.id===q.id)?q.id:randomUUID(),label:q.label.trim(),type:q.type,required:q.required}));
    assert(new Set(questions.map(q=>q.id)).size===questions.length,'Duplicate question identifiers');
    s.config={...s.config,timeZone,language:b.language,acceptedIds:[...new Set(b.acceptedIds.map(x=>x.trim()))],questions};save('Updated enrollment form and language');json(res,200,s.config);return true;
  }
  return false;
}
