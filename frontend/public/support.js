import { entryCurrencies } from '../../shared/catalog.mjs';
import {
  payPosition,
  debtPosition,
  payFlags,
  participationSummary,
  SUPPORT_ROUTES,
  displaySupportValue,
} from '../../shared/support.mjs';

export function createSupportUI(ctx) {
  const { esc, money, field, select, opts, button, heading, openModal, formHtml, toast } = ctx,
    $ = s => document.querySelector(s),
    s = () => ctx.getState(),
    today = ctx.today;
  const kinds = {
    'domestic-worker': 'Work and advance debt in India',
    'overseas-worker': 'Indian overseas worker / family',
    prospective: 'Prospective member',
    livelihood: 'Livelihood support',
  };
  const person = id => s().supportPeople.find(p => p.id === id),
    active = rows => (rows || []).filter(r => !r.voided);
  const choices = (values, selected) =>
    values
      .map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(displaySupportValue(v))}</option>`)
      .join('');
  const currencyOptions = code =>
    entryCurrencies(code)
      .map(c => `<option ${code === c ? 'selected' : ''}>${c}</option>`)
      .join('');
  const unknown = (value, currency) => (value === null || value === undefined ? 'Unknown' : money(value, currency));
  const inputNumber = (label, name, value = '', nullable = false) =>
    field(
      label,
      name,
      'number',
      value ?? '',
      `${nullable ? '' : 'required '}min="0" max="100000000" step="0.01"${nullable ? ' placeholder="Unknown / not provided"' : ''}`
    );
  const note = (label, name, value = '', help = '') =>
    `<label class="field wide"><span>${label}</span>${help ? `<small>${help}</small>` : ''}<textarea name="${name}" maxlength="1000">${esc(value)}</textarea></label>`;
  const sourceFields = p =>
    select(
      'Information supplied by',
      'source',
      choices(
        ['domestic-worker', 'overseas-worker'].includes(p.kind) ? ['worker', 'family'] : ['member', 'family'],
        p.source
      )
    ) +
    note(
      'Record notes (optional)',
      'notes',
      '',
      'Record only what is needed. No full IDs, location details or employer/recruiter submissions.'
    );
  const number = v => (v === '' || v === null || v === undefined ? null : Number(v));
  const table = (headers, rows) =>
    `<div class="table-wrap support-table"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>${rows.length ? '' : '<div class="empty">No records yet.</div>'}</div>`;
  const action = (label, name, id = '', extra = '') =>
    `<button class="text-btn" data-action="support-${name}" data-id="${esc(id)}" ${extra}>${label}</button>`;
  const provenance = r =>
    `<small class="record-source">${esc(r.source)} report · ${esc(r.createdAt?.slice(0, 10) || today())}${r.pending ? ' · Pending sync' : ''}${r.voided ? ' · Voided' : ''}</small>`;
  const staff = p =>
    s().staff.filter(
      u =>
        u.active &&
        (u.role !== 'officer' || u.groupIds.includes(p.groupId)) &&
        (s().user.role !== 'officer' || u.id === s().user.id)
    );
  let search = '',
    filter = '';
  async function send(path, method, payload) {
    if (!navigator.onLine) {
      await ctx.operationsUI.queueHealth(path, method, payload, 'Support record');
      return;
    }
    return ctx.api(path, method, payload);
  }
  function form(fields, label = 'Save record', extra = '') {
    return formHtml(fields, label, extra);
  }
  function submit(fn, after) {
    $('#modal-form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.currentTarget,
        b = f.querySelector('button[type="submit"]');
      b.disabled = true;
      try {
        await fn(Object.fromEntries(new FormData(f)));
        if (!ctx.operationsUI.unlocked()) await ctx.refresh();
        $('#dialog').close();
        ctx.render();
        after?.();
      } catch (err) {
        const error = f.querySelector('.form-error');
        error.textContent = err.message;
        error.tabIndex = -1;
        error.focus();
      } finally {
        b.disabled = false;
      }
    });
  }
  function createRecord(route, p, fields, parse = x => x, title = 'Add record') {
    const id = crypto.randomUUID();
    openModal(title, `<span data-no-translate>${esc(p.name)}</span>`, form(fields + sourceFields(p), 'Save record'));
    submit(
      async b => {
        await send('/support/' + route, 'POST', { ...parse(b), id, personId: p.id });
        toast('Record saved.');
      },
      () => profile(p.id)
    );
  }
  function totalHtml(totals) {
    return (
      Object.entries(totals)
        .map(([c, v]) => money(v, c))
        .join(' · ') || 'No amounts recorded'
    );
  }
  function directory(page) {
    const workers = page === 'workers',
      wanted = workers
        ? ['domestic-worker', 'overseas-worker']
        : page === 'prospects'
          ? ['prospective']
          : ['livelihood'];
    const profiles = s().supportPeople.filter(
      p =>
        wanted.includes(p.kind) &&
        (!workers || !filter || p.kind === filter) &&
        (!search || [p.name, p.memberReference, p.id].some(v => v?.toLowerCase().includes(search.toLowerCase())))
    );
    const flags = payFlags(s(), today());
    const title = workers ? 'Workers & families' : page === 'prospects' ? 'Second chance' : 'Loan-use & livelihoods';
    const subtitle = workers
      ? 'A record of pay, deductions, debt and support. For work in India and Indian workers overseas.'
      : page === 'prospects'
        ? 'Keep a factual participation history before a lending decision. Attendance and savings are not eligibility scores.'
        : 'Notice when a livelihood needs support. Keep household explanations separate from field observations.';
    return (
      heading(
        workers ? 'Worker support' : 'Community support',
        title,
        subtitle,
        button(
          workers ? 'Add worker / family' : page === 'prospects' ? 'Add prospective member' : 'Add livelihood profile',
          'support-person',
          'plus',
          false,
          `data-kind="${wanted[0]}"`
        )
      ) +
      (workers
        ? `<div class="support-niches"><button type="button" class="support-pathway ${filter === 'domestic-worker' ? 'selected' : ''}" data-support-pathway="domestic-worker" aria-pressed="${filter === 'domestic-worker'}"><small>India</small><strong>Work & advance debt</strong><span>Pay, deductions and reported advances</span></button><button type="button" class="support-pathway ${filter === 'overseas-worker' ? 'selected' : ''}" data-support-pathway="overseas-worker" aria-pressed="${filter === 'overseas-worker'}"><small>Overseas</small><strong>Workers & their families</strong><span>Salary, recruitment debt and remittances</span></button></div>`
        : '') +
      (s().demo && !s().supportPeople.length
        ? `<div class="review-strip">Explore all four journeys with fictional Indian records. ${button('Load support examples', 'support-demo', 'plus', true)}</div>`
        : '') +
      (s().demo && s().user.role === 'admin' && !s().config.bulkDemoLoaded
        ? `<div class="review-strip">Need a fuller picture? Add about 70 more fictional members, loans, visits and support records. ${button('Load larger sample dataset', 'support-bulk', 'plus', true)}</div>`
        : '') +
      `<div class="toolbar"><input class="search-input" id="support-search" aria-label="Search support profiles" placeholder="Search by name or member reference…" value="${esc(search)}">${workers ? `<select id="support-filter" aria-label="Worker pathway"><option value="">Both pathways</option>${wanted.map(k => `<option value="${k}" ${filter === k ? 'selected' : ''}>${kinds[k]}</option>`).join('')}</select>` : ''}</div>` +
      table(
        ['Person / reference', workers ? 'Pathway' : 'Latest record', 'Needs attention', ''],
        profiles.map(p => {
          const count = flags.filter(f => f.personId === p.id).length,
            checks = active(s().assetChecks).filter(r => r.personId === p.id),
            last = checks.at(-1),
            summary = participationSummary(s(), p.id);
          return `<tr><td><strong data-no-translate>${esc(p.name)}</strong><div class="field-help" data-no-translate>${esc(p.memberReference || p.memberId || 'Standalone support record')}</div></td><td>${workers ? kinds[p.kind] : page === 'prospects' ? `${summary.meetings} meetings · ${summary.present} recorded present` : last ? `${last.date} · ${displaySupportValue(last.functioning)}` : 'Not yet checked'}</td><td>${!p.consented ? '<span class="badge gray">Consent withdrawn</span>' : workers ? `${count} pay flag${count === 1 ? '' : 's'}` : page === 'prospects' ? `${p.missingInformation?.length || 0} missing items${p.reviewDate ? ' · Review ' + p.reviewDate : ''}` : last && ['not-working', 'partly-working'].includes(last.functioning) ? '<span class="badge amber">Follow-up needed</span>' : 'No concern recorded'}${p.pending ? '<div class="field-help">Pending sync</div>' : ''}</td><td>${action('Open record', 'profile', p.id)}</td></tr>`;
        })
      )
    );
  }
  function personModal(kind) {
    if (!s().groups.length) {
      toast('Create a field group first so access can be assigned.');
      return;
    }
    const id = crypto.randomUUID();
    openModal(
      'Add support profile',
      'No bank account, full ID number or existing Sahayog membership is required.',
      form(
        field('Name / agreed display name', 'name', 'text', '', 'required maxlength="120"', true) +
          select(
            'Support pathway',
            'kind',
            Object.entries(kinds)
              .map(([k, v]) => `<option value="${k}" ${kind === k ? 'selected' : ''}>${v}</option>`)
              .join(''),
            true
          ) +
          select('Assigned field group', 'groupId', opts(s().groups)) +
          select(
            'Existing member (optional)',
            'memberId',
            '<option value="">Standalone record</option>' + opts(s().members),
            true
          ).replace(' required', '') +
          field('Sahayog / organisation reference (optional)', 'memberReference', 'text', '', 'maxlength="80"') +
          select('Default record currency', 'currency', currencyOptions('INR')) +
          select(
            'Information supplied by',
            'source',
            choices(
              ['worker', 'family', 'member'],
              kind === 'prospective' || kind === 'livelihood' ? 'member' : 'worker'
            )
          ) +
          field('Safe contact instructions (optional)', 'safeContact', 'text', '', 'maxlength="300"', true) +
          note('Support context (optional)', 'notes') +
          '<label class="check field wide"><input type="checkbox" name="consented" required><span>The person or family freely agreed to this support record and understands its purpose. No employer or recruiter submission.</span></label>',
        'Create support profile'
      )
    );
    const fill = () => {
      const m = s().members.find(m => m.id === $('#modal-form [name="memberId"]').value);
      if (m) {
        $('#modal-form [name="name"]').value = m.name;
        $('#modal-form [name="groupId"]').value = m.groupId;
        $('#modal-form [name="memberReference"]').value = m.id;
      }
    };
    $('#modal-form [name="memberId"]').onchange = fill;
    const syncSource = () => {
      const isWorker = ['domestic-worker', 'overseas-worker'].includes($('#modal-form [name="kind"]').value);
      $('#modal-form [name="source"]').innerHTML = choices(
        isWorker ? ['worker', 'family'] : ['member', 'family'],
        isWorker ? 'worker' : 'member'
      );
    };
    $('#modal-form [name="kind"]').onchange = syncSource;
    syncSource();
    submit(
      async b => {
        await send('/support/people', 'POST', {
          ...b,
          id,
          memberId: b.memberId || null,
          consented: b.consented === 'on',
        });
        toast('Support profile created.');
      },
      () => profile(id)
    );
  }
  const correction = (r, route) =>
    s().user.role === 'officer' || r.pending || r.voided
      ? ''
      : action('Void incorrect entry', 'void', r.id, `data-route="${route}"`);
  function caseRows(personId) {
    return table(
      ['Concern / action', 'Assigned / due', 'Status / assistance', ''],
      (s().workerCases || [])
        .filter(c => !personId || c.personId === personId)
        .map(
          c =>
            `<tr><td><strong data-no-translate>${esc(c.title)}</strong><div class="field-help" data-no-translate>${esc(person(c.personId)?.name)} · ${esc(c.action)}</div></td><td>${esc(c.assignee)}<div class="field-help">${c.dueDate}</div></td><td>${esc(displaySupportValue(c.status))} · ${esc(displaySupportValue(c.deliveryStatus))}${c.pending ? ' · Pending sync' : ''}</td><td>${action('Open case', 'case', c.id)}</td></tr>`
        )
    );
  }
  function profile(id) {
    const p = person(id);
    if (!p) {
      toast('This profile is unavailable.');
      return;
    }
    const worker = ['domestic-worker', 'overseas-worker'].includes(p.kind),
      flags = payFlags(s(), today()).filter(f => f.personId === id),
      pay = (s().payPeriods || []).filter(r => r.personId === id),
      debts = (s().workerDebts || []).filter(r => r.personId === id),
      remits = (s().remittances || []).filter(r => r.personId === id);
    const controls = p.consented
      ? `<div class="actions support-actions">${worker ? action('Add pay period', 'pay', id) + action('Record debt', 'debt', id) + action('Record remittance', 'remit', id) : p.kind === 'prospective' ? action('Record meeting', 'meeting', id) + (s().user.role !== 'officer' ? action('Record reconsideration', 'review', id) : '') : ''}${action('Livelihood check', 'asset', id)}${action('Create support case', 'newcase', id)}</div>`
      : '<div class="review-strip">Consent is withdrawn. Existing history is retained; new capture is blocked.</div>';
    openModal(
      'Support record',
      `<span data-no-translate>${esc(p.name)}</span> · ${kinds[p.kind]}`,
      `<div class="support-profile-head"><div><small>Organisation reference</small><strong data-no-translate>${esc(p.memberReference || p.memberId || 'Standalone support record')}</strong><p data-no-translate>${esc(p.safeContact || 'No contact instructions recorded')}</p></div>${action('Consent, missing information & flag settings', 'settings', id)}</div>${provenance(p)}${p.notes ? `<p class="field-help" data-no-translate>${esc(p.notes)}</p>` : ''}${controls}` +
        (worker
          ? `<h3 class="section-title">Pay flags <small>Adjustable rules · not validated predictions</small></h3>${
              flags
                .map(f => {
                  const c = s().workerCases.find(c => c.sourceKey === 'pay:' + f.payId || c.sourceKey === f.key);
                  return `<article class="support-flag"><div><strong>${f.kind === 'unconfirmed-pay' ? 'Pay receipt unconfirmed' : f.kind === 'short-pay' ? 'Short pay reported' : 'Late pay reported'}</strong><p>${esc(f.reason)}</p><small>Rule: more than ${f.policy.lateDays} days late / shortfall at least ${f.policy.shortPercent}%.</small></div>${c ? action('View ' + c.status + ' case', 'case', c.id) : action('Open follow-up', 'newcase', id, `data-flag="${esc(f.key)}"`)}</article>`;
                })
                .join('') ||
              '<p class="field-help">No rule currently triggered. This is not a financial-health assessment.</p>'
            }<h3 class="section-title">Pay periods</h3>${table(
              ['Period / expected date', 'Expected take-home', 'Received', ''],
              pay.map(r => {
                const position = payPosition(s(), r, today());
                return `<tr class="${r.voided ? 'voided' : ''}"><td><strong data-no-translate>${esc(r.label)}</strong><div class="field-help">${r.periodStart} – ${r.periodEnd} · Due ${r.dueDate}</div>${provenance(r)}</td><td>${unknown(r.expected, r.currency)}</td><td>${unknown(position.received, r.currency)}${position.received === null ? `<div class="field-help">Known receipts: ${money(position.knownAmount, r.currency)}</div>` : ''}</td><td>${action('Details', 'paydetails', r.id)}${p.consented && !r.voided ? action('Add receipt', 'receipt', r.id) + action('Add deduction', 'deduction', r.id) : ''}${correction(r, 'pay')}</td></tr>`;
              })
            )}<h3 class="section-title">Recruitment & advance debt</h3>${table(
              ['Reported debt', 'Opening / advances', 'Repaid / balance', ''],
              debts.map(d => {
                const pos = debtPosition(s(), d, today());
                return `<tr class="${d.voided ? 'voided' : ''}"><td><strong data-no-translate>${esc(d.label)}</strong><div class="field-help">${d.kind} · ${d.date}${d.disputed ? ' · Disputed' : ''}</div>${provenance(d)}</td><td>${unknown(pos.opening, d.currency)} / ${money(pos.advances, d.currency)}</td><td>${money(pos.repaid, d.currency)} / <strong>${unknown(pos.balance, d.currency)}</strong></td><td>${action('History', 'debtdetails', d.id)}${p.consented && !d.voided ? action('Add advance / repayment', 'debtentry', d.id) : ''}${correction(d, 'debts')}</td></tr>`;
              })
            )}<p class="field-help">Balances reflect reported entries only, without calculated interest or fees. Unknown opening debt means an unknown balance. They are not verified legal obligations.</p><h3 class="section-title">Remittances</h3>${table(
              ['Sent', 'Fee (sent currency)', 'Received', 'Source / correction'],
              remits.map(
                r =>
                  `<tr class="${r.voided ? 'voided' : ''}"><td>${r.date}<div>${money(r.sent, r.sentCurrency)}</div></td><td>${unknown(r.fee, r.sentCurrency)}</td><td>${unknown(r.received, r.receivedCurrency)}<div class="field-help">${r.receivedDate || 'Receipt unconfirmed'}</div></td><td>${provenance(r)}${p.consented && !r.voided && r.received === null ? action('Confirm receipt', 'remitreceived', r.id) : ''}${correction(r, 'remittances')}</td></tr>`
              )
            )}<p class="field-help">Remittances are transfers, not new salary or automatic debt repayments. No exchange rate is inferred.</p>`
          : '') +
        (p.kind === 'prospective' ? prospectHistory(p) : '') +
        (p.kind === 'livelihood' || s().assetChecks.some(record => record.personId === p.id) ? assetHistory(p) : '') +
        `<h3 class="section-title">Support cases</h3>${caseRows(id)}<p class="field-help">Reported concerns support follow-up and specialist assistance. This app does not determine legal status, approve loans or send referrals automatically.</p>`
    );
    $('#dialog').classList.add('wide-dialog');
  }
  function prospectHistory(p) {
    const summary = participationSummary(s(), p.id);
    return `<h3 class="section-title">Participation before a decision</h3><div class="support-summary"><span>${summary.present} present / ${summary.attendanceRecorded} attendance observations</span><span>Contributions: ${totalHtml(summary.savings)}</span><span>${summary.unknownSavings} contribution amounts unknown</span></div><p class="field-help">${p.reviewDate ? 'Review due ' + p.reviewDate + '. ' : ''}Missing information: <span data-no-translate>${esc(p.missingInformation?.join('; ') || 'None specified; completeness not verified')}</span>. Attendance and savings do not establish creditworthiness.</p>${table(
      ['Date', 'Attendance', 'Contribution', 'Source / correction'],
      s()
        .participation.filter(r => r.personId === p.id)
        .map(
          r =>
            `<tr class="${r.voided ? 'voided' : ''}"><td>${r.date}</td><td>${esc(displaySupportValue(r.attendance))}</td><td>${unknown(r.savings, r.currency)}</td><td>${provenance(r)}${correction(r, 'participation')}</td></tr>`
        )
    )}<h3 class="section-title">Human reconsideration history</h3>${table(
      ['Date', 'Recorded outcome', 'Reason', ''],
      s()
        .reconsiderations.filter(r => r.personId === p.id)
        .map(
          r =>
            `<tr class="${r.voided ? 'voided' : ''}"><td>${r.date}</td><td>${esc(displaySupportValue(r.outcome))}</td><td data-no-translate>${esc(r.reason)}</td><td>${provenance(r)}${correction(r, 'reviews')}</td></tr>`
        )
    )}<p class="field-help">Outcomes record decisions made outside FieldLedger. A loan approval is not proof of improved financial health.</p>`;
  }
  function assetHistory(p) {
    return `<h3 class="section-title">Loan-use & livelihood checks</h3>${table(
      ['Date / intended purchase', 'Actual use / functioning', 'Separate accounts', ''],
      s()
        .assetChecks.filter(r => r.personId === p.id)
        .map(r => {
          const c = s().workerCases.find(c => c.sourceKey === 'asset:' + r.id);
          return `<tr class="${r.voided ? 'voided' : ''}"><td>${r.date}<div data-no-translate>${esc(r.intended)}</div>${provenance(r)}</td><td><span data-no-translate>${esc(r.actual)}</span><div>${esc(displaySupportValue(r.functioning))}</div></td><td><small>Household explanation</small><p data-no-translate>${esc(r.explanation || 'Not recorded')}</p><small>Officer observation</small><p data-no-translate>${esc(r.officerNotes || 'Not recorded')}</p></td><td>${!r.voided && p.consented ? (c ? action('View follow-up', 'case', c.id) : action('Create follow-up', 'newcase', p.id, `data-asset="${r.id}"`)) : ''}${correction(r, 'assets')}</td></tr>`;
        })
    )}`;
  }
  function addPay(p) {
    createRecord(
      'pay',
      p,
      field('Pay-period label', 'label', 'text', '', 'required maxlength="120"', true) +
        field('Period start', 'periodStart', 'date', today(), 'required') +
        field('Period end', 'periodEnd', 'date', today(), 'required') +
        field('Expected payment date', 'dueDate', 'date', today(), 'required') +
        select('Pay currency', 'currency', currencyOptions(p.currency)) +
        inputNumber('Expected take-home pay (optional)', 'expected', '', true),
      b => ({ ...b, expected: number(b.expected) }),
      'Expected pay'
    );
    $('#modal-form').insertAdjacentHTML(
      'afterbegin',
      '<p class="field-help">Expected take-home pay is the amount the worker expects to receive after anticipated deductions. Deductions are tracked separately and will not be subtracted again. Blank means unknown.</p>'
    );
  }
  function addReceipt(pay) {
    createRecord(
      'receipts',
      person(pay.personId),
      field('Date received / checked', 'date', 'date', today(), `required max="${today()}"`) +
        inputNumber('Pay received · ' + pay.currency + ' (optional)', 'amount', '', true),
      b => ({ ...b, payId: pay.id, amount: number(b.amount) }),
      'Record pay receipt'
    );
    $('#modal-form').insertAdjacentHTML(
      'afterbegin',
      '<p class="field-help">Record each payment once. Zero explicitly means no payment received at this check; blank means the amount is unknown. A later payment is a new receipt.</p>'
    );
  }
  function addDebt(p) {
    createRecord(
      'debts',
      p,
      field('Debt description', 'label', 'text', '', 'required maxlength="120"', true) +
        select('Debt type', 'kind', choices(['recruitment', 'advance', 'other'], 'advance')) +
        field('Opening balance date', 'date', 'date', today(), `required max="${today()}"`) +
        select('Debt currency', 'currency', currencyOptions(p.currency)) +
        inputNumber('Reported opening balance (optional)', 'opening', '', true) +
        '<label class="check field wide"><input type="checkbox" name="disputed"><span>The amount or obligation is disputed.</span></label>',
      b => ({ ...b, opening: number(b.opening), disputed: b.disputed === 'on' }),
      'Record reported debt'
    );
  }
  function debtEntry(d) {
    createRecord(
      'debt-entries',
      person(d.personId),
      select('Entry type', 'kind', choices(['repayment', 'advance'], 'repayment')) +
        field('Date', 'date', 'date', today(), `required max="${today()}"`) +
        inputNumber('Amount · ' + d.currency, 'amount').replace('min="0"', 'min="0.01"'),
      b => ({ ...b, debtId: d.id, amount: number(b.amount) }),
      'Debt advance / repayment'
    );
    $('#modal-form').insertAdjacentHTML(
      'afterbegin',
      '<p class="field-help">Do not enter a repayment already linked through a wage deduction. Linked deductions appear in the debt history automatically.</p>'
    );
  }
  function deduction(pay) {
    const p = person(pay.personId),
      debts = s().workerDebts.filter(d => d.personId === p.id && d.currency === pay.currency);
    createRecord(
      'deductions',
      p,
      field('Deduction description', 'label', 'text', '', 'required maxlength="120"', true) +
        field('Date', 'date', 'date', today(), `required max="${today()}"`) +
        inputNumber('Deducted amount · ' + pay.currency + ' (optional)', 'amount', '', true) +
        select('Worker’s account of deduction', 'status', choices(['unknown', 'agreed', 'disputed'], 'unknown')) +
        select(
          'Link to reported debt (optional)',
          'debtId',
          '<option value="">No debt repayment link</option>' + opts(debts, 'id', 'label'),
          true
        ).replace(' required', '') +
        '<label class="check field wide"><input type="checkbox" name="confirmedRepayment"><span>The worker/family reports that this deduction was actually applied to the selected debt. Add it once to debt repayments.</span></label>',
      b => ({
        ...b,
        payId: pay.id,
        amount: number(b.amount),
        debtId: b.debtId || null,
        confirmedRepayment: b.confirmedRepayment === 'on',
      }),
      'Record wage deduction'
    );
  }
  function remit(p) {
    createRecord(
      'remittances',
      p,
      field('Date sent', 'date', 'date', today(), `required max="${today()}"`) +
        select('Sent currency', 'sentCurrency', currencyOptions(p.currency)) +
        inputNumber('Amount sent', 'sent').replace('min="0"', 'min="0.01"') +
        inputNumber('Transfer fee (optional, sent currency)', 'fee', '', true) +
        select('Received currency', 'receivedCurrency', currencyOptions('INR')) +
        inputNumber('Amount actually received (optional)', 'received', '', true) +
        field('Date received (if known)', 'receivedDate', 'date', '', `max="${today()}"`),
      b => ({ ...b, sent: number(b.sent), fee: number(b.fee), received: number(b.received) }),
      'Record remittance'
    );
  }
  function confirmRemittance(r) {
    const operationId = crypto.randomUUID();
    openModal(
      'Confirm remittance received',
      `${esc(person(r.personId).name)} · Sent ${money(r.sent, r.sentCurrency)}`,
      form(
        inputNumber('Amount actually received · ' + r.receivedCurrency, 'received') +
          field('Date received', 'receivedDate', 'date', today(), `required max="${today()}"`) +
          select('Receipt information supplied by', 'source', choices(['worker', 'family', 'member'], r.source)),
        'Confirm received amount'
      )
    );
    submit(
      async b => {
        await send('/support/remittances/' + r.id, 'PATCH', {
          ...b,
          personId: r.personId,
          operationId,
          version: r.version,
          received: number(b.received),
        });
        toast('Actual receipt recorded; the sent amount is unchanged.');
      },
      () => profile(r.personId)
    );
  }
  function meeting(p) {
    createRecord(
      'participation',
      p,
      field('Meeting date', 'date', 'date', today(), `required max="${today()}"`) +
        select('Attendance', 'attendance', choices(['present', 'absent', 'excused', 'not-recorded'], 'not-recorded')) +
        select('Contribution currency', 'currency', currencyOptions(p.currency)) +
        inputNumber('Voluntary contribution (optional)', 'savings', '', true),
      b => ({ ...b, savings: number(b.savings) }),
      'Record prospective-member meeting'
    );
  }
  function review(p) {
    createRecord(
      'reviews',
      p,
      field('Review date', 'date', 'date', today(), `required max="${today()}"`) +
        select(
          'Human review outcome',
          'outcome',
          choices(['awaiting-information', 'reviewed', 'accepted-externally', 'not-accepted', 'withdrawn'], 'reviewed')
        ) +
        note('Reason for the recorded outcome', 'reason'),
      b => b,
      'Record human reconsideration'
    );
  }
  function asset(p) {
    const loans = s().loans.filter(l => l.memberId === p.memberId);
    createRecord(
      'assets',
      p,
      field('Check date', 'date', 'date', today(), `required max="${today()}"`) +
        select(
          'Existing loan (optional)',
          'loanId',
          '<option value="">Not linked to a loan</option>' + opts(loans, 'id', 'purpose')
        ) +
        field('Intended purchase / purpose', 'intended', 'text', '', 'required maxlength="120"', true) +
        field('Actual purchase / use reported', 'actual', 'text', '', 'required maxlength="120"', true) +
        select(
          'Functioning status',
          'functioning',
          choices(['unknown', 'working', 'partly-working', 'not-working', 'not-seen'], 'unknown'),
          true
        ) +
        note('Household explanation', 'explanation') +
        note('Officer observation', 'officerNotes'),
      b => ({ ...b, loanId: b.loanId || null }),
      'Quick livelihood check'
    );
  }
  function settings(p) {
    const operationId = crypto.randomUUID();
    openModal(
      'Consent & record settings',
      `<span data-no-translate>${esc(p.name)}</span>`,
      form(
        '<label class="check field wide"><input type="checkbox" name="consented" ' +
          (p.consented ? 'checked' : '') +
          '><span>Consent remains active for this support record.</span></label>' +
          note(
            'Missing information (one item per line)',
            'missingInformation',
            (p.missingInformation || []).join('\n')
          ) +
          field('Next reconsideration date (optional)', 'reviewDate', 'date', p.reviewDate || '') +
          (['domestic-worker', 'overseas-worker'].includes(p.kind)
            ? field(
                'Flag after this many late days',
                'lateDays',
                'number',
                p.payPolicy?.lateDays ?? 7,
                'required min="0" max="90" step="1"'
              ) +
              field(
                'Short-pay threshold (%)',
                'shortPercent',
                'number',
                p.payPolicy?.shortPercent ?? 10,
                'required min="1" max="100" step="0.1"'
              )
            : ''),
        'Save settings',
        '<p class="field-help">These adjustable rules are not validated predictions. Changing a threshold affects current flags, not earlier case snapshots. Withdrawing consent blocks new capture; existing records remain protected.</p>'
      )
    );
    submit(
      async b => {
        await send('/support/people/' + p.id, 'PATCH', {
          operationId,
          version: p.version,
          personId: p.id,
          consented: b.consented === 'on',
          missingInformation: b.missingInformation
            .split('\n')
            .map(x => x.trim())
            .filter(Boolean),
          reviewDate: b.reviewDate || null,
          payPolicy: {
            lateDays: b.lateDays === undefined ? (p.payPolicy?.lateDays ?? 7) : +b.lateDays,
            shortPercent: b.shortPercent === undefined ? (p.payPolicy?.shortPercent ?? 10) : +b.shortPercent,
          },
        });
      },
      () => profile(p.id)
    );
  }
  function newCase(p, flagKey, assetId) {
    const id = crypto.randomUUID(),
      flag = payFlags(s(), today()).find(f => f.key === flagKey),
      check = s().assetChecks.find(r => r.id === assetId);
    openModal(
      'Agree on support follow-up',
      `<span data-no-translate>${esc(p.name)}</span>`,
      form(
        field(
          'Concern / case title',
          'title',
          'text',
          flag
            ? flag.kind === 'unconfirmed-pay'
              ? 'Check pay receipt'
              : 'Discuss pay shortfall'
            : check
              ? 'Livelihood support needed'
              : '',
          'required maxlength="120"',
          true
        ) +
          note('Agreed action / referral', 'action') +
          select('Assigned to', 'assigneeId', opts(staff(p), 'id', 'name', s().user.id)) +
          field('Next action due', 'dueDate', 'date', today(), 'required') +
          sourceFields(p) +
          '<label class="check field wide"><input type="checkbox" name="agreed" required><span>The person or family agreed to this support action and safe follow-up.</span></label>',
        'Create follow-up',
        `<p class="field-help">${esc(flag?.reason || 'Record an appropriate action with the person. No referral is sent automatically.')}</p>`
      )
    );
    submit(
      async b => {
        await send('/support/cases', 'POST', {
          ...b,
          id,
          personId: p.id,
          sourceKey: flagKey || null,
          assetId: assetId || null,
          agreed: b.agreed === 'on',
        });
        toast('Support follow-up assigned.');
      },
      () => profile(p.id)
    );
  }
  function caseModal(id) {
    const c = s().workerCases.find(c => c.id === id);
    if (!c) {
      toast('This case is unavailable.');
      return;
    }
    const p = person(c.personId);
    const can = p.consented && (s().user.role !== 'officer' || c.assigneeId === s().user.id);
    openModal(
      'Support follow-up',
      `<span data-no-translate>${esc(p.name)} · ${esc(c.title)}</span>`,
      `<div class="explain"><strong>Agreed action</strong><p data-no-translate>${esc(c.action)}</p>${c.sourceSnapshot ? `<p>Source at opening: ${esc(c.sourceSnapshot.reason || c.sourceSnapshot.functioning)}</p>` : ''}</div>${can ? form(select('Case status', 'status', choices(['open', 'in-progress', 'resolved'], c.status)) + select('Assistance status', 'deliveryStatus', choices(['not-started', 'requested', 'received', 'unavailable', 'declined'], c.deliveryStatus)) + select('Assigned to', 'assigneeId', opts(staff(p), 'id', 'name', c.assigneeId)) + field('Next action due', 'dueDate', 'date', c.dueDate, 'required') + field('Date assistance received', 'receivedDate', 'date', c.receivedDate || '', `max="${today()}"`) + note('Outcome / closure reason', 'resolution', c.resolution) + note('Follow-up observations', 'outcomeNotes', c.outcomeNotes), 'Save follow-up') : `<p>${esc(displaySupportValue(c.status))} · ${esc(displaySupportValue(c.deliveryStatus))}</p><p data-no-translate>${esc(c.resolution)}</p>`}<details class="health-history"><summary>Update history (${c.history?.length || 0})</summary>${(c.history || []).map(h => `<p><strong>${esc(h.actor)}</strong> · ${esc(h.at)}<br><span data-no-translate>${esc(h.after.resolution || h.after.outcomeNotes || h.after.status)}</span></p>`).join('')}</details><p class="field-help">Resolving a case does not establish improved financial health. Record assistance actually received and the person’s circumstances.</p>`
    );
    if (can) {
      const operationId = crypto.randomUUID();
      submit(
        async b => {
          await send('/support/cases/' + id, 'PATCH', {
            ...b,
            personId: p.id,
            operationId,
            version: c.version,
            receivedDate: b.receivedDate || null,
          });
          toast('Follow-up saved.');
        },
        () => profile(p.id)
      );
    }
  }
  function payDetails(id) {
    const pay = s().payPeriods.find(p => p.id === id);
    openModal(
      'Pay record detail',
      `<span data-no-translate>${esc(pay.label)}</span>`,
      `<p>Expected take-home: ${unknown(pay.expected, pay.currency)} · Due ${pay.dueDate}</p><h3 class="section-title">Receipts</h3>${table(
        ['Date', 'Received', 'Notes / source', ''],
        s()
          .payReceipts.filter(r => r.payId === id)
          .map(
            r =>
              `<tr class="${r.voided ? 'voided' : ''}"><td>${r.date}</td><td>${unknown(r.amount, r.currency)}</td><td><span data-no-translate>${esc(r.notes)}</span>${provenance(r)}</td><td>${correction(r, 'receipts')}</td></tr>`
          )
      )}<h3 class="section-title">Deductions</h3>${table(
        ['Date / description', 'Deduction', 'Worker account / debt link', ''],
        s()
          .deductions.filter(r => r.payId === id)
          .map(
            r =>
              `<tr class="${r.voided ? 'voided' : ''}"><td>${r.date}<div data-no-translate>${esc(r.label)}</div>${provenance(r)}</td><td>${unknown(r.amount, r.currency)}</td><td>${esc(displaySupportValue(r.status))}${r.debtId ? ' · Included once in debt repayments' : ''}</td><td>${correction(r, 'deductions')}</td></tr>`
          )
      )}<p class="field-help">Deductions are not subtracted from expected take-home pay again. A disputed deduction is a reported concern, not a legal finding.</p>`
    );
    $('#dialog').classList.add('wide-dialog');
  }
  function debtDetails(id) {
    const d = s().workerDebts.find(d => d.id === id);
    openModal(
      'Reported debt history',
      `<span data-no-translate>${esc(d.label)}</span>`,
      table(
        ['Date', 'Entry', 'Amount', 'Source / correction'],
        s()
          .debtEntries.filter(e => e.debtId === id)
          .map(
            e =>
              `<tr class="${e.voided ? 'voided' : ''}"><td>${e.date}</td><td>${e.kind}${e.deductionId ? ' · Linked wage deduction' : ''}</td><td>${money(e.amount, e.currency)}</td><td>${provenance(e)}${e.deductionId ? 'Correct through linked deduction' : correction(e, 'debt-entries')}</td></tr>`
          )
      ) +
        '<p class="field-help">Opening balance: ' +
        unknown(d.opening, d.currency) +
        '. Reported balance only; interest and fees are not inferred.</p>'
    );
  }
  function voidModal(route, id) {
    const r = s()[SUPPORT_ROUTES[route]].find(x => x.id === id);
    openModal(
      'Void incorrect entry',
      'The original remains in history. A linked deduction repayment is reversed with it.',
      form(field('Reason', 'reason', 'text', '', 'required minlength="5" maxlength="500"', true), 'Void entry')
    );
    submit(
      async b => {
        await send('/support/' + route + '/' + id + '/void', 'POST', {
          ...b,
          id: crypto.randomUUID(),
          personId: r.personId,
          version: r.version,
        });
      },
      () => profile(r.personId)
    );
  }
  document.addEventListener('click', async e => {
    const pathway = e.target.closest('[data-support-pathway]');
    if (pathway) {
      filter = filter === pathway.dataset.supportPathway ? '' : pathway.dataset.supportPathway;
      ctx.render();
      return;
    }
    const target = e.target.closest('[data-action^="support-"]');
    if (!target) return;
    const id = target.dataset.id;
    try {
      switch (target.dataset.action) {
        case 'support-person':
          personModal(target.dataset.kind);
          break;
        case 'support-profile':
          profile(id);
          break;
        case 'support-pay':
          addPay(person(id));
          break;
        case 'support-receipt':
          addReceipt(s().payPeriods.find(p => p.id === id));
          break;
        case 'support-debt':
          addDebt(person(id));
          break;
        case 'support-debtentry':
          debtEntry(s().workerDebts.find(d => d.id === id));
          break;
        case 'support-deduction':
          deduction(s().payPeriods.find(p => p.id === id));
          break;
        case 'support-remit':
          remit(person(id));
          break;
        case 'support-remitreceived':
          confirmRemittance(s().remittances.find(r => r.id === id));
          break;
        case 'support-meeting':
          meeting(person(id));
          break;
        case 'support-review':
          review(person(id));
          break;
        case 'support-asset':
          asset(person(id));
          break;
        case 'support-settings':
          settings(person(id));
          break;
        case 'support-newcase':
          newCase(person(id), target.dataset.flag, target.dataset.asset);
          break;
        case 'support-case':
          caseModal(id);
          break;
        case 'support-paydetails':
          payDetails(id);
          break;
        case 'support-debtdetails':
          debtDetails(id);
          break;
        case 'support-void':
          voidModal(target.dataset.route, id);
          break;
        case 'support-bulk':
          await ctx.api('/demo/bulk', 'POST', {});
          await ctx.refresh();
          ctx.render();
          toast('Larger fictional dataset loaded.');
          break;
        case 'support-demo':
          await ctx.api('/support/demo', 'POST', {});
          await ctx.refresh();
          ctx.render();
          toast('Fictional support examples loaded.');
          break;
      }
    } catch (error) {
      toast(error.message);
    }
  });
  function enhance(page) {
    if (['workers', 'prospects', 'livelihood'].includes(page)) {
      $('#support-search').addEventListener('input', e => {
        search = e.target.value;
        const position = e.target.selectionStart;
        ctx.render();
        $('#support-search').focus();
        $('#support-search').setSelectionRange(position, position);
      });
      $('#support-filter')?.addEventListener('change', e => {
        filter = e.target.value;
        ctx.render();
      });
    }
    if (page === 'followups' && s().workerCases.length)
      $('.footer').insertAdjacentHTML(
        'beforebegin',
        `<section class="panel support-case-panel"><div class="panel-header"><h2>Worker & livelihood support cases</h2></div>${caseRows()}</section>`
      );
  }
  return {
    enhance,
    pages: {
      workers: () => directory('workers'),
      prospects: () => directory('prospects'),
      livelihood: () => directory('livelihood'),
    },
  };
}
