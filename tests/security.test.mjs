import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, client, ADMIN_PASSWORD } from './helpers.mjs';

test('demo mode still works when bound to a non-loopback address', async () => {
  const app = await launch({ HOST: '0.0.0.0' });
  const request = client(app);
  try {
    const login = await request('/login', 'POST', { demo: true });
    assert.equal(login.status, 200);
    assert.equal(login.body.demo, true);
    assert.equal((await request('/workspace')).status, 200);
  } finally {
    await app.close();
  }
});

test('logout clears the configured session cookie and invalidates the session', async () => {
  const app = await launch({ SESSION_COOKIE_NAME: 'custom_session' });
  const request = client(app);
  try {
    const login = await request('/login', 'POST', { demo: true });
    assert.match(login.headers.get('set-cookie'), /^custom_session=/);
    const logout = await request('/logout', 'POST', {});
    assert.match(logout.headers.get('set-cookie'), /^custom_session=; .*Max-Age=0/);
    assert.equal((await request('/workspace')).status, 401);
  } finally {
    await app.close();
  }
});

test('resetting a password ends that account’s sessions; officers cannot import certificate status', async () => {
  const app = await launch({ DEMO_MODE: 'false', NODE_ENV: 'test', ADMIN_PASSWORD });
  const admin = client(app);
  const officer = client(app);
  try {
    assert.equal((await admin('/login', 'POST', { username: 'admin', password: ADMIN_PASSWORD })).status, 200);
    const created = await admin('/staff', 'POST', {
      name: 'Field Officer',
      username: 'officer.one',
      role: 'officer',
      password: 'officer-password-123',
      groupIds: [],
    });
    assert.equal(created.status, 201);
    const login = await officer('/login', 'POST', { username: 'officer.one', password: 'officer-password-123' });
    assert.equal(login.status, 200);
    assert.equal((await officer('/certificates/status/import', 'POST', { envelope: {} })).status, 403);

    const staff = (await admin('/workspace')).body.staff.find(u => u.username === 'officer.one');
    const reset = await admin(`/staff/${staff.id}`, 'PATCH', {
      role: 'officer',
      active: true,
      groupIds: [],
      password: 'a-brand-new-password-456',
    });
    assert.equal(reset.status, 200);
    assert.equal((await officer('/workspace')).status, 401);
  } finally {
    await app.close();
  }
});

test('prototype-chain names are not treated as support collections', async () => {
  const app = await launch();
  const request = client(app);
  try {
    await request('/login', 'POST', { demo: true });
    const result = await request('/support/constructor', 'POST', { id: 'abcdefgh1' });
    assert.equal(result.status, 404);
  } finally {
    await app.close();
  }
});

test('oversized and malformed request bodies are rejected cleanly', async () => {
  const app = await launch();
  const request = client(app);
  try {
    await request('/login', 'POST', { demo: true });
    assert.equal((await request('/groups', 'POST', { name: 'x'.repeat(150000) })).status, 413);
    const raw = await fetch(app.url + '/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    assert.equal(raw.status, 400);
  } finally {
    await app.close();
  }
});

test('an administrator changing their own staff password keeps their current session', async () => {
  const app = await launch({ DEMO_MODE: 'false', NODE_ENV: 'test', ADMIN_PASSWORD });
  const admin = client(app);
  const second = client(app);
  try {
    await admin('/login', 'POST', { username: 'admin', password: ADMIN_PASSWORD });
    await admin('/staff', 'POST', {
      name: 'Second Admin',
      username: 'admin.two',
      role: 'admin',
      password: 'second-admin-password-1',
      groupIds: [],
    });
    assert.equal(
      (await second('/login', 'POST', { username: 'admin.two', password: 'second-admin-password-1' })).status,
      200
    );
    const me = (await second('/workspace')).body.staff.find(u => u.username === 'admin.two');
    const reset = await second(`/staff/${me.id}`, 'PATCH', {
      role: 'admin',
      active: true,
      groupIds: [],
      password: 'second-admin-password-2',
    });
    assert.equal(reset.status, 200);
    assert.equal((await second('/workspace')).status, 200);
  } finally {
    await app.close();
  }
});

test('larger fictional dataset loads once, only in demo mode, and passes record validation', async () => {
  const app = await launch();
  const request = client(app);
  try {
    await request('/login', 'POST', { demo: true });
    const before = (await request('/workspace')).body;
    const loaded = await request('/demo/bulk', 'POST', {});
    assert.equal(loaded.status, 201, JSON.stringify(loaded.body));
    assert.ok(loaded.body.members >= 60 && loaded.body.supportRecords >= 30);
    const after = (await request('/workspace')).body;
    assert.equal(after.members.length, before.members.length + loaded.body.members);
    assert.equal(new Set(after.members.map(m => m.id)).size, after.members.length);
    assert.ok(after.payReceipts.length > 0 && after.participation.length > 0 && after.assetChecks.length > 0);
    assert.equal((await request('/demo/bulk', 'POST', {})).status, 409);
  } finally {
    await app.close();
  }
  const privateApp = await launch({ DEMO_MODE: 'false', ADMIN_PASSWORD });
  const admin = client(privateApp);
  try {
    await admin('/login', 'POST', { username: 'admin', password: ADMIN_PASSWORD });
    assert.equal((await admin('/demo/bulk', 'POST', {})).status, 403);
  } finally {
    await privateApp.close();
  }
});
