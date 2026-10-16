import { randomUUID } from 'node:crypto';
import { indicators, reviewReasons } from '../services/indicators.mjs';
import { ApiError, assert, str, money, date, json, parseBody } from '../middleware/http.mjs';

export function createApiRouter({ repository, auth, demo }) {
  const {read, save} = repository;
  const audit = (s,user,action) => s.audit.unshift({id:randomUUID(),at:new Date().toISOString(),actor:user.name,action});
  return async function routeApi(req,res,url) {
    const path=url.pathname;
    // Parse asynchronous input before loading state, keeping read/validate/write atomic
    // within this single-process server's synchronous repository operations.
    const requestBody = ['GET','HEAD'].includes(req.method) ? {} : await parseBody(req);
      if(path==='/api/session' && req.method==='GET') { const current=auth.userFor(req);return json(res,200,{user:current?{name:current.name,role:current.role,expires:current.expires}:null,demo}); }
      if(path==='/api/login' && req.method==='POST') return json(res,200,auth.login(req,res,requestBody));
      const user=auth.userFor(req);assert(user,'Please sign in',401);
      if(path==='/api/logout' && req.method==='POST'){auth.logout(res,user);return json(res,200,{ok:true});}
      const s=read();
      if(path==='/api/workspace' && req.method==='GET')return json(res,200,{...s,demo,user:{name:user.name,role:user.role}});
      if(path==='/api/groups' && req.method==='POST') {
        const b=requestBody;assert(str(b.name)&&str(b.location)&&str(b.officer)&&date(b.nextMeeting),'Complete all group fields');
        const group={id:'GRP-'+randomUUID().slice(0,8),name:b.name.trim(),location:b.location.trim(),officer:b.officer.trim(),nextMeeting:b.nextMeeting,time:'09:00',color:'teal'};
        s.groups.push(group);audit(s,user,`Created group ${group.id}`);save(s);return json(res,201,group);
      }
      if(path==='/api/members' && req.method==='POST') {
        const b=requestBody;assert(str(b.name)&&str(b.business)&&s.groups.some(g=>g.id===b.groupId),'Name, livelihood and valid group are required');
        assert(money(b.income)&&money(b.expenses)&&Number.isInteger(b.household)&&b.household>=1&&b.household<=30&&Number.isInteger(b.earners)&&b.earners>=0&&b.earners<=b.household,'Check household figures');
        assert(['Local government ID','Voter ID','Other approved ID'].includes(b.identityType)&&/^\d{4}$/.test(b.identitySuffix),'Select an ID type and enter only its last four digits');
        const member={id:'MEM-'+randomUUID().slice(0,8),name:b.name.trim(),business:b.business.trim(),groupId:b.groupId,income:b.income,expenses:b.expenses,household:b.household,earners:b.earners,identityType:b.identityType,identitySuffix:b.identitySuffix,kycVerified:false,joined:new Date().toISOString().slice(0,10),consent:null};
        s.members.push(member);audit(s,user,`Enrolled member ${member.id}`);save(s);return json(res,201,member);
      }
      if(path==='/api/loans' && req.method==='POST') {
        const b=requestBody;assert(s.members.some(m=>m.id===b.memberId),'Member not found');assert(money(b.principal)&&b.principal>0&&money(b.installment)&&b.installment>0&&b.installment<=b.principal&&str(b.purpose)&&date(b.date)&&['weekly','fortnightly','monthly'].includes(b.frequency),'Check loan details');
        const loan={id:'LN-'+randomUUID().slice(0,8),memberId:b.memberId,principal:b.principal,installment:b.installment,purpose:b.purpose.trim(),date:b.date,frequency:b.frequency,status:'active'};s.loans.push(loan);audit(s,user,`Recorded externally approved interest-free demo loan ${loan.id}`);save(s);return json(res,201,loan);
      }
      if(path==='/api/visits' && req.method==='POST') {
        const b=requestBody;assert(str(b.id,1,80)&&s.members.some(m=>m.id===b.memberId)&&date(b.date)&&b.date<=new Date().toISOString().slice(0,10),'Valid member and visit date required');
        const existing=s.visits.find(v=>v.id===b.id);if(existing){assert(['memberId','date','attendance','paid','savings','utilisation','note'].every(key=>existing[key]===b[key])&&(existing.loanId||null)===(b.loanId||null),'Visit identifier already used with different contents',409);return json(res,200,existing);}
        assert(!s.visits.some(v=>v.memberId===b.memberId&&v.date===b.date),'A visit already exists for this member on this date',409);
        assert(['present','absent','excused','not-recorded'].includes(b.attendance)&&['not-checked','verified','follow-up'].includes(b.utilisation),'Invalid visit status');
        assert(money(b.paid)&&money(b.savings)&&str(b.note,0,1000),'Invalid amounts or note');
        const loan=b.loanId?s.loans.find(l=>l.id===b.loanId&&l.memberId===b.memberId):null;
        assert(!b.loanId||loan,'Loan not found');assert(loan||b.paid===0,'Select a loan to record repayment');
        const outstanding=loan?Math.max(0,loan.principal-s.visits.filter(v=>v.loanId===loan.id).reduce((n,v)=>n+v.paid,0)):0;
        assert(b.paid<=outstanding,'Payment exceeds remaining principal');
        const visit={id:b.id,memberId:b.memberId,loanId:loan?.id||null,date:b.date,attendance:b.attendance,due:loan?Math.min(loan.installment,outstanding):0,paid:b.paid,savings:b.savings,utilisation:b.utilisation,note:b.note.trim(),officer:user.name,createdAt:new Date().toISOString()};
        s.visits.push(visit);audit(s,user,`Recorded visit ${visit.id} for ${visit.memberId}`);save(s);return json(res,201,visit);
      }
      const match=path.match(/^\/api\/members\/([^/]+)\/(consent|export|verify)$/);
      if(match) {
        const m=s.members.find(m=>m.id===match[1]);assert(m,'Member not found',404);
        if(match[2]==='verify'&&req.method==='POST'){m.kycVerified=true;audit(s,user,`Attested in-person identity check for ${m.id}`);save(s);return json(res,200,m);}
        if(match[2]==='consent'&&req.method==='POST') {
          const b=requestBody;assert(typeof b.granted==='boolean','Consent choice required');
          if(b.granted)assert(str(b.recipient)&&str(b.purpose)&&b.attested===true,'Recipient, purpose and member attestation required');
          m.consent=b.granted?{granted:true,recipient:b.recipient.trim(),purpose:b.purpose.trim(),at:new Date().toISOString(),expires:new Date(Date.now()+30*86400000).toISOString(),officer:user.name}:{granted:false,at:new Date().toISOString()};
          audit(s,user,`${b.granted?'Recorded sharing consent':'Revoked sharing consent'} for ${m.id}`);save(s);return json(res,200,m.consent);
        }
        if(match[2]==='export'&&req.method==='GET') {
          assert(m.consent?.granted&&Date.parse(m.consent.expires)>Date.now(),'Current member consent is required before sharing',403);
          audit(s,user,`Exported ${m.id} for ${m.consent.recipient}`);save(s);
          return json(res,200,{schema:'fieldledger.profile.v1',issuer:s.settings.name,generatedAt:new Date().toISOString(),synthetic:demo,member:{id:m.id,name:m.name,business:m.business},indicators:indicators(m,s.visits,s.loans),reviewReasons:reviewReasons(m,s.visits,s.loans),consent:m.consent,notice:'Descriptive record only. Not a credit score, credit decision or cryptographically signed credential. Previously downloaded copies cannot be recalled.'});
        }
      }
      if(path==='/api/settings'&&req.method==='POST') {
        const b=requestBody;assert(str(b.name)&&['PHP','INR','USD','KHR','IDR'].includes(b.currency)&&str(b.country),'Invalid organization settings');s.settings={name:b.name.trim(),currency:b.currency,country:b.country.trim(),locale:'en'};audit(s,user,'Updated organization settings');save(s);return json(res,200,s.settings);
      }
      throw new ApiError('Endpoint not found',404);
  };
}
