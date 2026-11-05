import { entryCurrencies } from '../../shared/catalog.mjs';
import {
  payPosition,
  debtPosition,
  payFlags,
  participationSummary,
  reviewQueue,
  REFUSAL_CATEGORIES,
  FIXABLE,
  SUPPORT_ROUTES,
  displaySupportValue,
} from '../../shared/support.mjs';

export function createSupportUI(ctx) {
  const { esc, money, field, select, opts, button, heading, openModal, formHtml, toast } = ctx,
    $ = s => document.querySelector(s),
    s = () => ctx.getState(),
    today = ctx.today;
  const kinds = {
    'domestic-worker': 'Worker in India',
    'overseas-worker': 'Indian worker abroad / family',
    prospective: 'Person waiting for a loan review',
    livelihood: 'Help with work or a business',
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
      'Who told you this?',
      'source',
      choices(
        ['domestic-worker', 'overseas-worker'].includes(p.kind) ? ['worker', 'family'] : ['member', 'family'],
        p.source
      )
    ) +
    note(
      'Notes (optional)',
      'notes',
      '',
      'Write only what is needed. Do not enter full ID numbers or locations. Use the person’s or family’s account, not an employer’s or recruiter’s.'
    );
  const number = v => (v === '' || v === null || v === undefined ? null : Number(v));
  const table = (headers, rows) =>
    `<div class="table-wrap support-table"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>${rows.length ? '' : '<div class="empty">No records yet.</div>'}</div>`;
  const action = (label, name, id = '', extra = '') =>
    `<button class="text-btn" data-action="support-${name}" data-id="${esc(id)}" ${extra}>${label}</button>`;
  const provenance = r =>
    `<small class="record-source">${esc(r.source)} report · ${esc(r.createdAt?.slice(0, 10) || today())}${r.pending ? ' · Not sent yet' : ''}${r.voided ? ' · Marked incorrect' : ''}</small>`;
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
      await ctx.operationsUI.queueHealth(path, method, payload, 'Person’s record');
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
  let queueExpanded = false;
  function queuePanel() {
    const queue = reviewQueue(s(), today()),
      shown = queueExpanded ? queue : queue.slice(0, 8);
    if (!queue.length)
      return '<section class="panel review-queue"><h3 class="section-title">People to look at again</h3><p class="field-help">Nothing needs another look right now. This list is only a reminder and says nothing about who is eligible.</p></section>';
    const rows = shown
      .map(entry => {
        const p = s().supportPeople.find(x => x.id === entry.personId);
        return `<article class="queue-item"><div><strong data-no-translate>${esc(p.name)}</strong><small>Waiting ${entry.waitingDays} days</small></div><ul>${entry.prompts
          .map(
            prompt =>
              `<li class="${prompt.note ? 'queue-note' : ''}"><span>${esc(prompt.rule)}</span><small data-no-translate>${esc(prompt.evidence)}</small></li>`
          )
          .join('')}</ul>${action('Open record', 'profile', p.id)}</article>`;
      })
      .join('');
    return `<section class="panel review-queue"><h3 class="section-title">People to look at again <small>${queue.length} waiting</small></h3><p class="field-help">These are reminders for staff, listed by how long they have waited. They are not a score and do not rank anyone. Someone who is not listed has not been judged ineligible, and being listed does not decide anything.</p>${rows}${
      queue.length > shown.length
        ? `<button class="text-btn" data-action="support-queue-more">Show all ${queue.length}</button>`
        : queueExpanded && queue.length > 8
          ? '<button class="text-btn" data-action="support-queue-less">Show fewer</button>'
          : ''
    }</section>`;
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
    const title = workers ? 'Workers & families' : page === 'prospects' ? 'Second chance' : 'Loan-use checks';
    const subtitle = workers
      ? 'Record money sent home, pay, money taken from pay, debt and help needed. An unknown amount stays unknown; it is never treated as zero. Start by adding a worker or family, or open an existing record.'
      : page === 'prospects'
        ? 'Keep records for people who were refused or may deserve another look: meetings attended, money sent home, loan use and the reason for refusal. These records do not decide who gets a loan. A person does.'
        : 'Record what the loan paid for and whether it is working. Keep what the family says separate from what you see.';
    return (
      heading(
        workers ? 'Worker support' : 'Community support',
        title,
        subtitle,
        button(
          workers ? 'Add worker / family' : page === 'prospects' ? 'Add person for review' : 'Add work record',
          'support-person',
          'plus',
          false,
          `data-kind="${wanted[0]}"`
        )
      ) +
      (workers
        ? `<div class="support-niches"><button type="button" class="support-pathway ${filter === 'overseas-worker' ? 'selected' : ''}" data-support-pathway="overseas-worker" aria-pressed="${filter === 'overseas-worker'}"><small>Money from abroad</small><strong>Families of workers abroad</strong><span>Money sent home, salary delays and job-related debt</span></button><button type="button" class="support-pathway ${filter === 'domestic-worker' ? 'selected' : ''}" data-support-pathway="domestic-worker" aria-pressed="${filter === 'domestic-worker'}"><small>Work in India</small><strong>Workers in India</strong><span>Pay and money borrowed for work</span></button></div>`
        : '') +
      (s().demo && !s().supportPeople.length
        ? `<div class="review-strip">Try the screens with made-up people and records. ${button('Add sample records', 'support-demo', 'plus', true)}</div>`
        : '') +
      (s().demo && s().user.role === 'admin' && !s().config.bulkDemoLoaded
        ? `<div class="review-strip">Want more examples? Add about 230 made-up members, with their loans and weekly visits, and over 200 records for workers and people waiting for review. ${button('Add more sample records', 'support-bulk', 'plus', true)}</div>`
        : '') +
      (page === 'prospects' ? queuePanel() : '') +
      `<div class="toolbar"><input class="search-input" id="support-search" aria-label="Search support profiles" placeholder="Search by name or member reference…" value="${esc(search)}">${workers ? `<select id="support-filter" aria-label="Type of worker"><option value="">All workers</option>${wanted.map(k => `<option value="${k}" ${filter === k ? 'selected' : ''}>${kinds[k]}</option>`).join('')}</select>` : ''}</div>` +
      table(
        ['Person / reference', workers ? 'Worker type' : 'Latest record', 'Needs attention', ''],
        profiles.map(p => {
          const count = flags.filter(f => f.personId === p.id).length,
            checks = active(s().assetChecks).filter(r => r.personId === p.id),
            last = checks.at(-1),
            summary = participationSummary(s(), p.id);
          return `<tr><td><strong data-no-translate>${esc(p.name)}</strong><div class="field-help" data-no-translate>${esc(p.memberReference || p.memberId || 'Not linked to a member')}</div></td><td>${workers ? kinds[p.kind] : page === 'prospects' ? `${summary.meetings} meetings · ${summary.present} recorded present` : last ? `${last.date} · ${displaySupportValue(last.functioning)}` : 'Not yet checked'}</td><td>${!p.consented ? '<span class="badge gray">Permission withdrawn</span>' : workers ? `${count} pay reminder${count === 1 ? '' : 's'}` : page === 'prospects' ? `${p.missingInformation?.length || 0} missing items${p.reviewDate ? ' · Review ' + p.reviewDate : ''}` : last && ['not-working', 'partly-working'].includes(last.functioning) ? '<span class="badge amber">Follow-up needed</span>' : 'No concern recorded'}${p.pending ? '<div class="field-help">Not sent yet</div>' : ''}</td><td>${action('Open record', 'profile', p.id)}</td></tr>`;
        })
      )
    );
  }
  function personModal(kind) {
    if (!s().groups.length) {
      toast('Add a group first. Then choose which staff can see its records.');
      return;
    }
    const id = crypto.randomUUID();
    openModal(
      'Add a person or family',
      'An officer records this, or the family does with the officer’s help. They do not need a bank account or Sahayog membership. Do not enter full ID numbers.',
      form(
        field('Name the person wants to use', 'name', 'text', '', 'required maxlength="120"', true) +
          select(
            'What kind of record is this?',
            'kind',
            Object.entries(kinds)
              .map(([k, v]) => `<option value="${k}" ${kind === k ? 'selected' : ''}>${v}</option>`)
              .join(''),
            true
          ) +
          select('Which group will support this person?', 'groupId', opts(s().groups)) +
          select(
            'Existing member (optional)',
            'memberId',
            '<option value="">No linked member</option>' + opts(s().members),
            true
          ).replace(' required', '') +
          field('Member number, if they have one (optional)', 'memberReference', 'text', '', 'maxlength="80"') +
          select('Currency for new records', 'currency', currencyOptions('INR')) +
          select(
            'Who told you this?',
            'source',
            choices(
              ['worker', 'family', 'member'],
              kind === 'prospective' || kind === 'livelihood' ? 'member' : 'worker'
            )
          ) +
          field('How can we contact them safely? (optional)', 'safeContact', 'text', '', 'maxlength="300"', true) +
          note('What help might they need? (optional)', 'notes') +
          '<label class="check field wide"><input type="checkbox" name="consented" required><span>The person or family understands why we are keeping this record and freely agrees. The information comes from them, not an employer or recruiter.</span></label>',
        'Save person or family'
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
      : action('Mark an entry as incorrect', 'void', r.id, `data-route="${route}"`);
  function caseRows(personId) {
    return table(
      ['Concern / action', 'Assigned / due', 'Status / assistance', ''],
      (s().workerCases || [])
        .filter(c => !personId || c.personId === personId)
        .map(
          c =>
            `<tr><td><strong data-no-translate>${esc(c.title)}</strong><div class="field-help" data-no-translate>${esc(person(c.personId)?.name)} · ${esc(c.action)}</div></td><td>${esc(c.assignee)}<div class="field-help">${c.dueDate}</div></td><td>${esc(displaySupportValue(c.status))} · ${esc(displaySupportValue(c.deliveryStatus))}${c.pending ? ' · Not sent yet' : ''}</td><td>${action('Open case', 'case', c.id)}</td></tr>`
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
      ? `<div class="actions support-actions">${worker ? action('Add expected pay', 'pay', id) + action('Record debt', 'debt', id) + action('Record money sent home', 'remit', id) : p.kind === 'prospective' ? action('Record meeting', 'meeting', id) + action('Record why a loan was refused', 'refusal', id) + (s().user.role !== 'officer' ? action('Record loan review', 'review', id) : '') : ''}${action('Livelihood check', 'asset', id)}${action('Create support case', 'newcase', id)}</div>`
      : '<div class="review-strip">Permission was withdrawn. You can read earlier records, but cannot add new ones.</div>';
    openModal(
      'Person’s record',
      `<span data-no-translate>${esc(p.name)}</span> · ${kinds[p.kind]}`,
      `<div class="support-profile-head"><div><small>Member number</small><strong data-no-translate>${esc(p.memberReference || p.memberId || 'Not linked to a member')}</strong><p data-no-translate>${esc(p.safeContact || 'No contact instructions recorded')}</p></div>${action('Permission, missing details & reminders', 'settings', id)}</div>${provenance(p)}${p.notes ? `<p class="field-help" data-no-translate>${esc(p.notes)}</p>` : ''}${controls}` +
        (worker
          ? `<h3 class="section-title">Pay to check <small>Reminders based on your settings. These do not predict what will happen.</small></h3>${
              flags
                .map(f => {
                  const c = s().workerCases.find(c => c.sourceKey === 'pay:' + f.payId || c.sourceKey === f.key);
                  return `<article class="support-flag"><div><strong>${f.kind === 'unconfirmed-pay' ? 'Pay not yet confirmed' : f.kind === 'short-pay' ? 'Less pay than expected' : 'Pay is late'}</strong><p>${esc(f.reason)}</p><small>Reminder setting: more than ${f.policy.lateDays} days late, or at least ${f.policy.shortPercent}% less pay than expected.</small></div>${c ? action('View ' + c.status + ' case', 'case', c.id) : action('Open follow-up', 'newcase', id, `data-flag="${esc(f.key)}"`)}</article>`;
                })
                .join('') ||
              '<p class="field-help">No pay reminders right now. This does not tell us whether the family is doing well.</p>'
            }<h3 class="section-title">Pay periods</h3>${table(
              ['Period / expected date', 'Expected pay after deductions', 'Received', ''],
              pay.map(r => {
                const position = payPosition(s(), r, today());
                return `<tr class="${r.voided ? 'voided' : ''}"><td><strong data-no-translate>${esc(r.label)}</strong><div class="field-help">${r.periodStart} – ${r.periodEnd} · Due ${r.dueDate}</div>${provenance(r)}</td><td>${unknown(r.expected, r.currency)}</td><td>${unknown(position.received, r.currency)}${position.received === null ? `<div class="field-help">Amount confirmed so far: ${money(position.knownAmount, r.currency)}</div>` : ''}</td><td>${action('Details', 'paydetails', r.id)}${p.consented && !r.voided ? action('Record pay received', 'receipt', r.id) + action('Record money taken from pay', 'deduction', r.id) : ''}${correction(r, 'pay')}</td></tr>`;
              })
            )}<h3 class="section-title">Money borrowed for work</h3>${table(
              ['Debt, as reported', 'Starting debt / more borrowed', 'Repaid / still owed', ''],
              debts.map(d => {
                const pos = debtPosition(s(), d, today());
                return `<tr class="${d.voided ? 'voided' : ''}"><td><strong data-no-translate>${esc(d.label)}</strong><div class="field-help">${d.kind} · ${d.date}${d.disputed ? ' · Person disagrees' : ''}</div>${provenance(d)}</td><td>${unknown(pos.opening, d.currency)} / ${money(pos.advances, d.currency)}</td><td>${money(pos.repaid, d.currency)} / <strong>${unknown(pos.balance, d.currency)}</strong></td><td>${action('History', 'debtdetails', d.id)}${p.consented && !d.voided ? action('Add money borrowed or repaid', 'debtentry', d.id) : ''}${correction(d, 'debts')}</td></tr>`;
              })
            )}<p class="field-help">These totals use only what the person or family reported. Interest and fees are not added. If the starting debt is unknown, the amount left is also unknown. This is not a legal check of the debt.</p><h3 class="section-title">Money sent home</h3>${table(
              ['Sent', 'Transfer fee (currency sent)', 'Received', 'Source / correction'],
              remits.map(
                r =>
                  `<tr class="${r.voided ? 'voided' : ''}"><td>${r.date}<div>${money(r.sent, r.sentCurrency)}</div></td><td>${unknown(r.fee, r.sentCurrency)}</td><td>${unknown(r.received, r.receivedCurrency)}<div class="field-help">${r.receivedDate || 'Not yet confirmed as received'}</div></td><td>${provenance(r)}${p.consented && !r.voided && r.received === null ? action('Confirm receipt', 'remitreceived', r.id) : ''}${correction(r, 'remittances')}</td></tr>`
              )
            )}<p class="field-help">Money sent home is shown separately from pay and loan repayments. The app does not convert currencies.</p>`
          : '') +
        (p.kind === 'prospective' ? prospectHistory(p) : '') +
        (p.kind === 'livelihood' || s().assetChecks.some(record => record.personId === p.id) ? assetHistory(p) : '') +
        `<h3 class="section-title">Support cases</h3>${caseRows(id)}<p class="field-help">Use these records to agree on help or contact a specialist. The app does not make legal decisions, approve loans or contact services for you.</p>`
    );
    $('#dialog').classList.add('wide-dialog');
  }
  function prospectHistory(p) {
    const summary = participationSummary(s(), p.id);
    return `<h3 class="section-title">Meetings before a loan review</h3><div class="support-summary"><span>${summary.present} present / ${summary.attendanceRecorded} attendance observations</span><span>Contributions: ${totalHtml(summary.savings)}</span><span>${summary.unknownSavings} contribution amounts unknown</span></div><p class="field-help">${p.reviewDate ? 'Review due ' + p.reviewDate + '. ' : ''}Missing information: <span data-no-translate>${esc(p.missingInformation?.join('; ') || 'None specified; completeness not verified')}</span>. Attendance and savings do not prove that someone can repay a loan.</p>${table(
      ['Date', 'Attendance', 'Contribution', 'Source / correction'],
      s()
        .participation.filter(r => r.personId === p.id)
        .map(
          r =>
            `<tr class="${r.voided ? 'voided' : ''}"><td>${r.date}</td><td>${esc(displaySupportValue(r.attendance))}</td><td>${unknown(r.savings, r.currency)}</td><td>${provenance(r)}${correction(r, 'participation')}</td></tr>`
        )
    )}<h3 class="section-title">Why a loan was refused <small>Decided by the lender, outside FieldLedger</small></h3>${table(
      ['Date', 'Main reason', 'Can it be fixed?', 'Explanation', ''],
      (s().refusals || [])
        .filter(r => r.personId === p.id)
        .map(
          r =>
            `<tr class="${r.voided ? 'voided' : ''}"><td>${r.date}</td><td>${esc(displaySupportValue(r.category))}</td><td>${esc(displaySupportValue(r.fixable))}</td><td data-no-translate>${esc(r.reason)}${r.missingItems?.length ? `<div class="field-help">Would address: ${esc(r.missingItems.join('; '))}</div>` : ''}</td><td>${provenance(r)}${correction(r, 'refusals')}</td></tr>`
        )
    )}<h3 class="section-title">Previous loan reviews</h3>${table(
      ['Date', 'Lender’s decision', 'Reason', ''],
      s()
        .reconsiderations.filter(r => r.personId === p.id)
        .map(
          r =>
            `<tr class="${r.voided ? 'voided' : ''}"><td>${r.date}</td><td>${esc(displaySupportValue(r.outcome))}</td><td data-no-translate>${esc(r.reason)}</td><td>${provenance(r)}${correction(r, 'reviews')}</td></tr>`
        )
    )}<p class="field-help">Record the decision made by the lender. FieldLedger does not decide. Getting a loan does not by itself mean the family is better off.</p>`;
  }
  function assetHistory(p) {
    return `<h3 class="section-title">Checks on work and loan use</h3>${table(
      ['Date / intended purchase', 'Actual use / functioning', 'Separate accounts', ''],
      s()
        .assetChecks.filter(r => r.personId === p.id)
        .map(r => {
          const c = s().workerCases.find(c => c.sourceKey === 'asset:' + r.id);
          return `<tr class="${r.voided ? 'voided' : ''}"><td>${r.date}<div data-no-translate>${esc(r.intended)}</div>${provenance(r)}</td><td><span data-no-translate>${esc(r.actual)}</span><div>${esc(displaySupportValue(r.functioning))}</div></td><td><small>What the family says</small><p data-no-translate>${esc(r.explanation || 'Not recorded')}</p><small>What the field worker saw</small><p data-no-translate>${esc(r.officerNotes || 'Not recorded')}</p></td><td>${!r.voided && p.consented ? (c ? action('View follow-up', 'case', c.id) : action('Create follow-up', 'newcase', p.id, `data-asset="${r.id}"`)) : ''}${correction(r, 'assets')}</td></tr>`;
        })
    )}`;
  }
  function addPay(p) {
    createRecord(
      'pay',
      p,
      field('Name for this pay period, e.g. October pay', 'label', 'text', '', 'required maxlength="120"', true) +
        field('Work period starts', 'periodStart', 'date', today(), 'required') +
        field('Work period ends', 'periodEnd', 'date', today(), 'required') +
        field('When should the pay arrive?', 'dueDate', 'date', today(), 'required') +
        select('Pay currency', 'currency', currencyOptions(p.currency)) +
        inputNumber('Pay expected after deductions (leave blank if unknown)', 'expected', '', true),
      b => ({ ...b, expected: number(b.expected) }),
      'Expected pay'
    );
    $('#modal-form').insertAdjacentHTML(
      'afterbegin',
      '<p class="field-help">Enter the pay the worker expects after any planned deductions. Record deductions separately; the app will not subtract them again. Leave the amount blank if it is unknown.</p>'
    );
  }
  function addReceipt(pay) {
    createRecord(
      'receipts',
      person(pay.personId),
      field('Date received or checked', 'date', 'date', today(), `required max="${today()}"`) +
        inputNumber('Pay received · ' + pay.currency + ' (optional)', 'amount', '', true),
      b => ({ ...b, payId: pay.id, amount: number(b.amount) }),
      'Record pay receipt'
    );
    $('#modal-form').insertAdjacentHTML(
      'afterbegin',
      '<p class="field-help">Enter each payment once. Enter 0 if no money was received at this check. Leave blank if you do not know the amount. Add a new record for a later payment.</p>'
    );
  }
  function addDebt(p) {
    createRecord(
      'debts',
      p,
      field('What was the money borrowed for?', 'label', 'text', '', 'required maxlength="120"', true) +
        select('Debt type', 'kind', choices(['recruitment', 'advance', 'other'], 'advance')) +
        field('Date of the starting amount', 'date', 'date', today(), `required max="${today()}"`) +
        select('Debt currency', 'currency', currencyOptions(p.currency)) +
        inputNumber('Amount owed at the start (leave blank if unknown)', 'opening', '', true) +
        '<label class="check field wide"><input type="checkbox" name="disputed"><span>The person disagrees with the amount or says they should not owe it.</span></label>',
      b => ({ ...b, opening: number(b.opening), disputed: b.disputed === 'on' }),
      'Record reported debt'
    );
  }
  function debtEntry(d) {
    createRecord(
      'debt-entries',
      person(d.personId),
      select('Money coming in or going out', 'kind', choices(['repayment', 'advance'], 'repayment')) +
        field('Date', 'date', 'date', today(), `required max="${today()}"`) +
        inputNumber('Amount · ' + d.currency, 'amount').replace('min="0"', 'min="0.01"'),
      b => ({ ...b, debtId: d.id, amount: number(b.amount) }),
      'Add money borrowed or repaid'
    );
    $('#modal-form').insertAdjacentHTML(
      'afterbegin',
      '<p class="field-help">If money taken from pay is already linked to this debt, do not add it again. It is already in the repayment history.</p>'
    );
  }
  function deduction(pay) {
    const p = person(pay.personId),
      debts = s().workerDebts.filter(d => d.personId === p.id && d.currency === pay.currency);
    createRecord(
      'deductions',
      p,
      field('Why was money taken from pay?', 'label', 'text', '', 'required maxlength="120"', true) +
        field('Date', 'date', 'date', today(), `required max="${today()}"`) +
        inputNumber('Deducted amount · ' + pay.currency + ' (optional)', 'amount', '', true) +
        select(
          'Does the worker agree with this deduction?',
          'status',
          choices(['unknown', 'agreed', 'disputed'], 'unknown')
        ) +
        select(
          'Did this repay a recorded debt? (optional)',
          'debtId',
          '<option value="">No linked debt</option>' + opts(debts, 'id', 'label'),
          true
        ).replace(' required', '') +
        '<label class="check field wide"><input type="checkbox" name="confirmedRepayment"><span>The worker or family says this money really paid back the selected debt. Add it once as a repayment.</span></label>',
      b => ({
        ...b,
        payId: pay.id,
        amount: number(b.amount),
        debtId: b.debtId || null,
        confirmedRepayment: b.confirmedRepayment === 'on',
      }),
      'Record money taken from pay'
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
      'Record money sent home'
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
        toast('Money received recorded; the sent amount is unchanged.');
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
        inputNumber('Money saved by choice (leave blank if unknown)', 'savings', '', true),
      b => ({ ...b, savings: number(b.savings) }),
      'Record a meeting before a loan review'
    );
  }
  function review(p) {
    createRecord(
      'reviews',
      p,
      field('Review date', 'date', 'date', today(), `required max="${today()}"`) +
        select(
          'What did the lender decide?',
          'outcome',
          choices(['awaiting-information', 'reviewed', 'accepted-externally', 'not-accepted', 'withdrawn'], 'reviewed')
        ) +
        note('Why did the lender make this decision?', 'reason'),
      b => b,
      'Record the lender’s review'
    );
  }
  function refusal(p) {
    createRecord(
      'refusals',
      p,
      field('Date the lender decided', 'date', 'date', today(), `required max="${today()}"`) +
        select('Main reason', 'category', choices(REFUSAL_CATEGORIES, 'documentation')) +
        select('Can it be fixed?', 'fixable', choices(FIXABLE, 'unknown')) +
        field(
          'What would address it (optional, separate with ;)',
          'missingItems',
          'text',
          '',
          'maxlength="300"',
          true
        ) +
        note('Reason, in the lender’s words', 'reason'),
      b => ({
        ...b,
        missingItems: (b.missingItems || '')
          .split(';')
          .map(x => x.trim())
          .filter(Boolean),
      }),
      'Record why a loan was refused'
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
        field('What was the loan meant to pay for?', 'intended', 'text', '', 'required maxlength="120"', true) +
        field('What does the person say it was used for?', 'actual', 'text', '', 'required maxlength="120"', true) +
        select(
          'Functioning status',
          'functioning',
          choices(['unknown', 'working', 'partly-working', 'not-working', 'not-seen'], 'unknown'),
          true
        ) +
        note('What the family says', 'explanation') +
        note('What the field worker saw', 'officerNotes'),
      b => ({ ...b, loanId: b.loanId || null }),
      'Quick livelihood check'
    );
  }
  function settings(p) {
    const operationId = crypto.randomUUID();
    openModal(
      'Permission & record settings',
      `<span data-no-translate>${esc(p.name)}</span>`,
      form(
        '<label class="check field wide"><input type="checkbox" name="consented" ' +
          (p.consented ? 'checked' : '') +
          '><span>The person or family still agrees to this record.</span></label>' +
          note(
            'What details are missing? (one per line)',
            'missingInformation',
            (p.missingInformation || []).join('\n')
          ) +
          field('Next loan review date (optional)', 'reviewDate', 'date', p.reviewDate || '') +
          (['domestic-worker', 'overseas-worker'].includes(p.kind)
            ? field(
                'Flag after this many late days',
                'lateDays',
                'number',
                p.payPolicy?.lateDays ?? 7,
                'required min="0" max="90" step="1"'
              ) +
              field(
                'Remind me when pay is short by this much (%)',
                'shortPercent',
                'number',
                p.payPolicy?.shortPercent ?? 10,
                'required min="1" max="100" step="0.1"'
              )
            : ''),
        'Save settings',
        '<p class="field-help">These settings create reminders, not predictions. Changes affect today’s reminders, not earlier follow-up notes. If permission is withdrawn, earlier records stay protected but no new records can be added.</p>'
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
              : 'Discuss missing pay'
            : check
              ? 'Help with work or a business needed'
              : '',
          'required maxlength="120"',
          true
        ) +
          note('What help did you agree on?', 'action') +
          select('Assigned to', 'assigneeId', opts(staff(p), 'id', 'name', s().user.id)) +
          field('Next follow-up date', 'dueDate', 'date', today(), 'required') +
          sourceFields(p) +
          '<label class="check field wide"><input type="checkbox" name="agreed" required><span>The person or family agreed to this help and how we will follow up safely.</span></label>',
        'Create follow-up',
        `<p class="field-help">${esc(flag?.reason || 'Agree on the next step with the person. You must contact services yourself.')}</p>`
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
      `<div class="explain"><strong>Agreed action</strong><p data-no-translate>${esc(c.action)}</p>${c.sourceSnapshot ? `<p>Reason this follow-up was opened: ${esc(c.sourceSnapshot.reason || c.sourceSnapshot.functioning)}</p>` : ''}</div>${can ? form(select('Follow-up status', 'status', choices(['open', 'in-progress', 'resolved'], c.status)) + select('Help received', 'deliveryStatus', choices(['not-started', 'requested', 'received', 'unavailable', 'declined'], c.deliveryStatus)) + select('Assigned to', 'assigneeId', opts(staff(p), 'id', 'name', c.assigneeId)) + field('Next follow-up date', 'dueDate', 'date', c.dueDate, 'required') + field('Date assistance received', 'receivedDate', 'date', c.receivedDate || '', `max="${today()}"`) + note('What happened, or why was the follow-up closed?', 'resolution', c.resolution) + note('Notes from the follow-up', 'outcomeNotes', c.outcomeNotes), 'Save follow-up') : `<p>${esc(displaySupportValue(c.status))} · ${esc(displaySupportValue(c.deliveryStatus))}</p><p data-no-translate>${esc(c.resolution)}</p>`}<details class="health-history"><summary>Update history (${c.history?.length || 0})</summary>${(c.history || []).map(h => `<p><strong>${esc(h.actor)}</strong> · ${esc(h.at)}<br><span data-no-translate>${esc(h.after.resolution || h.after.outcomeNotes || h.after.status)}</span></p>`).join('')}</details><p class="field-help">Closing a follow-up does not mean the problem is solved. Record what help was received and how the person is doing.</p>`
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
      `<p>Expected pay after deductions: ${unknown(pay.expected, pay.currency)} · Due ${pay.dueDate}</p><h3 class="section-title">Receipts</h3>${table(
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
      )}<p class="field-help">Deductions are not subtracted from expected pay again. A disagreement records the worker’s concern; it is not a legal decision.</p>`
    );
    $('#dialog').classList.add('wide-dialog');
  }
  function debtDetails(id) {
    const d = s().workerDebts.find(d => d.id === id);
    openModal(
      'Debt, as reported history',
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
        '<p class="field-help">Money available at the start: ' +
        unknown(d.opening, d.currency) +
        '. Reported balance only; interest and fees are not inferred.</p>'
    );
  }
  function voidModal(route, id) {
    const r = s()[SUPPORT_ROUTES[route]].find(x => x.id === id);
    openModal(
      'Mark an entry as incorrect',
      'The old entry stays in history but is no longer counted. If it created a debt repayment, that repayment is also removed from the total.',
      form(
        field('Reason', 'reason', 'text', '', 'required minlength="5" maxlength="500"', true),
        'Mark entry as incorrect'
      )
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
        case 'support-refusal':
          refusal(person(id));
          break;
        case 'support-queue-more':
          queueExpanded = true;
          ctx.render();
          break;
        case 'support-queue-less':
          queueExpanded = false;
          ctx.render();
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
