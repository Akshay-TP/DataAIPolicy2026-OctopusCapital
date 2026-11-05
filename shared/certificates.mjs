export const CERTIFICATE_FORMAT = 'fieldledger.certificate.v1';
export const WITHDRAWAL_FORMAT = 'fieldledger.withdrawals.v1';
export const CLOSURE_CLAIM = 'specified-loan-closed-no-outstanding-balance';
export const CLOSURE_STATEMENT =
  'The issuer confirms that the specified loan was closed with no outstanding balance on the assessment date. This is not a credit score or a statement about other loans.';
export const DEFAULT_CERTIFICATE_POLICY = { maxStatusAgeHours: 24, requireLiveStatus: false };
export const CERTIFICATE_TABLES = {
  closureReviews: 'closure_reviews',
  certificates: 'loan_certificates',
  certificateDecisions: 'certificate_decisions',
  certificateStatusCache: 'certificate_status_cache',
};
export const canonicalJson = value =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map(key => [key, item[key]])
        )
      : item
  );
export const signedBytes = (format, payload) => new TextEncoder().encode(format + '\n' + canonicalJson(payload));
export const base64url = data =>
  btoa(String.fromCharCode(...new Uint8Array(data)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
export const fromBase64url = text =>
  Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), character => character.charCodeAt(0));
const exact = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === keys.slice().sort().join(',');
const text = (value, max = 120) =>
  typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
const instant = value =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const day = value =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function certificateShape(envelope) {
  const p = envelope?.payload;
  return (
    exact(envelope, ['format', 'algorithm', 'payload', 'signature']) &&
    envelope.format === CERTIFICATE_FORMAT &&
    envelope.algorithm === 'Ed25519' &&
    typeof envelope.signature === 'string' &&
    /^[A-Za-z0-9_-]{86}$/.test(envelope.signature) &&
    exact(p, [
      'id',
      'issuerId',
      'issuerName',
      'keyId',
      'recipientId',
      'claim',
      'statement',
      'subjectRef',
      'loanRef',
      'assessmentDate',
      'preparedAt',
      'expiresAt',
      'synthetic',
    ]) &&
    ['id', 'issuerId', 'issuerName', 'keyId', 'recipientId'].every(key => text(p[key])) &&
    text(p.subjectRef, 60) &&
    text(p.loanRef, 60) &&
    p.claim === CLOSURE_CLAIM &&
    p.statement === CLOSURE_STATEMENT &&
    day(p.assessmentDate) &&
    instant(p.preparedAt) &&
    instant(p.expiresAt) &&
    p.preparedAt < p.expiresAt &&
    typeof p.synthetic === 'boolean'
  );
}
function withdrawalShape(envelope) {
  const p = envelope?.payload;
  return (
    exact(envelope, ['format', 'algorithm', 'payload', 'signature']) &&
    envelope.format === WITHDRAWAL_FORMAT &&
    envelope.algorithm === 'Ed25519' &&
    /^[A-Za-z0-9_-]{86}$/.test(envelope.signature || '') &&
    exact(p, ['issuerId', 'keyId', 'sequence', 'issuedAt', 'nextUpdate', 'withdrawn']) &&
    text(p.issuerId) &&
    text(p.keyId) &&
    Number.isSafeInteger(p.sequence) &&
    p.sequence >= 0 &&
    instant(p.issuedAt) &&
    instant(p.nextUpdate) &&
    p.issuedAt < p.nextUpdate &&
    Array.isArray(p.withdrawn) &&
    p.withdrawn.length <= 10000 &&
    new Set(p.withdrawn.map(row => row?.id)).size === p.withdrawn.length &&
    p.withdrawn.every(row => exact(row, ['id', 'at']) && text(row.id) && instant(row.at) && row.at <= p.issuedAt)
  );
}
async function authentic(envelope, key) {
  if (!globalThis.crypto?.subtle) return null;
  try {
    const imported = await crypto.subtle.importKey('raw', fromBase64url(key.publicKey), { name: 'Ed25519' }, false, [
      'verify',
    ]);
    return await crypto.subtle.verify(
      'Ed25519',
      imported,
      fromBase64url(envelope.signature),
      signedBytes(envelope.format, envelope.payload)
    );
  } catch (error) {
    return error.name === 'NotSupportedError' ? null : false;
  }
}
function recognised(keys, p, at) {
  return keys.find(
    key =>
      key.issuerId === p.issuerId &&
      key.keyId === p.keyId &&
      !key.disabled &&
      instant(key.validFrom) &&
      instant(key.validUntil) &&
      Date.parse(key.validFrom) <= at &&
      at <= Date.parse(key.validUntil)
  );
}
export async function verifyWithdrawalList(envelope, keys, now = Date.now()) {
  if (!withdrawalShape(envelope)) return { valid: false, reason: 'unsupported-status-format' };
  const p = envelope.payload,
    key = recognised(keys, p, Date.parse(p.issuedAt));
  if (!key || !recognised(keys, p, now)) return { valid: false, reason: 'unrecognised-status-issuer' };
  if (Date.parse(p.issuedAt) > now + 120000) return { valid: false, reason: 'future-status-list' };
  const valid = await authentic(envelope, key);
  return valid
    ? { valid: true, reason: 'verified-status-list' }
    : { valid: false, reason: valid === null ? 'crypto-unavailable' : 'invalid-status-signature' };
}
/** Runs locally in the receiving browser as well as the server. Never contacts an issuer. */
export async function verifyCertificate(
  envelope,
  { keys = [], statusLists = [], policy = DEFAULT_CERTIFICATE_POLICY, recipientId, now = Date.now() } = {}
) {
  const result = {
    format: 'unsupported',
    issuer: 'unknown',
    signature: 'not-checked',
    dates: 'not-checked',
    withdrawal: 'unknown',
    recipient: 'not-checked',
    statusIssuedAt: null,
    statusNextUpdate: null,
    statusAgeHours: null,
    checkedAt: new Date(now).toISOString(),
    evidenceValid: false,
  };
  if (!certificateShape(envelope)) return result;
  result.format = 'supported';
  const p = envelope.payload,
    key = recognised(keys, p, Date.parse(p.preparedAt));
  result.recipient = p.recipientId === recipientId ? 'intended-recipient' : 'different-recipient';
  result.dates =
    now < Date.parse(p.preparedAt) - 120000 ? 'not-yet-valid' : now >= Date.parse(p.expiresAt) ? 'expired' : 'valid';
  if (!key || key.name !== p.issuerName || !recognised(keys, p, now)) {
    result.issuer = 'unrecognised-key';
    return result;
  }
  result.issuer = 'recognised';
  const valid = await authentic(envelope, key);
  result.signature = valid === null ? 'unavailable' : valid ? 'valid' : 'invalid';
  if (result.signature !== 'valid') return result;
  const lists = [];
  for (const list of statusLists.filter(list => list?.payload?.issuerId === p.issuerId))
    if ((await verifyWithdrawalList(list, keys, now)).valid) lists.push(list);
  const list = lists.sort(
    (a, b) => b.payload.sequence - a.payload.sequence || b.payload.issuedAt.localeCompare(a.payload.issuedAt)
  )[0];
  if (list) {
    const status = list.payload;
    result.statusIssuedAt = status.issuedAt;
    result.statusNextUpdate = status.nextUpdate;
    result.statusAgeHours = Math.max(0, (now - Date.parse(status.issuedAt)) / 3600000);
    result.withdrawal = status.withdrawn.some(row => row.id === p.id)
      ? 'withdrawn'
      : status.issuedAt < p.preparedAt
        ? 'snapshot-predates-certificate'
        : policy.requireLiveStatus
          ? 'live-status-required'
          : now >= Date.parse(status.nextUpdate) || result.statusAgeHours > policy.maxStatusAgeHours
            ? 'stale-snapshot'
            : 'not-listed-in-snapshot';
  }
  result.evidenceValid =
    result.dates === 'valid' &&
    result.recipient === 'intended-recipient' &&
    result.withdrawal === 'not-listed-in-snapshot';
  return result;
}

export function closureSource(s, loanId) {
  const loan = s.loans.find(row => row.id === loanId);
  if (!loan) return null;
  const fields = ['id', 'memberId', 'principal', 'currency', 'date', 'status'];
  return {
    loan: Object.fromEntries(fields.map(key => [key, loan[key]])),
    payments: s.visits
      .filter(row => row.loanId === loanId)
      .map(row => ({
        id: row.id,
        date: row.date,
        paid: row.paid,
        currency: row.currency,
        version: row.version || 1,
        pending: !!row.pending,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}
export function closureBlockers(s, loanId) {
  const source = closureSource(s, loanId);
  if (!source) return ['Loan not found'];
  const { loan, payments } = source,
    errors = [];
  if (!Number.isFinite(loan.principal) || loan.principal <= 0 || !loan.currency || !payments.length)
    errors.push('Complete loan and final repayment records are required');
  if (payments.some(row => row.pending || row.currency !== loan.currency || !Number.isFinite(row.paid) || row.paid < 0))
    errors.push('Payments are pending, incomplete or use a different currency');
  if (Math.round(loan.principal * 100) !== payments.reduce((sum, row) => sum + Math.round(row.paid * 100), 0))
    errors.push('Recorded repayments do not exactly settle the principal');
  return errors;
}
/** Any change to approved local source records withdraws existing evidence conservatively. */
export function reconcileCertificates(s) {
  for (const certificate of s.certificates || [])
    if (
      !certificate.withdrawal &&
      canonicalJson(certificate.sourceSnapshot) !== canonicalJson(closureSource(s, certificate.loanId))
    ) {
      certificate.withdrawal = {
        at: new Date().toISOString(),
        actor: 'System',
        reason: 'Approved source records changed',
        replacementId: null,
      };
      s.config.certificateStatusSequence = (s.config.certificateStatusSequence || 0) + 1;
    }
}

export function displayCertificateResult(value) {
  const labels = {
    'not-checked': 'Not checked',
    unknown: 'Unknown',
    unsupported: 'Unsupported format',
    supported: 'Supported claim definition',
    'unrecognised-key': 'Unknown, disabled or out-of-date issuer key',
    recognised: 'Approved issuer key',
    valid: 'Valid',
    invalid: 'Invalid signature',
    unavailable: 'Cryptographic verification unavailable on this device',
    expired: 'Expired',
    'not-yet-valid': 'Not yet valid',
    'intended-recipient': 'Intended receiving institution',
    'different-recipient': 'Different receiving institution',
    withdrawn: 'Withdrawn',
    'stale-snapshot': 'Status snapshot is too old',
    'snapshot-predates-certificate': 'Status snapshot predates this certificate; obtain a newer signed snapshot',
    'live-status-required': 'Current issuer confirmation required; cached status is insufficient',
    'not-listed-in-snapshot': 'Not listed as withdrawn in the available snapshot',
    'borrower-reviewed': 'Borrower reviewed',
    'correction-requested': 'Correction requested',
    'manual-review': 'Manual review',
    'not-accepted': 'Not accepted',
  };
  return labels[value] || String(value).replace(/^\w/, letter => letter.toUpperCase());
}
