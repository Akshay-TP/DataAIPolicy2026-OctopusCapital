import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {CURRENCIES,currencyDigits,validMoney,totalsByCurrency,formatMoney,attendanceByDate} from '../shared/catalog.mjs';
import {openRepository} from '../database/repository.mjs';
import {indicators} from '../backend/services/indicators.mjs';

test('currency precision and per-currency totals do not silently combine money',()=>{
  assert.deepEqual(CURRENCIES,['PHP','USD']);assert.equal(currencyDigits('JPY'),0);assert.equal(currencyDigits('USD'),2);
  assert.equal(validMoney(1.25,'USD'),true);assert.equal(validMoney(1.255,'USD'),false);assert.equal(validMoney(1.5,'JPY'),false);assert.equal(validMoney(20000,'VND'),false);
  assert.equal(validMoney(10,'INVALID'),false);
  assert.deepEqual(totalsByCurrency([{currency:'PHP',paid:100},{currency:'USD',paid:5.25},{currency:'PHP',paid:50}],'paid'),{PHP:150,USD:5.25});
  assert.match(formatMoney(1.25,'USD','hi'),/USD/);assert.match(formatMoney(1.25,'USD'),/1\.25/);
  assert.match(formatMoney(100.5,'USD'),/100\.50/);
});

test('same-day currency entries count attendance once, with separate financial indicators',()=>{
  const member={id:'m',currency:'PHP',income:1000,expenses:500};
  const visits=[{id:'a',memberId:'m',date:'2026-10-01',currency:'PHP',attendance:'present',paid:50,due:50,savings:100,utilisation:'not-checked',loanId:'l'},
    {id:'b',memberId:'m',date:'2026-10-01',currency:'USD',attendance:'present',paid:5,due:5,savings:10,utilisation:'not-checked',loanId:'u'}];
  const data=indicators(member,visits,[{id:'l',memberId:'m',currency:'PHP',principal:100},{id:'u',memberId:'m',currency:'USD',principal:20}]);
  assert.equal(data.visits,1);assert.equal(data.attendanceTotal,1);assert.equal(data.savings,100);assert.deepEqual(data.savingsByCurrency,{PHP:100,USD:10});assert.deepEqual(data.outstandingByCurrency,{PHP:50,USD:15});
  assert.equal(attendanceByDate([...visits,{date:'2026-10-01',attendance:'absent'}])[0].conflict,true);
});

test('v2 migration preserves currencies, history and foreign keys, and retains a pre-migration copy',()=>{
  const dir=mkdtempSync(join(tmpdir(),'fl-currency-migration-'));
  const db=new DatabaseSync(join(dir,'fieldledger.sqlite'));
  db.exec(readFileSync('database/migrations/001_initial.sql','utf8'));db.exec(readFileSync('database/migrations/002_operations.sql','utf8'));
  db.exec("ALTER TABLE visits ADD COLUMN version INTEGER NOT NULL DEFAULT 1; INSERT INTO schema_migrations(version) VALUES(1),(2)");
  db.prepare('INSERT INTO organization VALUES(1,?,?,?,?)').run('Migration NGO','India','INR','en');
  db.prepare('INSERT INTO community_groups VALUES(?,?,?,?,?,?,?)').run('g','Group','Village','Officer','2026-10-01','09:00','teal');
  db.prepare('INSERT INTO members VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('m','Member','g','Shop',1000,500,3,1,1,'Voter ID','1234','2026-01-01');
  db.prepare('INSERT INTO loans VALUES(?,?,?,?,?,?,?,?)').run('l','m',100,10,'weekly','Shop','2026-01-01','active');
  db.prepare('INSERT INTO visits VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('v','m','l','2026-01-08','present',10,10,5,'verified','','Officer','2026-01-08T09:00:00Z',2);
  db.prepare('INSERT INTO visit_revisions VALUES(?,?,?,?,?,?,?)').run('r','v','2026-01-09','Supervisor','Corrected from receipt',JSON.stringify({paid:5}),JSON.stringify({paid:10}));
  db.close();
  const repo=openRepository({dataDir:dir,demo:false});
  try{const s=repo.read();assert.equal(s.members[0].currency,'INR');assert.equal(s.loans[0].currency,'INR');assert.equal(s.visits[0].currency,'INR');assert.equal(s.revisions[0].before.paid,5);assert.ok(existsSync(join(dir,'before-multicurrency.sqlite')));s.settings.currency='USD';repo.save(s);assert.equal(repo.read().visits[0].currency,'INR');assert.equal(repo.read().members[0].currency,'INR');}
  finally{repo.close();rmSync(dir,{recursive:true,force:true});}
});

test('multi-currency API keeps loan, receipt, corrections and defaults consistent',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'fl-currency-api-'));
  const proc=spawn(process.execPath,['backend/server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DATA_DIR:dir,DEMO_MODE:'true',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
  let errors='';proc.stderr.on('data',d=>errors+=d);
  const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(errors)),5000);proc.stdout.on('data',d=>{const match=String(d).match(/http:\/\/[^ ]+/);if(match){clearTimeout(timer);resolve(match[0]);}});proc.on('exit',()=>reject(new Error(errors)));});
  let cookie='';
  async function request(path,method='GET',body){const response=await fetch(url+'/api'+path,{method,headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});if(path==='/login')cookie=response.headers.get('set-cookie')?.split(';')[0]||'';return {status:response.status,body:await response.json()};}
  try{
    await request('/login','POST',{demo:true});const initial=(await request('/workspace')).body;
    assert.equal((await request('/settings','POST',{...initial.settings,currency:'USD'})).status,200);
    let s=(await request('/workspace')).body;assert.equal(s.members[0].currency,'PHP');assert.equal(s.visits[0].currency,'PHP');
    const loan=await request('/loans','POST',{memberId:'MEM-001',currency:'USD',principal:100,installment:20,frequency:'weekly',purpose:'Equipment',date:'2026-10-01'});assert.equal(loan.status,201);
    const visit={id:'usd-visit',memberId:'MEM-001',loanId:loan.body.id,currency:'USD',date:'2026-10-16',attendance:'present',paid:20,savings:2.25,utilisation:'verified',note:''};
    assert.equal((await request('/visits','POST',{...visit,currency:'PHP'})).status,400);
    assert.equal((await request('/visits','POST',visit)).status,201);
    assert.equal((await request('/visits','POST',visit)).status,200);
    assert.equal((await request('/visits','POST',{...visit,id:'php-visit',loanId:initial.loans[0].id,currency:'PHP',paid:100,savings:50})).status,201);
    assert.equal((await request('/visits','POST',{...visit,id:'duplicate'})).status,409);
    const receipt=(await request('/visits/usd-visit/receipt')).body;assert.equal(receipt.currency,'USD');assert.equal(receipt.total,22.25);
    assert.equal((await request('/loans/'+loan.body.id+'/schedule')).body.currency,'USD');
    assert.equal((await request('/visits/usd-visit','PATCH',{...visit,version:1,reason:'Correction attempt',currency:'EUR'})).status,400);
    assert.equal((await request('/loans','POST',{memberId:'MEM-001',currency:'JPY',principal:100.5,installment:10,frequency:'monthly',purpose:'Test',date:'2026-10-01'})).status,400);
    assert.equal((await request('/loans','POST',{memberId:'MEM-001',currency:'JPY',principal:1000,installment:100,frequency:'monthly',purpose:'Test',date:'2026-10-01'})).status,400);
    assert.equal((await request('/config','POST',{...s.config,language:'fil'})).status,200);
    assert.equal((await request('/config','POST',{...s.config,language:'xx'})).status,400);
    s=(await request('/workspace')).body;assert.equal(s.visits.find(v=>v.id==='usd-visit').currency,'USD');assert.equal(s.visits.find(v=>v.id==='php-visit').currency,'PHP');
    const shared=await fetch(url+'/shared/catalog.mjs');assert.equal(shared.status,200);assert.match(shared.headers.get('content-type'),/javascript/);
  }finally{proc.kill();await once(proc,'exit');rmSync(dir,{recursive:true,force:true});}
});
