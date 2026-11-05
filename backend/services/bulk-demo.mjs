import { addDays } from '../../shared/health.mjs';

/**
 * Larger fictional dataset for demonstrations. Entirely synthetic.
 * A seeded generator makes every load identical, so results are reviewable and tests are stable.
 */
function generator(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: p => next() < p,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: list => list[Math.floor(next() * list.length)],
    // Approximately normal, clamped, for income-like quantities.
    around: (mid, spread) => mid + (next() + next() + next() - 1.5) * ((spread * 2) / 1.5) * 0.5,
    weighted(entries) {
      const total = entries.reduce((n, [, w]) => n + w, 0);
      let x = next() * total;
      for (const [value, w] of entries) if ((x -= w) < 0) return value;
      return entries.at(-1)[0];
    },
  };
}
const round = (n, step) => Math.round(n / step) * step;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekday = date => new Date(date + 'T00:00:00Z').getUTCDay();

const FIRST = [
  'Anjali',
  'Bhavna',
  'Chitra',
  'Deepa',
  'Ela',
  'Farida',
  'Gauri',
  'Hema',
  'Indu',
  'Jaya',
  'Kiran',
  'Leela',
  'Mamta',
  'Neeta',
  'Omana',
  'Padma',
  'Qamar',
  'Roshni',
  'Shanti',
  'Tara',
  'Uma',
  'Vimala',
  'Yamini',
  'Zeenat',
  'Aarti',
  'Bharati',
  'Chandrika',
  'Devaki',
  'Ganga',
  'Hasina',
  'Jyoti',
  'Kamini',
  'Lakshmi',
  'Madhuri',
  'Nasreen',
  'Parvati',
  'Rukmini',
  'Saraswati',
  'Tabassum',
  'Urmila',
  'Vasanti',
  'Sakina',
  'Rehana',
  'Pramila',
  'Sulochana',
  'Revati',
  'Mehrunnisa',
  'Janaki',
  'Gulab',
  'Dhanalakshmi',
];
const LAST = [
  'Kulkarni',
  'Reddy',
  'Nair',
  'Iyer',
  'Khan',
  'Bhatt',
  'Mehta',
  'Pillai',
  'Banerjee',
  'Chopra',
  'Desai',
  'Menon',
  'Shetty',
  'Kaur',
  'Ansari',
  'Mondal',
  'Gaikwad',
  'Shinde',
  'Patil',
  'Waghmare',
  'Chavan',
  'Sheikh',
  'Pathan',
  'Bhosale',
  'Kamble',
  'Jadhav',
  'More',
  'Naidu',
  'Rao',
  'Gowda',
  'Mallick',
  'Barman',
  'Hazarika',
  'Kharat',
  'Solanki',
  'Parmar',
  'Rathod',
  'Meena',
  'Gurjar',
  'Tiwari',
  'Pandey',
  'Yadav',
  'Sahu',
  'Behera',
  'Mohanty',
  'Lakra',
  'Munda',
  'Kujur',
];
const MALE = [
  'Arjun',
  'Bilal',
  'Chandan',
  'Dinesh',
  'Eshwar',
  'Faiz',
  'Girish',
  'Harish',
  'Imran',
  'Jagdish',
  'Kabir',
  'Lokesh',
  'Manoj',
  'Naveen',
  'Omprakash',
  'Prakash',
  'Rafiq',
  'Sanjay',
  'Tukaram',
  'Vijay',
  'Wasim',
  'Yusuf',
  'Ravi',
  'Sunil',
  'Mahesh',
];
// [livelihood, typical monthly household income in INR]
const LIVELIHOODS = [
  ['Village grocery shop', 21000],
  ['Vegetable growing', 13000],
  ['Food stall', 17000],
  ['Poultry raising', 15000],
  ['Tailoring', 12000],
  ['Market trading', 19000],
  ['Dairy (2 animals)', 18000],
  ['Handloom weaving', 10500],
  ['Flower selling', 9000],
  ['Tea stall', 14000],
  ['Bangle and cosmetics shop', 13500],
  ['Goat rearing', 11000],
  ['Home-based food catering', 15500],
  ['Fish vending', 12500],
];
const GROUPS = [
  ['Jyoti Mahila Group', 'Priya Nair'],
  ['Kisan Sakhi Group', 'Meera Shah'],
  ['Ekta Self-Help Group', 'Asha Patil'],
  ['Navjeevan Women’s Group', 'Priya Nair'],
  ['Prerna Livelihood Group', 'Meera Shah'],
  ['Asha Kiran Group', 'Kavya Rao'],
  ['Shakti Bachat Group', 'Kavya Rao'],
  ['Gram Laxmi Group', 'Sana Sheikh'],
  ['Saheli Savings Group', 'Sana Sheikh'],
  ['Udyogini Group', 'Asha Patil'],
  ['Ujjwala Mahila Group', 'Priya Nair'],
  ['Tejaswini Group', 'Meera Shah'],
];
const COLORS = ['teal', 'purple', 'orange'];
const WEEKS = 14;

/** Adds groups, members, loans and weekly visits directly to the workspace snapshot. */
export function addBulkCore(s, today) {
  const rng = generator(20260814);
  const firstGroupNumber = s.groups.length + 1;
  const groups = GROUPS.map(([name, officer], g) => {
    const day = 1 + (g % 6); // Monday–Saturday
    let next = addDays(today, 1);
    while (weekday(next) !== day) next = addDays(next, 1);
    return {
      id: `GRP-${String(firstGroupNumber + g).padStart(3, '0')}`,
      name,
      location: '',
      officer,
      day: WEEKDAYS[day],
      nextMeeting: next,
      time: ['09:00', '09:30', '10:30', '15:00'][g % 4],
      color: COLORS[g % 3],
      _day: day,
    };
  });
  const members = [],
    loans = [],
    visits = [];
  let memberNumber = s.members.length + 1,
    loanNumber = s.loans.length + 1;
  const usedNames = new Set(s.members.map(m => m.name));
  groups.forEach((group, g) => {
    // The most recent meeting day on or before today.
    let lastMeeting = today;
    while (weekday(lastMeeting) !== group._day) lastMeeting = addDays(lastMeeting, -1);
    const badWeek = rng.chance(0.3) ? rng.int(2, 8) : null; // group-wide disruption (illness, flooding, festival)
    const size = rng.int(16, 24);
    for (let k = 0; k < size; k++) {
      let name;
      do name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
      while (usedNames.has(name));
      usedNames.add(name);
      const [business, typical] = rng.pick(LIVELIHOODS);
      const income = round(Math.max(5000, rng.around(typical, typical * 0.28)), 100);
      const expenses = round(income * (0.62 + rng.next() * 0.42), 100); // ~8% report no surplus
      const profile = rng.weighted([
        ['reliable', 70],
        ['occasional', 21],
        ['struggling', 9],
      ]);
      const member = {
        id: `MEM-${String(memberNumber++).padStart(3, '0')}`,
        name,
        currency: 'INR',
        groupId: group.id,
        business,
        income,
        expenses,
        household: rng.weighted([
          [2, 8],
          [3, 22],
          [4, 30],
          [5, 22],
          [6, 12],
          [7, 6],
        ]),
        earners: 1,
        kycVerified: rng.chance(0.93),
        identityType: rng.weighted([
          ['Aadhaar', 82],
          ['Voter ID', 12],
          ['Other approved ID', 6],
        ]),
        identitySuffix: String(rng.int(1000, 9999)),
        joined: addDays(today, -rng.int(100, 420)),
        consent: null,
      };
      member.earners = Math.min(member.household, rng.chance(0.33) ? 2 : 1);
      members.push(member);
      const hasLoan = rng.chance(0.82);
      const loanWeeks = rng.int(5, WEEKS);
      let loan = null;
      if (hasLoan) {
        const principal = Math.min(80000, round(member.income * rng.around(2.0, 0.6), 1000));
        const termWeeks = rng.pick([26, 36, 46, 52]);
        loan = {
          id: `LN-${String(loanNumber++).padStart(3, '0')}`,
          memberId: member.id,
          currency: 'INR',
          principal: Math.max(10000, principal),
          installment: Math.max(300, round(Math.max(10000, principal) / termWeeks, 50)),
          frequency: 'weekly',
          purpose: member.business,
          date: addDays(lastMeeting, -7 * loanWeeks),
          status: 'active',
        };
        loans.push(loan);
      }
      const firstWeek = loan ? loanWeeks - 1 : WEEKS - 1;
      let remaining = loan ? loan.principal : 0;
      const attendProb = { reliable: 0.95, occasional: 0.82, struggling: 0.62 }[profile];
      for (let w = firstWeek; w >= 0; w--) {
        const date = addDays(lastMeeting, -7 * w);
        const disrupted = badWeek !== null && w === badWeek;
        const present = !disrupted && rng.chance(attendProb);
        const excusedAbsence = !present && rng.chance(0.4);
        const due = loan ? Math.min(loan.installment, remaining) : 0;
        let paid = 0;
        if (loan && due > 0 && present) {
          const factor =
            profile === 'struggling' && w < 6
              ? rng.pick([0, 0.5, 0.5, 1])
              : rng.chance(profile === 'reliable' ? 0.985 : 0.88)
                ? 1
                : rng.pick([0, 0.5]);
          paid = Math.min(remaining, round(due * factor, 10));
        }
        remaining -= paid;
        const last = w === 0;
        visits.push({
          id: `bulk-${member.id}-${w}`,
          memberId: member.id,
          currency: 'INR',
          loanId: loan?.id || null,
          date,
          attendance: present ? 'present' : excusedAbsence ? 'excused' : 'absent',
          due,
          paid,
          savings: present ? Math.max(20, round(rng.around(profile === 'struggling' ? 60 : 130, 70), 10)) : 0,
          utilisation: !loan
            ? 'not-checked'
            : last && profile === 'struggling'
              ? 'follow-up'
              : w === firstWeek - 1 && rng.chance(0.6)
                ? 'verified'
                : rng.chance(0.04)
                  ? 'verified'
                  : 'not-checked',
          note:
            last && profile === 'struggling'
              ? 'Income dipped this month. Arrange a supportive follow-up visit.'
              : disrupted && present
                ? 'Attended despite local disruption.'
                : '',
          officer: group.officer,
          createdAt: date + 'T10:00:00.000Z',
          version: 1,
        });
      }
    }
  });
  const clean = groups.map(({ _day, ...rest }) => rest);
  s.groups.push(...clean);
  s.members.push(...members);
  s.loans.push(...loans);
  s.visits.push(...visits);
  return { groups: clean.length, members: members.length, loans: loans.length, visits: visits.length };
}

const MISSING_ITEMS = [
  'Proof of address',
  'Voter ID copy',
  'Aadhaar copy (last four digits only on file)',
  'Evidence of regular income',
  'Passport-size photograph',
  'Reference from a group member',
  'Husband’s or guardian’s consent form',
  'Bank passbook copy',
];
const REFUSAL_REASONS = {
  documentation: [
    'Address proof was out of date.',
    'ID copy was unclear and could not be read.',
    'Name on documents did not match.',
    'Documents were not available at the time of the visit.',
  ],
  'income-evidence': [
    'Income is seasonal and was hard to evidence at the visit.',
    'Works informally with no written record of earnings.',
    'Earnings are shared with a family business.',
  ],
  'attendance-record': [
    'Attended too few meetings before the decision.',
    'Missed meetings; reasons were not recorded.',
  ],
  'repayment-history': ['Earlier informal loan was reported as unpaid.', 'Past repayment record was unclear.'],
  capacity: ['Existing household borrowing seemed high relative to income.'],
  other: ['Group did not reach agreement on membership.', 'Officer recorded a concern without further detail.'],
};
const REFUSAL_FIX = {
  documentation: ['yes', 'yes', 'yes', 'unknown'],
  'income-evidence': ['yes', 'unknown', 'unknown', 'no'],
  'attendance-record': ['yes', 'yes', 'unknown'],
  'repayment-history': ['unknown', 'no', 'unknown'],
  capacity: ['no', 'unknown'],
  other: ['unknown', 'no', 'unknown'],
};

/**
 * Support-module examples. Each step is validated by the real route handlers.
 * Returns { steps: [{route, body, method?, id?}], backdate: {personId: {created, updated}} } — the loader
 * backdates profile creation so reminder rules that depend on elapsed time behave realistically.
 */
export function bulkSupportExamples(s, today) {
  const rng = generator(77031);
  const bulkGroups = s.groups.filter(g => g.id >= 'GRP-004');
  const groupIds = (bulkGroups.length ? bulkGroups : s.groups).map(g => g.id);
  const steps = [],
    backdate = {};
  const date = d => addDays(today, -d);
  const add = (route, body, extra = {}) => steps.push({ route, body, ...extra });
  const person = (id, name, kind, currency, groupId, source, memberId = null, daysAgo = 0) => {
    add('people', {
      id,
      name,
      kind,
      currency,
      source,
      memberId,
      groupId,
      memberReference: '',
      safeContact: 'Agree contact preferences at the next visit',
      notes: 'Fictional demonstration record',
      consented: true,
    });
    if (daysAgo)
      backdate[id] = {
        created: date(daysAgo),
        updated: addDays(date(daysAgo), Math.floor(daysAgo * (0.45 + rng.next() * 0.55))),
      };
  };
  const used = new Set();
  const personName = pool => {
    let n;
    do n = `${rng.pick(pool)} ${rng.pick(LAST)}`;
    while (used.has(n));
    used.add(n);
    return n;
  };
  // ---- Workers and families ----
  for (let w = 0; w < 60; w++) {
    const overseas = w % 5 < 2; // 40% overseas families
    const currency = overseas
      ? rng.weighted([
          ['AED', 55],
          ['SAR', 35],
          ['INR', 10],
        ])
      : 'INR';
    const groupId = rng.pick(groupIds),
      id = `bulk-worker-${String(w).padStart(3, '0')}`;
    const name = personName(MALE) + (overseas ? ' / family' : '');
    const source = overseas ? 'family' : 'worker';
    person(id, name, overseas ? 'overseas-worker' : 'domestic-worker', currency, groupId, source, null, 130);
    const wage = overseas
      ? Math.round(rng.around(currency === 'INR' ? 24000 : currency === 'AED' ? 1300 : 1500, 250) / 10) * 10
      : round(rng.around(13500, 3500), 100);
    const profile = rng.weighted([
      ['steady', 62],
      ['delayed', 20],
      ['short', 12],
      ['unclear', 6],
    ]);
    for (let p = 0; p < 4; p++) {
      const start = date(125 - p * 30),
        end = addDays(start, 29),
        due = addDays(end, 3),
        payId = `${id}-pay-${p}`;
      if (due > today) continue;
      add('pay', {
        id: payId,
        personId: id,
        source,
        label: `${['Month', 'Cycle'][w % 2]} ${p + 1}`,
        periodStart: start,
        periodEnd: end,
        dueDate: due,
        expected: wage,
        currency,
        notes: '',
      });
      const roll = rng.next();
      let outcome = 'ontime';
      if (profile === 'delayed' && roll < 0.55) outcome = 'late';
      else if (profile === 'short' && roll < 0.55) outcome = 'short';
      else if (profile === 'unclear' && roll < 0.6) outcome = roll < 0.3 ? 'unknown' : 'none';
      else if (roll > 0.96) outcome = 'late';
      if (outcome === 'none') continue; // no receipt recorded: unconfirmed, not non-payment
      const receiptDate = addDays(due, outcome === 'late' ? rng.int(9, 25) : rng.int(-1, 2));
      if (receiptDate > today || receiptDate < start) continue;
      const amount =
        outcome === 'unknown' ? null : outcome === 'short' ? Math.round(wage * (0.6 + rng.next() * 0.3)) : wage;
      add('receipts', { id: `${payId}-rcpt`, personId: id, source, payId, date: receiptDate, amount, notes: '' });
    }
    let debtId = null;
    if (rng.chance(overseas ? 0.65 : 0.5)) {
      debtId = `${id}-debt`;
      const opening = overseas ? round(rng.around(85000, 35000), 1000) : round(rng.around(16000, 8000), 500);
      add('debts', {
        id: debtId,
        personId: id,
        source,
        date: date(110),
        kind: overseas ? 'recruitment' : 'advance',
        label: overseas ? 'Reported recruitment fee loan' : 'Reported work advance',
        opening: Math.max(3000, opening),
        currency: 'INR',
        disputed: rng.chance(0.22),
        notes: 'Amount reported by worker; not a verified legal obligation',
      });
      const repayments = rng.int(0, 3);
      let repaid = 0;
      for (let r = 0; r < repayments; r++) {
        const amount = round(Math.max(500, opening * rng.around(0.06, 0.04)), 100);
        if (repaid + amount > opening * 0.5) break;
        repaid += amount;
        add('debt-entries', {
          id: `${debtId}-e${r}`,
          personId: id,
          source,
          debtId,
          date: date(85 - r * 25),
          kind: 'repayment',
          amount,
          notes: '',
        });
      }
    }
    if (rng.chance(0.28))
      add('deductions', {
        id: `${id}-ded`,
        personId: id,
        source: 'worker',
        payId: `${id}-pay-0`,
        date: date(95),
        label: rng.pick(['Accommodation charge', 'Food charge', 'Transport charge', 'Uniform and tools']),
        amount: round(wage * rng.around(0.08, 0.04), 50) || 500,
        status: rng.weighted([
          ['agreed', 50],
          ['disputed', 35],
          ['unknown', 15],
        ]),
        notes: '',
      });
    if (overseas) {
      const sentCurrency = currency === 'INR' ? 'AED' : currency;
      for (let r = 0; r < 3; r++) {
        const sent = Math.round((wage * rng.around(0.55, 0.12)) / 10) * 10 || 100,
          sentDate = date(100 - r * 30);
        const known = rng.chance(0.85);
        add('remittances', {
          id: `${id}-rem-${r}`,
          personId: id,
          source: 'family',
          date: sentDate,
          sent,
          sentCurrency,
          fee: rng.chance(0.8) ? Math.round(sent * 0.02) + 4 : null,
          received: known ? Math.round(sent * (sentCurrency === 'AED' ? 22.4 : 22)) : null,
          receivedCurrency: 'INR',
          receivedDate: known ? addDays(sentDate, rng.int(1, 4)) : null,
          notes: '',
        });
      }
    }
    // Some workers with short or delayed pay already have an agreed follow-up case.
    if ((profile === 'short' || profile === 'delayed') && rng.chance(0.55))
      add('cases', {
        id: `${id}-case`,
        personId: id,
        source,
        title: profile === 'short' ? 'Pay lower than agreed' : 'Pay arriving late',
        action: 'Discuss with the worker and agree who will approach the employer or a specialist service.',
        dueDate: addDays(today, rng.int(3, 21)),
        assigneeId: 'admin',
        agreed: true,
        notes: '',
      });
  }
  // ---- Prospective members ("second chance") ----
  const PROSPECTS = 110;
  for (let k = 0; k < PROSPECTS; k++) {
    const id = `bulk-prospect-${String(k).padStart(3, '0')}`,
      groupId = rng.pick(groupIds);
    const age = rng.int(20, 130); // days since profile created
    person(id, personName(FIRST), 'prospective', 'INR', groupId, 'member', null, age);
    const profile = rng.weighted([
      ['regular', 45],
      ['patchy', 35],
      ['new', 20],
    ]);
    const meetings = profile === 'new' ? rng.int(0, 1) : Math.min(Math.floor(age / 7), rng.int(2, 8));
    for (let m = 0; m < meetings; m++) {
      const meetingDate = addDays(date(age), 7 * (m + 1));
      if (meetingDate > today) break;
      const attends = rng.chance(profile === 'regular' ? 0.9 : 0.6);
      const attendance = attends ? 'present' : rng.chance(0.45) ? 'excused' : 'absent';
      add('participation', {
        id: `${id}-part-${m}`,
        personId: id,
        source: 'member',
        date: meetingDate,
        attendance,
        savings: attends
          ? rng.chance(0.12)
            ? null
            : round(rng.around(110, 60), 10) || 50
          : rng.chance(0.5)
            ? 0
            : null,
        currency: 'INR',
        notes: '',
      });
    }
    // Refusal reasons: mostly fixable documentation or income-evidence gaps.
    let refusalDate = null;
    if (rng.chance(0.4) && age > 20) {
      const category = rng.weighted([
        ['documentation', 40],
        ['income-evidence', 24],
        ['attendance-record', 12],
        ['repayment-history', 10],
        ['capacity', 6],
        ['other', 8],
      ]);
      refusalDate = date(rng.int(8, Math.min(age - 3, 90)));
      const needed =
        category === 'documentation'
          ? [rng.pick(MISSING_ITEMS.slice(0, 3))]
          : category === 'income-evidence'
            ? ['Evidence of regular income']
            : [];
      add('refusals', {
        id: `${id}-refusal`,
        personId: id,
        source: 'member',
        date: refusalDate,
        category,
        fixable: rng.pick(REFUSAL_FIX[category]),
        missingItems: needed,
        reason: rng.pick(REFUSAL_REASONS[category]),
        notes: '',
      });
    }
    // Agreed missing information and a review date.
    const missing =
      refusalDate || rng.chance(0.25)
        ? [...new Set(Array.from({ length: rng.int(1, 3) }, () => rng.pick(MISSING_ITEMS)))]
        : [];
    const reviewDate = rng.chance(0.65)
      ? addDays(
          today,
          rng.weighted([
            [-40, 5],
            [-14, 8],
            [-3, 7],
            [10, 40],
            [30, 40],
          ])
        )
      : null;
    if (missing.length || reviewDate)
      add(
        'people',
        {
          operationId: `${id}-update-1`,
          version: 1,
          consented: true,
          missingInformation: missing,
          reviewDate,
          payPolicy: { lateDays: 7, shortPercent: 10 },
        },
        { method: 'PATCH', id }
      );
    // Human reconsideration after some refusals; some are still waiting.
    if (refusalDate && rng.chance(0.5)) {
      const reviewOn = addDays(refusalDate, rng.int(6, 30));
      if (reviewOn <= today) {
        const outcome = rng.weighted([
          ['reviewed', 25],
          ['awaiting-information', 25],
          ['accepted-externally', 35],
          ['not-accepted', 12],
          ['withdrawn', 3],
        ]);
        add('reviews', {
          id: `${id}-review`,
          personId: id,
          source: 'member',
          date: reviewOn,
          outcome,
          reason: {
            reviewed: 'Supervisor met the applicant and reviewed the documents again.',
            'awaiting-information': 'Waiting for the applicant to bring the missing documents.',
            'accepted-externally': 'Accepted by the lending committee after documents were supplied.',
            'not-accepted': 'Committee confirmed the earlier decision after reconsideration.',
            withdrawn: 'Applicant chose not to proceed.',
          }[outcome],
          notes: '',
        });
      }
    }
  }
  // ---- Livelihood checks, linked to real members and their loans where possible ----
  const candidates = s.members
    .filter(m => groupIds.includes(m.groupId) && s.loans.some(l => l.memberId === m.id))
    .filter((_, i) => i % 5 === 0);
  const checks = ['working', 'working', 'working', 'partly-working', 'not-working', 'not-seen'];
  for (let k = 0; k < 45 && k < candidates.length; k++) {
    const member = candidates[k],
      loan = s.loans.find(l => l.memberId === member.id);
    const id = `bulk-livelihood-${String(k).padStart(3, '0')}`;
    person(id, member.name, 'livelihood', 'INR', member.groupId, 'member', member.id, 90);
    const intended = [
      'Two milch goats',
      'Sewing machine and fabric',
      'Dairy cow',
      'Vegetable cart',
      'Stock for grocery shop',
      'Poultry shed and chicks',
      'Handloom repair',
      'Tea stall equipment',
    ][k % 8];
    const functioning = rng.pick(checks);
    add('assets', {
      id: `${id}-check`,
      personId: id,
      source: 'member',
      date: date(rng.int(7, 60)),
      loanId: loan.id,
      intended,
      actual: functioning === 'not-seen' ? 'Not seen at visit' : intended,
      functioning,
      explanation:
        functioning === 'not-working'
          ? 'Household reports the animal fell ill.'
          : functioning === 'partly-working'
            ? 'Running at reduced capacity this season.'
            : '',
      officerNotes: '',
      notes: '',
    });
  }
  return { steps, backdate };
}
