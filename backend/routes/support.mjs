import {supportExamples} from '../services/support-demo.mjs';
import {assert,str,date,json} from '../middleware/http.mjs';
import {groupAccess,memberAccess,requireRole} from '../services/access.mjs';
import {localDate} from '../services/dates.mjs';
import {CURRENCIES,validMoney} from '../../shared/catalog.mjs';
import {REPORTERS,SUPPORT_COLLECTIONS,SUPPORT_ROUTES,payFlags,debtPosition} from '../../shared/support.mjs';

const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const text=(v,max=1000)=>{assert(str(v??'',0,max),'Text is too long');return (v||'').trim();};
const ident=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(v);

export function supportRoutes({req,res,url,b,s,user,repository,demo,audit}){
  if(url.pathname==='/api/support/demo'&&req.method==='POST'){
    requireRole(user,'admin');assert(demo,'Examples are available only in demo mode',403);assert(!s.supportPeople.length,'Support records already exist; examples will not overwrite them',409);assert(s.groups.length,'Create a field group first');
    const today=localDate(s.config.timeZone);
    for(const [route,body] of supportExamples(s,today))supportRoutes({req:{method:'POST'},res:{writeHead(){},end(){}},url:{pathname:'/api/support/'+route},b:body,s,user,repository:{...repository,save(){}},demo,audit});
    audit(s,user,'Loaded fictional Indian support examples');repository.save(s);json(res,201,{ok:true});return true;
  }
  const match=url.pathname.match(/^\/api\/support\/([a-z-]+)(?:\/([^/]+))?(?:\/(void))?$/);if(!match||!SUPPORT_ROUTES[match[1]])return false;
  const [,,id,operation]=match,key=SUPPORT_ROUTES[match[1]],today=localDate(s.config.timeZone);
  for(const key of SUPPORT_COLLECTIONS)s[key]||=[];
  assert(!b.capturedBy||b.capturedBy===user.id,'This offline record belongs to another account',403);
  for(const field of ['latitude','longitude','location','passportNumber','aadhaar','nationalId','employerFeed'])assert(!(field in b),'Location and full identity or employer-feed fields are not collected');
  const save=action=>{audit(s,user,action);repository.save(s);};
  const personAccess=(personId,consent=true)=>{const p=s.supportPeople.find(p=>p.id===personId);assert(p,'Support profile not found',404);groupAccess(user,p.groupId);if(consent)assert(p.consented,'Consent is withdrawn. New capture is blocked.',403);return p;};
  const source=()=>{assert(REPORTERS.includes(b.source),'Choose worker, family or member as the information source');const p=s.supportPeople.find(row=>row.id===b.personId);assert(!['domestic-worker','overseas-worker'].includes(p?.kind)||['worker','family'].includes(b.source),'Worker records must come from the worker or family');return {source:b.source,notes:text(b.notes)};};
  const actualDate=v=>assert(date(v)&&v<=today,'Recorded event date cannot be in the future');
  const amount=(v,currency,nullable=false)=>assert(nullable&&v===null||CURRENCIES.includes(currency)&&validMoney(v,currency),'Enter a valid amount for the selected currency, or explicitly unknown where allowed');
  const related=(collection,recordId,personId)=>{const r=s[collection].find(r=>r.id===recordId&&!r.voided);assert(r&&r.personId===personId,'Linked record is unavailable or belongs to another person');return r;};
  const staff=[{id:'admin',name:demo?'Asha Patil':'Administrator',role:'admin',active:true},...repository.listStaff()];
  const assignee=(staffId,p)=>{const target=staff.find(u=>u.id===staffId&&u.active);assert(target&&(target.role!=='officer'||target.groupIds.includes(p.groupId)),'Choose active staff assigned to this group');assert(user.role!=='officer'||target.id===user.id,'Officers may assign only to themselves',403);return target;};
  if(id&&operation==='void'&&req.method==='POST'){
    requireRole(user,'admin','supervisor');assert(!['supportPeople','workerCases'].includes(key),'This type of record cannot be voided');
    const record=s[key].find(r=>r.id===id);assert(record,'Record not found',404);personAccess(record.personId,false);
    const voidKey=canonical({version:b.version,reason:b.reason});if(record.voided&&record.voidKey===voidKey&&record.voidActorId===user.id){json(res,200,record);return true;}
    assert(!record.voided&&record.version===b.version,'Record changed; reload before voiding',409);assert(str(b.reason,5,500),'Explain the correction');
    if(key==='workerDebts')assert(!s.debtEntries.some(r=>r.debtId===id&&!r.voided),'Void linked advances and repayments before this debt record',409);
    if(key==='payPeriods')assert(![...s.payReceipts,...s.deductions].some(r=>r.payId===id&&!r.voided),'Void related receipts and deductions before this pay period',409);
    const patch={voidKey,voidActorId:user.id,voided:true,voidReason:b.reason.trim(),voidedBy:user.name,voidedAt:new Date().toISOString()};
    if(key==='debtEntries')assert(!record.deductionId,'Void the linked deduction to reverse both records',409);
    if(key==='deductions'){const entry=s.debtEntries.find(e=>e.deductionId===id);if(entry){Object.assign(entry,patch);entry.version++;}}
    Object.assign(record,patch);record.version++;if(key==='debtEntries'){const debt=s.workerDebts.find(d=>d.id===record.debtId),balance=debtPosition(s,debt,today).balance;assert(balance===null||balance>=0,'This reversal would overdraw the reported debt balance; correct the repayment first');}save(`Voided ${key} record ${id}`);json(res,200,record);return true;
  }
  if(id&&req.method==='PATCH'){
    assert(['supportPeople','workerCases','remittances'].includes(key),'Use a dated replacement record and void the incorrect observation');
    const record=s[key].find(r=>r.id===id);assert(record,'Record not found',404);const p=personAccess(key==='supportPeople'?id:record.personId,false);
    assert(ident(b.operationId),'Valid operation identifier required');const requestKey=canonical(b),previous=(record.history||[]).find(h=>h.operationId===b.operationId);
    if(previous){assert(previous.requestKey===requestKey,'Operation identifier already used',409);json(res,200,record);return true;}
    assert(b.version===record.version,'This record changed; review the current version first',409);
    let next;
    if(key==='supportPeople'){
      assert(typeof b.consented==='boolean','Record consent');assert(Array.isArray(b.missingInformation)&&b.missingInformation.length<=12&&b.missingInformation.every(x=>str(x,1,120)),'Check missing-information items');assert(!b.reviewDate||date(b.reviewDate),'Check the review date');
      assert(b.payPolicy&&Number.isInteger(b.payPolicy.lateDays)&&b.payPolicy.lateDays>=0&&b.payPolicy.lateDays<=90&&Number.isFinite(b.payPolicy.shortPercent)&&b.payPolicy.shortPercent>=1&&b.payPolicy.shortPercent<=100,'Late days must be 0–90 and short-pay threshold 1–100%');
      next={consented:b.consented,missingInformation:b.missingInformation.map(x=>x.trim()),reviewDate:b.reviewDate||null,payPolicy:{lateDays:b.payPolicy.lateDays,shortPercent:b.payPolicy.shortPercent}};
    }else if(key==='remittances'){
      assert(p.consented,'Consent withdrawn: new support updates are blocked',403);assert(record.received===null,'Receipt is already recorded; use a reasoned correction if it is wrong',409);amount(b.received,record.receivedCurrency);assert(date(b.receivedDate)&&b.receivedDate>=record.date&&b.receivedDate<=today,'Check the actual receipt date');assert(REPORTERS.includes(b.source),'Record the receipt information source');next={received:b.received,receivedDate:b.receivedDate,receivedSource:b.source};
    }else{
      assert(p.consented,'Consent withdrawn: new support updates are blocked',403);assert(user.role!=='officer'||record.assigneeId===user.id,'Only the assigned officer or supervisor can update this case',403);
      assert(['open','in-progress','resolved'].includes(b.status)&&['not-started','requested','received','unavailable','declined'].includes(b.deliveryStatus)&&date(b.dueDate),'Check case status, delivery and due date');
      assert(b.status!=='resolved'||str(b.resolution,5,1000),'Record the outcome or closure reason');assert(b.deliveryStatus!=='received'||date(b.receivedDate)&&b.receivedDate<=today,'Record when assistance was received');
      const target=assignee(b.assigneeId||record.assigneeId,p);
      next={status:b.status,deliveryStatus:b.deliveryStatus,dueDate:b.dueDate,receivedDate:b.deliveryStatus==='received'?b.receivedDate:null,resolution:text(b.resolution),outcomeNotes:text(b.outcomeNotes),assigneeId:target.id,assignee:target.name};
    }
    const at=new Date().toISOString();record.history||=[];record.history.push({operationId:b.operationId,requestKey,at,actor:user.name,before:Object.fromEntries(Object.keys(next).map(k=>[k,record[k]??null])),after:next});Object.assign(record,next,{version:record.version+1,updatedAt:at});save(`Updated ${key} record ${id}`);json(res,200,record);return true;
  }
  assert(req.method==='POST'&&!id,'Unsupported support operation',405);assert(ident(b.id),'Valid record identifier required');
  const {capturedBy,...input}=b,inputKey=canonical(input),existing=s[key].find(r=>r.id===b.id);
  if(existing){personAccess(key==='supportPeople'?existing.id:existing.personId,false);assert(existing.createdById===user.id&&existing.inputKey===inputKey,'Record identifier already used with different information',409);json(res,200,existing);return true;}
  let payload,extra={};
  if(key==='supportPeople'){
    assert(str(b.name)&&['domestic-worker','overseas-worker','prospective','livelihood'].includes(b.kind),'Enter a name and support pathway');groupAccess(user,b.groupId);assert(s.groups.some(g=>g.id===b.groupId),'Choose an existing field group');assert(b.consented===true,'Record freely given consent before creating a support profile');assert(REPORTERS.includes(b.source),'Record worker, family or member as the source');
    if(b.memberId){const m=memberAccess(s,user,b.memberId);assert(m.groupId===b.groupId,'Member and field group must match');assert(!s.supportPeople.some(p=>p.memberId===m.id&&p.id!==b.id),'This member already has a support profile',409);}
    assert(!['domestic-worker','overseas-worker'].includes(b.kind)||['worker','family'].includes(b.source),'Worker intake must come from the worker or family');
    assert(CURRENCIES.includes(b.currency),'Choose a supported currency');
    payload={id:b.id,name:b.name.trim(),kind:b.kind,groupId:b.groupId,memberId:b.memberId||null,memberReference:text(b.memberReference,80),currency:b.currency,source:b.source,consented:true,safeContact:text(b.safeContact,300),notes:text(b.notes)};
    extra={consentAt:new Date().toISOString(),missingInformation:[],reviewDate:null,payPolicy:{lateDays:7,shortPercent:10},history:[]};
  }else{
    const p=personAccess(b.personId);const common={id:b.id,personId:p.id,...source()};
    if(key==='payPeriods'){
      assert(['domestic-worker','overseas-worker'].includes(p.kind),'Pay tracking requires a worker profile');assert(date(b.periodStart)&&date(b.periodEnd)&&b.periodStart<=b.periodEnd&&date(b.dueDate)&&b.dueDate>=b.periodStart,'Check pay period and expected payment date');amount(b.expected,b.currency,true);assert(CURRENCIES.includes(b.currency),'Choose currency');assert(str(b.label),'Describe this pay period');
      payload={...common,label:b.label.trim(),periodStart:b.periodStart,periodEnd:b.periodEnd,dueDate:b.dueDate,expected:b.expected,currency:b.currency};
      assert(!s.payPeriods.some(r=>!r.voided&&r.personId===p.id&&r.periodStart===b.periodStart&&r.periodEnd===b.periodEnd&&r.currency===b.currency&&r.id!==b.id),'This pay period already exists; add receipts to it',409);
    }else if(key==='payReceipts'){
      const pay=related('payPeriods',b.payId,p.id);actualDate(b.date);amount(b.amount,pay.currency,true);assert(b.date>=pay.periodStart,'Receipt cannot precede this pay period');payload={...common,payId:pay.id,date:b.date,amount:b.amount,currency:pay.currency};
    }else if(key==='workerDebts'){
      actualDate(b.date);amount(b.opening,b.currency,true);assert(CURRENCIES.includes(b.currency)&&['recruitment','advance','other'].includes(b.kind)&&str(b.label)&&typeof b.disputed==='boolean','Check debt type, currency and description');payload={...common,date:b.date,kind:b.kind,label:b.label.trim(),opening:b.opening,currency:b.currency,disputed:b.disputed};
    }else if(key==='debtEntries'){
      const debt=related('workerDebts',b.debtId,p.id);actualDate(b.date);assert(b.date>=debt.date,'Entry cannot precede opening balance date');amount(b.amount,debt.currency);assert(b.amount>0&&['advance','repayment'].includes(b.kind),'Enter a positive advance or repayment');payload={...common,debtId:debt.id,date:b.date,kind:b.kind,amount:b.amount,currency:debt.currency};
    }else if(key==='deductions'){
      const pay=related('payPeriods',b.payId,p.id);actualDate(b.date);assert(b.date>=pay.periodStart,'Deduction cannot precede this pay period');amount(b.amount,pay.currency,true);assert(str(b.label)&&['agreed','disputed','unknown'].includes(b.status),'Describe the deduction and whether it is disputed');
      assert(!b.debtId||b.confirmedRepayment===true&&b.amount>0,'Confirm an actual debt repayment before linking a deduction');
      const debt=b.debtId?related('workerDebts',b.debtId,p.id):null;if(debt)assert(debt.currency===pay.currency&&b.date>=debt.date,'Debt and deduction must use the same currency and valid dates');
      payload={...common,payId:pay.id,date:b.date,label:b.label.trim(),amount:b.amount,currency:pay.currency,status:b.status,debtId:debt?.id||null,confirmedRepayment:!!debt};
    }else if(key==='remittances'){
      actualDate(b.date);amount(b.sent,b.sentCurrency);assert(b.sent>0&&CURRENCIES.includes(b.receivedCurrency),'Enter a positive sent amount and receiving currency');amount(b.fee,b.sentCurrency,true);amount(b.received,b.receivedCurrency,true);
      if(b.received!==null)assert(date(b.receivedDate)&&b.receivedDate>=b.date&&b.receivedDate<=today,'Record the actual date received');else assert(!b.receivedDate,'A received date requires a received amount');
      payload={...common,date:b.date,sent:b.sent,sentCurrency:b.sentCurrency,fee:b.fee,received:b.received,receivedCurrency:b.receivedCurrency,receivedDate:b.received===null?null:b.receivedDate};
    }else if(key==='participation'){
      assert(p.kind==='prospective','Choose a prospective member');actualDate(b.date);assert(['present','absent','excused','not-recorded'].includes(b.attendance),'Choose attendance');assert(CURRENCIES.includes(b.currency),'Choose currency');amount(b.savings,b.currency,true);
      assert(!s.participation.some(r=>!r.voided&&r.personId===p.id&&r.date===b.date&&r.id!==b.id),'Participation already recorded for this date',409);payload={...common,date:b.date,attendance:b.attendance,savings:b.savings,currency:b.currency};
    }else if(key==='reconsiderations'){
      assert(p.kind==='prospective','Choose a prospective member');actualDate(b.date);requireRole(user,'admin','supervisor');assert(['awaiting-information','reviewed','accepted-externally','not-accepted','withdrawn'].includes(b.outcome)&&str(b.reason,5,1000),'Record the human review outcome and reason');payload={...common,date:b.date,outcome:b.outcome,reason:b.reason.trim()};
    }else if(key==='assetChecks'){
      actualDate(b.date);assert(str(b.intended)&&str(b.actual)&&['working','not-working','partly-working','unknown','not-seen'].includes(b.functioning),'Record intended purchase, actual use and functioning status');
      if(b.loanId){assert(p.memberId,'Link a member before attaching a loan');memberAccess(s,user,p.memberId);const loan=s.loans.find(l=>l.id===b.loanId);assert(loan&&loan.memberId===p.memberId,'Loan belongs to another member');}
      payload={...common,date:b.date,intended:b.intended.trim(),actual:b.actual.trim(),functioning:b.functioning,loanId:b.loanId||null,explanation:text(b.explanation),officerNotes:text(b.officerNotes)};
    }else if(key==='workerCases'){
      assert(str(b.title)&&str(b.action,5,1000)&&date(b.dueDate),'Describe the concern, agreed action and due date');assert(b.agreed===true,'Confirm agreement to this support action');const target=assignee(b.assigneeId,p);
      let snapshot=null,sourceKey=b.sourceKey||null;
      if(sourceKey){const flag=payFlags(s,today).find(f=>f.key===sourceKey&&f.personId===p.id);assert(flag,'This flag has changed; review the latest pay record',409);snapshot=flag;sourceKey='pay:'+flag.payId;}
      if(b.assetId){assert(!sourceKey,'Choose a single source for this case');const asset=related('assetChecks',b.assetId,p.id);sourceKey='asset:'+asset.id;snapshot={assetId:asset.id,functioning:asset.functioning,explanation:asset.explanation};}
      assert(!sourceKey||!s.workerCases.some(c=>c.sourceKey===sourceKey&&c.id!==b.id),'A case already exists for this concern; use its follow-up history',409);
      payload={...common,title:b.title.trim(),action:b.action.trim(),dueDate:b.dueDate,assigneeId:target.id,assignee:target.name,agreed:true,sourceKey,sourceSnapshot:snapshot};extra={status:'open',deliveryStatus:'not-started',receivedDate:null,resolution:'',outcomeNotes:'',history:[]};
    }
  }
  assert(payload,'Unsupported support record');const requestKey=canonical({...payload,...(key==='workerCases'?{sourceSnapshot:undefined}:{} )});
  const old=s[key].find(r=>r.id===b.id);if(old){assert(old.createdById===user.id&&old.requestKey===requestKey,'Record identifier already used with different information',409);json(res,200,old);return true;}
  const at=new Date().toISOString(),record={...payload,...extra,inputKey,requestKey,createdById:user.id,createdBy:user.name,createdAt:at,version:1,voided:false};
  s[key].push(record);
  if(key==='deductions'&&record.debtId)s.debtEntries.push({id:'ded-'+record.id,personId:record.personId,debtId:record.debtId,date:record.date,kind:'repayment',amount:record.amount,currency:record.currency,source:record.source,notes:'Linked reported wage deduction',deductionId:record.id,createdById:user.id,createdBy:user.name,createdAt:at,version:1,voided:false});
  if(key==='debtEntries'||key==='deductions'&&record.debtId){const debt=s.workerDebts.find(d=>d.id===record.debtId),balance=debtPosition(s,debt,today).balance;assert(balance===null||balance>=0,'Repayment exceeds the recorded debt balance; review opening balance or missing advances');}
  save(`Recorded ${key} ${record.id}`);json(res,201,record);return true;
}
