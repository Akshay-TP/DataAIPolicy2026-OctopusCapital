import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {openRepository} from '../database/repository.mjs';
import {outcomeReport,addDays,cashflowProjection} from '../shared/health.mjs';
import {decryptBackup} from '../backend/services/backup.mjs';

test('outcomes use matched households, separate nonresponse, and ignore void/future/late reports',()=>{
  const members=Array.from({length:7},(_,i)=>({id:'m'+i,groupId:i===6?'other':'g'}));
  const checkins=members.map((m,i)=>({id:'b'+i,memberId:m.id,date:'2026-01-01',response:'answered',shortfallDays:i===5?null:10,stress:3,borrowing:'yes',createdAt:'2026-01-01'}));
  const supportPlans=members.map((m,i)=>({id:'p'+i,memberId:m.id,baselineId:'b'+i,startDate:'2026-01-01',deliveryStatus:'suggested',status:'open',dueDate:'2026-01-10'}));
  const c=(i,response,days,date='2026-01-31',extra={})=>({id:'f'+i,memberId:'m'+i,planId:'p'+i,milestone:30,date,response,shortfallDays:days,stress:1,borrowing:'no',createdAt:date,...extra});
  checkins.push(c(0,'answered',4),c(1,'declined',null),c(2,'unavailable',null),c(3,'answered',0,'2026-02-20'),c(4,'answered',0,'2026-01-31',{voided:true}),c(6,'answered',0));
  // A second plan for m0 does not give that household twice the weight.
  supportPlans.push({...supportPlans[0],id:'p0b'});
  const s={members,checkins,supportPlans};
  const r=outcomeReport(s,{asOf:'2026-02-25',groupId:'g'}),m=r.milestones[0];
  assert.equal(r.cohortHouseholds,6);assert.equal(r.baselineMissing,1);
  assert.equal(m.due,5);assert.equal(m.paired,1);assert.equal(m.declined,1);assert.equal(m.unavailable,1);assert.equal(m.missing,2);assert.equal(m.late,1);
  assert.equal(m.baselineMean,10);assert.equal(m.followupMean,4);assert.equal(m.improved,1);assert.equal(m.stressChange,-2);assert.equal(m.borrowingPairs,1);assert.equal(m.borrowingAfter,0);
  assert.equal(r.milestones[1].due,0);
  assert.equal(outcomeReport(s,{asOf:'2026-01-30',groupId:'g'}).milestones[0].paired,0);
});

test('planner nets expected flows by date and currency without mixing or counting cancelled entries',()=>{
  const entries=[{date:'2026-01-01',currency:'KHR',kind:'expense',amount:120},{date:'2026-01-01',currency:'USD',kind:'income',amount:1000},{date:'2026-01-02',currency:'KHR',kind:'income',amount:70},{date:'2026-01-02',currency:'KHR',kind:'expense',amount:99,cancelled:true}];
  assert.deepEqual(cashflowProjection(entries,{currency:'KHR',openingBalance:100,from:'2026-01-01',to:'2026-01-31'}),[{date:'2026-01-01',income:0,expenses:120,balance:-20,gap:true},{date:'2026-01-02',income:70,expenses:0,balance:50,gap:false}]);
});

test('household workflow persists, scopes access, handles retries and conflicts, and backs up all records',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'fl-health-'));
  const proc=spawn(process.execPath,['backend/server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DATA_DIR:dir,DEMO_MODE:'true',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
  let stderr='';proc.stderr.on('data',d=>stderr+=d);
  const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(stderr)),5000);proc.stdout.on('data',d=>{const m=String(d).match(/http:\/\/[^ ]+/);if(m){clearTimeout(timer);resolve(m[0]);}});proc.on('exit',()=>{clearTimeout(timer);reject(new Error(stderr));});});
  async function client(body){const login=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];return async(path,method='GET',body)=>{const r=await fetch(url+'/api'+path,{method,headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};}
  let expected;
  try {
    const admin=await client({demo:true});
    await admin('/staff','POST',{name:'Officer',username:'health-officer',password:'safe-test-password-123',role:'officer',groupIds:['GRP-001']});
    const officer=await client({username:'health-officer',password:'safe-test-password-123'}),who=(await officer('/workspace')).body.user;
    const base={id:'baseline-0001',memberId:'MEM-001',date:'2026-01-01',response:'answered',voluntaryConfirmed:true,shortfallDays:10,stress:3,income:5000,expenses:6000,currency:'KHR',essentials:['food'],causes:['delayed-income'],borrowing:'yes',supportPreference:'requested',explanation:'Payment delayed',officerNotes:'Discussed available support'};
    assert.equal((await officer('/health/checkins','POST',{...base,memberId:'MEM-010'})).status,403);
    assert.equal((await officer('/health/checkins','POST',{...base,capturedBy:'another-account'})).status,403);
    assert.equal((await officer('/health/checkins','POST',{...base,shortfallDays:31})).status,400);
    assert.equal((await officer('/health/checkins','POST',{...base,voluntaryConfirmed:false})).status,400);
    assert.equal((await officer('/health/checkins','POST',{...base,response:'declined'})).status,400);
    assert.equal((await officer('/health/checkins','POST',base)).status,201);
    assert.equal((await officer('/health/checkins','POST',base)).status,200);
    assert.equal((await officer('/health/checkins','POST',{...base,shortfallDays:9})).status,409);
    assert.equal((await officer('/health/checkins','POST',{...base,id:'duplicate-0001'})).status,409);
    assert.equal((await officer('/health/services','POST',{})).status,403);
    const service=(await admin('/health/services','POST',{name:'Budget support',provider:'NGO',type:'planning',active:true,details:'Existing service',accessNotes:'Ask your officer'})).body;
    const plan={id:'plan-00000001',memberId:'MEM-001',baselineId:base.id,serviceId:service.id,action:'Agree on a household budget',startDate:'2026-01-02',dueDate:'2026-01-09',assigneeId:who.id,agreed:true,notes:'Household priority is food'};
    assert.equal((await officer('/health/plans','POST',{...plan,agreed:false})).status,400);
    const created=await officer('/health/plans','POST',plan);assert.equal(created.status,201,JSON.stringify(created.body));
    assert.equal((await officer('/health/plans','POST',plan)).status,200);
    assert.equal((await officer('/followups/'+created.body.followupId,'PATCH',{version:1,status:'resolved',resolution:'Case done'})).status,409);
    const update={memberId:base.memberId,version:1,operationId:'update-00001',status:'in-progress',deliveryStatus:'received',receivedDate:'2026-01-08',requestedDate:'2026-01-03',endedDate:'2026-01-10',dueDate:'2026-01-31',deliveryNotes:'Session completed',resolution:''};
    assert.equal((await officer('/health/plans/'+plan.id,'PATCH',update)).status,200);
    assert.equal((await officer('/health/plans/'+plan.id,'PATCH',update)).status,200);
    assert.equal((await officer('/health/plans/'+plan.id,'PATCH',{...update,operationId:'another-update'})).status,409);
    const outcome={...base,id:'outcome-00001',date:addDays(base.date,30),planId:plan.id,milestone:30,shortfallDays:3,stress:1,borrowing:'no',supportPreference:'not-requested',supportHelpfulness:'helped'};
    assert.equal((await officer('/health/checkins','POST',{...outcome,date:'2026-01-30'})).status,400);
    assert.equal((await officer('/health/checkins','POST',outcome)).status,201);
    const report=(await officer('/health/outcomes?asOf=2026-02-15')).body;
    assert.equal(report.milestones[0].paired,1);assert.equal(report.milestones[0].followupMean,3);assert.equal(report.delivery.medianDaysToSupport,6);
    const entry={id:'cashflow-0001',memberId:'MEM-001',date:'2026-02-01',kind:'income',amount:1000,currency:'KHR',label:'Expected shop sales',notes:''};
    assert.equal((await officer('/health/cashflow','POST',entry)).status,201);assert.equal((await officer('/health/cashflow','POST',entry)).status,200);
    const declined={...base,id:'declined-0001',date:'2026-02-20',response:'declined',voluntaryConfirmed:false,shortfallDays:null,income:null,expenses:null,stress:null,essentials:[],causes:[],borrowing:'unknown',supportPreference:'declined',explanation:''};
    assert.equal((await officer('/health/checkins','POST',declined)).status,201);
    assert.equal((await officer('/health/checkins/'+base.id+'/void','POST',{version:1,reason:'Incorrect recall period'})).status,403);
    assert.equal((await admin('/health/checkins/'+outcome.id+'/void','POST',{version:1,reason:'Incorrect recall period'})).status,200);
    assert.equal((await admin('/health/outcomes?asOf=2026-02-15')).body.milestones[0].paired,0);
    assert.equal((await officer('/health/cashflow/'+entry.id+'/cancel','POST',{version:1,reason:'Income date changed'})).status,200);
    const scenario={id:'scenario-00001',memberId:'MEM-001',label:'Harvest and dollar installments',assumptions:{from:'2026-02-01',to:'2026-03-01',openingKHR:400000,openingUSD:0,khrPerUsd:4000,rateDate:'2026-01-31',rateSource:'Planning test',stressPercent:10},entries:[{id:'expected-debt',date:'2026-02-10',label:'Dollar debt',kind:'expense',currency:'USD',amount:110}]};
    assert.equal((await officer('/health/scenarios','POST',{...scenario,memberId:'MEM-010'})).status,403);
    assert.equal((await officer('/health/scenarios','POST',{...scenario,assumptions:{...scenario.assumptions,khrPerUsd:0}})).status,400);
    const savedScenario=await officer('/health/scenarios','POST',scenario);assert.equal(savedScenario.status,201,JSON.stringify(savedScenario.body));assert.equal(savedScenario.body.result.base.maxGap,40000);
    assert.equal((await officer('/health/scenarios','POST',scenario)).status,200);
    assert.equal((await officer('/health/scenarios','POST',{...scenario,label:'Changed'})).status,409);
    const scoped=(await officer('/workspace')).body;assert.equal(scoped.checkins.length,3);assert.equal(scoped.supportPlans.length,1);assert.equal(scoped.cashflow.length,1);assert.equal(scoped.scenarios.length,1);assert.equal(scoped.storage.encrypted,true);assert.ok(Date.parse(scoped.offlineAccess.expiresAt)>Date.now());
    assert.equal((await officer('/health/household-link','POST',{memberId:'MEM-002',targetMemberId:'MEM-001',confirmed:true})).status,403);
    assert.equal((await admin('/health/household-link','POST',{memberId:'MEM-002',targetMemberId:'MEM-001',confirmed:true})).status,200);
    assert.equal((await officer('/health/checkins','POST',{...base,id:'same-family-0001',memberId:'MEM-002'})).status,409);
    assert.equal((await admin('/health/outcomes?asOf=2026-02-15')).body.households,23);
    const archive=(await admin('/backup','POST',{password:'backup-health-passphrase'})).body;
    const payload=decryptBackup(archive,'backup-health-passphrase');assert.equal(payload.schema,6);expected=payload.workspace;
    const restoreDir=mkdtempSync(join(tmpdir(),'fl-health-restored-')),repo=openRepository({dataDir:restoreDir,demo:false});
    try{repo.save(expected);for(const key of ['checkins','supportPlans','services','cashflow','scenarios'])assert.deepEqual(repo.read()[key],expected[key]);}finally{repo.close();rmSync(restoreDir,{recursive:true,force:true});}
    assert.equal((await officer('/health/outcomes?groupId=GRP-002')).status,403);
    const empty=await admin('/staff','POST',{name:'Other officer',username:'health-other',password:'safe-test-password-123',role:'officer',groupIds:['GRP-002']});assert.equal(empty.status,201);
    const other=await client({username:'health-other',password:'safe-test-password-123'}),otherWorkspace=(await other('/workspace')).body;
    assert.equal(otherWorkspace.checkins.length,0);assert.equal(otherWorkspace.supportPlans.length,0);assert.equal(otherWorkspace.cashflow.length,0);assert.equal(otherWorkspace.scenarios.length,0);
  }finally{proc.kill();await once(proc,'exit');}
  const reopened=openRepository({dataDir:dir,demo:false});try{assert.equal(reopened.read().supportPlans[0].history.length,1);assert.equal(reopened.read().checkins.length,3);}finally{reopened.close();rmSync(dir,{recursive:true,force:true});}
});
