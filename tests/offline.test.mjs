import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OfflineVault } from '../frontend/public/offline.js';

test('offline records encrypt, lock, recover, reject wrong passphrase, and isolate accounts', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) };
  const vault = new OfflineVault('workspace-admin');
  await assert.rejects(() => vault.save([{ note: 'Private household observation' }]), /Unlock/);
  await vault.unlock('device-passphrase-123');
  await vault.save([{ id: 'offline-1', note: 'Private household observation', paid: 50 }]);
  assert.ok(!store.get(vault.storageKey).includes('Private household observation'));
  assert.equal(vault.metadata().count, 1);
  vault.lock();
  assert.equal(vault.records.length, 0);
  assert.equal(vault.metadata().locked, true);
  await assert.rejects(() => vault.unlock('incorrect-passphrase-123'), /Unable to unlock/);
  await vault.unlock('device-passphrase-123');
  assert.equal(vault.records[0].paid, 50);
  const other = new OfflineVault('workspace-other');
  assert.equal(other.metadata().count, 0);
  // Another owner has neither the key nor the authenticated ciphertext.
  await other.unlock('different-passphrase-123');
  assert.deepEqual(other.records, []);
  await vault.save([]);
  assert.equal(vault.metadata().count, 0);
});

test('encrypted queue preserves household unknowns, voluntary responses and versioned support updates', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) };
  const vault = new OfflineVault('health-workspace-officer');
  const records = [
    {
      id: 'checkin-1',
      memberId: 'member-1',
      _kind: 'Household check-in',
      _path: '/health/checkins',
      _method: 'POST',
      payload: {
        id: 'checkin-1',
        response: 'declined',
        shortfallDays: null,
        essentials: [],
        officerNotes: 'Private household conversation',
        capturedBy: 'officer',
      },
    },
    {
      id: 'update-1',
      memberId: 'member-1',
      _kind: 'Support update',
      _path: '/health/plans/plan-1',
      _method: 'PATCH',
      payload: {
        operationId: 'update-1',
        version: 3,
        deliveryStatus: 'not-received',
        deliveryNotes: 'Programme unavailable',
        capturedBy: 'officer',
      },
    },
  ];
  await vault.unlock('household-device-passphrase');
  await vault.save(records);
  vault.lock();
  assert.equal(vault.metadata().count, 2);
  assert.ok(!store.get(vault.storageKey).includes('Private household conversation'));
  await vault.unlock('household-device-passphrase');
  assert.deepEqual(vault.records, records);
});
import { dualCurrencyProjection } from '../shared/health.mjs';
import { projectOffline } from '../shared/offline-model.mjs';
import { offlineAccessValid } from '../frontend/public/offline.js';

test('saved encrypted workspace reopens without a server and retains its outbox; concurrent tabs cannot overwrite it', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) };
  const owner = 'offline-restart-workspace',
    vault = new OfflineVault(owner),
    workspace = {
      settings: { name: 'NGO' },
      user: { id: 'officer', name: 'Staff' },
      offlineAccess: { expiresAt: '2026-12-01T00:00:00Z' },
      members: [{ name: 'PRIVATE-MEMBER-CANARY' }],
    };
  await vault.unlock('offline-restart-passphrase');
  await vault.saveWorkspace(workspace);
  await vault.save([{ id: 'pending' }]);
  vault.lock();
  const fresh = new OfflineVault(owner);
  await fresh.unlock('offline-restart-passphrase');
  assert.deepEqual(fresh.workspace, workspace);
  assert.equal(fresh.records[0].id, 'pending');
  assert.equal(offlineAccessValid(workspace, Date.parse('2026-11-01')), true);
  assert.equal(offlineAccessValid(workspace, Date.parse('2026-12-02')), false);
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open('fieldledger-encrypted', 1);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const envelope = await new Promise(resolve => {
    const r = db.transaction('vaults').objectStore('vaults').get(owner);
    r.onsuccess = () => resolve(r.result);
  });
  assert.equal(JSON.stringify(envelope).includes('PRIVATE-MEMBER-CANARY'), false);
  assert.equal(JSON.stringify([...store.values()]).includes('PRIVATE-MEMBER-CANARY'), false);
  const other = new OfflineVault(owner);
  await other.unlock('offline-restart-passphrase');
  await fresh.mutateRecords(r => [...r, { id: 'new' }]);
  await assert.rejects(() => other.save([]), /another tab/);
  await other.unlock('offline-restart-passphrase');
  assert.equal(other.records.length, 2);
  await Promise.all([
    other.mutateRecords(r => [...r, { id: 'third' }]),
    other.mutateRecords(r => [...r, { id: 'fourth' }]),
  ]);
  assert.equal(other.records.length, 4);
  const tx = db.transaction('vaults', 'readwrite');
  const damaged = { ...envelope, data: envelope.data.slice(0, -4) + 'AAAA' };
  tx.objectStore('vaults').put(damaged, 'tampered-workspace');
  await new Promise(resolve => (tx.oncomplete = resolve));
  await assert.rejects(
    () => new OfflineVault('tampered-workspace').unlock('offline-restart-passphrase'),
    /Unable to unlock/
  );
  db.close();
});

test('offline projections show drafts once, preserve unknowns, and keep server truth untouched', () => {
  const s = { user: { id: 'u', name: 'Officer' }, staff: [], visits: [], checkins: [], supportPlans: [], cashflow: [] };
  const records = [
    {
      id: 'c',
      _kind: 'Check-in',
      _path: '/health/checkins',
      payload: { id: 'c', memberId: 'm', date: '2026-01-01', response: 'declined', shortfallDays: null },
    },
  ];
  const projected = projectOffline(s, records);
  assert.equal(projected.checkins[0].pending, true);
  assert.equal(projected.checkins[0].shortfallDays, null);
  assert.equal(s.checkins.length, 0);
  assert.equal(projectOffline(projected, records).checkins.length, 1);
  assert.equal(projectOffline(s, [{ ...records[0], _error: 'Conflict' }]).checkins.length, 0);
});
test('KHR income/USD installments expose cash-flow cliffs, conversion needs, FX stress and invalid assumptions', () => {
  const options = {
    from: '2026-01-01',
    to: '2026-01-31',
    openingKHR: 400000,
    openingUSD: 0,
    khrPerUsd: 4000,
    rateDate: '2026-01-01',
    rateSource: 'Test assumption',
    stressPercent: 10,
  };
  const entries = [
    { date: '2026-01-05', kind: 'expense', currency: 'USD', amount: 100 },
    { date: '2026-01-20', kind: 'income', currency: 'KHR', amount: 500000 },
    { date: '2026-01-25', kind: 'expense', currency: 'USD', amount: 150 },
  ];
  const p = dualCurrencyProjection(entries, options);
  assert.equal(p.base.rows[1].balance, 0);
  assert.equal(p.base.rows[1].usd, -100);
  assert.equal(p.base.rows[1].requiresExchange, true);
  assert.equal(p.base.firstGap, '2026-01-25');
  assert.equal(p.base.maxGap, 100000);
  assert.equal(p.stress.firstGap, '2026-01-05');
  assert.equal(p.stress.maxGap, 200000);
  assert.throws(() => dualCurrencyProjection(entries, { ...options, khrPerUsd: 0 }), /rate/);
  assert.throws(() => dualCurrencyProjection(entries, { ...options, rateSource: '' }), /source/);
  assert.throws(() => dualCurrencyProjection(entries, { ...options, to: '2028-01-01' }), /366/);
  assert.equal(
    dualCurrencyProjection(
      entries.map(e => ({ ...e, cancelled: true })),
      options
    ).base.maxGap,
    0
  );
});

test('locking during encryption cannot restore decrypted records or overwrite the saved vault', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) };
  const vault = new OfflineVault('lock-race-cleanup');
  await vault.unlock('lock-race-device-passphrase');
  await vault.save([{ id: 'existing' }]);
  const original = crypto.subtle.encrypt.bind(crypto.subtle);
  let release, started;
  const barrier = new Promise(resolve => (release = resolve)),
    encrypting = new Promise(resolve => (started = resolve));
  crypto.subtle.encrypt = async (...args) => {
    started();
    await barrier;
    return original(...args);
  };
  try {
    const saving = vault.save([{ id: 'unsaved-sensitive-value' }]);
    await encrypting;
    vault.lock();
    release();
    await assert.rejects(saving, /locked during save/);
    assert.equal(vault.key, null);
    assert.equal(vault.workspace, null);
    assert.deepEqual(vault.records, []);
  } finally {
    crypto.subtle.encrypt = original;
  }
  await vault.unlock('lock-race-device-passphrase');
  assert.deepEqual(vault.records, [{ id: 'existing' }]);
});

test('metadata failure reports that ciphertext survived rather than silently claiming offline setup succeeded', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) };
  const vault = new OfflineVault('metadata-error-cleanup');
  await vault.unlock('metadata-error-passphrase');
  globalThis.localStorage.setItem = () => {
    throw new Error('Browser storage denied');
  };
  await assert.rejects(() => vault.save([{ id: 'durable-record' }]), /saved encrypted/);
  vault.lock();
  globalThis.localStorage.setItem = (k, v) => store.set(k, v);
  await vault.unlock('metadata-error-passphrase');
  assert.equal(vault.records[0].id, 'durable-record');
});
