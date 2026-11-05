import { dualCurrencyProjection } from '../../shared/health.mjs';
import { randomUUID } from 'node:crypto';
import { assert, str, date, json } from '../middleware/http.mjs';
import { memberAccess, requireRole, scopedWorkspace } from '../services/access.mjs';
import { localDate } from '../services/dates.mjs';
import { validMoney, CURRENCIES } from '../../shared/catalog.mjs';
import { ESSENTIALS, CAUSES, DELIVERY, addDays, outcomeReport } from '../../shared/health.mjs';
import { householdDemo } from '../services/health-demo.mjs';

const text = (value, max = 1000) => {
  assert(str(value ?? '', 0, max), 'Text is too long');
  return (value || '').trim();
};
const identity = b => {
  assert(typeof b.id === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(b.id), 'Valid record identifier required');
  return b.id;
};
const canonical = v =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x
  );
const choices = (value, allowed) =>
  Array.isArray(value) &&
  value.length <= allowed.length &&
  new Set(value).size === value.length &&
  value.every(x => allowed.includes(x));
export function healthRoutes({ req, res, url, b, s, user, repository, demo, audit }) {
  const path = url.pathname,
    method = req.method,
    today = localDate(s.config.timeZone);
  const save = message => {
    audit(s, user, message);
    repository.save(s);
  };
  const staff = () => [
    { id: 'admin', name: demo ? 'Asha Patil' : 'Administrator', role: 'admin', active: true },
    ...repository.listStaff(),
  ];
  const assignee = (id, member) => {
    const target = staff().find(u => u.id === id);
    assert(
      target?.active && (target.role !== 'officer' || target.groupIds.includes(member.groupId)),
      'Choose active staff assigned to this household'
    );
    assert(user.role !== 'officer' || target.id === user.id, 'Officers can assign only to themselves', 403);
    return target;
  };
  const editable = p => {
    memberAccess(s, user, p.memberId);
    assert(
      user.role !== 'officer' || p.assigneeId === user.id,
      'Only the assigned officer or supervisor can update this support plan',
      403
    );
  };
  const capture = () => {
    assert(!b.capturedBy || b.capturedBy === user.id, 'This offline record belongs to another staff account', 403);
  };
  if (path === '/api/health/demo' && method === 'POST') {
    requireRole(user, 'admin');
    assert(demo, 'Sample records are available only in demo mode', 403);
    assert(
      !s.checkins.length && !s.supportPlans.length && !s.services.length && !s.cashflow.length,
      'Household records already exist. Sample data will not overwrite them.',
      409
    );
    assert(s.members.length >= 3, 'Three sample members are needed');
    householdDemo(s, today, user);
    save('Loaded synthetic household support examples');
    json(res, 201, { ok: true });
    return true;
  }
  if (path === '/api/health/household-link' && method === 'POST') {
    requireRole(user, 'admin', 'supervisor');
    const source = memberAccess(s, user, b.memberId);
    assert(b.confirmed === true, 'Confirm that these members report for the same household');
    const target = b.targetMemberId ? memberAccess(s, user, b.targetMemberId) : null;
    assert(!target || target.id !== source.id, 'Choose another member or a separate household');
    source.householdKey = target ? target.householdKey || target.id : randomUUID();
    save(`Updated reporting household link for ${source.id}`);
    json(res, 200, { ok: true });
    return true;
  }
  if (path === '/api/health/outcomes' && method === 'GET') {
    const asOf = url.searchParams.get('asOf') || today,
      from = url.searchParams.get('from') || '1900-01-01',
      to = url.searchParams.get('to') || today;
    assert(date(asOf) && asOf <= today && date(from) && date(to) && from <= to, 'Check the reporting dates');
    const scoped = scopedWorkspace(s, user, staff()),
      groupId = url.searchParams.get('groupId') || '';
    assert(!groupId || scoped.groups.some(g => g.id === groupId), 'Group is not available', 403);
    json(res, 200, outcomeReport(scoped, { asOf, from, to, groupId }));
    return true;
  }
  if (path === '/api/health/checkins' && method === 'POST') {
    capture();
    const id = identity(b),
      member = memberAccess(s, user, b.memberId);
    assert(date(b.date) && b.date <= today, 'Check-in date cannot be in the future');
    assert(['answered', 'declined', 'unavailable'].includes(b.response), 'Choose a response status');
    const answered = b.response === 'answered';
    assert(!answered || b.voluntaryConfirmed === true, 'Confirm the household freely agreed to answer');
    assert(
      b.shortfallDays === null || (Number.isInteger(b.shortfallDays) && b.shortfallDays >= 0 && b.shortfallDays <= 30),
      'Shortfall days must be unknown or 0–30'
    );
    assert(
      choices(b.essentials, ESSENTIALS) && choices(b.causes, CAUSES),
      'Check essentials and contributing circumstances'
    );
    assert(
      !b.causes.includes('unknown') || b.causes.length === 1,
      'Choose unknown by itself, or select the reported circumstances'
    );
    assert(b.shortfallDays !== 0 || !b.essentials.length, 'A zero-day report cannot list unmet essentials');
    assert(CURRENCIES.includes(b.currency), 'Choose a supported currency');
    for (const key of ['income', 'expenses'])
      assert(b[key] === null || validMoney(b[key], b.currency), 'Amounts must be unknown or valid for this currency');
    assert(['yes', 'no', 'unknown', 'declined'].includes(b.borrowing), 'Choose a borrowing response');
    assert(
      b.stress === null || (Number.isInteger(b.stress) && b.stress >= 0 && b.stress <= 4),
      'Stress must be unknown or 0–4'
    );
    assert(
      ['requested', 'not-requested', 'undecided', 'declined'].includes(b.supportPreference),
      'Record the household support preference'
    );
    if (!answered)
      assert(
        b.shortfallDays === null &&
          b.income === null &&
          b.expenses === null &&
          b.stress === null &&
          !b.essentials.length &&
          !b.causes.length &&
          !b.explanation &&
          b.borrowing === 'unknown' &&
          b.supportPreference === 'declined',
        'Declined or unavailable check-ins cannot contain household answers'
      );
    const plan = b.planId ? s.supportPlans.find(p => p.id === b.planId) : null;
    if (b.planId) {
      assert(plan && plan.memberId === member.id, 'Support plan belongs to another household');
      assert([30, 90].includes(b.milestone), 'Choose a 30- or 90-day follow-up');
      const base = s.checkins.find(c => c.id === plan.baselineId);
      assert(base && !base.voided, 'Baseline was voided; create a replacement support plan');
      assert(
        b.date >= addDays(base.date, b.milestone) && b.date >= plan.startDate,
        'This follow-up is earlier than its milestone or support plan start'
      );
    } else assert(!b.milestone, 'A milestone requires a support plan');
    if (b.visitId)
      assert(
        s.visits.some(v => v.id === b.visitId && v.memberId === member.id && v.date === b.date),
        'Linked visit must be for this household and date'
      );
    const payload = {
      id,
      memberId: member.id,
      date: b.date,
      periodStart: addDays(b.date, -29),
      response: b.response,
      voluntaryConfirmed: answered,
      shortfallDays: b.shortfallDays,
      essentials: b.essentials,
      causes: b.causes,
      currency: b.currency,
      income: b.income,
      expenses: b.expenses,
      borrowing: b.borrowing,
      stress: b.stress,
      supportPreference: b.supportPreference,
      explanation: text(b.explanation),
      officerNotes: text(b.officerNotes),
      planId: plan?.id || null,
      milestone: plan ? b.milestone : null,
      visitId: b.visitId || null,
      supportHelpfulness: plan && answered ? b.supportHelpfulness || 'unknown' : 'unknown',
    };
    assert(
      ['helped', 'partly', 'not-helped', 'unknown', 'declined'].includes(payload.supportHelpfulness),
      'Choose a support feedback response'
    );
    const existing = s.checkins.find(c => c.id === id);
    if (existing) {
      assert(
        existing.createdById === user.id && existing.requestKey === canonical(payload),
        'Identifier already used with different answers',
        409
      );
      json(res, 200, existing);
      return true;
    }
    const householdIds = new Set(
      s.members.filter(m => (m.householdKey || m.id) === (member.householdKey || member.id)).map(m => m.id)
    );
    assert(
      !s.checkins.some(c => !c.voided && householdIds.has(c.memberId) && c.date === b.date),
      'A check-in already exists for this reporting household and date',
      409
    );
    const checkin = {
      ...payload,
      requestKey: canonical(payload),
      createdBy: user.name,
      createdById: user.id,
      createdAt: new Date().toISOString(),
      voided: false,
      version: 1,
    };
    s.checkins.push(checkin);
    save(`Recorded household check-in ${id} (${b.response})`);
    json(res, 201, checkin);
    return true;
  }
  let match = path.match(/^\/api\/health\/checkins\/([^/]+)\/void$/);
  if (match && method === 'POST') {
    requireRole(user, 'admin', 'supervisor');
    const c = s.checkins.find(c => c.id === match[1]);
    assert(c, 'Check-in not found', 404);
    memberAccess(s, user, c.memberId);
    assert(b.version === c.version && !c.voided, 'Check-in changed; reload first', 409);
    assert(str(b.reason, 5, 500), 'Explain why this report is being voided');
    Object.assign(c, {
      voided: true,
      voidReason: b.reason.trim(),
      voidedBy: user.name,
      voidedAt: new Date().toISOString(),
      version: c.version + 1,
    });
    save(`Voided household check-in ${c.id}`);
    json(res, 200, c);
    return true;
  }
  if (
    (path === '/api/health/services' && method === 'POST') ||
    ((match = path.match(/^\/api\/health\/services\/([^/]+)$/)) && method === 'PATCH')
  ) {
    requireRole(user, 'admin', 'supervisor');
    assert(
      str(b.name) &&
        str(b.provider) &&
        ['assistance', 'referral', 'planning', 'livelihood', 'other'].includes(b.type) &&
        typeof b.active === 'boolean',
      'Complete service name, provider, type and availability'
    );
    const old = match ? s.services.find(x => x.id === match[1]) : null;
    if (match) assert(old, 'Service not found', 404);
    if (old) assert(old.version === b.version, 'Service changed; reload first', 409);
    const service = {
      id: old?.id || randomUUID(),
      name: b.name.trim(),
      provider: b.provider.trim(),
      type: b.type,
      active: b.active,
      details: text(b.details),
      accessNotes: text(b.accessNotes),
      version: (old?.version || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    if (old) s.services[s.services.indexOf(old)] = service;
    else s.services.push(service);
    save(`${old ? 'Updated' : 'Added'} support service ${service.id}`);
    json(res, old ? 200 : 201, service);
    return true;
  }
  if (path === '/api/health/plans' && method === 'POST') {
    capture();
    const id = identity(b),
      member = memberAccess(s, user, b.memberId),
      existing = s.supportPlans.find(p => p.id === id);
    const requestKey = canonical(b);
    if (existing) {
      assert(
        existing.createdById === user.id && existing.requestKey === requestKey,
        'Identifier already used for a different support plan',
        409
      );
      json(res, 200, existing);
      return true;
    }
    const baseline = s.checkins.find(c => c.id === b.baselineId && !c.voided && c.memberId === member.id);
    assert(
      baseline && baseline.response === 'answered' && baseline.supportPreference === 'requested',
      'Select a valid check-in where the household requested support'
    );
    assert(b.agreed === true, 'Confirm the household agreed to this support plan');
    assert(
      str(b.action) &&
        date(b.startDate) &&
        b.startDate >= baseline.date &&
        b.startDate <= today &&
        date(b.dueDate) &&
        b.dueDate >= b.startDate,
      'Check the action, start and follow-up dates'
    );
    const service = b.serviceId ? s.services.find(x => x.id === b.serviceId && x.active) : null;
    assert(!b.serviceId || service, 'Select an available service');
    const target = assignee(b.assigneeId, member),
      at = new Date().toISOString();
    const f = {
      id: randomUUID(),
      memberId: member.id,
      title: b.action.trim(),
      assigneeId: target.id,
      assignee: target.name,
      dueDate: b.dueDate,
      status: 'open',
      notes: text(b.notes),
      resolution: '',
      createdBy: user.name,
      createdAt: at,
      updatedAt: at,
      version: 1,
    };
    const plan = {
      id,
      memberId: member.id,
      baselineId: baseline.id,
      followupId: f.id,
      serviceId: service?.id || null,
      serviceName: service?.name || 'Other agreed support',
      provider: service?.provider || '',
      action: b.action.trim(),
      startDate: b.startDate,
      dueDate: b.dueDate,
      assigneeId: target.id,
      assignee: target.name,
      status: 'open',
      deliveryStatus: 'suggested',
      requestedDate: null,
      receivedDate: null,
      deliveryNotes: '',
      notes: text(b.notes),
      resolution: '',
      endedDate: null,
      agreed: true,
      createdBy: user.name,
      createdById: user.id,
      createdAt: at,
      updatedAt: at,
      version: 1,
      requestKey,
      history: [],
    };
    s.followups.push(f);
    s.supportPlans.push(plan);
    save(`Created household support plan ${id}`);
    json(res, 201, plan);
    return true;
  }
  match = path.match(/^\/api\/health\/plans\/([^/]+)$/);
  if (match && method === 'PATCH') {
    capture();
    const p = s.supportPlans.find(p => p.id === match[1]);
    assert(p, 'Support plan not found', 404);
    editable(p);
    assert(str(b.operationId, 8, 80), 'Update identifier required');
    const key = canonical(b),
      retry = p.history.find(h => h.operationId === b.operationId);
    if (retry) {
      assert(retry.requestKey === key, 'Update identifier already used', 409);
      json(res, 200, p);
      return true;
    }
    assert(p.version === b.version, 'This plan changed; reload before updating', 409);
    assert(
      DELIVERY.includes(b.deliveryStatus) &&
        ['open', 'in-progress', 'resolved'].includes(b.status) &&
        date(b.dueDate) &&
        b.dueDate >= p.startDate,
      'Check status and follow-up date'
    );
    for (const value of [b.requestedDate, b.receivedDate, b.endedDate])
      assert(
        !value || (date(value) && value >= p.startDate && value <= today),
        'Support dates must fall between plan start and today'
      );
    assert(b.deliveryStatus !== 'received' || date(b.receivedDate), 'Record the date support was received');
    assert(b.deliveryStatus !== 'requested' || date(b.requestedDate), 'Record the date support was requested');
    assert(
      !b.requestedDate || !b.receivedDate || b.requestedDate <= b.receivedDate,
      'Received date cannot precede request date'
    );
    assert(
      !['not-received', 'cancelled'].includes(b.deliveryStatus) || str(b.deliveryNotes, 5, 1000),
      'Explain why support was not received or was cancelled'
    );
    assert(
      b.status !== 'resolved' || str(b.resolution, 5, 1000),
      'Record a closure reason; closure does not imply improvement'
    );
    const member = memberAccess(s, user, p.memberId),
      target = assignee(b.assigneeId || p.assigneeId, member),
      at = new Date().toISOString();
    const next = {
      deliveryStatus: b.deliveryStatus,
      status: b.status,
      dueDate: b.dueDate,
      requestedDate: b.requestedDate || null,
      receivedDate: b.deliveryStatus === 'received' ? b.receivedDate : null,
      endedDate: b.endedDate || null,
      deliveryNotes: text(b.deliveryNotes),
      resolution: text(b.resolution),
      assigneeId: target.id,
      assignee: target.name,
    };
    assert(
      !next.endedDate || !next.receivedDate || next.endedDate >= next.receivedDate,
      'Support end cannot precede receipt'
    );
    p.history.push({
      operationId: b.operationId,
      requestKey: key,
      at,
      actor: user.name,
      before: Object.fromEntries(Object.keys(next).map(k => [k, p[k]])),
      after: next,
    });
    Object.assign(p, next, { version: p.version + 1, updatedAt: at });
    const f = s.followups.find(f => f.id === p.followupId);
    Object.assign(f, {
      status: p.status,
      dueDate: p.dueDate,
      assigneeId: p.assigneeId,
      assignee: p.assignee,
      resolution: p.resolution,
      version: f.version + 1,
      updatedAt: at,
    });
    save(`Updated household support plan ${p.id} (${p.deliveryStatus})`);
    json(res, 200, p);
    return true;
  }
  if (path === '/api/health/scenarios' && method === 'POST') {
    capture();
    const id = identity(b),
      member = memberAccess(s, user, b.memberId);
    assert(
      str(b.label, 1, 120) && b.assumptions && Array.isArray(b.entries) && b.entries.length <= 2000,
      'Name the scenario and include its expected entries'
    );
    for (const e of b.entries)
      assert(
        date(e.date) &&
          str(e.label) &&
          CURRENCIES.includes(e.currency) &&
          validMoney(e.amount, e.currency) &&
          e.amount > 0 &&
          ['income', 'expense'].includes(e.kind),
        'Check scenario entries'
      );
    let result;
    try {
      result = dualCurrencyProjection(b.entries, b.assumptions);
    } catch (e) {
      assert(false, e.message);
    }
    assert(
      date(result.assumptions.rateDate) &&
        result.assumptions.rateDate <= today &&
        date(result.assumptions.from) &&
        date(result.assumptions.to),
      'Check the planning and rate dates'
    );
    const payload = {
      id,
      memberId: member.id,
      label: b.label.trim(),
      assumptions: result.assumptions,
      entries: b.entries.map(e => ({
        id: e.id || null,
        date: e.date,
        label: e.label,
        kind: e.kind,
        currency: e.currency,
        amount: e.amount,
        cancelled: !!e.cancelled,
      })),
    };
    const existing = s.scenarios.find(e => e.id === id);
    if (existing) {
      assert(
        existing.createdById === user.id && existing.requestKey === canonical(payload),
        'Scenario identifier already used with different assumptions',
        409
      );
      json(res, 200, existing);
      return true;
    }
    const scenario = {
      ...payload,
      result,
      requestKey: canonical(payload),
      createdById: user.id,
      createdBy: user.name,
      createdAt: new Date().toISOString(),
      version: 1,
    };
    s.scenarios.push(scenario);
    save(`Saved cash-flow scenario ${id}`);
    json(res, 201, scenario);
    return true;
  }
  if (path === '/api/health/cashflow' && method === 'POST') {
    capture();
    const id = identity(b),
      member = memberAccess(s, user, b.memberId);
    assert(
      date(b.date) &&
        ['income', 'expense'].includes(b.kind) &&
        CURRENCIES.includes(b.currency) &&
        validMoney(b.amount, b.currency) &&
        b.amount > 0 &&
        str(b.label),
      'Check expected date, label, currency and amount'
    );
    const payload = {
      id,
      memberId: member.id,
      date: b.date,
      kind: b.kind,
      currency: b.currency,
      amount: b.amount,
      label: b.label.trim(),
      notes: text(b.notes),
    };
    const existing = s.cashflow.find(e => e.id === id);
    if (existing) {
      assert(
        existing.createdById === user.id && existing.requestKey === canonical(payload),
        'Identifier already used',
        409
      );
      json(res, 200, existing);
      return true;
    }
    const entry = {
      ...payload,
      requestKey: canonical(payload),
      createdById: user.id,
      createdBy: user.name,
      createdAt: new Date().toISOString(),
      cancelled: false,
      version: 1,
    };
    s.cashflow.push(entry);
    save(`Added expected household cash flow ${id}`);
    json(res, 201, entry);
    return true;
  }
  match = path.match(/^\/api\/health\/cashflow\/([^/]+)\/cancel$/);
  if (match && method === 'POST') {
    const entry = s.cashflow.find(e => e.id === match[1]);
    assert(entry, 'Entry not found', 404);
    memberAccess(s, user, entry.memberId);
    assert(
      user.role !== 'officer' || entry.createdById === user.id,
      'Only the creator or supervisor may cancel this entry',
      403
    );
    assert(entry.version === b.version && !entry.cancelled, 'Entry changed; reload first', 409);
    assert(str(b.reason, 5, 500), 'Explain the cancellation');
    Object.assign(entry, {
      cancelled: true,
      cancelReason: b.reason.trim(),
      cancelledBy: user.name,
      cancelledAt: new Date().toISOString(),
      version: entry.version + 1,
    });
    save(`Cancelled expected cash flow ${entry.id}`);
    json(res, 200, entry);
    return true;
  }
  return false;
}
