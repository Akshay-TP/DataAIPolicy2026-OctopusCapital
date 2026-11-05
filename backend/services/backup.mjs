import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
export function encryptBackup(payload, password) {
  const salt = randomBytes(16),
    iv = randomBytes(12),
    key = scryptSync(password, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return {
    format: 'fieldledger.backup.v1',
    algorithm: 'AES-256-GCM',
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}
export function decryptBackup(archive, password) {
  if (archive.format !== 'fieldledger.backup.v1' || archive.algorithm !== 'AES-256-GCM' || archive.kdf !== 'scrypt')
    throw new Error('Unsupported backup format');
  const key = scryptSync(password, Buffer.from(archive.salt, 'base64'), 32);
  const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(archive.iv, 'base64'));
  cipher.setAuthTag(Buffer.from(archive.tag, 'base64'));
  return JSON.parse(
    Buffer.concat([cipher.update(Buffer.from(archive.data, 'base64')), cipher.final()]).toString('utf8')
  );
}
