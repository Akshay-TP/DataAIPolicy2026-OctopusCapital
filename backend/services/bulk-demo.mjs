import { addDays } from '../../shared/health.mjs';

// Larger fictional dataset for demonstrations. Deterministic (no randomness) and entirely synthetic.
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
];
const BUSINESSES = [
  'Village grocery shop',
  'Vegetable growing',
  'Food stall',
  'Poultry raising',
  'Tailoring',
  'Market trading',
  'Dairy',
  'Handloom weaving',
  'Flower selling',
  'Tea stall',
];
const NEW_GROUPS = [
  ['GRP-004', 'Jyoti Mahila Group', 'Priya Nair', 'Tuesday', 'teal'],
  ['GRP-005', 'Kisan Sakhi Group', 'Meera Shah', 'Wednesday', 'purple'],
  ['GRP-006', 'Ekta Self-Help Group', 'Asha Patil', 'Saturday', 'orange'],
  ['GRP-007', 'Navjeevan Women’s Group', 'Priya Nair', 'Thursday', 'teal'],
  ['GRP-008', 'Prerna Livelihood Group', 'Meera Shah', 'Friday', 'purple'],
];
const MEMBERS_PER_GROUP = 14;
const WEEKS = 10;

/** Adds groups, members, loans and weekly visits directly to the workspace snapshot. */
export function addBulkCore(s, today) {
  const nextMeeting = day => addDays(today, 1 + (day % 7));
  const groups = NEW_GROUPS.map(([id, name, officer, day, color], i) => ({
    id,
    name,
    location: '',
    officer,
    day,
    nextMeeting: nextMeeting(i),
    time: `${9 + (i % 3)}:00`,
    color,
  }));
  const firstNumber = s.members.length + 1;
  const members = [];
  groups.forEach((group, g) => {
    for (let k = 0; k < MEMBERS_PER_GROUP; k++) {
      const n = g * MEMBERS_PER_GROUP + k,
        i = firstNumber + n;
      members.push({
        id: `MEM-${String(i).padStart(3, '0')}`,
        name: `${FIRST[n % FIRST.length]} ${LAST[(n * 7 + g) % LAST.length]}`,
        currency: 'INR',
        groupId: group.id,
        business: BUSINESSES[n % BUSINESSES.length],
        income: 15000 + ((n * 937) % 12000),
        expenses: 12000 + ((n * 641) % 9000),
        household: 2 + (n % 6),
        earners: 1 + (n % 3 === 0 ? 1 : 0),
        kycVerified: n % 9 !== 4,
        identityType: 'Aadhaar',
        identitySuffix: String(1000 + ((n * 7919) % 9000)),
        joined: addDays(today, -(120 + (n % 60))),
        consent: null,
      });
    }
  });
  const loans = members
    .filter((_, n) => n % 5 !== 4)
    .map((m, n) => ({
      id: `LN-${String(s.loans.length + n + 1).padStart(3, '0')}`,
      memberId: m.id,
      currency: 'INR',
      principal: 24000 + (n % 8) * 3000,
      installment: 1200 + (n % 5) * 100,
      frequency: 'weekly',
      purpose: m.business,
      date: addDays(today, -(WEEKS * 7)),
      status: 'active',
    }));
  const visits = [];
  members.forEach((m, n) => {
    const loan = loans.find(l => l.memberId === m.id);
    let remaining = loan ? loan.principal : 0;
    for (let w = 0; w < WEEKS; w++) {
      const date = addDays(today, -(WEEKS * 7) + (w + 1) * 7 - 1);
      if (date > today) continue;
      const struggling = n % 11 === 3 && w >= 5,
        absent = struggling || (n + w) % 13 === 0;
      const due = loan ? Math.min(loan.installment, remaining) : 0;
      const paid = absent || (n % 7 === 2 && w % 2 === 1) ? 0 : due;
      remaining -= paid;
      visits.push({
        id: `bulk-${m.id}-${w}`,
        memberId: m.id,
        currency: 'INR',
        loanId: loan?.id || null,
        date,
        attendance: absent ? 'absent' : 'present',
        due,
        paid,
        savings: absent ? 0 : 100 + (n % 4) * 50,
        utilisation: w === WEEKS - 1 && loan ? (struggling ? 'follow-up' : 'verified') : 'not-checked',
        note: w === WEEKS - 1 && struggling ? 'Income dipped this month. Arrange a supportive follow-up visit.' : '',
        officer: groups.find(x => x.id === m.groupId).officer,
        createdAt: date + 'T10:00:00.000Z',
        version: 1,
      });
    }
  });
  s.groups.push(...groups);
  s.members.push(...members);
  s.loans.push(...loans);
  s.visits.push(...visits);
  return { groups: groups.length, members: members.length, loans: loans.length, visits: visits.length };
}

/** Support-module examples as [route, body] pairs; each is validated by the real route handlers. */
export function bulkSupportExamples(s, today) {
  const groups = s.groups.filter(g => NEW_GROUPS.some(x => x[0] === g.id));
  const date = d => addDays(today, -d);
  const out = [];
  const person = (id, name, kind, currency, groupId, source, memberId = null) =>
    out.push([
      'people',
      {
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
      },
    ]);
  // Workers: pay periods with on-time, late, short and unknown receipts; some with debt and deductions.
  for (let w = 0; w < 14; w++) {
    const overseas = w % 3 === 0,
      currency = overseas ? ['AED', 'SAR'][w % 2] : 'INR',
      group = groups[w % groups.length].id;
    const id = `bulk-worker-${String(w).padStart(2, '0')}`,
      name = `${MALE[w % MALE.length]} ${LAST[(w * 5) % LAST.length]}`;
    person(
      id,
      overseas ? `${name} / family` : name,
      overseas ? 'overseas-worker' : 'domestic-worker',
      currency,
      group,
      overseas ? 'family' : 'worker'
    );
    const wage = overseas ? 1500 + w * 20 : 14000 + w * 400;
    for (let p = 0; p < 3; p++) {
      const start = date(120 - p * 30),
        end = addDays(start, 29),
        due = addDays(end, 3),
        payId = `${id}-pay-${p}`;
      out.push([
        'pay',
        {
          id: payId,
          personId: id,
          source: overseas ? 'family' : 'worker',
          label: `Month ${p + 1}`,
          periodStart: start,
          periodEnd: end,
          dueDate: due,
          expected: wage,
          currency,
          notes: '',
        },
      ]);
      const outcome = (w + p) % 5;
      if (outcome === 4) continue; // no receipt recorded: unconfirmed, not non-payment
      const amount = outcome === 3 ? Math.round(wage * 0.7) : outcome === 2 ? null : wage;
      out.push([
        'receipts',
        {
          id: `${payId}-rcpt`,
          personId: id,
          source: overseas ? 'family' : 'worker',
          payId,
          date: addDays(due, outcome === 1 ? 12 : 0),
          amount,
          notes: '',
        },
      ]);
    }
    if (w % 2 === 0) {
      const debtId = `${id}-debt`;
      out.push([
        'debts',
        {
          id: debtId,
          personId: id,
          source: overseas ? 'family' : 'worker',
          date: date(100),
          kind: overseas ? 'recruitment' : 'advance',
          label: overseas ? 'Reported recruitment fee loan' : 'Reported work advance',
          opening: overseas ? 90000 : 15000 + w * 500,
          currency: 'INR',
          disputed: w % 4 === 0,
          notes: 'Amount reported by worker; not a verified legal obligation',
        },
      ]);
      out.push([
        'debt-entries',
        {
          id: `${debtId}-e1`,
          personId: id,
          source: overseas ? 'family' : 'worker',
          debtId,
          date: date(50),
          kind: 'repayment',
          amount: 2000,
          notes: '',
        },
      ]);
    }
    if (w % 3 === 1)
      out.push([
        'deductions',
        {
          id: `${id}-ded`,
          personId: id,
          source: 'worker',
          payId: `${id}-pay-0`,
          date: date(70),
          label: 'Accommodation charge',
          amount: 1200,
          status: w % 2 ? 'disputed' : 'agreed',
          notes: '',
        },
      ]);
  }
  // Prospective members ("second chance"): voluntary participation records, a few human reviews.
  for (let k = 0; k < 10; k++) {
    const id = `bulk-prospect-${String(k).padStart(2, '0')}`,
      group = groups[(k + 1) % groups.length].id;
    person(
      id,
      `${FIRST[(k * 3) % FIRST.length]} ${LAST[(k * 5 + 2) % LAST.length]}`,
      'prospective',
      'INR',
      group,
      'member'
    );
    for (let m = 0; m < 2 + (k % 4); m++)
      out.push([
        'participation',
        {
          id: `${id}-part-${m}`,
          personId: id,
          source: 'member',
          date: date(70 - m * 14),
          attendance: (k + m) % 5 === 0 ? 'absent' : 'present',
          savings: (k + m) % 4 === 0 ? null : 100 + m * 50,
          currency: 'INR',
          notes: '',
        },
      ]);
    if (k % 3 === 0)
      out.push([
        'reviews',
        {
          id: `${id}-review`,
          personId: id,
          source: 'member',
          date: date(5),
          outcome: ['reviewed', 'awaiting-information', 'accepted-externally'][(k / 3) % 3],
          reason: 'Reviewed in person by a supervisor; no score or automated decision used',
          notes: '',
        },
      ]);
  }
  // Livelihood checks.
  for (let k = 0; k < 8; k++) {
    const id = `bulk-livelihood-${String(k).padStart(2, '0')}`,
      group = groups[(k + 2) % groups.length].id;
    person(
      id,
      `${FIRST[(k * 5 + 1) % FIRST.length]} ${LAST[(k * 3) % LAST.length]}`,
      'livelihood',
      'INR',
      group,
      'member'
    );
    out.push([
      'assets',
      {
        id: `${id}-check`,
        personId: id,
        source: 'member',
        date: date(14 + k),
        intended: ['Two goats', 'Sewing machine', 'Dairy cow', 'Vegetable cart'][k % 4],
        actual: ['Two goats', 'Sewing machine', 'Dairy cow', 'Vegetable cart'][k % 4],
        functioning: ['working', 'working', 'partly-working', 'not-working'][k % 4],
        explanation: k % 4 === 3 ? 'Household reports the animal fell ill.' : '',
        officerNotes: '',
        notes: '',
      },
    ]);
  }
  return out;
}
