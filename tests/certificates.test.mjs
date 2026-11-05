import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import png from 'pngjs';
import { seal } from '../backend/services/certificates.mjs';
import { prepareExchange } from '../backend/scripts/demo-exchange.mjs';
import {
  CERTIFICATE_FORMAT,
  WITHDRAWAL_FORMAT,
  CLOSURE_CLAIM,
  CLOSURE_STATEMENT,
  canonicalJson,
  verifyCertificate,
  verifyWithdrawalList,
  CERTIFICATE_TABLES,
} from '../shared/certificates.mjs';
import { openRepository } from '../database/repository.mjs';
import { decryptBackup } from '../backend/services/backup.mjs';
import 'fake-indexeddb/auto';
import { createCertificateUI } from '../frontend/public/certificates.js';
import { createOperationsUI } from '../frontend/public/features.js';
import { OfflineVault } from '../frontend/public/offline.js';

function fixture() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519'),
    now = Date.now();
  const key = {
    issuerId: 'issuer-a',
    name: 'Fictional issuer A',
    keyId: 'key-a',
    publicKey: publicKey.export({ format: 'jwk' }).x,
    validFrom: '2020-01-01T00:00:00.000Z',
    validUntil: '2036-01-01T00:00:00.000Z',
  };
  const payload = {
    id: 'certificate-0001',
    issuerId: key.issuerId,
    issuerName: key.name,
    keyId: key.keyId,
    recipientId: 'issuer-b',
    claim: CLOSURE_CLAIM,
    statement: CLOSURE_STATEMENT,
    subjectRef: 'Borrower A-1',
    loanRef: 'Loan-1',
    assessmentDate: new Date(now).toISOString().slice(0, 10),
    preparedAt: new Date(now - 86400000).toISOString(),
    expiresAt: new Date(now + 86400000).toISOString(),
    synthetic: true,
  };
  const list = {
    issuerId: key.issuerId,
    keyId: key.keyId,
    sequence: 0,
    issuedAt: new Date(now - 1000).toISOString(),
    nextUpdate: new Date(now + 86400000).toISOString(),
    withdrawn: [],
  };
  return {
    privateKey,
    key,
    payload,
    list,
    certificate: seal(privateKey, CERTIFICATE_FORMAT, payload),
    settings: {
      keys: [key],
      statusLists: [seal(privateKey, WITHDRAWAL_FORMAT, list)],
      recipientId: 'issuer-b',
      policy: { maxStatusAgeHours: 24, requireLiveStatus: false },
    },
    now,
  };
}

test('independent Ed25519 checks distinguish altered, unknown, expired, withdrawn, stale and unsupported evidence', async () => {
  const f = fixture(),
    verify = (document, settings = f.settings) => verifyCertificate(document, { ...settings, now: f.now });
  assert.equal((await verify(f.certificate)).evidenceValid, true);
  assert.equal(
    (await verify({ ...f.certificate, payload: { ...f.payload, loanRef: 'Altered loan' } })).signature,
    'invalid'
  );
  assert.equal(
    (await verify({ ...f.certificate, payload: { ...f.payload, issuerId: 'unknown' } })).issuer,
    'unrecognised-key'
  );
  const expired = seal(f.privateKey, CERTIFICATE_FORMAT, {
    ...f.payload,
    preparedAt: new Date(f.now - 2 * 86400000).toISOString(),
    expiresAt: new Date(f.now - 86400000).toISOString(),
  });
  assert.equal((await verify(expired)).dates, 'expired');
  const unsupported = seal(f.privateKey, CERTIFICATE_FORMAT, { ...f.payload, claim: 'unapproved-claim' });
  assert.equal((await verify(unsupported)).format, 'unsupported');
  assert.equal((await verify(f.certificate, { ...f.settings, recipientId: 'another' })).evidenceValid, false);
  assert.equal((await verify(f.certificate, { ...f.settings, statusLists: [] })).withdrawal, 'unknown');
  const predates = seal(f.privateKey, WITHDRAWAL_FORMAT, {
    ...f.list,
    issuedAt: new Date(f.now - 2 * 86400000).toISOString(),
  });
  assert.equal(
    (await verify(f.certificate, { ...f.settings, statusLists: [predates] })).withdrawal,
    'snapshot-predates-certificate'
  );
  const revoked = seal(f.privateKey, WITHDRAWAL_FORMAT, {
    ...f.list,
    sequence: 1,
    withdrawn: [{ id: f.payload.id, at: f.list.issuedAt }],
  });
  assert.equal((await verify(f.certificate, { ...f.settings, statusLists: [revoked] })).withdrawal, 'withdrawn');
  const stale = seal(f.privateKey, WITHDRAWAL_FORMAT, {
    ...f.list,
    issuedAt: new Date(f.now - 10000).toISOString(),
    nextUpdate: new Date(f.now - 5000).toISOString(),
  });
  assert.equal((await verify(f.certificate, { ...f.settings, statusLists: [stale] })).withdrawal, 'stale-snapshot');
  assert.equal(
    (await verify(f.certificate, { ...f.settings, policy: { maxStatusAgeHours: 24, requireLiveStatus: true } }))
      .withdrawal,
    'live-status-required'
  );
  const malicious = seal(f.privateKey, WITHDRAWAL_FORMAT, { ...f.list, withdrawn: [null] });
  assert.equal((await verifyWithdrawalList(malicious, [f.key])).valid, false);
  const fetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('Verification must not contact the issuer');
  };
  try {
    assert.equal((await verify(f.certificate)).evidenceValid, true);
  } finally {
    globalThis.fetch = fetch;
  }
});

test('a printable QR decodes to exactly the approved signed JSON envelope', async () => {
  const f = fixture(),
    buffer = await QRCode.toBuffer(canonicalJson(f.certificate), { errorCorrectionLevel: 'M', width: 640, margin: 4 }),
    image = png.PNG.sync.read(buffer),
    decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
  assert.ok(decoded);
  assert.deepEqual(JSON.parse(decoded.data), f.certificate);
  assert.equal((await verifyCertificate(JSON.parse(decoded.data), f.settings)).signature, 'valid');
});

async function launch(env) {
  const process = spawn(globalThis.process.execPath, ['backend/server.mjs'], {
    env: { ...env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let errors = '';
  process.stderr.on('data', data => (errors += data));
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errors || 'Startup timeout')), 10000);
    process.stdout.on('data', data => {
      const match = String(data).match(/http:\/\/[^ ]+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    process.on('exit', () => {
      clearTimeout(timer);
      reject(new Error(errors));
    });
  });
  return {
    process,
    url,
    async login(body = { demo: true }) {
      const response = await fetch(url + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 200);
      const cookie = response.headers.get('set-cookie').split(';')[0];
      return async (path, method = 'GET', payload) => {
        const response = await fetch(url + '/api' + path, {
          method,
          headers: { Cookie: cookie, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
          ...(payload ? { body: JSON.stringify(payload) } : {}),
        });
        return { status: response.status, body: await response.json() };
      };
    },
  };
}

test('officers attach review evidence online and through encrypted offline sync without updating the shared status cache', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fl-officer-certificate-')),
    servers = [],
    globals = Object.fromEntries(
      ['document', 'localStorage', 'navigator', 'FormData'].map(key => [
        key,
        Object.getOwnPropertyDescriptor(globalThis, key),
      ])
    );
  let operations;
  try {
    for (const institution of prepareExchange(root)) servers.push(await launch(institution.env));
    const [a, b] = await Promise.all(servers.map(server => server.login()));
    const review = (
      await a('/certificates/reviews', 'POST', {
        id: crypto.randomUUID(),
        loanId: 'DEMO-CLOSED-LOAN',
        subjectRef: 'Borrower-001',
        loanRef: 'Loan-001',
        recipientId: 'demo-partner',
        sourceSystem: 'BR.NET',
        sourceReference: 'Synthetic authoritative reconciliation',
        assessmentDate: new Date().toISOString().slice(0, 10),
        validDays: 30,
        authoritativeClosed: true,
        paymentsFinal: true,
        noPendingCorrections: true,
      })
    ).body;
    assert.ok(review.id);
    assert.equal(
      (
        await a(`/certificates/reviews/${review.id}/borrower`, 'POST', {
          version: 1,
          decision: 'approved',
          explained: true,
          consented: true,
          note: 'Borrower reviewed this exact claim',
        })
      ).status,
      200
    );
    const issued = await a(`/certificates/reviews/${review.id}/issue`, 'POST', { authorised: true });
    assert.equal(issued.status, 201);
    const envelope = issued.body.envelope,
      snapshot = (await a('/certificates/status')).body;
    assert.equal(
      (
        await b('/staff', 'POST', {
          name: 'Receiving Officer',
          username: 'receiver.officer',
          role: 'officer',
          groupIds: ['GRP-001'],
          password: 'officer-certificate-passphrase',
        })
      ).status,
      201
    );
    const officer = await servers[1].login({
      username: 'receiver.officer',
      password: 'officer-certificate-passphrase',
    });
    let workspace = (await officer('/workspace')).body;
    const cacheBefore = workspace.certificateStatusCache;
    assert.equal((await verifyCertificate(envelope, workspace.credentialSettings)).evidenceValid, false);
    assert.equal((await officer('/certificates/status/import', 'POST', { envelope: snapshot })).status, 403);

    // Drive the actual certificate form handlers, with lightweight DOM controls in place of a browser.
    const nodes = Object.fromEntries(
      ['text', 'verify', 'result', 'error', 'decision', 'upload', 'image', 'status'].map(id => [
        '#certificate-' + id,
        {},
      ])
    );
    const submit = {},
      formError = {};
    nodes['#certificate-decision'].querySelector = selector => (selector === 'button' ? submit : formError);
    nodes['#certificate-decision'].fields = {
      applicantMemberId: 'MEM-001',
      identity: 'matched',
      identityNotes: 'Presenter independently matched by staff',
      acceptance: 'accepted',
      reason: 'Meets the simulated closure-letter requirement',
    };
    const storage = new Map(),
      network = { onLine: true };
    let certificateClick,
      pending = [],
      sent = [];
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        addEventListener(name, handler) {
          if (name === 'click') certificateClick = handler;
        },
        querySelector: selector => nodes[selector],
      },
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: network });
    Object.defineProperty(globalThis, 'FormData', {
      configurable: true,
      value: class {
        constructor(form) {
          this.fields = form.fields;
        }
        [Symbol.iterator]() {
          return Object.entries(this.fields)[Symbol.iterator]();
        }
      },
    });
    const rawApi = async (path, method, payload) => {
      assert.equal(network.onLine, true, 'No server request is allowed during offline capture');
      const response = await officer(path, method, payload);
      if (response.status >= 400) throw Object.assign(new Error(response.body.error), { status: response.status });
      if (path === '/certificates/decisions') sent.push(payload);
      return response.body;
    };
    const ctx = {
      getState: () => workspace,
      rawApi,
      api: rawApi,
      setPending: value => {
        pending = value;
      },
      acceptWorkspace: async value => {
        workspace = value;
        await operations.cache(value);
      },
      refresh: async () => {
        workspace = await rawApi('/workspace');
      },
      render() {},
      toast() {},
      today: () => new Date().toISOString().slice(0, 10),
      esc: value => String(value),
      heading: () => '',
      button: () => '',
      field: () => '',
      select: () => '',
      opts: () => '',
    };
    operations = createOperationsUI(ctx);
    const ui = createCertificateUI({ ...ctx, operationsUI: operations });
    ui.page();
    await certificateClick({ target: { closest: () => ({ dataset: { action: 'cert-tab', id: 'verify' } }) } });
    ui.enhance();
    await nodes['#certificate-status'].onchange({
      target: { files: [{ size: 1000, text: async () => JSON.stringify(snapshot) }] },
    });
    nodes['#certificate-text'].oninput({ target: { value: JSON.stringify(envelope) } });
    await nodes['#certificate-verify'].onclick();
    assert.match(nodes['#certificate-result'].innerHTML, /document checks pass/);
    await nodes['#certificate-decision'].onsubmit({
      preventDefault() {},
      currentTarget: nodes['#certificate-decision'],
    });
    assert.equal(formError.textContent, undefined);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].statusSnapshot, snapshot);
    assert.deepEqual(workspace.certificateStatusCache, cacheBefore);
    const online = workspace.certificateDecisions.find(row => row.id === sent[0].id);
    assert.equal(online.acceptance, 'accepted');
    assert.deepEqual(online.statusSnapshot, snapshot);

    const owner = workspace.config.workspaceId + '-' + workspace.user.id;
    await operations.getVault().unlock('offline-officer-device-passphrase');
    await operations.getVault().saveWorkspace(workspace);
    network.onLine = false;
    await nodes['#certificate-verify'].onclick();
    await nodes['#certificate-decision'].onsubmit({
      preventDefault() {},
      currentTarget: nodes['#certificate-decision'],
    });
    assert.equal(pending.length, 1);
    const queued = JSON.parse(JSON.stringify(pending[0]));
    assert.deepEqual(queued.payload.statusSnapshot, snapshot);
    operations.lock();
    const reopened = new OfflineVault(owner);
    await reopened.unlock('offline-officer-device-passphrase');
    assert.deepEqual(reopened.records[0], queued);
    operations.adoptVault(reopened);
    // A supervisor refreshed the shared cache while this device was disconnected.
    assert.equal(
      (await b('/certificates/status/import', 'POST', { envelope: (await a('/certificates/status')).body })).status,
      200
    );
    const refreshedCache = (await b('/workspace')).body.certificateStatusCache;
    network.onLine = true;
    await operations.sync();
    assert.deepEqual(reopened.records, []);
    const offline = workspace.certificateDecisions.find(row => row.id === queued.id);
    assert.equal(offline.acceptance, 'accepted');
    assert.deepEqual(offline.statusSnapshot, snapshot);
    assert.deepEqual(workspace.certificateStatusCache, refreshedCache);
    assert.equal((await officer('/certificates/decisions', 'POST', queued.payload)).status, 200);
    assert.equal(workspace.certificateDecisions.filter(row => row.id === queued.id).length, 1);

    // A pending review must still obey current policy and newer withdrawals when it reconnects.
    network.onLine = false;
    await nodes['#certificate-verify'].onclick();
    await nodes['#certificate-decision'].onsubmit({
      preventDefault() {},
      currentTarget: nodes['#certificate-decision'],
    });
    assert.equal(reopened.records.length, 1);
    const blockedId = reopened.records[0].id;
    network.onLine = true;
    await b('/certificates/policy', 'POST', { maxStatusAgeHours: 24, requireLiveStatus: true });
    await operations.sync();
    assert.equal(reopened.records.length, 1);
    assert.match(reopened.records[0]._error, /Acceptance requires/);
    await b('/certificates/policy', 'POST', { maxStatusAgeHours: 24, requireLiveStatus: false });
    await a(`/certificates/issued/${issued.body.id}/withdraw`, 'POST', { reason: 'Synthetic source correction' });
    const withdrawal = (await a('/certificates/status')).body;
    assert.equal((await b('/certificates/status/import', 'POST', { envelope: withdrawal })).status, 200);
    await operations.sync();
    assert.equal(reopened.records.length, 1);
    assert.match(reopened.records[0]._error, /Acceptance requires/);
    assert.equal(
      workspace.certificateDecisions.some(row => row.id === blockedId),
      false
    );
    const changed = structuredClone(snapshot);
    changed.payload.sequence++;
    assert.equal(
      (
        await officer('/certificates/decisions', 'POST', {
          ...queued.payload,
          id: crypto.randomUUID(),
          statusSnapshot: changed,
        })
      ).status,
      400
    );
  } finally {
    operations?.lock();
    for (const [key, descriptor] of Object.entries(globals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    for (const server of servers) {
      server.process.kill();
      await once(server.process, 'exit');
    }
    rmSync(root, { recursive: true, force: true });
  }
});

test('two isolated institutions issue and receive in both directions with borrower review, source-version checks and withdrawal', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fl-certificates-')),
    institutions = prepareExchange(root),
    servers = [];
  try {
    for (const institution of institutions) servers.push(await launch(institution.env));
    const [a, b] = await Promise.all(servers.map(server => server.login()));
    assert.notEqual(institutions[0].env.SESSION_COOKIE_NAME, institutions[1].env.SESSION_COOKIE_NAME);
    let [workspaceA, workspaceB] = await Promise.all([a('/workspace'), b('/workspace')]);
    assert.notEqual(workspaceA.body.config.workspaceId, workspaceB.body.config.workspaceId);
    assert.ok(!JSON.stringify(workspaceA.body).includes('PRIVATE KEY'));
    assert.ok(!JSON.stringify(workspaceA.body.credentialSettings).includes('privateKeyFile'));
    async function prepare(client, recipientId, overrides = {}) {
      return client('/certificates/reviews', 'POST', {
        id: 'review-' + crypto.randomUUID(),
        loanId: 'DEMO-CLOSED-LOAN',
        subjectRef: 'Borrower-001',
        loanRef: 'Loan-A-001',
        recipientId,
        sourceSystem: 'BR.NET',
        sourceReference: 'Synthetic authoritative closure review',
        assessmentDate: new Date().toISOString().slice(0, 10),
        validDays: 30,
        authoritativeClosed: true,
        paymentsFinal: true,
        noPendingCorrections: true,
        ...overrides,
      });
    }
    async function issue(client, recipientId) {
      const prepared = await prepare(client, recipientId);
      assert.equal(prepared.status, 201, JSON.stringify(prepared.body));
      const review = prepared.body;
      assert.equal(
        (await client(`/certificates/reviews/${review.id}/issue`, 'POST', { authorised: true })).status,
        409
      );
      assert.equal(
        (
          await client(`/certificates/reviews/${review.id}/borrower`, 'POST', {
            version: 1,
            decision: 'approved',
            explained: true,
            consented: true,
            note: 'Borrower reviewed every disclosed field and agreed',
          })
        ).status,
        200
      );
      const issued = await client(`/certificates/reviews/${review.id}/issue`, 'POST', { authorised: true });
      assert.equal(issued.status, 201, JSON.stringify(issued.body));
      assert.deepEqual(issued.body.envelope.payload, review.payload);
      assert.equal(
        (await client(`/certificates/reviews/${review.id}/issue`, 'POST', { authorised: true })).status,
        200
      );
      return issued.body;
    }
    assert.equal((await prepare(a, 'demo-partner', { paymentsFinal: false })).status, 400);
    assert.equal((await prepare(a, 'demo-partner', { assessmentDate: '2020-01-01' })).status, 400);
    assert.equal((await prepare(a, 'demo-partner', { loanId: 'LN-001' })).status, 409);
    const certificateA = await issue(a, 'demo-partner'),
      certificateB = await issue(b, 'demo-sahayog');
    assert.equal(
      (await b('/certificates/status/import', 'POST', { envelope: (await a('/certificates/status')).body })).status,
      200
    );
    assert.equal(
      (await a('/certificates/status/import', 'POST', { envelope: (await b('/certificates/status')).body })).status,
      200
    );
    workspaceB = await b('/workspace');
    assert.equal(
      (await verifyCertificate(certificateA.envelope, workspaceB.body.credentialSettings)).evidenceValid,
      true
    );
    workspaceA = await a('/workspace');
    assert.equal(
      (await verifyCertificate(certificateB.envelope, workspaceA.body.credentialSettings)).evidenceValid,
      true
    );
    assert.equal(certificateA.envelope.payload.principal, undefined);
    assert.equal(certificateA.envelope.payload.identitySuffix, undefined);
    assert.equal(certificateA.envelope.payload.payments, undefined);
    const delivery = await a(`/certificates/issued/${certificateA.id}/delivery`);
    assert.equal(delivery.status, 200);
    assert.deepEqual(delivery.body.envelope, certificateA.envelope);
    const decision = {
      id: 'decision-00001',
      envelope: certificateA.envelope,
      identity: 'matched',
      identityNotes: 'Synthetic presenter identity independently matched',
      acceptance: 'accepted',
      reason: 'Meets the simulated closure-letter authentication requirement',
    };
    assert.equal((await prepare(a, 'demo-partner', { subjectRef: 'invalid\nreference' })).status, 400);
    const concurrent = await Promise.all([
      b('/certificates/decisions', 'POST', {
        ...decision,
        id: 'concurrent-review',
        identity: 'unresolved',
        acceptance: 'manual-review',
      }),
      b('/groups', 'POST', { name: 'Concurrent test group', officer: 'Staff', nextMeeting: '2026-12-01' }),
    ]);
    assert.ok(concurrent.every(row => row.status === 201));
    const afterConcurrent = (await b('/workspace')).body;
    assert.ok(afterConcurrent.certificateDecisions.some(row => row.id === 'concurrent-review'));
    assert.ok(afterConcurrent.groups.some(row => row.name === 'Concurrent test group'));
    assert.equal((await b('/certificates/decisions', 'POST', { ...decision, identity: 'mismatched' })).status, 409);
    assert.equal((await b('/certificates/decisions', 'POST', decision)).status, 201);
    assert.equal((await b('/certificates/decisions', 'POST', decision)).status, 200);
    assert.equal(
      (
        await b('/certificates/decisions', 'POST', {
          ...decision,
          id: 'mismatch-review-01',
          identity: 'mismatched',
          acceptance: 'manual-review',
        })
      ).status,
      201
    );
    await b('/certificates/policy', 'POST', { maxStatusAgeHours: 24, requireLiveStatus: true });
    assert.equal((await b('/certificates/decisions', 'POST', { ...decision, id: 'fresh-policy-block' })).status, 409);
    await b('/certificates/policy', 'POST', { maxStatusAgeHours: 24, requireLiveStatus: false });
    const before = certificateA.envelope;
    const correction = {
      version: 1,
      paid: 999,
      savings: 0,
      attendance: 'present',
      utilisation: 'not-checked',
      note: 'Synthetic correction',
      reason: 'Correcting a settlement amount',
    };
    assert.equal((await a('/visits/demo-closure-payment', 'PATCH', correction)).status, 200);
    workspaceA = await a('/workspace');
    assert.equal(workspaceA.body.certificates[0].withdrawal.reason, 'Approved source records changed');
    assert.deepEqual(workspaceA.body.certificates[0].envelope, before);
    const list = (await a('/certificates/status')).body;
    assert.equal((await b('/certificates/status/import', 'POST', { envelope: list })).status, 200);
    const staleList = JSON.parse(
      await (await import('node:fs/promises')).readFile(institutions[1].env.CERTIFICATE_TRUST_FILE, 'utf8')
    ).statusLists[0];
    assert.equal((await b('/certificates/status/import', 'POST', { envelope: staleList })).status, 409);
    workspaceB = await b('/workspace');
    assert.equal(
      (await verifyCertificate(certificateA.envelope, workspaceB.body.credentialSettings)).withdrawal,
      'withdrawn'
    );
    assert.equal((await b('/certificates/decisions', 'POST', { ...decision, id: 'withdrawn-evidence' })).status, 409);
    const incomplete = await prepare(a, 'demo-partner');
    assert.equal(incomplete.status, 409);
    assert.equal(
      (
        await a('/visits/demo-closure-payment', 'PATCH', {
          ...correction,
          version: 2,
          paid: 1000,
          reason: 'Reconciled final settlement',
        })
      ).status,
      200
    );
    const replacement = await prepare(a, 'demo-partner', { replacesId: certificateA.id });
    assert.equal(replacement.status, 201);
    assert.equal(
      (
        await a(`/certificates/reviews/${replacement.body.id}/borrower`, 'POST', {
          version: 1,
          decision: 'correction-requested',
          explained: true,
          consented: false,
          note: 'Borrower requested clarification before signing',
        })
      ).status,
      200
    );
    assert.equal(
      (await a(`/certificates/reviews/${replacement.body.id}/issue`, 'POST', { authorised: true })).status,
      409
    );
    assert.equal(
      (
        await a(`/certificates/reviews/${replacement.body.id}/borrower`, 'POST', {
          version: 2,
          decision: 'approved',
          explained: true,
          consented: true,
          note: 'Borrower reviewed the clarified record and consented',
        })
      ).status,
      200
    );
    const replaced = await a(`/certificates/reviews/${replacement.body.id}/issue`, 'POST', { authorised: true });
    assert.equal(replaced.status, 201);
    assert.equal(
      (await a('/workspace')).body.certificates.find(row => row.id === certificateA.id).withdrawal.replacementId,
      replaced.body.id
    );
    const pendingReview = await prepare(a, 'demo-partner');
    assert.equal(pendingReview.status, 201);
    await a(`/certificates/reviews/${pendingReview.body.id}/borrower`, 'POST', {
      version: 1,
      decision: 'approved',
      explained: true,
      consented: true,
      note: 'Borrower reviewed exact claim',
    });
    await a('/visits/demo-closure-payment', 'PATCH', {
      ...correction,
      version: 3,
      paid: 999,
      reason: 'Another unsettled correction',
    });
    assert.equal(
      (await a(`/certificates/reviews/${pendingReview.body.id}/issue`, 'POST', { authorised: true })).status,
      409
    );
    const adminWorkspace = (await a('/workspace')).body,
      archive = (await a('/backup', 'POST', { password: 'certificate-test-backup' })).body,
      payload = decryptBackup(archive, 'certificate-test-backup');
    assert.equal(payload.schema, 8);
    const restoredDir = mkdtempSync(join(tmpdir(), 'fl-restored-cert-')),
      repository = openRepository({ dataDir: restoredDir, demo: false });
    try {
      repository.save(payload.workspace);
      for (const key of Object.keys(CERTIFICATE_TABLES)) assert.deepEqual(repository.read()[key], adminWorkspace[key]);
    } finally {
      repository.close();
      rmSync(restoredDir, { recursive: true, force: true });
    }
    await a('/staff', 'POST', {
      name: 'Unassigned officer',
      username: 'cert-officer',
      password: 'certificate-test-password',
      role: 'officer',
      groupIds: ['GRP-002'],
    });
    const officer = await servers[0].login({ username: 'cert-officer', password: 'certificate-test-password' });
    assert.equal((await officer('/workspace')).body.certificates.length, 0);
    assert.equal((await officer(`/certificates/issued/${certificateA.id}/delivery`)).status, 403);
    assert.equal((await prepare(officer, 'demo-partner')).status, 403);
    const worker = {
      id: 'worker-source-check',
      name: 'Worker',
      kind: 'domestic-worker',
      groupId: 'GRP-001',
      currency: 'INR',
      source: 'member',
      consented: true,
    };
    assert.equal((await a('/support/people', 'POST', worker)).status, 400);
    assert.equal(
      (
        await a('/groups', 'POST', {
          name: 'New group',
          officer: 'Staff',
          nextMeeting: '2026-12-01',
          location: 'Not collected',
        })
      ).status,
      400
    );
    assert.equal(
      (await a('/groups', 'POST', { name: 'New group', officer: 'Staff', nextMeeting: '2026-12-01' })).body.location,
      ''
    );
  } finally {
    for (const server of servers) {
      server.process.kill();
      await once(server.process, 'exit');
    }
    rmSync(root, { recursive: true, force: true });
  }
});
