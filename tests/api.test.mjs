import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

async function launch(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fieldledger-api-'));
  const proc = spawn(process.execPath, ['backend/server.mjs'], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', DATA_DIR: dir, NODE_ENV: 'test', DEMO_MODE: 'true', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let errors = '';
  proc.stderr.on('data', d => (errors += d));
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errors || 'Server start timed out')), 5000);
    proc.stdout.on('data', d => {
      const m = d.toString().match(/http:\/\/[^ ]+/);
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
  return {
    url: ready,
    async close() {
      proc.kill();
      await once(proc, 'exit');
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
test('API enforces authentication, validation, idempotence, consent, and revocation', async () => {
  const app = await launch();
  let cookie = '';
  async function request(path, method = 'GET', body, headers = {}) {
    const r = await fetch(app.url + '/api' + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: await r.json(), headers: r.headers };
  }
  try {
    assert.equal((await request('/workspace')).status, 401);
    const login = await request('/login', 'POST', { demo: true });
    assert.equal(login.status, 200);
    cookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    const s = (await request('/workspace')).body;
    assert.equal(s.members.length, 24);
    assert.equal((await request('/session')).body.user.token, undefined);
    assert.equal((await request('/groups', 'POST', { name: 'X' }, { Origin: 'https://foreign.invalid' })).status, 403);
    assert.equal((await request('/members/MEM-001/export')).status, 403);
    assert.equal(
      (await request('/members/MEM-001/consent', 'POST', { granted: true, recipient: 'NGO', purpose: 'Review' }))
        .status,
      400
    );
    assert.equal(
      (
        await request('/members/MEM-001/consent', 'POST', {
          granted: true,
          recipient: 'NGO',
          purpose: 'Review',
          attested: true,
        })
      ).status,
      200
    );
    const exported = await request('/members/MEM-001/export');
    assert.equal(exported.status, 200);
    assert.equal(exported.body.member.identitySuffix, undefined);
    assert.equal(exported.body.synthetic, true);
    await request('/members/MEM-001/consent', 'POST', { granted: false });
    assert.equal((await request('/members/MEM-001/export')).status, 403);
    const visit = {
      id: 'test-visit',
      memberId: 'MEM-001',
      loanId: s.loans[0].id,
      date: '2026-10-15',
      attendance: 'present',
      paid: 500,
      savings: 100,
      utilisation: 'verified',
      note: 'Synthetic field observation',
    };
    assert.equal((await request('/visits', 'POST', visit)).status, 201);
    assert.equal((await request('/visits', 'POST', visit)).status, 200);
    assert.equal((await request('/visits', 'POST', { ...visit, paid: 100 })).status, 409);
    assert.equal((await request('/visits', 'POST', { ...visit, id: 'different-id' })).status, 409);
    assert.equal(
      (await request('/visits', 'POST', { ...visit, id: 'overpaid', date: '2026-10-14', paid: 999999 })).status,
      400
    );
    assert.equal((await request('/visits', 'POST', { ...visit, id: 'invalid-date', date: '2026-02-30' })).status, 400);
    assert.equal((await request('/workspace')).body.visits.length, s.visits.length + 1);
    await request('/logout', 'POST', {});
    assert.equal((await request('/workspace')).status, 401);
  } finally {
    await app.close();
  }
});
test('private workspace requires password and contains no demonstration members', async () => {
  const app = await launch({ DEMO_MODE: 'false', ADMIN_PASSWORD: 'test-password-at-least-12' });
  try {
    const bad = await fetch(app.url + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demo: true }),
    });
    assert.equal(bad.status, 401);
    const ok = await fetch(app.url + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-password-at-least-12' }),
    });
    assert.equal(ok.status, 200);
    const ws = await fetch(app.url + '/api/workspace', {
      headers: { Cookie: ok.headers.get('set-cookie').split(';')[0] },
    });
    assert.equal((await ws.json()).members.length, 0);
  } finally {
    await app.close();
  }
});
