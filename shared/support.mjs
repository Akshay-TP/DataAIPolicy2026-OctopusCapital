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
  refusals: 'prospect_refusals',
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
  refusals: 'refusals',
  assets: 'assetChecks',
  cases: 'workerCases',
};
export function displaySupportValue(value) {
  const labels = {
    'domestic-worker': 'Worker in India',
    'overseas-worker': 'Indian worker abroad / family',
    'not-recorded': 'Not recorded',
    'not-working': 'Not working',
    'partly-working': 'Partly working',
    'not-seen': 'Not seen',
    'in-progress': 'In progress',
    'not-started': 'Not started',
    'awaiting-information': 'More details needed',
    'accepted-externally': 'Accepted by the lender',
    'not-accepted': 'Not accepted',
    resolved: 'Closed',
    recruitment: 'Money borrowed to get a job',
    advance: 'Money borrowed in advance',
    repayment: 'Money repaid',
    unknown: 'Not known',
    agreed: 'Worker agrees',
    disputed: 'Worker disagrees',
    reviewed: 'Reviewed by staff',
    withdrawn: 'Withdrawn from review',
    prospective: 'Waiting for a loan review',
    livelihood: 'Work or business',
    documentation: 'Documents missing or unclear',
    'income-evidence': 'Income evidence',
    'attendance-record': 'Attendance record',
    'repayment-history': 'Repayment history',
    capacity: 'Capacity concern',
  };
  return labels[value] || String(value).replace(/^\w/, character => character.toUpperCase());
}
export const REFUSAL_CATEGORIES = [
  'documentation',
  'income-evidence',
  'attendance-record',
  'repayment-history',
  'capacity',
  'other',
];
export const FIXABLE = ['yes', 'no', 'unknown'];
export const MISSING_INFO_REMINDER_DAYS = 30;
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
            ? `Pay has not been confirmed, ${daysLate} days after it was due. Ask the worker or family; this does not mean they were not paid.`
            : `Pay is still ${position.shortfall} ${p.currency} short, ${daysLate} days after it was due.`,
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
        reason: `Recorded pay is ${((position.shortfall / p.expected) * 100).toFixed(1)}% less than expected. Your reminder is set to ${policy.shortPercent}%.`,
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

/**
 * Second-chance review queue: transparent reminders for staff, never a score or a ranking of worth.
 * Every prompt names the rule and the records behind it. People are ordered only by how long a
 * prompt has been waiting. Not appearing here says nothing about anyone's eligibility.
 */
export function reviewQueue(s, asOf) {
  const days = (from, to) => Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 86400000));
  const label = value => displaySupportValue(value).toLowerCase();
  const queue = [];
  for (const p of s.supportPeople || []) {
    if (p.kind !== 'prospective' || !p.consented) continue;
    const mine = rows => active(rows || []).filter(r => r.personId === p.id);
    const meetings = mine(s.participation),
      reviews = mine(s.reconsiderations).sort((a, b) => a.date.localeCompare(b.date)),
      refusals = mine(s.refusals).sort((a, b) => a.date.localeCompare(b.date));
    if (reviews.at(-1)?.outcome === 'withdrawn') continue; // the person withdrew; nothing to prompt
    const prompts = [],
      refusal = refusals.at(-1);
    if (p.reviewDate && p.reviewDate <= asOf)
      prompts.push({
        key: 'review-due',
        since: p.reviewDate,
        rule: 'Agreed review date has passed',
        evidence: `Review date ${p.reviewDate}, ${days(p.reviewDate, asOf)} days ago.`,
      });
    if (refusal && refusal.fixable !== 'no' && !reviews.some(r => r.date >= refusal.date))
      prompts.push({
        key: 'fixable-refusal',
        since: refusal.date,
        rule: 'Refused for a reason that may be fixable, with no review since',
        evidence: `Refused ${refusal.date} for ${label(refusal.category)}; fixable: ${refusal.fixable}.${
          refusal.missingItems?.length ? ' Needed: ' + refusal.missingItems.join(', ') + '.' : ''
        }`,
      });
    const lastChange = (p.history || []).at(-1)?.at?.slice(0, 10) || p.createdAt?.slice(0, 10);
    if (p.missingInformation?.length && lastChange && days(lastChange, asOf) >= MISSING_INFO_REMINDER_DAYS)
      prompts.push({
        key: 'missing-information',
        since: lastChange,
        rule: `Still missing information after ${MISSING_INFO_REMINDER_DAYS}+ days`,
        evidence: `${p.missingInformation.join('; ')} (listed ${days(lastChange, asOf)} days ago).`,
      });
    if (refusal && meetings.length < 2)
      prompts.push({
        key: 'few-observations',
        since: refusal.date,
        rule: 'Refused after fewer than two meetings were recorded',
        evidence: `${meetings.length} meeting record(s). Few records are not evidence of unsuitability.`,
      });
    if (!prompts.length) continue;
    // Context notes: shown only for people already queued, never a reason to queue someone.
    const unknown = meetings.filter(r => r.savings === null);
    if (unknown.length)
      prompts.push({
        key: 'unknown-contributions',
        note: true,
        since: unknown.map(r => r.date).sort()[0],
        rule: 'Some contribution amounts are not known',
        evidence: `${unknown.length} meeting(s) have no contribution amount. Ask and record it; unknown is not zero.`,
      });
    const absent = meetings.filter(r => r.attendance === 'absent');
    if (refusal?.category === 'attendance-record' && absent.length)
      prompts.push({
        key: 'attendance-reasons',
        note: true,
        since: refusal.date,
        rule: 'Refused over attendance, and the reasons for absences are not recorded',
        evidence: `${absent.length} absence(s) recorded. Check for work shifts, travel or caring duties before relying on them.`,
      });
    const since = prompts
      .filter(x => !x.note)
      .map(x => x.since)
      .sort()[0];
    queue.push({ personId: p.id, since, waitingDays: days(since, asOf), prompts });
  }
  return queue.sort((a, b) => a.since.localeCompare(b.since) || a.personId.localeCompare(b.personId));
}
