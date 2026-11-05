import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

export const ADMIN_PASSWORD = 'correct-horse-battery-staple';

export async function launch(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fieldledger-sec-'));
  const proc = spawn(process.execPath, ['backend/server.mjs'], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', DATA_DIR: dir, NODE_ENV: 'test', DEMO_MODE: 'true', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let errors = '';
  proc.stderr.on('data', d => (errors += d));
  const url = await new Promise((resolve, reject) => {
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
    url,
    async close() {
      proc.kill();
      await once(proc, 'exit');
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function client(app) {
  let cookie = '';
  return async function request(path, method = 'GET', body) {
    const r = await fetch(app.url + '/api' + path, {
      method,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const setCookie = r.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: r.status, body: await r.json(), headers: r.headers };
  };
}
