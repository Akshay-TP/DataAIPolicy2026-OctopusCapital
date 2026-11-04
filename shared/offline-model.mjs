import {DEFAULT_PAY_POLICY,SUPPORT_ROUTES} from './support.mjs';
import {addDays} from './health.mjs';
// Pending observations are provisional. Never mutate the cached server snapshot.
export function projectOffline(workspace,records){
  const s=structuredClone(workspace);if(!s)return s;
  for(const r of records){
    if(r._error)continue;
    const p=r.payload||r,meta={createdBy:s.user.name,createdById:s.user.id,createdAt:new Date().toISOString(),version:1,pending:true};
    if(r._path?.startsWith('/support/')){
      const route=r._path.split('/')[2],id=r._path.split('/')[3],key=SUPPORT_ROUTES[route];
      if(!key)continue;s[key]||=[];
      if(r._path.endsWith('/void')){const row=s[key].find(x=>x.id===id);if(row){row.voided=true;row.pending=true;}if(key==='deductions')for(const e of s.debtEntries||[])if(e.deductionId===id){e.voided=true;e.pending=true;}continue;}
      if(r._method==='PATCH'){const row=s[key].find(x=>x.id===id);if(row&&row.version===p.version)Object.assign(row,p,{version:p.version+1,pending:true});continue;}
      if(s[key].some(x=>x.id===p.id))continue;
      let extra={history:[]};
      if(key==='supportPeople')extra={...extra,missingInformation:[],payPolicy:{...DEFAULT_PAY_POLICY},reviewDate:null};
      if(key==='workerCases')extra={...extra,status:'open',deliveryStatus:'not-started',assignee:s.staff.find(x=>x.id===p.assigneeId)?.name||s.user.name};
      if(key==='payReceipts'||key==='deductions')extra.currency=s.payPeriods.find(x=>x.id===p.payId)?.currency;
      if(key==='debtEntries')extra.currency=s.workerDebts.find(x=>x.id===p.debtId)?.currency;
      s[key].push({...meta,...extra,...p});
      if(key==='deductions'&&p.debtId){s.debtEntries||=[];if(!s.debtEntries.some(e=>e.id==='ded-'+p.id))s.debtEntries.push({...meta,id:'ded-'+p.id,personId:p.personId,debtId:p.debtId,date:p.date,kind:'repayment',amount:p.amount,currency:extra.currency,deductionId:p.id,source:p.source});}
      continue;
    }
    const collection=!r._kind?'visits':({'/health/checkins':'checkins','/health/plans':'supportPlans','/health/cashflow':'cashflow','/health/scenarios':'scenarios'})[r._path];
    if(collection){s[collection]||=[];if(s[collection].some(v=>v.id===p.id))continue;let extra={};
      if(collection==='checkins')extra={periodStart:addDays(p.date,-29),voided:false};
      if(collection==='supportPlans')extra={history:[],deliveryStatus:'suggested',status:'open',assignee:s.staff.find(u=>u.id===p.assigneeId)?.name||s.user.name};
      s[collection].push({...meta,...extra,...p});
    }else if(r._method==='PATCH'&&r._path.startsWith('/health/plans/')){const plan=s.supportPlans.find(v=>v.id===r._path.split('/').at(-1));if(plan&&plan.version===p.version)Object.assign(plan,p,{version:p.version+1,pending:true});}
  }return s;
}
