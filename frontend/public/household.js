import { CURRENCIES } from '../../shared/catalog.mjs';
import {
  ESSENTIALS,
  CAUSES,
  DELIVERY,
  addDays,
  outcomeReport,
  cashflowProjection,
  dualCurrencyProjection,
} from '../../shared/health.mjs';
import { translate, activeLanguage, t } from './i18n.js';

export function createHouseholdUI(ctx) {
  const { api, esc, money, field, select, opts, button, heading, openModal, formHtml, handleForm, toast } = ctx;
  const state = () => ctx.getState(),
    $ = s => document.querySelector(s),
    today = ctx.today;
  let healthView = 'households',
    healthGroup = '',
    healthQuery = '',
    reportFilters = { from: '', to: '', asOf: '', groupId: '' };
  const names = {
    food: 'Food',
    housing: 'Housing',
    utilities: 'Utilities',
    healthcare: 'Healthcare',
    education: 'Education',
    transport: 'Transport',
    other: 'Other',
    'delayed-income': 'Delayed income',
    'income-drop': 'Lower income',
    'expense-increase': 'Higher expenses',
    'debt-payments': 'Debt payments',
    'seasonal-income': 'Seasonal income',
    unknown: 'Unknown',
    answered: 'Answered',
    declined: 'Prefer not to answer',
    unavailable: 'Could not reach the family',
    'not-requested': 'No help requested',
    requested: 'Help requested',
    undecided: 'Undecided',
    suggested: 'Suggested',
    received: 'Received',
    'not-received': 'Not received',
    cancelled: 'Cancelled',
    open: 'Open',
    'in-progress': 'In progress',
    resolved: 'Closed',
    helped: 'Helped',
    partly: 'Partly helped',
    'not-helped': 'Did not help',
  };
  const label = value => t(names[value] || value, activeLanguage(state()));
  const named = items => items.map(id => ({ id, name: label(id) }));
  const member = id => state().members.find(m => m.id === id);
  const safeName = id => `<span data-no-translate>${esc(member(id)?.name || id)}</span>`;
  const rows = (headers, body) =>
    `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body.join('')}</tbody></table>${body.length ? '' : '<div class="empty">No records yet.</div>'}</div>`;
  const section = title => `<h3 class="form-section">${title}</h3>`;
  const note = (label, name, value = '', help = '') =>
    `<label class="field wide"><span>${label}</span>${help ? `<span class="field-help">${help}</span>` : ''}<textarea name="${name}" maxlength="1000">${esc(value)}</textarea></label>`;
  const choice = (label, name, values, selected, wide = false) =>
    select(label, name, opts(named(values), 'id', 'name', selected), wide);
  const nullable = (label, name, type = 'number', max = 100000000) =>
    field(
      label,
      name,
      type,
      '',
      `min="0" max="${max}" step="${max === 30 || max === 4 ? '1' : '0.01'}" placeholder="Unknown / prefer not to answer"`
    );
  const metric = (title, value, detail) =>
    `<div class="health-metric"><small>${title}</small><strong>${value}</strong><p>${detail}</p></div>`;
  const response = c =>
    c.voided
      ? 'Voided'
      : c.response !== 'answered'
        ? label(c.response)
        : c.shortfallDays === null
          ? 'Days unknown'
          : `${c.shortfallDays} / 30 days`;
  const family = id =>
    new Set(
      state()
        .members.filter(m => (m.householdKey || m.id) === (member(id)?.householdKey || id))
        .map(m => m.id)
    );
  const latest = id =>
    state()
      .checkins.filter(c => family(id).has(c.memberId) && !c.voided)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  const staffFor = id =>
    state().staff.filter(u => u.active && (u.role !== 'officer' || u.groupIds.includes(member(id)?.groupId)));
  async function send(path, method, payload, kind) {
    if (!navigator.onLine) {
      await ctx.operationsUI.queueHealth(path, method, payload, kind);
      toast('Saved encrypted on this device. Reconnect and sync.');
    } else await api(path, method, payload);
  }
  function healthPage() {
    const members = state().members.filter(
      m =>
        (!healthGroup || m.groupId === healthGroup) &&
        (!healthQuery || `${m.name} ${m.id}`.toLowerCase().includes(healthQuery.toLowerCase()))
    );
    return (
      heading(
        'Everyday money needs',
        'Household support',
        'Find out when a family cannot cover everyday needs. Agree on help, then check back.',
        button('Check in with a family', 'hh-check') + button('Plan help', 'hh-plan', 'calendar', true)
      ) +
      `<div class="health-intro"><div><strong>Start with a conversation</strong><p>Ask about the last 30 days. People can skip questions. Answers do not decide whether they get a loan.</p></div><button class="text-btn" data-nav="services">Help available →</button></div>
      ${state().demo && state().user.role === 'admin' && !state().checkins.length && !state().services.length ? '<div class="review-strip">Try this screen with made-up household records.<button class="text-btn" data-action="hh-demo">Load sample household records</button></div>' : ''}
      <div class="health-view-switch" aria-label="Support view"><button data-action="hh-view" data-view="households" aria-pressed="${healthView === 'households'}">Reporting members</button><button data-action="hh-view" data-view="plans" aria-pressed="${healthView === 'plans'}">Support plans</button><button class="text-btn" data-nav="outcomes">View outcomes →</button></div>
      <section class="panel"><div class="table-toolbar"><label class="search"><input id="health-search" aria-label="Search households" placeholder="Search by name or member ID…" value="${esc(healthQuery)}"></label><select id="health-group" class="filter" aria-label="Community group"><option value="">All groups</option>${opts(state().groups, 'id', 'name', healthGroup)}</select></div><div id="health-rows">${healthView === 'households' ? householdRows(members) : planRows(state().supportPlans.filter(p => members.some(m => m.id === p.memberId)))}</div></section><p class="field-help">${healthView === 'plans' ? 'Delivery and household outcomes are tracked separately.' : 'A supervisor can link members of the same household so the progress report counts that family once.'}</p>`
    );
  }
  function householdRows(members) {
    return rows(
      ['Reporting member', 'Latest check-in', 'Days short of money for everyday needs', 'Open support', ''],
      members.map(m => {
        const c = latest(m.id),
          open = state().supportPlans.filter(p => p.memberId === m.id && p.status !== 'resolved').length;
        return `<tr><td><strong data-no-translate>${esc(m.name)}</strong><div class="field-help">${esc(m.id)}</div></td><td>${c ? esc(c.date) : 'Not yet checked'}</td><td>${c ? esc(response(c)) : 'Unknown'}</td><td>${open}</td><td><div class="actions"><button class="text-btn" data-action="hh-timeline" data-id="${m.id}">History</button><button class="text-btn" data-action="hh-check" data-id="${m.id}">Check in</button>${state().user.role !== 'officer' ? `<button class="text-btn" data-action="hh-link" data-id="${m.id}">Household link</button>` : ''}</div></td></tr>`;
      })
    );
  }
  function planRows(plans) {
    return rows(
      ['Household / agreed action', 'Delivery', 'Owner / next action', 'Case', ''],
      plans.map(
        p =>
          `<tr><td>${safeName(p.memberId)}<div class="field-help" data-no-translate>${esc(p.action)}</div></td><td><span class="badge ${['not-received', 'cancelled'].includes(p.deliveryStatus) ? 'amber' : 'gray'}">${label(p.deliveryStatus)}</span></td><td><span data-no-translate>${esc(p.assignee)}</span><div class="field-help">${p.dueDate}</div></td><td>${label(p.status)}${p.status !== 'resolved' && p.dueDate < today() ? '<div class="field-help">Action overdue</div>' : ''}</td><td><button class="text-btn" data-action="hh-plan-open" data-id="${p.id}">Open plan</button></td></tr>`
      )
    );
  }
  function checks(name, values) {
    return `<div class="checkbox-grid">${values.map(value => `<label class="check"><input type="checkbox" name="${name}" value="${value}"><span>${label(value)}</span></label>`).join('')}</div>`;
  }
  function checkinModal(memberId, planId, milestone) {
    if (!state().members.length) {
      toast('Add a member first.');
      return;
    }
    const plan = state().supportPlans.find(p => p.id === planId),
      selected = plan?.memberId || memberId || state().members[0].id;
    const minDate = plan ? addDays(state().checkins.find(c => c.id === plan.baselineId).date, milestone) : '';
    const selectedDate = ctx.today(),
      id = crypto.randomUUID();
    openModal(
      plan ? 'Outcome check-in' : 'Check in with a family',
      'Ask in private. The person can skip a question or choose not to answer at all.',
      formHtml(
        section('Check-in details') +
          select('Member', 'memberId', opts(state().members, 'id', 'name', selected), true) +
          field(
            'Check-in date',
            'date',
            'date',
            selectedDate,
            `required max="${today()}" ${minDate ? `min="${minDate}"` : ''}`
          ) +
          choice('Response status', 'response', ['answered', 'declined', 'unavailable'], 'answered') +
          `<p class="field-help wide" id="recall-period"></p><div class="wide household-answers">${section('Previous 30 days')}<label class="check"><input type="checkbox" name="voluntaryConfirmed"><span>The family freely agreed to answer. Skipping questions will not affect their access to help or loans.</span></label><div class="form-grid health-answer-grid">${nullable('Days the family could not pay for everyday needs', 'shortfallDays', 'number', 30).replace('</label>', '<small class="field-help">Count each day once, even if several essentials were affected.</small></label>')}${nullable('Worry about money (0 = none; 4 = very high)', 'stress', 'number', 4)}<fieldset class="field wide"><legend>What could the family not afford?</legend>${checks('essentials', ESSENTIALS)}</fieldset><fieldset class="field wide"><legend>What does the family say caused the problem?</legend>${checks('causes', CAUSES)}</fieldset>${note('What the family says', 'explanation', '', 'Write what the family says. Do not guess the cause or enter private ID or medical details.')}${choice('Did they borrow for everyday needs or to repay debt?', 'borrowing', ['unknown', 'yes', 'no', 'declined'], 'unknown', true)}${choice('Would the family like help?', 'supportPreference', ['undecided', 'requested', 'not-requested', 'declined'], 'undecided', true)}${section('Optional household budget')}${select('Currency', 'currency', ctx.currencyOptions(CURRENCIES.includes(member(selected)?.currency) ? member(selected).currency : 'INR'), true)}${nullable('Income received in the previous 30 days', 'income')}${nullable('Total spending in the previous 30 days', 'expenses')}${plan ? choice('Did this support help?', 'supportHelpfulness', ['unknown', 'helped', 'partly', 'not-helped', 'declined'], 'unknown', true) : ''}</div></div>` +
          section('What the field worker saw') +
          note('Officer notes', 'officerNotes', '', 'Separate observations from household answers. Optional.'),
        'Save check-in',
        `<p class="field-help">A check-in is a dated household report, not a credit score. Leave numeric answers blank when unknown. Zero means none. ${plan ? `${milestone}-day outcome for the linked support plan.` : ''}</p>`
      )
    );
    const form = $('#modal-form'),
      memberInput = form.elements.memberId;
    if (plan) memberInput.disabled = true;
    const update = () => {
      const answered = form.elements.response.value === 'answered';
      form.querySelector('.household-answers').hidden = !answered;
      form
        .querySelectorAll('.household-answers input,.household-answers select,.household-answers textarea')
        .forEach(el => (el.disabled = !answered));
      $('#recall-period').textContent =
        `Recall period: ${addDays(form.elements.date.value, -29)} to ${form.elements.date.value} (30 days).`;
    };
    form.elements.response.addEventListener('change', update);
    form.elements.date.addEventListener('change', () => {
      if (form.elements.date.value) update();
    });
    update();
    handleForm(async b => {
      const answered = b.response === 'answered',
        num = key => (answered && b[key] !== '' && b[key] !== undefined ? Number(b[key]) : null);
      const payload = {
        id,
        memberId: plan ? selected : b.memberId,
        date: b.date,
        response: b.response,
        voluntaryConfirmed: answered && b.voluntaryConfirmed === 'on',
        shortfallDays: num('shortfallDays'),
        stress: num('stress'),
        income: num('income'),
        expenses: num('expenses'),
        currency: answered ? b.currency : member(plan ? selected : b.memberId)?.currency || 'INR',
        essentials: answered ? [...form.querySelectorAll('[name="essentials"]:checked')].map(e => e.value) : [],
        causes: answered ? [...form.querySelectorAll('[name="causes"]:checked')].map(e => e.value) : [],
        explanation: answered ? b.explanation : '',
        officerNotes: b.officerNotes,
        borrowing: answered ? b.borrowing : 'unknown',
        supportPreference: answered ? b.supportPreference : 'declined',
        planId: plan?.id || null,
        milestone: plan ? milestone : null,
        supportHelpfulness: answered ? b.supportHelpfulness || 'unknown' : 'unknown',
      };
      payload.visitId =
        state().visits.find(v => v.memberId === payload.memberId && v.date === payload.date)?.id || null;
      await send('/health/checkins', 'POST', payload, 'Check in with a family');
      toast(navigator.onLine ? 'Check in with a family saved.' : 'Check-in queued securely.');
    });
  }
  function planModal(memberId, baselineId) {
    const eligible = state().checkins.filter(
      c => !c.voided && c.response === 'answered' && c.supportPreference === 'requested'
    );
    if (!eligible.length) {
      toast('First add a check-in and record that the family wants help.');
      return;
    }
    if (memberId && !eligible.some(c => family(memberId).has(c.memberId))) {
      toast('This household needs a check-in requesting support first.');
      return;
    }
    const selected = memberId
      ? eligible.filter(c => family(memberId).has(c.memberId)).at(-1).memberId
      : eligible.at(-1).memberId;
    const baselines = id => eligible.filter(c => c.memberId === id).sort((a, b) => b.date.localeCompare(a.date));
    const baselineOptions = id =>
      opts(
        baselines(id).map(c => ({ id: c.id, name: `${c.date} · ${response(c)}` })),
        'id',
        'name',
        baselineId
      );
    const id = crypto.randomUUID();
    openModal(
      'Plan help',
      'Record the help agreed with the family. You still need to arrange the help yourself. The app does not approve help or send money.',
      formHtml(
        select(
          'Member',
          'memberId',
          opts(
            state().members.filter(m => eligible.some(c => c.memberId === m.id)),
            'id',
            'name',
            selected
          ),
          true
        ) +
          select('First check-in', 'baselineId', baselineOptions(selected), true) +
          select(
            'Service or referral',
            'serviceId',
            '<option value="">Other agreed support</option>' +
              opts(
                state()
                  .services.filter(x => x.active)
                  .map(x => ({ id: x.id, name: `${x.name} · ${x.provider}` }))
              ),
            true
          ).replace(' required', '') +
          field('Agreed action', 'action', 'text', '', 'required maxlength="120"', true) +
          select('Assigned to', 'assigneeId', opts(staffFor(selected), 'id', 'name', state().user.id)) +
          field('Plan start date', 'startDate', 'date', today(), `required max="${today()}"`) +
          field('Next follow-up date', 'dueDate', 'date', addDays(today(), 7), 'required', true) +
          note('Plan notes', 'notes') +
          `<label class="check field wide"><input type="checkbox" name="agreed" required><span>The family agreed to this action and understands what help is available.</span></label>`,
        'Plan help',
        `<p class="field-help">Check back 30 and 90 days after the first check-in. Referring someone does not mean they received help.</p>`
      )
    );
    const form = $('#modal-form');
    form.elements.memberId.addEventListener('change', () => {
      form.elements.baselineId.innerHTML = baselineOptions(form.elements.memberId.value);
      form.elements.assigneeId.innerHTML = opts(staffFor(form.elements.memberId.value), 'id', 'name', state().user.id);
    });
    handleForm(async b => {
      await send('/health/plans', 'POST', { ...b, id, agreed: b.agreed === 'on' }, 'Support plan');
      toast('Support plan recorded.');
    });
  }
  function openPlan(id) {
    const p = state().supportPlans.find(p => p.id === id),
      base = state().checkins.find(c => c.id === p.baselineId),
      canEdit = state().user.role !== 'officer' || p.assigneeId === state().user.id;
    const milestones = [30, 90]
      .map(day => {
        const due = addDays(base.date, day),
          end = addDays(due, 14),
          answers = state().checkins.filter(c => !c.voided && c.planId === p.id && c.milestone === day);
        return `<div class="outcome-task"><div><strong>${day}-day outcome</strong><p>${due} – ${end}</p><small>${answers.length ? `${answers.length} check-in(s) recorded` : 'No outcome recorded'}${base.voided ? ' · Baseline voided' : ''}</small></div><button class="btn secondary small" data-action="hh-outcome" data-id="${p.id}" data-day="${day}" ${today() < due || base.voided ? 'disabled' : ''}>Check in</button></div>`;
      })
      .join('');
    openModal(
      'Support plan',
      `${esc(member(p.memberId)?.name)} · ${esc(p.action)}`,
      `<div class="health-plan-summary"><p><strong data-no-translate>${esc(p.serviceName)}</strong> <span data-no-translate>${esc(p.provider)}</span></p><p data-no-translate>${esc(p.notes)}</p><span class="badge">${label(p.deliveryStatus)}</span> <span class="badge gray">${label(p.status)}</span></div>${base.voided ? '<div class="explain">The first check-in was marked incorrect. Keep its history, close this plan with a reason, then start a new plan from a correct check-in.</div>' : ''}<h3 class="section-title">Outcome check-ins</h3>${milestones}<p class="field-help">A closed follow-up or help received does not prove the family is better off. Reports more than 14 days after the 30- or 90-day check date stay in the history but are left out of comparisons.</p>${
        canEdit
          ? formHtml(
              section('Support delivery') +
                choice('Delivery status', 'deliveryStatus', DELIVERY, p.deliveryStatus) +
                choice('Follow-up status', 'status', ['open', 'in-progress', 'resolved'], p.status) +
                field('Date requested (optional)', 'requestedDate', 'date', p.requestedDate || '', `max="${today()}"`) +
                field('Date received (if received)', 'receivedDate', 'date', p.receivedDate || '', `max="${today()}"`) +
                field('Support ended (optional)', 'endedDate', 'date', p.endedDate || '', `max="${today()}"`) +
                field('Next follow-up date', 'dueDate', 'date', p.dueDate, 'required') +
                select('Assigned to', 'assigneeId', opts(staffFor(p.memberId), 'id', 'name', p.assigneeId), true) +
                note('Delivery notes / reason not received', 'deliveryNotes', p.deliveryNotes) +
                note('Closure reason / resolution', 'resolution', p.resolution),
              'Save support update'
            )
          : `<p data-no-translate>${esc(p.resolution)}</p>`
      }<details class="health-history"><summary>Update history (${p.history.length})</summary>${
        p.history
          .slice()
          .reverse()
          .map(
            h =>
              `<article><strong data-no-translate>${esc(h.actor)}</strong> · ${esc(h.at)}<p>${label(h.before.deliveryStatus)} → ${label(h.after.deliveryStatus)} · ${label(h.after.status)}</p><p data-no-translate>${esc(h.after.deliveryNotes)} ${esc(h.after.resolution)}</p></article>`
          )
          .join('') || '<p>No updates yet.</p>'
      }</details>`
    );
    const operationId = crypto.randomUUID();
    if (canEdit)
      handleForm(async b => {
        await send(
          `/health/plans/${p.id}`,
          'PATCH',
          { ...b, memberId: p.memberId, version: p.version, operationId },
          'Support update'
        );
        toast('Support plan updated.');
      });
  }
  function timeline(id) {
    const reports = state()
      .checkins.filter(c => family(id).has(c.memberId))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    openModal(
      'Household timeline',
      `<span data-no-translate>${esc(member(id)?.name || id)}</span>`,
      `<div class="actions health-actions">${button('Check in with a family', 'hh-check', 'plus', false, `data-id="${id}"`)}${button('Plan help', 'hh-plan', 'calendar', true, `data-id="${id}"`)}${button('Cash-flow planner', 'hh-calendar', 'wallet', true, `data-id="${id}"`)}</div><p class="field-help">Each report covers the last 30 days. Reports may cover some of the same days, so do not add their totals together. The family’s explanation is not proof of the cause.</p><div class="household-timeline">${reports.map(c => `<article class="timeline-entry ${c.voided ? 'voided' : ''}"><div><strong>${c.date}</strong> <span class="badge ${c.shortfallDays > 0 ? 'amber' : 'gray'}">${esc(response(c))}</span></div><p>${c.periodStart} – ${c.date}${c.milestone ? ` · ${c.milestone}-day outcome` : ''}</p><p>${c.essentials.map(label).join(', ') || 'No essentials specified'} · ${c.causes.map(label).join(', ') || 'No circumstances specified'}</p><p><small>What the family says</small><span data-no-translate>${esc(c.explanation || 'Not recorded')}</span></p><p><small>What the field worker saw</small><span data-no-translate>${esc(c.officerNotes || 'Not recorded')}</span></p><div class="kv"><div><small>Income / spending</small>${c.income === null ? 'Unknown' : money(c.income, c.currency)} / ${c.expenses === null ? 'Unknown' : money(c.expenses, c.currency)}</div><div><small>Stress / borrowing</small>${c.stress === null ? 'Unknown' : c.stress + ' / 4'} · ${label(c.borrowing)}</div><div><small>Does the family want help?</small>${label(c.supportPreference)}</div>${c.planId ? `<div><small>Support feedback</small>${label(c.supportHelpfulness)}</div>` : ''}</div>${c.voided ? `<p data-no-translate>Voided: ${esc(c.voidReason)}</p>` : `<div class="actions">${c.supportPreference === 'requested' ? `<button class="text-btn" data-action="hh-plan" data-id="${id}" data-baseline="${c.id}">Plan help</button>` : ''}${state().user.role !== 'officer' ? `<button class="text-btn" data-action="hh-void" data-id="${c.id}">Mark a report as incorrect</button>` : ''}</div>`}</article>`).join('') || '<div class="empty">No check-ins yet. Ask a family if they would like to talk.</div>'}</div><h3 class="section-title">Support history</h3>${planRows(state().supportPlans.filter(p => p.memberId === id))}`
    );
    $('#dialog').classList.add('wide-dialog');
  }
  function servicesPage() {
    const manage = state().user.role !== 'officer';
    return (
      heading(
        'Available support',
        'Help available',
        'List the help your team can offer or help a family apply for.',
        manage ? button('Add support service', 'hh-service') : ''
      ) +
      `<div class="explain">Check with the provider that the help is available and who can apply. Your team keeps this list up to date. The app does not contact providers or share records with them.</div><div class="service-grid">${
        state()
          .services.map(
            s =>
              `<section class="panel service-card"><span class="badge ${s.active ? '' : 'gray'}">${s.active ? 'Available' : 'Unavailable'}</span><h2 data-no-translate>${esc(s.name)}</h2><p data-no-translate>${esc(s.provider)}</p><p data-no-translate>${esc(s.details)}</p><div class="explain" data-no-translate>${esc(s.accessNotes || 'Ask the provider about access requirements.')}</div>${manage ? `<button class="text-btn" data-action="hh-service" data-id="${s.id}">Edit service</button>` : ''}</section>`
          )
          .join('') ||
        '<section class="panel empty">No help is listed yet. Add services your team has checked before offering them to a family.</section>'
      }</div>`
    );
  }
  function serviceModal(id) {
    const s = state().services.find(s => s.id === id);
    openModal(
      s ? 'Edit support service' : 'Add support service',
      'Add a real service and how to access it. Do not enter private contact details.',
      formHtml(
        field('Service name', 'name', 'text', s?.name || '', 'required maxlength="120"', true) +
          field('Provider / organization', 'provider', 'text', s?.provider || '', 'required maxlength="120"', true) +
          choice(
            'Service type',
            'type',
            ['assistance', 'referral', 'planning', 'livelihood', 'other'],
            s?.type || 'assistance'
          ) +
          select(
            'Availability',
            'active',
            '<option value="true">Available</option><option value="false" ' +
              (s?.active === false ? 'selected' : '') +
              '>Unavailable</option>'
          ) +
          note('What help is available?', 'details', s?.details) +
          note('Who can apply, and how?', 'accessNotes', s?.accessNotes),
        'Save service'
      )
    );
    handleForm(async b => {
      if (!navigator.onLine) throw new Error('Connect to update the service directory.');
      await api('/health/services' + (s ? '/' + s.id : ''), s ? 'PATCH' : 'POST', {
        ...b,
        active: b.active === 'true',
        version: s?.version,
      });
      toast('Help available saved.');
    });
  }
  const getReport = () =>
    outcomeReport(state(), {
      asOf: reportFilters.asOf || today(),
      from: reportFilters.from || '1900-01-01',
      to: reportFilters.to || today(),
      groupId: reportFilters.groupId,
    });
  function outcomesPage() {
    const r = getReport(),
      fmt = n => (n === null ? '—' : n.toFixed(1));
    return (
      heading(
        'Track progress',
        'Progress reports',
        'Compare how families are doing before and after help. Green ▼ means fewer days short of money (better); red ▲ means more (worse). A change does not prove the app or the help caused it.',
        button('Download summary spreadsheet', 'hh-export', 'down', true)
      ) +
      `<form id="outcome-filters" class="panel outcome-filters">${field('First check-in: from', 'from', 'date', reportFilters.from || '')}${field('First check-in: to', 'to', 'date', reportFilters.to || '')}${field('As of', 'asOf', 'date', reportFilters.asOf || today(), `required max="${today()}"`)}${select(
        'Community group',
        'groupId',
        '<option value="">All groups</option>' + opts(state().groups, 'id', 'name', reportFilters.groupId)
      )
        .replace(' required', '')
        .replace(
          '<span class="required-mark" aria-hidden="true"> *</span>',
          ''
        )}<button class="btn" type="submit">Show results</button><p class="form-error" role="alert"></p></form>
      <div class="health-metrics">${metric('Families checked in with', r.checkedHouseholds, `${r.households} families in the selected groups`)}${metric('Help received', `${r.delivery.received} / ${r.delivery.plans}`, 'Plans started in this date range')}${metric('Typical wait for help', r.delivery.medianDaysToSupport === null ? '—' : r.delivery.medianDaysToSupport + ' days', 'The middle wait, from starting a plan to receiving help')}${metric('Actions overdue', r.delivery.overdue, `${r.delivery.open} open / ${r.delivery.closed} closed plans`)}</div>
      <div class="explain">Each family is counted once, using the first check-in for its earliest help plan in this date range. ${r.cohortHouseholds} families are included; ${r.baselineMissing} do not have a usable first answer about days short of money. ${r.excludedBaselines} plans are left out because the first check-in was marked incorrect or is unavailable. Later answers count from day 30 or 90 until 14 days after that date. A missing answer is never counted as zero.</div>
      ${r.milestones
        .map(
          m =>
            `<section class="panel health-section"><div class="panel-header"><div><h2>${m.day}-day family progress</h2><p class="panel-description">${m.due} due · ${m.notDue} not yet due · ${m.paired} families answered both times</p></div></div><div class="panel-body"><div class="health-metrics">${metric('Days short of money: first check-in', fmt(m.baselineMean), 'Average for families who answered both times')}${metric('Days short of money: later check-in', fmt(m.followupMean), 'Days in the last 30')}${metric('Change in days short of money', `<span class="trend good"><i aria-hidden="true">▼</i> ${m.improved} fewer <em>(better)</em></span><span class="trend bad"><i aria-hidden="true">▲</i> ${m.worsened} more <em>(worse)</em></span><span class="trend same">${m.unchanged} no change</span>`, 'Families who answered both times')}${metric('Families without both answers', m.due - m.paired, `${m.declined} declined · ${m.unavailable} unavailable · ${m.missing} missing/unknown`)}</div><p class="field-help">${m.late} families answered outside the allowed dates. Change in money worries: ${fmt(m.stressChange)} points for ${m.stressPairs} families who answered both times (a negative number means less worry). Borrowing reported: ${m.borrowingBefore} → ${m.borrowingAfter} for ${m.borrowingPairs} families who answered yes or no both times.</p>${rows(
              [
                'Household',
                'Follow-up due',
                'Days short of money at the first check-in',
                'Days short of money at the later check-in',
                'Status',
                '',
              ],
              m.rows.map(
                row =>
                  `<tr><td>${safeName(row.memberId)}</td><td>${row.due}</td><td>${row.baselineDays}</td><td>${row.followupDays ?? '—'}</td><td>${row.status === 'unavailable' ? label('unavailable') : row.status === 'declined' ? label('declined') : esc(row.status)}</td><td><button class="text-btn" data-action="hh-plan-open" data-id="${row.planId}">Open plan</button></td></tr>`
              )
            )}</div></section>`
        )
        .join('')}
      <p class="field-help">These figures show reported changes. Seasons, other help and family circumstances may also affect them. Closing a follow-up, repaying or saving does not prove a family is doing well.</p>`
    );
  }
  function projectionHtml(result) {
    const base = result.base,
      stress = result.stress;
    return `<div class="planner-summary"><div><small>First date money may run short</small><strong>${base.firstGap || 'None in this plan'}</strong><span>Largest gap: ${money(base.maxGap, 'KHR')}</span></div><div><small>If the riel loses value +${result.assumptions.stressPercent}%</small><strong>${stress.firstGap || 'No shortfall'}</strong><span>Largest gap: ${money(stress.maxGap, 'KHR')}</span></div></div><p class="field-help">The riel total assumes money can be exchanged at the rate you entered. Each currency is also shown separately. If one currency is short, the family may need to exchange money or get help, even if the combined total is positive. The app does not exchange money.</p>${rows(
      [
        'Date',
        'Riel available',
        'US dollars available',
        'Total in riel at the entered rate',
        'If the exchange rate worsens',
      ],
      base.rows.map(
        (r, i) =>
          `<tr><td>${r.date}</td><td class="${r.khr < 0 ? 'cash-gap' : ''}">${money(r.khr, 'KHR')}</td><td class="${r.usd < 0 ? 'cash-gap' : ''}">${money(r.usd, 'USD')}</td><td class="${r.gap ? 'cash-gap' : ''}">${money(r.balance, 'KHR')}<div class="field-help">${r.gap ? 'Expected shortfall' : r.requiresExchange ? 'Conversion needed' : ''}</div></td><td class="${stress.rows[i].gap ? 'cash-gap' : ''}">${money(stress.rows[i].balance, 'KHR')}</td></tr>`
      )
    )}<p class="field-help">The plan combines money coming in and going out on the same day. It does not know which payment happens first or about costs you leave out. These are estimates, not actual payments or proof of why money ran short.</p>`;
  }
  function singleCurrencyCalendar(id) {
    const m = member(id),
      entries = state().cashflow.filter(e => e.memberId === id);
    openModal(
      'Cash-flow planner',
      `<span data-no-translate>${esc(m.name)}</span> · Planned money in and out`,
      `${button('Add expected entry', 'hh-cash-entry', 'plus', false, `data-id="${id}"`)}<p class="field-help">Add when money is expected to come in or go out. Each currency is shown separately. The plan only knows what you enter and does not show the order of payments within a day. No money moves here.</p><form id="cashflow-preview"><div class="form-grid">${select('Currency', 'currency', ctx.currencyOptions(m.currency || 'INR'))}${field('Opening available money', 'openingBalance', 'number', '', 'required min="0" max="100000000" step="0.01"')}${field('From date', 'from', 'date', today(), 'required')}${field('To date', 'to', 'date', addDays(today(), 30), 'required')}</div><div class="form-actions"><button class="btn">Show expected gaps</button></div><p class="form-error" role="alert"></p></form><div id="cashflow-result"></div><h3 class="section-title">Planned money in and out</h3>${rows(
        ['Date', 'Purpose', 'Expected amount', 'Status'],
        entries.map(
          e =>
            `<tr><td>${e.date}</td><td data-no-translate>${esc(e.label)}</td><td>${money(e.amount, e.currency)}</td><td>${e.cancelled ? 'Cancelled' : e.pending ? 'Not sent yet' : e.kind}${!e.cancelled && !e.pending ? ` <button class="text-btn" data-action="hh-cash-cancel" data-id="${e.id}">Cancel entry</button>` : ''}</td></tr>`
        )
      )}`
    );
    $('#cashflow-preview').onsubmit = e => {
      e.preventDefault();
      const b = Object.fromEntries(new FormData(e.target));
      if (b.from > b.to) {
        e.target.querySelector('.form-error').textContent = 'Check the planning dates.';
        return;
      }
      const result = cashflowProjection(entries, { ...b, openingBalance: +b.openingBalance });
      $('#cashflow-result').innerHTML = rows(
        ['Date', 'Income', 'Expenses', 'Available'],
        result.map(
          r =>
            `<tr><td>${r.date}</td><td>${money(r.income, b.currency)}</td><td>${money(r.expenses, b.currency)}</td><td class="${r.gap ? 'cash-gap' : ''}">${money(r.balance, b.currency)}${r.gap ? ' · Money may run short' : ''}</td></tr>`
        )
      );
    };
  }
  function calendar(id) {
    singleCurrencyCalendar(id);
    const saved = (state().scenarios || []).filter(record => record.memberId === id);
    if (!saved.length) return;
    $('#dialog .modal-body').insertAdjacentHTML(
      'beforeend',
      `<details class="health-history"><summary>Earlier planning snapshots (${saved.length})</summary><p class="field-help">You can read earlier saved plans but cannot edit them. They keep the currencies and estimates used at the time.</p>${rows(
        ['Name', 'Recorded', ''],
        saved.map(
          record =>
            `<tr><td data-no-translate>${esc(record.label)}</td><td>${esc(record.createdAt?.slice(0, 10) || 'Not recorded')}</td><td><button class="text-btn" data-action="hh-scenario" data-id="${record.id}">View snapshot</button></td></tr>`
        )
      )}</details>`
    );
  }
  function scenarioView(id) {
    const s = state().scenarios.find(e => e.id === id);
    openModal(
      'Saved planning snapshot',
      `<span data-no-translate>${esc(s.label)}</span>`,
      `<p>Rate: ${esc(s.assumptions.khrPerUsd)} KHR per USD · ${esc(s.assumptions.rateDate)}</p><p data-no-translate>Source: ${esc(s.assumptions.rateSource)}</p>${projectionHtml(dualCurrencyProjection(s.entries, s.assumptions))}<h3 class="section-title">Entries captured in this snapshot</h3>${rows(
        ['Date', 'Purpose', 'Amount'],
        s.entries.map(
          e =>
            `<tr><td>${e.date}</td><td data-no-translate>${esc(e.label)}</td><td>${money(e.amount, e.currency)}</td></tr>`
        )
      )}<p class="field-help">This is a saved copy of the plan. Later edits do not change it.</p>`
    );
    $('#dialog').classList.add('wide-dialog');
  }
  function cashEntry(id) {
    const recordId = crypto.randomUUID();
    openModal(
      'Add expected cash flow',
      esc(member(id).name),
      formHtml(
        field('Label / purpose', 'label', 'text', '', 'required maxlength="120"', true) +
          choice('Money coming in or going out', 'kind', ['income', 'expense'], 'income') +
          select(
            'Currency',
            'currency',
            ctx.currencyOptions(CURRENCIES.includes(member(id).currency) ? member(id).currency : 'INR')
          ) +
          field('Expected date', 'date', 'date', today(), 'required') +
          field('Expected amount', 'amount', 'number', '', 'required min="0.01" step="0.01" max="100000000"') +
          note('Planning notes', 'notes'),
        'Save expected entry'
      )
    );
    handleForm(async b => {
      await send(
        '/health/cashflow',
        'POST',
        { ...b, id: recordId, memberId: id, amount: +b.amount },
        'Planned money in and out'
      );
      toast('Expected entry recorded.');
    });
  }
  function exportSummary() {
    const r = getReport(),
      rows = [
        [
          'as_of',
          'baseline_from',
          'baseline_to',
          'group_id',
          'milestone_days',
          'households_in_scope',
          'cohort_households',
          'eligible_baselines',
          'households_due',
          'not_yet_due',
          'matched',
          'declined',
          'unavailable',
          'missing_unknown',
          'late_unmatched',
          'baseline_mean_shortfall_days',
          'followup_mean_shortfall_days',
          'fewer_days',
          'same_days',
          'more_days',
          'stress_pairs',
          'mean_stress_change',
          'borrowing_pairs',
          'borrowing_before',
          'borrowing_after',
          'plans',
          'support_received',
          'plans_closed',
          'median_days_to_support',
        ],
        ...r.milestones.map(m => [
          r.asOf,
          reportFilters.from || '',
          reportFilters.to || today(),
          reportFilters.groupId || 'all',
          m.day,
          r.households,
          r.cohortHouseholds,
          m.eligible,
          m.due,
          m.notDue,
          m.paired,
          m.declined,
          m.unavailable,
          m.missing,
          m.late,
          m.baselineMean ?? '',
          m.followupMean ?? '',
          m.improved,
          m.unchanged,
          m.worsened,
          m.stressPairs,
          m.stressChange ?? '',
          m.borrowingPairs,
          m.borrowingBefore,
          m.borrowingAfter,
          r.delivery.plans,
          r.delivery.received,
          r.delivery.closed,
          r.delivery.medianDaysToSupport ?? '',
        ]),
      ];
    const url = URL.createObjectURL(
      new Blob([rows.map(row => row.map(v => '"' + String(v).replaceAll('"', '""') + '"').join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldledger-outcomes-${r.asOf}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Summary downloaded. It does not include household names.');
  }
  function enhance(page) {
    if (page === 'health') {
      $('#health-search').addEventListener('input', e => {
        healthQuery = e.target.value;
        const filtered = state().members.filter(
          m =>
            (!healthGroup || m.groupId === healthGroup) &&
            (!healthQuery || `${m.name} ${m.id}`.toLowerCase().includes(healthQuery.toLowerCase()))
        );
        $('#health-rows').innerHTML =
          healthView === 'households'
            ? householdRows(filtered)
            : planRows(state().supportPlans.filter(p => filtered.some(m => m.id === p.memberId)));
        translate($('#health-rows'), activeLanguage(state()));
      });
      $('#health-group').addEventListener('change', e => {
        healthGroup = e.target.value;
        ctx.render();
      });
    }
    if (page === 'outcomes')
      $('#outcome-filters').addEventListener('submit', e => {
        e.preventDefault();
        const b = Object.fromEntries(new FormData(e.target));
        if (b.from && b.to && b.from > b.to) {
          e.target.querySelector('.form-error').textContent = 'End date must follow start date.';
          return;
        }
        reportFilters = b;
        ctx.render();
      });
    if (page === 'overview')
      $('.quick-actions')?.insertAdjacentHTML(
        'afterbegin',
        button('Check in with a family', 'hh-check', 'people', true)
      );
    if (page === 'meetings')
      $('.page-heading .actions')?.insertAdjacentHTML(
        'beforeend',
        button('Check in with a family', 'hh-check', 'people', true)
      );
    translate($('#app'), activeLanguage(state()));
  }
  function enhanceModal() {
    const action = $('#dialog [data-action="visit"][data-id]');
    if (action && !$('#dialog .household-profile')) {
      const id = action.dataset.id,
        c = latest(id);
      $('#dialog .modal-body').insertAdjacentHTML(
        'afterbegin',
        `<section class="household-profile"><div><strong>Household financial health</strong><p>${c ? `${c.date} · ${esc(response(c))}` : 'No household check-in recorded yet.'}</p></div><div class="actions">${button('Check in', 'hh-check', 'plus', false, `data-id="${id}"`)}<button class="text-btn" data-action="hh-timeline" data-id="${id}">Household history</button></div></section>`
      );
    }
    translate($('#dialog'), activeLanguage(state()));
  }
  document.addEventListener('open-support-plan', e => openPlan(e.detail));
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-action]');
    if (!b || !b.dataset.action.startsWith('hh-')) return;
    const id = b.dataset.id;
    try {
      switch (b.dataset.action) {
        case 'hh-view':
          healthView = b.dataset.view;
          ctx.render();
          break;
        case 'hh-link': {
          openModal(
            'Reporting household',
            `<span data-no-translate>${esc(member(id).name)}</span>`,
            formHtml(
              select(
                'Share a reporting household with',
                'targetMemberId',
                '<option value="">Separate household</option>' +
                  opts(
                    state().members.filter(m => m.id !== id),
                    'id',
                    'name',
                    state().members.find(m => m.id !== id && family(id).has(m.id))?.id || ''
                  )
              ).replace(' required', '') +
                '<label class="check field wide"><input type="checkbox" name="confirmed" required><span>I checked with the member who belongs to this household. This only changes how the progress report counts the family. Loans and staff access stay separate.</span></label>',
              'Save household link'
            )
          );
          handleForm(async body => {
            if (!navigator.onLine) throw new Error('Connect to change household links.');
            await api('/health/household-link', 'POST', { ...body, memberId: id, confirmed: body.confirmed === 'on' });
          });
          break;
        }
        case 'hh-demo':
          if (!navigator.onLine) throw new Error('Connect to load samples.');
          b.disabled = true;
          try {
            await api('/health/demo', 'POST', {});
            await ctx.refresh();
            ctx.render();
          } finally {
            b.disabled = false;
          }
          break;
        case 'hh-check':
          checkinModal(id);
          break;
        case 'hh-plan':
          planModal(id, b.dataset.baseline);
          break;
        case 'hh-plan-open':
          openPlan(id);
          break;
        case 'hh-outcome':
          checkinModal(null, id, Number(b.dataset.day));
          break;
        case 'hh-timeline':
          timeline(id);
          break;
        case 'hh-service':
          serviceModal(id);
          break;
        case 'hh-calendar':
          calendar(id);
          break;
        case 'hh-cash-entry':
          cashEntry(id);
          break;
        case 'hh-void': {
          const c = state().checkins.find(c => c.id === id);
          openModal(
            'Mark a report as incorrect',
            'The report stays in history but is no longer counted in progress reports.',
            formHtml(
              field('Reason', 'reason', 'text', '', 'required minlength="5" maxlength="500"', true),
              'Mark as incorrect'
            )
          );
          handleForm(async body => {
            if (!navigator.onLine) throw new Error('Connect to void a report.');
            await api(`/health/checkins/${id}/void`, 'POST', { ...body, version: c.version });
          });
          break;
        }
        case 'hh-scenario':
          scenarioView(id);
          break;
        case 'hh-cash-cancel': {
          const entry = state().cashflow.find(c => c.id === id);
          openModal(
            'Cancel expected entry',
            'The original entry remains in history.',
            formHtml(
              field('Reason', 'reason', 'text', '', 'required minlength="5" maxlength="500"', true),
              'Cancel entry'
            )
          );
          handleForm(async body => {
            if (!navigator.onLine) throw new Error('Connect to cancel an expected entry.');
            await api(`/health/cashflow/${id}/cancel`, 'POST', { ...body, version: entry.version });
          });
          break;
        }
        case 'hh-export':
          exportSummary();
          break;
      }
    } catch (error) {
      toast(error.message);
    }
  });
  return { enhance, enhanceModal, pages: { health: healthPage, outcomes: outcomesPage, services: servicesPage } };
}
