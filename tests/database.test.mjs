import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openRepository } from '../database/repository.mjs';

test('relational data, consent, and visits survive closing and reopening',()=>{
  const dataDir=mkdtempSync(join(tmpdir(),'fieldledger-db-'));
  let repo=openRepository({dataDir,demo:true});
  try {
    const s=repo.read();assert.equal(s.members.length,24);assert.equal(s.visits.length,192);
    assert.equal(s.settings.country,'India');assert.equal(s.settings.currency,'INR');assert.equal(s.config.timeZone,'Asia/Kolkata');
    assert.equal(s.members[0].name,'Sunita Patil');assert.ok([...s.members,...s.loans,...s.visits].every(r=>r.currency==='INR'));
    s.members[0].consent={granted:true,recipient:'Partner NGO',purpose:'Member requested review',at:new Date().toISOString(),expires:new Date(Date.now()+10000).toISOString(),officer:'Test'};
    s.settings.name='Test organization';repo.save(s);repo.close();repo=openRepository({dataDir,demo:true});
    const restored=repo.read();assert.equal(restored.settings.name,'Test organization');assert.equal(restored.members[0].consent.recipient,'Partner NGO');assert.equal(restored.members[0].kycVerified,true);assert.equal(restored.loans.length,18);
    restored.members[0].groupId='missing-group';assert.throws(()=>repo.save(restored),/FOREIGN KEY/);assert.equal(repo.read().members[0].groupId,'GRP-001');
  } finally {repo.close();rmSync(dataDir,{recursive:true,force:true});}
});
test('non-demo starts empty',()=>{
  const dataDir=mkdtempSync(join(tmpdir(),'fieldledger-empty-')),repo=openRepository({dataDir,demo:false});
  try {assert.equal(repo.read().members.length,0);assert.equal(repo.read().groups.length,0);}finally{repo.close();rmSync(dataDir,{recursive:true,force:true});}
});
