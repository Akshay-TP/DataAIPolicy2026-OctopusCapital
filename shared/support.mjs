export const SUPPORT_TABLES = {
  supportPeople: 'support_people',
  payPeriods: 'worker_pay_periods',
  payReceipts: 'worker_pay_receipts',
  workerDebts: 'worker_debts',
  debtEntries: 'worker_debt_entries',
  deductions: 'worker_deductions',
  remittances: 'worker_remittances',
  participation: 'prospect_participation',
  reconsiderations: 'prospect_reviews',
  assetChecks: 'livelihood_checks',
  workerCases: 'worker_support_cases',
};
export const SUPPORT_COLLECTIONS = Object.keys(SUPPORT_TABLES);
// One route contract for the API, offline projection and record-review UI.
export const SUPPORT_ROUTES = {
  people: 'supportPeople',
  pay: 'payPeriods',
  receipts: 'payReceipts',
  debts: 'workerDebts',
  'debt-entries': 'debtEntries',
  deductions: 'deductions',
  remittances: 'remittances',
  participation: 'participation',
  reviews: 'reconsiderations',
  assets: 'assetChecks',
  cases: 'workerCases',
};
export function displaySupportValue(value) {
  const labels = {
    'domestic-worker': 'Work and advance debt in India',
    'overseas-worker': 'Indian overseas worker / family',
    'not-recorded': 'Not recorded',
    'not-working': 'Not working',
    'partly-working': 'Partly working',
    'not-seen': 'Not seen',
    'in-progress': 'In progress',
    'not-started': 'Not started',
    'awaiting-information': 'Awaiting information',
    'accepted-externally': 'Accepted outside FieldLedger',
    'not-accepted': 'Not accepted',
  };
  return labels[value] || String(value).replace(/^\w/, character => character.toUpperCase());
}
export const REPORTERS = ['worker', 'family', 'member'];
export const DEFAULT_PAY_POLICY = { lateDays: 7, shortPercent: 10 };
const cents = n => Math.round(n * 100);
const active = rows => rows.filter(r => !r.voided);

/** Expected means take-home pay, already allowing for expected deductions.
 * Deductions and remittances never count as salary receipts. Unknown is not zero. */
export function payPosition(s, period, asOf) {
  const rows = active(s.payReceipts || []).filter(r => r.payId === period.id && r.date <= asOf);
  const known = rows.filter(r => r.amount !== null),
    knownAmount = known.reduce((n, r) => n + cents(r.amount), 0) / 100;
  const complete = rows.length > 0 && rows.every(r => r.amount !== null);
  const received = complete ? knownAmount : null;
  return {
    received,
    knownAmount,
    hasUnknown: rows.some(r => r.amount === null),
    unreported: !rows.length,
    shortfall:
      period.expected === null || received === null
        ? null
        : Math.max(0, cents(period.expected) - cents(received)) / 100,
    receipts: rows,
  };
}
export function debtPosition(s, debt, asOf) {
  const entries = active(s.debtEntries || []).filter(e => e.debtId === debt.id && e.date <= asOf);
  const advances = entries.filter(e => e.kind === 'advance').reduce((n, e) => n + cents(e.amount), 0) / 100;
  const repaid = entries.filter(e => e.kind === 'repayment').reduce((n, e) => n + cents(e.amount), 0) / 100;
  return {
    opening: debt.opening,
    advances,
    repaid,
    balance: debt.opening === null ? null : (cents(debt.opening) + cents(advances) - cents(repaid)) / 100,
    disputed: debt.disputed,
  };
}
export function payFlags(s, asOf) {
  const flags = [];
  for (const p of active(s.payPeriods || [])) {
    const person = (s.supportPeople || []).find(x => x.id === p.personId);
    if (!person?.consented) continue;
    const policy = person.payPolicy || DEFAULT_PAY_POLICY,
      position = payPosition(s, p, asOf);
    const daysLate = Math.floor((Date.parse(asOf) - Date.parse(p.dueDate)) / 86400000);
    if (daysLate < 0) continue;
    if (
      daysLate > policy.lateDays &&
      ((position.received === null && (p.expected === null || position.knownAmount < p.expected)) ||
        position.shortfall > 0)
    ) {
      const kind = position.received === null ? 'unconfirmed-pay' : 'late-pay';
      flags.push({
        key: p.id + ':' + kind,
        kind,
        payId: p.id,
        personId: p.personId,
        currency: p.currency,
        daysLate,
        policy: { ...policy },
        position,
        reason:
          position.received === null
            ? `Pay receipt is unconfirmed, ${daysLate} days after the expected date. This does not establish non-payment.`
            : `Expected take-home pay remains short by ${position.shortfall} ${p.currency}, ${daysLate} days after the expected date.`,
      });
    }
    if (
      p.expected > 0 &&
      position.shortfall !== null &&
      position.shortfall > 0 &&
      (position.shortfall / p.expected) * 100 >= policy.shortPercent
    ) {
      flags.push({
        key: p.id + ':short-pay',
        kind: 'short-pay',
        payId: p.id,
        personId: p.personId,
        currency: p.currency,
        policy: { ...policy },
        position,
        reason: `Recorded receipts are ${((position.shortfall / p.expected) * 100).toFixed(1)}% below expected take-home pay; threshold ${policy.shortPercent}%.`,
      });
    }
  }
  return flags;
}
export function participationSummary(s, personId) {
  const rows = active(s.participation || []).filter(r => r.personId === personId),
    attendance = rows.filter(r => r.attendance !== 'not-recorded');
  const savings = {};
  for (const r of rows)
    if (r.savings !== null) savings[r.currency] = (cents(savings[r.currency] || 0) + cents(r.savings)) / 100;
  return {
    meetings: rows.length,
    present: attendance.filter(r => r.attendance === 'present').length,
    attendanceRecorded: attendance.length,
    savings,
    unknownSavings: rows.filter(r => r.savings === null).length,
  };
}
