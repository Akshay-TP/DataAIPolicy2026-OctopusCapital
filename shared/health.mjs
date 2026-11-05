// Plain, inspectable measures. No score, eligibility decision, or causal attribution.
export const ESSENTIALS = ['food', 'housing', 'utilities', 'healthcare', 'education', 'transport', 'other'];
export const CAUSES = [
  'delayed-income',
  'income-drop',
  'expense-increase',
  'debt-payments',
  'seasonal-income',
  'other',
  'unknown',
];
export const DELIVERY = ['suggested', 'requested', 'received', 'not-received', 'cancelled'];
export const addDays = (date, days) =>
  new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export function outcomeReport(s, { asOf, from = '0000-01-01', to = '9999-12-31', groupId = '' } = {}) {
  const members = s.members.filter(m => !groupId || m.groupId === groupId),
    ids = new Set(members.map(m => m.id));
  const household = id => members.find(m => m.id === id)?.householdKey || id;
  const valid = s.checkins.filter(c => !c.pending && !c.voided && c.date <= asOf && ids.has(c.memberId));
  const plans = s.supportPlans.filter(p => !p.pending && ids.has(p.memberId) && p.startDate <= asOf);
  // One baseline per household: earliest support plan in the chosen baseline-date cohort.
  const cohorts = new Map();
  for (const p of plans.slice().sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))) {
    const baseline = valid.find(c => c.id === p.baselineId);
    if (baseline && baseline.date >= from && baseline.date <= to && !cohorts.has(household(p.memberId)))
      cohorts.set(household(p.memberId), { plan: p, baseline });
  }
  const milestones = [30, 90].map(day => {
    const result = {
      day,
      eligible: 0,
      due: 0,
      notDue: 0,
      paired: 0,
      declined: 0,
      unavailable: 0,
      missing: 0,
      late: 0,
      improved: 0,
      unchanged: 0,
      worsened: 0,
      baselineMean: null,
      followupMean: null,
      stressPairs: 0,
      stressChange: null,
      borrowingPairs: 0,
      borrowingBefore: 0,
      borrowingAfter: 0,
      rows: [],
    };
    let before = 0,
      after = 0,
      stress = 0;
    for (const { plan, baseline } of cohorts.values()) {
      if (baseline.response !== 'answered' || baseline.shortfallDays === null) continue;
      result.eligible++;
      const due = addDays(baseline.date, day),
        end = addDays(due, 14);
      if (due > asOf) {
        result.notDue++;
        continue;
      }
      result.due++;
      const entries = valid
        .filter(c => c.planId === plan.id && c.milestone === day && c.date >= due)
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
      const inWindow = entries.filter(c => c.date <= end),
        answer = inWindow.find(c => c.response === 'answered' && c.shortfallDays !== null);
      const last = inWindow.at(-1);
      let status = 'missing';
      if (answer) {
        result.paired++;
        before += baseline.shortfallDays;
        after += answer.shortfallDays;
        status =
          answer.shortfallDays < baseline.shortfallDays
            ? 'improved'
            : answer.shortfallDays > baseline.shortfallDays
              ? 'worsened'
              : 'unchanged';
        result[status]++;
        if (baseline.stress !== null && answer.stress !== null) {
          result.stressPairs++;
          stress += answer.stress - baseline.stress;
        }
        if (['yes', 'no'].includes(baseline.borrowing) && ['yes', 'no'].includes(answer.borrowing)) {
          result.borrowingPairs++;
          result.borrowingBefore += Number(baseline.borrowing === 'yes');
          result.borrowingAfter += Number(answer.borrowing === 'yes');
        }
      } else if (last?.response === 'declined') {
        status = 'declined';
        result.declined++;
      } else if (last?.response === 'unavailable') {
        status = 'unavailable';
        result.unavailable++;
      } else {
        result.missing++;
        if (entries.some(c => c.date > end)) result.late++;
      }
      result.rows.push({
        memberId: plan.memberId,
        planId: plan.id,
        baselineId: baseline.id,
        due,
        end,
        status,
        baselineDays: baseline.shortfallDays,
        followupDays: answer?.shortfallDays ?? null,
      });
    }
    if (result.paired) {
      result.baselineMean = before / result.paired;
      result.followupMean = after / result.paired;
    }
    if (result.stressPairs) result.stressChange = stress / result.stressPairs;
    return result;
  });
  const delivery = plans.filter(p => p.startDate >= from && p.startDate <= to),
    received = delivery.filter(p => p.deliveryStatus === 'received' && p.receivedDate <= asOf);
  const times = received.map(p => daysBetween(p.startDate, p.receivedDate)).sort((a, b) => a - b);
  const median = times.length
    ? (times[Math.floor((times.length - 1) / 2)] + times[Math.ceil((times.length - 1) / 2)]) / 2
    : null;
  return {
    asOf,
    households: new Set(members.map(m => household(m.id))).size,
    checkedHouseholds: new Set(valid.map(c => household(c.memberId))).size,
    cohortHouseholds: cohorts.size,
    excludedBaselines: plans.filter(p => !valid.some(c => c.id === p.baselineId)).length,
    baselineMissing: [...cohorts.values()].filter(
      ({ baseline: c }) => c.response !== 'answered' || c.shortfallDays === null
    ).length,
    milestones,
    delivery: {
      plans: delivery.length,
      received: received.length,
      notReceived: delivery.filter(p => p.deliveryStatus === 'not-received').length,
      closed: delivery.filter(p => p.status === 'resolved').length,
      medianDaysToSupport: median,
      open: delivery.filter(p => p.status !== 'resolved').length,
      overdue: delivery.filter(p => p.status !== 'resolved' && p.dueDate < asOf).length,
    },
  };
}
export function cashflowProjection(entries, { currency, openingBalance, from, to }) {
  let balance = Math.round(openingBalance * 100);
  const dates = [
    ...new Set(
      entries.filter(e => !e.cancelled && e.currency === currency && e.date >= from && e.date <= to).map(e => e.date)
    ),
  ].sort();
  return dates.map(date => {
    const rows = entries.filter(e => !e.cancelled && e.currency === currency && e.date === date);
    const income = rows.filter(e => e.kind === 'income').reduce((n, e) => n + Math.round(e.amount * 100), 0),
      expenses = rows.filter(e => e.kind === 'expense').reduce((n, e) => n + Math.round(e.amount * 100), 0);
    balance += income - expenses;
    return { date, income: income / 100, expenses: expenses / 100, balance: balance / 100, gap: balance < 0 };
  });
}
/** KHR-equivalent planning, with original currency wallets always visible. No live FX feed. */
export function dualCurrencyProjection(entries, options) {
  const { from, to, rateDate, rateSource } = options,
    rate = Number(options.khrPerUsd),
    openingKHR = Number(options.openingKHR),
    openingUSD = Number(options.openingUSD),
    stressPercent = Number(options.stressPercent || 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to || daysBetween(from, to) > 366)
    throw new Error('Choose a planning period of at most 366 days.');
  if (
    !Number.isFinite(rate) ||
    rate < 1 ||
    rate > 1000000 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(rateDate) ||
    typeof rateSource !== 'string' ||
    !rateSource.trim() ||
    rateSource.length > 200
  )
    throw new Error('Enter KHR per USD, the rate date and its source.');
  if (
    ![openingKHR, openingUSD].every(
      n => Number.isFinite(n) && n >= 0 && n <= 100000000 && Math.abs(n * 100 - Math.round(n * 100)) < 0.00001
    ) ||
    !Number.isFinite(stressPercent) ||
    stressPercent < 0 ||
    stressPercent > 100
  )
    throw new Error('Check opening money and exchange-rate stress (0–100%).');
  const active = entries.filter(e => !e.cancelled && e.date >= from && e.date <= to);
  if (
    active.some(
      e =>
        !['KHR', 'USD'].includes(e.currency) ||
        !['income', 'expense'].includes(e.kind) ||
        !Number.isFinite(e.amount) ||
        e.amount <= 0 ||
        e.amount > 100000000
    )
  )
    throw new Error('Expected entries must have valid KHR or USD amounts.');
  function calculate(fx) {
    let khr = Math.round(openingKHR * 100),
      usd = Math.round(openingUSD * 100),
      balance = khr + Math.floor(usd * fx);
    const dates = [...new Set([from, ...active.map(e => e.date), to])].sort(),
      rows = [];
    for (const date of dates) {
      let income = 0,
        expenses = 0;
      for (const e of active.filter(e => e.date === date)) {
        const cents = Math.round(e.amount * 100),
          sign = e.kind === 'income' ? 1 : -1;
        if (e.currency === 'KHR') khr += sign * cents;
        else usd += sign * cents;
        const equivalent = e.currency === 'USD' ? (sign === 1 ? Math.floor(cents * fx) : Math.ceil(cents * fx)) : cents;
        if (sign === 1) income += equivalent;
        else expenses += equivalent;
      }
      balance += income - expenses;
      if (![balance, khr, usd].every(Number.isSafeInteger))
        throw new Error('Planning totals exceed supported precision. Shorten this period.');
      rows.push({
        date,
        income: income / 100,
        expenses: expenses / 100,
        balance: balance / 100,
        khr: khr / 100,
        usd: usd / 100,
        gap: balance < 0,
        requiresExchange: balance >= 0 && (khr < 0 || usd < 0),
      });
    }
    return {
      rate: fx,
      rows,
      firstGap: rows.find(r => r.gap)?.date || null,
      maxGap: Math.max(0, ...rows.map(r => -r.balance)),
      exchangeRequired: rows.some(r => r.requiresExchange),
    };
  }
  return {
    base: calculate(rate),
    stress: calculate(rate * (1 + stressPercent / 100)),
    assumptions: {
      from,
      to,
      openingKHR,
      openingUSD,
      khrPerUsd: rate,
      rateDate,
      rateSource: rateSource.trim(),
      stressPercent,
    },
    entryCount: active.length,
  };
}
