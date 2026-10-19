import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {schedule,installmentDate} from '../backend/services/schedules.mjs';
import {encryptBackup,decryptBackup} from '../backend/services/backup.mjs';
import {openRepository} from '../database/repository.mjs';
import {parseCsv} from '../backend/services/csv.mjs';
import {localDate} from '../backend/services/dates.mjs';

test('field dates respect local midnight rather than UTC midnight',()=>{
  assert.equal(localDate('Asia/Manila',new Date('2026-10-16T17:00:00Z')),'2026-10-17');
  assert.equal(localDate('UTC',new Date('2026-10-16T17:00:00Z')),'2026-10-16');
});

test('repayment schedule handles partial payments, final cents, and month ends',()=>{
  assert.equal(installmentDate('2026-01-31','monthly',1),'2026-02-28');
  assert.equal(installmentDate('2026-01-31','monthly',2),'2026-03-31');
  const loan={id:'l',date:'2026-01-01',frequency:'weekly',principal:100.01,installment:40};
  const data=schedule(loan,[{loanId:'l',date:'2026-01-08',paid:50}],'2026-01-20');
  assert.equal(data.rows.length,3);assert.equal(data.rows[2].due,20.01);
  assert.equal(data.rows[0].status,'paid');assert.equal(data.rows[1].status,'partial');assert.equal(data.rows[1].paid,10);
  assert.equal(data.arrears,30);assert.equal(data.balance,50.01);
  assert.equal(schedule(loan,[{loanId:'l',date:'2026-02-01',paid:100.01}],'2026-01-20').totalPaid,0);
  assert.throws(()=>schedule({...loan,installment:0.01},[]),/600/);
});
test('CSV preserves quoted commas and rejects invalid rows',()=>{
  assert.deepEqual(parseCsv('name,business\r\n"Ana, Jr.","Food ""stall"""\r\n'),[{name:'Ana, Jr.',business:'Food "stall"'}]);
  assert.throws(()=>parseCsv('name,business\n"Unclosed,shop'),/unclosed/);
  assert.throws(()=>parseCsv('name,business\nAna,Shop,Extra'),/number of cells/);
});
test('backup authentication rejects tampering and incorrect passphrases',()=>{
  const encrypted=encryptBackup({members:[{name:'Private name'}]},'backup-passphrase-123');
  assert.ok(!JSON.stringify(encrypted).includes('Private name'));
  assert.deepEqual(decryptBackup(encrypted,'backup-passphrase-123'),{members:[{name:'Private name'}]});
  assert.throws(()=>decryptBackup(encrypted,'wrong-passphrase'));
  assert.throws(()=>decryptBackup({...encrypted,tag:Buffer.alloc(16).toString('base64')},'backup-passphrase-123'));
});

async function launch(){
  const dir=mkdtempSync(join(tmpdir(),'fl-operations-'));
  const proc=spawn(process.execPath,['backend/server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DATA_DIR:dir,NODE_ENV:'test',DEMO_MODE:'true'},stdio:['ignore','pipe','pipe']});
  let errors='';proc.stderr.on('data',d=>errors+=d);
  const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(errors)),5000);proc.stdout.on('data',d=>{const m=String(d).match(/http:\/\/[^ ]+/);if(m){clearTimeout(timer);resolve(m[0]);}});proc.on('exit',()=>reject(new Error(errors)));});
  async function client(login){const response=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(login)});assert.equal(response.status,200,await response.text());const cookie=response.headers.get('set-cookie').split(';')[0];return async(path,method='GET',body)=>{const r=await fetch(url+'/api'+path,{method,headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};}
  return {dir,client,async close(){proc.kill();await once(proc,'exit');rmSync(dir,{recursive:true,force:true});}};
}
test('group meeting atomicity, permissions, corrections, cases, CSV, and full restore',async()=>{
  const app=await launch();
  const password='staff-password-123';
  try {
    const admin=await app.client({demo:true});
    let workspace=(await admin('/workspace')).body;
    assert.equal(workspace.config.language,'en');
    const officer={name:'Field Officer',username:'officer1',role:'officer',password,groupIds:['GRP-001']};
    assert.equal((await admin('/staff','POST',officer)).status,201);
    assert.equal((await admin('/staff','POST',{...officer,name:'Supervisor',username:'supervisor1',role:'supervisor',groupIds:[]})).status,201);
    const field=await app.client({username:'officer1',password}),supervisor=await app.client({username:'supervisor1',password});
    const scoped=(await field('/workspace')).body;
    assert.equal(scoped.members.length,8);assert.equal(scoped.groups.length,1);assert.equal(scoped.staff.length,1);assert.equal(scoped.staff[0].passwordHash,undefined);assert.equal(scoped.audit.length,0);
    assert.equal((await field('/staff','POST',{...officer,username:'forbidden'})).status,403);
    assert.equal((await field('/backup','POST',{password})).status,403);
    assert.equal((await field('/settings','POST',workspace.settings)).status,403);
    assert.equal((await field('/members/MEM-010/verify','POST',{})).status,403);
    const make=(id,memberId,paid=100)=>({id,memberId,loanId:workspace.loans.find(l=>l.memberId===memberId)?.id||null,attendance:'present',paid,savings:25,utilisation:'not-checked',note:''});
    const meeting={groupId:'GRP-001',date:'2026-10-16',visits:[make('batch1','MEM-001'),make('batch2','MEM-002',999999)]};
    assert.equal((await field('/meetings','POST',meeting)).status,400);
    assert.equal((await admin('/workspace')).body.visits.length,workspace.visits.length);
    meeting.visits[1].paid=100;
    assert.equal((await field('/meetings','POST',meeting)).status,201);
    assert.equal((await field('/meetings','POST',meeting)).status,201);
    assert.equal((await admin('/workspace')).body.visits.length,workspace.visits.length+2);
    const edit={attendance:'present',paid:50,savings:30,utilisation:'verified',note:'Checked',version:1,reason:'Corrected amount from signed meeting sheet'};
    assert.equal((await field('/visits/batch1','PATCH',edit)).status,403);
    assert.equal((await supervisor('/visits/batch1','PATCH',edit)).status,200);
    assert.equal((await supervisor('/visits/batch1','PATCH',edit)).status,409);
    const history=(await admin('/visits/batch1/history')).body;
    assert.equal(history.revisions[0].before.paid,100);assert.equal(history.revisions[0].after.paid,50);
    const receipt=(await field('/visits/batch1/receipt')).body;assert.equal(receipt.total,80);assert.equal(receipt.version,2);assert.equal(receipt.corrected,true);
    assert.equal((await field('/loans/'+workspace.loans.find(l=>l.memberId==='MEM-010').id+'/schedule')).status,403);
    const user=scoped.user;
    assert.equal((await field('/visits','POST',{...make('wrong-owner','MEM-001'),date:'2026-10-17',capturedBy:'another-staff-account'})).status,403);
    const created=await field('/followups','POST',{memberId:'MEM-001',title:'Check stock purchase',assigneeId:user.id,dueDate:'2026-10-20',notes:'Arrange a visit'});assert.equal(created.status,201);
    assert.equal((await field('/followups/'+created.body.id,'PATCH',{version:1,status:'resolved',resolution:''})).status,400);
    assert.equal((await field('/followups/'+created.body.id,'PATCH',{version:1,status:'resolved',resolution:'Visited and confirmed stock purchase'})).status,200);
    const csv='name,groupId,business,income,expenses,household,earners,identityType,identitySuffix\nImported Person,GRP-001,Shop,12000,9000,4,2,Local government ID,1234\n';
    assert.equal((await supervisor('/import/members','POST',{csv,commit:false})).body.valid,1);
    assert.equal((await supervisor('/import/members','POST',{csv,commit:true})).status,201);
    assert.equal((await supervisor('/import/members','POST',{csv,commit:true})).status,400);
    assert.equal((await field('/import/members','POST',{csv,commit:false})).status,403);
    const config=await admin('/config','POST',{language:'fil',acceptedIds:['Barangay ID'],questions:[{label:'Seasonal income',type:'number',required:true}]});assert.equal(config.status,200);
    const member={name:'Test custom fields',groupId:'GRP-001',business:'Shop',income:12000,expenses:8000,household:3,earners:1,identityType:'Barangay ID',identitySuffix:'1234'};
    assert.equal((await field('/members','POST',member)).status,400);
    member.customFields={[config.body.questions[0].id]:1500};const customMember=await field('/members','POST',member);assert.equal(customMember.status,201);
    const archive=(await admin('/backup','POST',{password:'backup-passphrase-123'})).body;
    const payload=decryptBackup(archive,'backup-passphrase-123');assert.equal(payload.staff.length,2);assert.equal(payload.workspace.revisions.length,1);
    assert.equal(payload.workspace.members.find(m=>m.id===customMember.body.id).customFieldLabels[config.body.questions[0].id],'Seasonal income');
    const restoreDir=join(app.dir,'restore'),backupFile=join(app.dir,'backup.json');writeFileSync(backupFile,JSON.stringify(archive));
    const restore=spawn(process.execPath,['backend/scripts/restore.mjs'],{env:{...process.env,BACKUP_FILE:backupFile,BACKUP_PASSWORD:'backup-passphrase-123',DATA_DIR:restoreDir},stdio:['ignore','pipe','pipe']});
    let logs='';restore.stderr.on('data',d=>logs+=d);const [code]=await once(restore,'exit');assert.equal(code,0,logs);
    const restored=openRepository({dataDir:restoreDir,demo:false});
    try{assert.equal(restored.read().members.length,payload.workspace.members.length);assert.equal(restored.read().revisions[0].before.paid,100);assert.equal(restored.read().followups[0].status,'resolved');assert.equal(restored.listStaff().length,2);}finally{restored.close();}
    workspace=(await admin('/workspace')).body;
    const account=workspace.staff.find(u=>u.username==='officer1');assert.equal((await admin('/staff/'+account.id,'PATCH',{role:'officer',active:false,groupIds:['GRP-001']})).status,200);
    assert.equal((await field('/workspace')).status,401);
  }finally{await app.close();}
});
