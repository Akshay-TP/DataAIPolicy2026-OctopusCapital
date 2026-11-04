const encoder = new TextEncoder();
const decoder = new TextDecoder();
const VAULT_DATABASE = 'fieldledger-encrypted';
const PROFILE_INDEX = 'fl-offline-profiles';
let connection;

function base64(bytes) {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(text);
}
const bytes = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));

function store() {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(VAULT_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('vaults');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Encrypted browser storage is unavailable. Enable browser storage and retry.'));
  }).catch(error => { connection = null; throw error; });
  return connection;
}
async function read(owner) {
  const database = await store();
  return new Promise((resolve, reject) => {
    const request = database.transaction('vaults').objectStore('vaults').get(owner);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function write(owner, envelope, revision) {
  const database = await store();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('vaults', 'readwrite');
    const vaults = transaction.objectStore('vaults');
    const request = vaults.get(owner);
    request.onsuccess = () => {
      if ((request.result?.revision || 0) !== revision) {
        transaction.abort();
        return;
      }
      vaults.put(envelope, owner);
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new Error('Offline storage changed in another tab. Lock and unlock again before editing.'));
    transaction.onerror = () => reject(transaction.error);
  });
}
export function savedWorkspaces() {
  try {
    const profiles = JSON.parse(localStorage.getItem(PROFILE_INDEX) || '[]');
    return Array.isArray(profiles) ? profiles.filter(profile => typeof profile.owner === 'string' && typeof profile.label === 'string') : [];
  } catch { return []; }
}
export function offlineAccessValid(workspace, now = Date.now()) {
  return !!workspace?.offlineAccess && Date.parse(workspace.offlineAccess.expiresAt) > now;
}

/** Authenticated ciphertext is persisted; decrypted financial data stays in this tab. */
export class OfflineVault {
  constructor(owner) {
    this.owner = owner;
    this.storageKey = 'fl-offline-' + owner;
    this.key = null;
    this.salt = null;
    this.records = [];
    this.workspace = null;
    this.revision = 0;
    this.generation = 0;
    this.writing = Promise.resolve();
  }

  metadata() {
    try {
      const data = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
      return {count: data?.count || 0, hasWorkspace: !!data?.hasWorkspace, savedAt: data?.savedAt, locked: !this.key};
    } catch { throw new Error('Offline metadata is unreadable. Keep the browser data for recovery.'); }
  }

  async unlock(password) {
    if (password.length < 12) throw new Error('Use at least 12 characters for the device passphrase.');
    await this.writing;
    this.lock();
    const generation = this.generation;
    const stored = await read(this.owner);
    let legacy;
    try { legacy = JSON.parse(localStorage.getItem(this.storageKey) || 'null'); }
    catch { if (!stored) throw new Error('Earlier offline storage is unreadable. Keep the browser data for recovery.'); }
    const data = stored || (legacy?.data ? legacy : null);
    const salt = data ? bytes(data.salt) : crypto.getRandomValues(new Uint8Array(16));
    const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      {name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256'},
      material, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']
    );
    let pack = {records: [], workspace: null};
    if (data) {
      try {
        const plaintext = await crypto.subtle.decrypt(
          {name: 'AES-GCM', iv: bytes(data.iv), additionalData: encoder.encode(this.owner)}, key, bytes(data.data)
        );
        const parsed = JSON.parse(decoder.decode(plaintext));
        pack = Array.isArray(parsed) ? {records: parsed, workspace: null} : parsed;
        if (!Array.isArray(pack.records)) throw new Error('Invalid records');
      } catch { throw new Error('Unable to unlock. Check the device passphrase; records have not been changed.'); }
    }
    if (generation !== this.generation) throw new Error('Workspace locked while unlocking. Try again when ready.');
    this.key = key;
    this.salt = salt;
    this.records = pack.records;
    this.workspace = pack.workspace;
    this.revision = stored?.revision || 0;
    if (data && !stored) await this.save(this.records);
  }

  persistMetadata(pack) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        version: 2, count: pack.records.length, hasWorkspace: !!pack.workspace, savedAt: new Date().toISOString()
      }));
      if (pack.workspace) {
        const profiles = savedWorkspaces().filter(profile => profile.owner !== this.owner);
        profiles.push({owner: this.owner, label: pack.workspace.settings.name + ' · ' + pack.workspace.user.name});
        localStorage.setItem(PROFILE_INDEX, JSON.stringify(profiles));
      }
    } catch {
      throw new Error('Records were saved encrypted, but this browser could not update the workspace chooser. Enable browser storage and retry.');
    }
  }

  update(changes) {
    const operation = this.writing.then(async () => {
      if (!this.key) throw new Error('Unlock Offline records before saving on this device.');
      const generation = this.generation;
      const key = this.key;
      const pack = {records: this.records, workspace: this.workspace, ...(typeof changes === 'function' ? changes() : changes)};
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv, additionalData: encoder.encode(this.owner)}, key, encoder.encode(JSON.stringify(pack))
      );
      if (generation !== this.generation) throw new Error('Workspace locked during save. Unlock and review the record before retrying.');
      const envelope = {version: 2, revision: this.revision + 1, salt: base64(this.salt), iv: base64(iv), data: base64(new Uint8Array(encrypted))};
      await write(this.owner, envelope, this.revision);
      this.revision = envelope.revision;
      // A lock may occur while IndexedDB commits. Never repopulate decrypted memory afterwards.
      if (generation !== this.generation) {
        this.persistMetadata(pack);
        throw new Error('Workspace locked during save. Unlock to review the saved encrypted record.');
      }
      this.records = pack.records;
      this.workspace = pack.workspace;
      this.persistMetadata(pack);
    });
    this.writing = operation.catch(() => {});
    return operation;
  }

  mutateRecords(change) { return this.update(() => ({records: change(this.records)})); }
  save(records) { return this.update({records}); }
  saveWorkspace(workspace) { return this.update({workspace}); }
  lock() {
    this.generation++;
    this.key = null;
    this.records = [];
    this.workspace = null;
    this.salt = null;
  }
}
