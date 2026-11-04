import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OfflineVault} from '../frontend/public/offline.js';

test('offline records encrypt, lock, recover, reject wrong passphrase, and isolate accounts',async()=>{
  const store=new Map();globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
  const vault=new OfflineVault('workspace-admin');
  await assert.rejects(()=>vault.save([{note:'Private household observation'}]),/Unlock/);
  await vault.unlock('device-passphrase-123');
  await vault.save([{id:'offline-1',note:'Private household observation',paid:50}]);
  assert.ok(!store.get(vault.storageKey).includes('Private household observation'));
  assert.equal(vault.metadata().count,1);
  vault.lock();assert.equal(vault.records.length,0);assert.equal(vault.metadata().locked,true);
  await assert.rejects(()=>vault.unlock('incorrect-passphrase-123'),/Unable to unlock/);
  await vault.unlock('device-passphrase-123');assert.equal(vault.records[0].paid,50);
  const other=new OfflineVault('workspace-other');assert.equal(other.metadata().count,0);
  store.set(other.storageKey,store.get(vault.storageKey));await assert.rejects(()=>other.unlock('device-passphrase-123'),/Unable to unlock/);
  await vault.save([]);assert.equal(vault.metadata().count,0);
});

test('encrypted queue preserves household unknowns, voluntary responses and versioned support updates',async()=>{
  const store=new Map();globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
  const vault=new OfflineVault('health-workspace-officer');
  const records=[
    {id:'checkin-1',memberId:'member-1',_kind:'Household check-in',_path:'/health/checkins',_method:'POST',payload:{id:'checkin-1',response:'declined',shortfallDays:null,essentials:[],officerNotes:'Private household conversation',capturedBy:'officer'}},
    {id:'update-1',memberId:'member-1',_kind:'Support update',_path:'/health/plans/plan-1',_method:'PATCH',payload:{operationId:'update-1',version:3,deliveryStatus:'not-received',deliveryNotes:'Programme unavailable',capturedBy:'officer'}}
  ];
  await vault.unlock('household-device-passphrase');await vault.save(records);vault.lock();
  assert.equal(vault.metadata().count,2);assert.ok(!store.get(vault.storageKey).includes('Private household conversation'));
  await vault.unlock('household-device-passphrase');assert.deepEqual(vault.records,records);
});
