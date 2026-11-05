import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { payPosition, payFlags, debtPosition, SUPPORT_COLLECTIONS } from '../shared/support.mjs';
import { projectOffline } from '../shared/offline-model.mjs';
import { decryptBackup } from '../backend/services/backup.mjs';
import { openRepository } from '../database/repository.mjs';

test('pay rules preserve unknowns, use take-home expectations, and never count deductions or remittances as wages', () => {
  const p = { id: 'person', consented: true, payPolicy: { lateDays: 7, shortPercent: 10 } },
    pay = { id: 'pay', personId: p.id, dueDate: '2026-01-01', expected: 1000, currency: 'INR' };
  const s = {
    supportPeople: [p],
    payPeriods: [pay],
    payReceipts: [],
    deductions: [{ payId: 'pay', amount: 500 }],
    remittances: [{ sent: 500 }],
  };
  assert.equal(payPosition(s, pay, '2026-01-20').received, null);
  assert.equal(payFlags(s, '2026-01-08').length, 0);
  assert.equal(payFlags(s, '2026-01-09')[0].kind, 'unconfirmed-pay');
  s.payReceipts = [{ payId: 'pay', date: '2026-01-02', amount: 900 }];
  assert.equal(payFlags(s, '2026-01-02')[0].kind, 'short-pay');
  assert.equal(payPosition(s, pay, '2026-01-20').shortfall, 100);
  s.payReceipts.push({ payId: 'pay', date: '2026-01-03', amount: null });
  assert.equal(payPosition(s, pay, '2026-01-20').received, null);
  assert.equal(payPosition(s, pay, '2026-01-20').knownAmount, 900);
  assert.equal(
    payFlags(s, '2026-01-20').some(f => f.kind === 'short-pay'),
    false
  );
  s.payReceipts[1].voided = true;
  s.payReceipts.push({ payId: 'pay', date: '2026-02-01', amount: 100 });
  assert.equal(payFlags(s, '2026-01-20').length, 2);
  assert.equal(payFlags(s, '2026-02-01').length, 0);
  p.consented = false;
  assert.deepEqual(payFlags(s, '2026-01-20'), []);
});

test('offline support projections preserve dependency order, apply linked deductions once and retain version checks', () => {
  const base = {
    user: { id: 'u', name: 'Staff' },
    staff: [],
    supportPeople: [],
    payPeriods: [],
    workerDebts: [],
    debtEntries: [],
    deductions: [],
  };
  const q = (path, payload, method = 'POST') => ({ _kind: 'Support record', _path: path, _method: method, payload });
  const records = [
    q('/support/people', { id: 'person', name: 'Person', consented: true }),
    q('/support/pay', { id: 'pay', personId: 'person', currency: 'INR' }),
    q('/support/debts', { id: 'debt', personId: 'person', opening: 1000, currency: 'INR', date: '2026-01-01' }),
    q('/support/deductions', {
      id: 'deduction',
      personId: 'person',
      payId: 'pay',
      debtId: 'debt',
      amount: 100,
      date: '2026-01-02',
      source: 'worker',
    }),
  ];
  const projected = projectOffline(base, records);
  assert.equal(projected.supportPeople[0].pending, true);
  assert.equal(projected.deductions[0].currency, 'INR');
  assert.equal(debtPosition(projected, projected.workerDebts[0], '2026-01-03').balance, 900);
  assert.equal(projectOffline(projected, records).debtEntries.length, 1);
  assert.equal(base.supportPeople.length, 0);
  const reversed = projectOffline(projected, [
    q('/support/deductions/deduction/void', { reason: 'Wrong amount', version: 1 }),
  ]);
  assert.equal(debtPosition(reversed, reversed.workerDebts[0], '2026-01-03').balance, 1000);
});

test('support API scopes standalone people, validates ledger entries, retries safely, links cases, and restores all modules', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fl-support-')),
    proc = spawn(process.execPath, ['backend/server.mjs'], {
      env: { ...process.env, PORT: '0', DATA_DIR: dir, DEMO_MODE: 'true', NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  let errors = '';
  proc.stderr.on('data', d => (errors += d));
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errors || 'Server startup timeout')), 8000);
    proc.stdout.on('data', d => {
      const m = String(d).match(/http:\/\/[^ ]+/);
      if (m) {
        clearTimeout(timer);
        resolve(m[0]);
      }
    });
    proc.on('exit', () => {
      clearTimeout(timer);
      reject(new Error(errors));
    });
  });
  async function client(login) {
    const r = await fetch(url + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(login),
      }),
      cookie = r.headers.get('set-cookie').split(';')[0];
    return async (path, method = 'GET', body) => {
      const r = await fetch(url + '/api' + path, {
        method,
        headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    };
  }
  try {
    const admin = await client({ demo: true });
    await admin('/staff', 'POST', {
      name: 'Field staff',
      username: 'support-officer',
      password: 'support-testing-password',
      role: 'officer',
      groupIds: ['GRP-001'],
    });
    const officer = await client({ username: 'support-officer', password: 'support-testing-password' });
    const p = {
      id: 'worker-person-01',
      name: 'Worker alias',
      kind: 'domestic-worker',
      groupId: 'GRP-001',
      currency: 'INR',
      source: 'worker',
      consented: true,
      safeContact: 'At agreed meeting',
      notes: '',
    };
    assert.equal((await officer('/support/people', 'POST', { ...p, source: 'employer' })).status, 400);
    assert.equal((await officer('/support/people', 'POST', { ...p, consented: false })).status, 400);
    assert.equal((await officer('/support/people', 'POST', { ...p, latitude: 1 })).status, 400);
    assert.equal((await officer('/support/people', 'POST', { ...p, groupId: 'GRP-002' })).status, 403);
    assert.equal((await officer('/support/people', 'POST', p)).status, 201);
    assert.equal(
      (await officer('/support/people', 'POST', { ...p, capturedBy: (await officer('/workspace')).body.user.id }))
        .status,
      200
    );
    assert.equal((await officer('/support/people', 'POST', { ...p, name: 'Changed' })).status, 409);
    assert.equal(
      (await admin('/support/people', 'POST', { ...p, id: 'other-person-01', groupId: 'GRP-002' })).status,
      201
    );
    const pay = {
      id: 'pay-period-0001',
      personId: p.id,
      label: 'January salary',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      dueDate: '2026-02-01',
      expected: 1000,
      currency: 'INR',
      source: 'worker',
      notes: '',
    };
    assert.equal((await officer('/support/pay', 'POST', pay)).status, 201);
    assert.equal((await officer('/support/pay', 'POST', pay)).status, 200);
    assert.equal((await officer('/support/pay', 'POST', { ...pay, id: 'duplicate-period' })).status, 409);
    const receipt = {
      id: 'pay-receipt-0001',
      personId: p.id,
      payId: pay.id,
      date: '2026-02-02',
      amount: 700,
      source: 'worker',
      notes: '',
    };
    assert.equal((await officer('/support/receipts', 'POST', receipt)).status, 201);
    assert.equal((await officer('/support/receipts', 'POST', receipt)).status, 200);
    assert.equal(
      (await officer('/support/receipts', 'POST', { ...receipt, id: 'bad-receipt-01', amount: 0.001 })).status,
      400
    );
    assert.equal(
      (await officer('/support/receipts', 'POST', { ...receipt, id: 'other-receipt-01', personId: 'other-person-01' }))
        .status,
      403
    );
    const debt = {
      id: 'debt-record-0001',
      personId: p.id,
      date: '2026-01-01',
      label: 'Reported advance',
      kind: 'advance',
      opening: 5000,
      currency: 'INR',
      disputed: true,
      source: 'worker',
      notes: '',
    };
    assert.equal((await officer('/support/debts', 'POST', debt)).status, 201);
    const deduction = {
      id: 'wage-deduction-01',
      personId: p.id,
      payId: pay.id,
      debtId: debt.id,
      date: '2026-02-02',
      label: 'Debt deduction',
      amount: 200,
      status: 'disputed',
      confirmedRepayment: true,
      source: 'worker',
      notes: '',
    };
    assert.equal(
      (await officer('/support/deductions', 'POST', { ...deduction, confirmedRepayment: false })).status,
      400
    );
    assert.equal((await officer('/support/deductions', 'POST', deduction)).status, 201);
    assert.equal((await officer('/support/deductions', 'POST', deduction)).status, 200);
    let state = (await officer('/workspace')).body;
    assert.equal(state.debtEntries.length, 1);
    assert.equal(debtPosition(state, state.workerDebts[0], '2026-03-01').balance, 4800);
    assert.equal(payPosition(state, state.payPeriods[0], '2026-03-01').received, 700);
    assert.equal(
      (
        await officer('/support/debt-entries', 'POST', {
          id: 'overpaid-entry-01',
          personId: p.id,
          debtId: debt.id,
          date: '2026-02-03',
          kind: 'repayment',
          amount: 6000,
          source: 'worker',
        })
      ).status,
      400
    );
    assert.equal((await officer('/workspace')).body.debtEntries.length, 1);
    const remit = {
      id: 'remittance-0001',
      personId: p.id,
      date: '2026-02-02',
      sent: 100,
      sentCurrency: 'USD',
      fee: null,
      received: 8200,
      receivedCurrency: 'INR',
      receivedDate: '2026-02-03',
      source: 'family',
      notes: '',
    };
    assert.equal((await officer('/support/remittances', 'POST', remit)).status, 201);
    assert.equal(
      (await officer('/support/remittances', 'POST', { ...remit, id: 'bad-remittance-01', receivedDate: '2026-02-01' }))
        .status,
      400
    );
    const pendingRemit = { ...remit, id: 'pending-remittance', received: null, receivedDate: null };
    assert.equal((await officer('/support/remittances', 'POST', pendingRemit)).status, 201);
    const confirmed = {
      operationId: 'confirm-receipt-01',
      version: 1,
      received: 8100,
      receivedDate: '2026-02-03',
      source: 'family',
    };
    assert.equal((await officer('/support/remittances/' + pendingRemit.id, 'PATCH', confirmed)).status, 200);
    assert.equal((await officer('/support/remittances/' + pendingRemit.id, 'PATCH', confirmed)).status, 200);
    assert.equal(
      (
        await officer('/support/remittances/' + pendingRemit.id, 'PATCH', {
          ...confirmed,
          operationId: 'another-receipt-01',
        })
      ).status,
      409
    );
    const who = state.user.id,
      follow = {
        id: 'worker-case-0001',
        personId: p.id,
        title: 'Discuss pay gap',
        action: 'Agree a safe follow-up and discuss support',
        dueDate: '2026-03-01',
        assigneeId: who,
        sourceKey: pay.id + ':short-pay',
        source: 'worker',
        agreed: true,
        notes: '',
      };
    const created = await officer('/support/cases', 'POST', follow);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal((await officer('/support/cases', 'POST', follow)).status, 200);
    assert.equal((await officer('/support/cases', 'POST', { ...follow, id: 'duplicate-case-01' })).status, 409);
    assert.equal(
      (
        await officer('/support/cases', 'POST', {
          ...follow,
          id: 'duplicate-late-case',
          sourceKey: pay.id + ':late-pay',
        })
      ).status,
      409
    );
    const update = {
      personId: p.id,
      operationId: 'case-update-0001',
      version: 1,
      status: 'resolved',
      deliveryStatus: 'received',
      receivedDate: '2026-03-01',
      dueDate: '2026-03-01',
      resolution: 'Assistance received; worker reports payment still disputed',
      outcomeNotes: 'Follow-up recorded',
      assigneeId: who,
    };
    assert.equal((await officer('/support/cases/' + follow.id, 'PATCH', update)).status, 200);
    assert.equal((await officer('/support/cases/' + follow.id, 'PATCH', update)).status, 200);
    assert.equal(
      (await officer('/support/cases/' + follow.id, 'PATCH', { ...update, operationId: 'stale-update-01' })).status,
      409
    );
    const prospect = {
      ...p,
      id: 'prospect-person-01',
      kind: 'prospective',
      name: 'Prospective member',
      source: 'member',
    };
    assert.equal((await officer('/support/people', 'POST', prospect)).status, 201);
    const meeting = {
      id: 'prospect-meeting-01',
      personId: prospect.id,
      date: '2026-02-01',
      attendance: 'present',
      savings: null,
      currency: 'INR',
      source: 'member',
    };
    assert.equal((await officer('/support/participation', 'POST', meeting)).status, 201);
    assert.equal(
      (await officer('/support/participation', 'POST', { ...meeting, id: 'duplicate-meeting' })).status,
      409
    );
    const review = {
      id: 'prospect-review-01',
      personId: prospect.id,
      date: '2026-02-02',
      outcome: 'awaiting-information',
      reason: 'Income information still incomplete',
      source: 'member',
    };
    assert.equal((await officer('/support/reviews', 'POST', review)).status, 403);
    assert.equal((await admin('/support/reviews', 'POST', review)).status, 201);
    const asset = {
      id: 'livelihood-check-01',
      personId: prospect.id,
      date: '2026-02-02',
      intended: 'Buffalo',
      actual: 'Buffalo purchased',
      functioning: 'partly-working',
      explanation: 'Household reports animal unwell',
      officerNotes: 'Discuss veterinary referral',
      source: 'member',
    };
    assert.equal((await officer('/support/assets', 'POST', asset)).status, 201);
    assert.equal(
      (
        await officer('/support/cases', 'POST', {
          ...follow,
          id: 'asset-case-0001',
          personId: prospect.id,
          sourceKey: null,
          assetId: asset.id,
        })
      ).status,
      201
    );
    assert.equal(
      (
        await officer('/support/deductions/' + deduction.id + '/void', 'POST', {
          version: 1,
          reason: 'Wrong deduction amount',
        })
      ).status,
      403
    );
    assert.equal(
      (
        await admin('/support/deductions/' + deduction.id + '/void', 'POST', {
          version: 1,
          reason: 'Wrong deduction amount',
        })
      ).status,
      200
    );
    assert.equal(
      (
        await admin('/support/deductions/' + deduction.id + '/void', 'POST', {
          version: 1,
          reason: 'Wrong deduction amount',
        })
      ).status,
      200
    );
    state = (await officer('/workspace')).body;
    assert.equal(debtPosition(state, state.workerDebts[0], '2026-03-01').balance, 5000);
    const settings = {
      personId: p.id,
      operationId: 'profile-update-01',
      version: 1,
      consented: false,
      payPolicy: { lateDays: 3, shortPercent: 20 },
      missingInformation: ['Receipt amount clarification'],
      reviewDate: '2026-03-01',
    };
    assert.equal((await officer('/support/people/' + p.id, 'PATCH', settings)).status, 200);
    assert.equal(
      (
        await officer('/support/pay', 'POST', {
          ...pay,
          id: 'after-revocation',
          periodStart: '2026-03-01',
          periodEnd: '2026-03-31',
          dueDate: '2026-04-01',
        })
      ).status,
      403
    );
    state = (await officer('/workspace')).body;
    assert.equal(state.supportPeople.length, 2);
    assert.equal(
      state.supportPeople.some(x => x.id === 'other-person-01'),
      false
    );
    assert.equal(state.workerCases.length, 2);
    const full = (await admin('/workspace')).body,
      archive = (await admin('/backup', 'POST', { password: 'support-backup-password' })).body,
      payload = decryptBackup(archive, 'support-backup-password');
    assert.equal(payload.schema, 8);
    const restoreDir = mkdtempSync(join(tmpdir(), 'fl-support-restored-')),
      repo = openRepository({ dataDir: restoreDir, demo: false });
    try {
      repo.save(payload.workspace);
      for (const key of SUPPORT_COLLECTIONS) assert.deepEqual(repo.read()[key], full[key]);
    } finally {
      repo.close();
      rmSync(restoreDir, { recursive: true, force: true });
    }
    assert.equal((await admin('/support/demo', 'POST', {})).status, 409);
  } finally {
    proc.kill();
    await once(proc, 'exit');
    rmSync(dir, { recursive: true, force: true });
  }
});
