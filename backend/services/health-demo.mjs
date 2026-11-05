import { randomUUID } from 'node:crypto';
import { addDays } from '../../shared/health.mjs';

// Explicitly loaded only in synthetic demo workspaces; never run in private mode.
export function householdDemo(s, today, user) {
  const at = new Date().toISOString(),
    services = [
      {
        name: 'Demo household budgeting session',
        provider: 'Demo NGO field team',
        type: 'planning',
        details: 'Example only: plan essential spending around irregular income.',
        accessNotes: 'Example service. Replace with your NGO’s actual programme.',
      },
      {
        name: 'Demo emergency assistance referral',
        provider: 'Demo commune referral desk',
        type: 'referral',
        details: 'Example only: help a household contact an assistance programme.',
        accessNotes: 'Availability must be confirmed by staff. No automatic referral is sent.',
      },
    ].map(x => ({ ...x, id: randomUUID(), active: true, version: 1, updatedAt: at }));
  s.services.push(...services);
  for (const [index, m] of s.members.slice(0, 3).entries()) {
    const date = addDays(today, -120 + index * 12),
      id = randomUUID();
    const baseline = {
      id,
      memberId: m.id,
      date,
      periodStart: addDays(date, -29),
      response: 'answered',
      voluntaryConfirmed: true,
      shortfallDays: 8 + index * 2,
      essentials: ['food', 'utilities'],
      causes: ['delayed-income'],
      currency: m.currency || s.settings.currency,
      income: 18000,
      expenses: 20000,
      borrowing: 'yes',
      stress: 3,
      supportPreference: index < 2 ? 'requested' : 'not-requested',
      explanation: 'Synthetic example: customer payments arrived after essential bills.',
      officerNotes: 'Synthetic example for exploring the workflow.',
      planId: null,
      milestone: null,
      visitId: null,
      supportHelpfulness: 'unknown',
      createdBy: user.name,
      createdById: user.id,
      createdAt: at,
      voided: false,
      version: 1,
    };
    s.checkins.push(baseline);
    if (index === 2) continue;
    const planId = randomUUID(),
      f = {
        id: randomUUID(),
        memberId: m.id,
        title: index ? 'Example assistance referral' : 'Example budgeting support',
        assigneeId: user.id,
        assignee: user.name,
        dueDate: addDays(date, 7),
        status: index ? 'in-progress' : 'resolved',
        notes: 'Synthetic demonstration; no actual support provided.',
        resolution: index ? '' : 'Example: support completed; outcomes recorded separately.',
        createdBy: user.name,
        createdAt: at,
        updatedAt: at,
        version: 1,
      };
    s.followups.push(f);
    s.supportPlans.push({
      id: planId,
      memberId: m.id,
      baselineId: id,
      followupId: f.id,
      serviceId: services[index].id,
      serviceName: services[index].name,
      provider: services[index].provider,
      action: f.title,
      startDate: date,
      dueDate: f.dueDate,
      assigneeId: user.id,
      assignee: user.name,
      status: f.status,
      deliveryStatus: index ? 'not-received' : 'received',
      requestedDate: addDays(date, 1),
      receivedDate: index ? null : addDays(date, 4),
      endedDate: index ? null : addDays(date, 10),
      deliveryNotes: index
        ? 'Example: programme unavailable. Staff are checking alternatives.'
        : 'Example: session completed.',
      notes: f.notes,
      resolution: f.resolution,
      agreed: true,
      createdBy: user.name,
      createdById: user.id,
      createdAt: at,
      updatedAt: at,
      version: 1,
      history: [],
    });
    for (const day of [30, 90])
      s.checkins.push({
        ...baseline,
        id: randomUUID(),
        date: addDays(date, day),
        periodStart: addDays(date, day - 29),
        planId,
        milestone: day,
        shortfallDays: index ? null : day === 30 ? 4 : 2,
        response: index ? 'unavailable' : 'answered',
        voluntaryConfirmed: !index,
        essentials: index ? [] : ['food'],
        causes: index ? [] : ['delayed-income'],
        income: index ? null : 1100000,
        expenses: index ? null : 900000,
        stress: index ? null : 1,
        borrowing: index ? 'unknown' : 'no',
        supportPreference: index ? 'declined' : 'not-requested',
        explanation: index ? '' : 'Synthetic example: household reports more predictable receipts.',
        supportHelpfulness: index ? 'unknown' : 'partly',
      });
  }
  if (s.members[0])
    s.cashflow.push(
      {
        id: randomUUID(),
        memberId: s.members[0].id,
        date: addDays(today, 2),
        kind: 'expense',
        amount: 3000,
        currency: s.members[0].currency || s.settings.currency,
        label: 'Example essential bills',
        notes: 'Synthetic expected entry',
        createdById: user.id,
        createdBy: user.name,
        createdAt: at,
        cancelled: false,
        version: 1,
      },
      {
        id: randomUUID(),
        memberId: s.members[0].id,
        date: addDays(today, 5),
        kind: 'income',
        amount: 5000,
        currency: s.members[0].currency || s.settings.currency,
        label: 'Example shop receipts',
        notes: 'Synthetic expected entry',
        createdById: user.id,
        createdBy: user.name,
        createdAt: at,
        cancelled: false,
        version: 1,
      }
    );
}
