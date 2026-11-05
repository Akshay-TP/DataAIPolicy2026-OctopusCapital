import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import { openRepository } from '../../database/repository.mjs';
import { createDemoIssuer, seal } from '../services/certificates.mjs';
import { WITHDRAWAL_FORMAT } from '../../shared/certificates.mjs';

export function prepareExchange(root = resolve('data/certificate-exchange')) {
  const tag = createHash('sha256').update(root).digest('hex').slice(0, 16),
    keyRoot = resolve('.local/exchange-keys', tag),
    now = Date.now();
  const institutions = [
    { id: 'demo-sahayog', name: 'Sahayog workflow · fictional institution A', port: 3020 },
    { id: 'demo-partner', name: 'Receiving lender · fictional institution B', port: 3021 },
  ];
  const keys = [],
    statusLists = [];
  for (const [index, institution] of institutions.entries()) {
    institution.dataDir = resolve(root, String(index + 1));
    institution.issuerFile = createDemoIssuer(resolve(keyRoot, String(index + 1)), institution.id, institution.name);
    const { privateKeyFile, ...metadata } = JSON.parse(readFileSync(institution.issuerFile, 'utf8')),
      privateKey = createPrivateKey(readFileSync(privateKeyFile));
    keys.push({ ...metadata, publicKey: createPublicKey(privateKey).export({ format: 'jwk' }).x });
    const repository = openRepository({ dataDir: institution.dataDir, demo: true });
    try {
      const s = repository.read();
      s.settings.name = institution.name;
      if (!s.loans.some(row => row.id === 'DEMO-CLOSED-LOAN')) {
        const date = new Date(now - 60 * 86400000).toISOString().slice(0, 10),
          paidDate = new Date(now - 10 * 86400000).toISOString().slice(0, 10);
        s.loans.push({
          id: 'DEMO-CLOSED-LOAN',
          memberId: s.members[0].id,
          principal: 1000,
          installment: 1000,
          currency: 'INR',
          frequency: 'monthly',
          purpose: 'Synthetic settled loan for certificate demonstration',
          date,
          status: 'closed',
        });
        s.visits.push({
          id: 'demo-closure-payment',
          memberId: s.members[0].id,
          loanId: 'DEMO-CLOSED-LOAN',
          currency: 'INR',
          date: paidDate,
          attendance: 'present',
          due: 1000,
          paid: 1000,
          savings: 0,
          utilisation: 'not-checked',
          note: 'Synthetic final settlement',
          officer: 'Demo officer',
          createdAt: new Date(now - 10 * 86400000).toISOString(),
          version: 1,
        });
      }
      repository.save(s);
      statusLists.push(
        seal(privateKey, WITHDRAWAL_FORMAT, {
          issuerId: institution.id,
          keyId: metadata.keyId,
          sequence: s.config.certificateStatusSequence || 0,
          issuedAt: new Date(now).toISOString(),
          nextUpdate: new Date(now + 86400000).toISOString(),
          withdrawn: s.certificates.filter(row => row.withdrawal).map(row => ({ id: row.id, at: row.withdrawal.at })),
        })
      );
    } finally {
      repository.close();
    }
  }
  const trustFile = resolve(keyRoot, 'approved-public-registry.json');
  mkdirSync(dirname(trustFile), { recursive: true });
  writeFileSync(trustFile, JSON.stringify({ keys, statusLists }, null, 2));
  return institutions.map((institution, index) => ({
    ...institution,
    env: {
      ...process.env,
      PORT: String(institution.port),
      HOST: '127.0.0.1',
      DATA_DIR: institution.dataDir,
      DEMO_MODE: 'true',
      NODE_ENV: 'development',
      CERTIFICATE_ISSUER_FILE: institution.issuerFile,
      CERTIFICATE_TRUST_FILE: trustFile,
      SESSION_COOKIE_NAME: 'fl_certificate_demo_' + index,
    },
  }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const institutions = prepareExchange(
    process.env.CERTIFICATE_DEMO_ROOT ? resolve(process.env.CERTIFICATE_DEMO_ROOT) : undefined
  );
  const children = institutions.map(institution =>
    spawn(process.execPath, ['backend/server.mjs'], { env: institution.env, stdio: 'inherit' })
  );
  const stop = () => children.forEach(child => child.kill());
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  for (const child of children)
    child.on('error', error => {
      console.error(error.message);
      stop();
    });
  console.log(
    'Two fictional workspaces: http://127.0.0.1:3020 and http://127.0.0.1:3021. Open both and sign in to each demo. No real Sahayog issuance or adoption is represented.'
  );
  await Promise.all(children.map(child => once(child, 'exit')));
}
