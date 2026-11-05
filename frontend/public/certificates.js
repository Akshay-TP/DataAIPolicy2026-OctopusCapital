import {
  canonicalJson,
  closureBlockers,
  verifyCertificate,
  verifyWithdrawalList,
  displayCertificateResult,
} from '../../shared/certificates.mjs';

export function createCertificateUI(ctx) {
  const { esc, field, select, opts, button, heading, openModal, formHtml, toast } = ctx;
  const handleForm = (callback, after) => ctx.handleForm(callback, after, { refreshAfter: 'always' });
  const state = () => ctx.getState(),
    $ = selector => document.querySelector(selector),
    settings = () => state().credentialSettings;
  const authorised = () => ['admin', 'supervisor'].includes(state().user.role);
  const download = (name, value) => {
    const url = URL.createObjectURL(new Blob([canonicalJson(value)], { type: 'application/json' })),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const action = (label, name, id = '') =>
    `<button class="text-btn" data-action="cert-${name}" data-id="${esc(id)}">${label}</button>`;
  const check = (name, label) =>
    `<label class="check field wide"><input type="checkbox" name="${name}" required><span>${label}</span></label>`;
  const note = (label, name) =>
    `<label class="field wide"><span>${label}</span><textarea name="${name}" required minlength="5" maxlength="500"></textarea></label>`;
  const table = (headers, rows) =>
    `<div class="table-wrap"><table><thead><tr>${headers.map(label => `<th>${label}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>${rows.length ? '' : '<p class="empty">No records yet.</p>'}</div>`;
  const recipientName = id => settings().keys.find(key => key.issuerId === id)?.name || id;
  let tab = 'issue',
    inputText = '',
    verified = null,
    report = null,
    localStatus = [],
    owner = '';
  function previewFields(payload) {
    return `<dl class="certificate-fields">${[
      ['What this proves', 'This lender confirms that this loan is fully repaid. It does not cover other loans.'],
      ['Issued by', payload.issuerName],
      ['Borrower reference', payload.subjectRef],
      ['Loan reference', payload.loanRef],
      ['Who should receive it?', recipientName(payload.recipientId)],
      ['Date the loan was checked', payload.assessmentDate],
      ['Prepared', payload.preparedAt],
      ['Expires', payload.expiresAt],
      ['Proof number', payload.id],
    ]
      .map(([label, value]) => `<div><dt>${label}</dt><dd data-no-translate>${esc(value)}</dd></div>`)
      .join(
        ''
      )}</dl><details class="health-history"><summary>Exact wording in the signed file</summary><p>${esc(payload.statement)}</p></details>${payload.synthetic ? '<p class="review-strip">Made-up demo record. This is not proof from a real lender.</p>' : ''}`;
  }
  function page() {
    const nextOwner = state().config.workspaceId + '-' + state().user.id;
    if (owner !== nextOwner) {
      owner = nextOwner;
      inputText = '';
      verified = null;
      report = null;
      localStatus = [];
    }
    const config = settings();
    return (
      heading(
        'Loan repayment proof',
        'Proof a loan is repaid',
        'Create or check proof that one loan has been fully repaid. Check the document, the person presenting it and whether your organisation accepts it as separate steps.',
        action('Download cancellation list', 'status') +
          (state().user.role === 'admin' ? action('Rules for accepting proof', 'policy') : '')
      ) +
      `<div class="explain"><strong>${esc(config.issuer?.name || 'Verification workspace')}</strong><br>${config.synthetic ? 'This demo uses made-up organisations and records. It does not show that a real lender has agreed to use or accept these files.' : 'Your organisation must agree which lenders it trusts and when it will accept their proof.'} Without internet, checks use saved lender signatures and cancellation lists. A later cancellation may not appear yet.</div><div class="certificate-tabs" role="tablist">${['issue', 'verify'].map(value => `<button role="tab" aria-selected="${tab === value}" class="btn ${tab === value ? '' : 'secondary'}" data-action="cert-tab" data-id="${value}">${value === 'issue' ? 'Create proof' : 'Check received proof'}</button>`).join('')}</div>` +
      (tab === 'issue' ? issuancePage() : verificationPage())
    );
  }
  function issuancePage() {
    return `<section class="panel"><div class="panel-header"><h2>Proof waiting for review</h2>${authorised() && settings().issuer ? button('Start a proof of repayment', 'cert-prepare', 'plus') : ''}</div>${!settings().issuer ? '<p class="panel-body">This team cannot issue proof yet. Ask your server administrator to set up the organisation’s digital signature.</p>' : ''}${table(
      ['Loan / borrower', 'Record checked / progress', ''],
      state().closureReviews.map(
        row =>
          `<tr><td><strong data-no-translate>${esc(row.payload.loanRef)}</strong><div data-no-translate>${esc(row.payload.subjectRef)}</div></td><td>${esc(row.sourceSystem)} · ${esc(displayCertificateResult(row.status))}<div class="field-help">${row.payload.assessmentDate}</div></td><td>${action('Open review', 'review', row.id)}</td></tr>`
      )
    )}</section><section class="panel certificate-section"><div class="panel-header"><h2>Proof already issued</h2></div>${table(
      ['Proof / loan', 'Issue date / status', ''],
      state().certificates.map(
        row =>
          `<tr><td data-no-translate>${esc(row.envelope.payload.loanRef)}<div class="field-help">${esc(row.id)}</div></td><td>${row.issuedAt.slice(0, 10)} · ${row.withdrawal ? 'Cancelled' : 'Issued'}${row.withdrawal ? `<div class="field-help" data-no-translate>${esc(row.withdrawal.reason)}</div>` : ''}</td><td>${action('Download or print', 'delivery', row.id)}${authorised() && !row.withdrawal ? action('Withdraw', 'withdraw', row.id) : ''}${authorised() ? action('Create corrected proof', 'replace', row.id) : ''}</td></tr>`
      )
    )}</section>`;
  }
  function prepare(loanId = '', replacesId = null) {
    const loans = state().loans,
      keys = [
        ...new Map(
          settings()
            .keys.filter(key => !key.disabled)
            .map(key => [key.issuerId, key])
        ).values(),
      ];
    if (!loans.length) {
      toast('Add the loan and check its records first.');
      return;
    }
    const chosen =
        loans.find(row => row.id === loanId) || loans.find(row => !closureBlockers(state(), row.id).length) || loans[0],
      id = crypto.randomUUID();
    openModal(
      'Check the loan’s official records',
      'Check the lender’s official records. A zero balance here does not by itself prove that all money owed has been paid.',
      formHtml(
        select('Which loan?', 'loanId', opts(loans, 'id', 'id', chosen.id), true) +
          field('Borrower reference to share', 'subjectRef', 'text', chosen.memberId, 'required maxlength="60"') +
          field('Loan reference to share', 'loanRef', 'text', chosen.id, 'required maxlength="60"') +
          select(
            'Who will receive this proof?',
            'recipientId',
            opts(keys, 'issuerId', 'name', keys.find(key => key.issuerId !== settings().issuer.issuerId)?.issuerId),
            true
          ) +
          select(
            'Where are the official loan records?',
            'sourceSystem',
            '<option value="fieldledger">FieldLedger loan records</option><option value="BR.NET">BR.NET (you must check it yourself)</option><option value="other-external">Another system (you must check it yourself)</option>',
            true
          ) +
          field(
            'Note where you checked the records (not shared)',
            'sourceReference',
            'text',
            '',
            'required minlength="5" maxlength="300"',
            true
          ) +
          field('Date the loan was checked', 'assessmentDate', 'date', ctx.today(), `required max="${ctx.today()}"`) +
          field('How many days should this proof stay valid?', 'validDays', 'number', 30, 'required min="1" max="365" step="1"') +
          check(
            'authoritativeClosed',
            'I checked the official records. This loan is closed and fully paid, including anything owed outside FieldLedger.'
          ) +
          check('paymentsFinal', 'I checked all payments. They are complete, and none are still waiting to clear.') +
          check(
            'noPendingCorrections',
            'No corrections are still needed, including records on field devices that have not reached the server.'
          ),
        'Show what will be shared',
        '<p class="field-help">Use reference numbers agreed with the borrower, never full ID numbers. Check BR.NET yourself if needed. Next, show the borrower exactly what will be shared and ask permission.</p>'
      )
    );
    handleForm(
      async body => {
        const blockers = closureBlockers(state(), body.loanId);
        if (blockers.length) throw new Error(blockers.join('. '));
        await ctx.rawApi('/certificates/reviews', 'POST', {
          ...body,
          id,
          replacesId,
          validDays: +body.validDays,
          authoritativeClosed: true,
          paymentsFinal: true,
          noPendingCorrections: true,
        });
      },
      () => review(id)
    );
  }
  function review(id) {
    const row = state().closureReviews.find(record => record.id === id);
    if (!row) {
      toast('Review unavailable. Refresh the workspace.');
      return;
    }
    const borrowerForm = ['prepared', 'correction-requested'].includes(row.status)
      ? formHtml(
          select(
            'What does the borrower want to do?',
            'decision',
            '<option value="approved">Share this proof with the named organisation</option><option value="correction-requested">Correct something first — do not issue proof</option>',
            true
          ) +
            check(
              'explained',
              'I explained every field, what this proof covers, when it expires and who will receive it, in a language the borrower understands.'
            ) +
            '<label class="check field wide"><input type="checkbox" name="consented"><span>The borrower agrees to share exactly this information with the organisation shown.</span></label>' +
            note('Review notes or changes needed (not shared)', 'note'),
          'Record borrower’s choice'
        )
      : row.status === 'borrower-reviewed' && authorised()
        ? formHtml(
            check('authorised', 'My organisation has given me permission to issue this proof.'),
            'Sign and issue proof'
          )
        : '';
    openModal(
      'Show the borrower what will be shared',
      'Check every field with the borrower before sharing.',
      previewFields(row.payload) +
        `<details class="health-history"><summary>File details for technical checks</summary><pre class="certificate-json" data-no-translate>${esc(canonicalJson(row.payload))}</pre></details><details class="health-history"><summary>Staff record of checks</summary><p>Source: ${esc(row.sourceSystem)}</p><p data-no-translate>${esc(row.sourceReference)}</p><p class="record-fingerprint">Record version checked: ${esc(row.sourceVersion)}</p><p>Recorded by ${esc(row.createdBy)}. Status: ${esc(displayCertificateResult(row.status))}.</p></details>` +
        borrowerForm
    );
    $('#dialog').classList.add('wide-dialog');
    if (['prepared', 'correction-requested'].includes(row.status))
      handleForm(
        async body => {
          await ctx.rawApi(`/certificates/reviews/${id}/borrower`, 'POST', {
            ...body,
            version: row.version,
            explained: true,
            consented: body.consented === 'on',
          });
        },
        () => review(id)
      );
    else if (row.status === 'borrower-reviewed' && authorised())
      handleForm(async () => {
        await ctx.rawApi(`/certificates/reviews/${id}/issue`, 'POST', { authorised: true });
        toast('Proof signed and issued.');
      });
  }
  async function delivery(id) {
    const data = await ctx.rawApi(`/certificates/issued/${id}/delivery`),
      payload = data.envelope.payload;
    openModal(
      'Proof this loan is fully repaid',
      'The file and QR code contain the same signed proof.',
      `<article class="certificate-paper"><h2>Loan fully repaid</h2>${data.withdrawal ? '<p class="review-strip">CANCELLED — do not use this proof.</p>' : ''}${previewFields(payload)}<img class="certificate-qr" src="${data.qr}" alt="QR code containing the signed proof"><p>Give this file or printed QR code to the organisation shown. They must check their trusted lender list and a recent cancellation list. They must also check who is presenting it and decide whether to accept the proof.</p></article><div class="form-actions"><button class="btn secondary" id="certificate-file">Download proof file</button><a class="btn secondary" href="${data.qr}" download="${esc(id)}.png">Download QR image</a><button class="btn" data-action="print">Print proof</button></div>`
    );
    $('#dialog').classList.add('wide-dialog', 'printable');
    $('#certificate-file').onclick = () => download(id + '.json', data.envelope);
  }
  function withdraw(id) {
    openModal(
      'Cancel this proof',
      'The proof and its issue history stay on record. A cancellation tells others not to rely on it.',
      formHtml(note('Reason (internal)', 'reason'), 'Cancel this proof')
    );
    handleForm(async body => {
      await ctx.rawApi(`/certificates/issued/${id}/withdraw`, 'POST', body);
      toast('Proof cancelled. Download the updated cancellation list and give it to the organisations checking the proof.');
    });
  }
  function policy() {
    const p = settings().policy;
    openModal(
      'Rules for accepting loan proof',
      'These rules apply only to checking loan repayment proof. They do not decide whether someone gets a loan.',
      formHtml(
        field(
          'How old can a saved cancellation list be? (hours)',
          'maxStatusAgeHours',
          'number',
          p.maxStatusAgeHours,
          'required min="0" max="168" step="0.25"'
        ) +
          `<label class="check field wide"><input type="checkbox" name="requireLiveStatus" ${p.requireLiveStatus ? 'checked' : ''}><span>Require a fresh check with the issuing lender. A saved list is not enough. This app cannot make a live check, so acceptance will stay blocked.</span></label>`,
        'Save rules'
      )
    );
    handleForm(async body => {
      await ctx.rawApi('/certificates/policy', 'POST', {
        maxStatusAgeHours: +body.maxStatusAgeHours,
        requireLiveStatus: body.requireLiveStatus === 'on',
      });
    });
  }
  function verificationPage() {
    return `<details class="health-history"><summary>Trusted lenders and signature keys (${settings().keys.length} keys)</summary>${table(
      ['Lender / signature key', 'Signature key (public)', 'Trusted until'],
      settings().keys.map(
        key =>
          `<tr><td>${esc(key.name)}<div>${esc(key.keyId)}</div></td><td class="record-fingerprint">${esc(key.publicKey)}</td><td>${esc(key.validUntil)}${key.disabled ? ' · Disabled' : ''}</td></tr>`
      )
    )}<p class="field-help">Your organisation chooses which lender signatures to trust. Opening a proof file cannot add a lender to this list.</p></details><section class="panel"><div class="panel-body"><h2>Check a loan repayment proof</h2><p class="field-help">Choose a proof file, upload a photo of its QR code, or paste the file text below. Checks run on this device without contacting the lender. Only signatures already trusted by your organisation are accepted.</p><div class="certificate-imports"><label class="field">Proof file (.json)<input id="certificate-upload" type="file" accept="application/json,.json"></label><label class="field">Photo or image of the QR code<input id="certificate-image" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="field">Signed cancellation list (.json)<input id="certificate-status" type="file" accept="application/json,.json"></label></div><label class="field">Or paste the proof file text<textarea id="certificate-text" rows="5" maxlength="20000" placeholder="Paste all the text from the proof file…">${esc(inputText)}</textarea></label><button class="btn" id="certificate-verify">Check this proof</button><p class="form-error" id="certificate-error" role="alert"></p><div id="certificate-result" aria-live="polite"></div></div></section><section class="panel certificate-section"><div class="panel-header"><h2>Earlier checks of proof</h2></div>${table(
      ['Date / purpose', 'Identity', 'Decision on this proof', 'Reason'],
      state().certificateDecisions.map(
        row =>
          `<tr><td>${row.createdAt.slice(0, 10)}<div class="field-help">Proof of loan repayment${row.pending ? ' · Not sent yet' : ''}</div></td><td>${esc(displayCertificateResult(row.identity))}</td><td>${esc(displayCertificateResult(row.acceptance))}</td><td data-no-translate>${esc(row.reason)}</td></tr>`
      )
    )}</section>`;
  }
  function clearVerification() {
    verified = null;
    report = null;
    $('#certificate-result').innerHTML = '';
    $('#certificate-error').textContent = '';
  }
  async function verify() {
    try {
      const text = inputText,
        account = owner,
        envelope = JSON.parse(text),
        statusLists = [...settings().statusLists, ...localStatus],
        result = await verifyCertificate(envelope, {
          ...settings(),
          statusLists,
        });
      if (text !== inputText || account !== owner || tab !== 'verify' || !$('#certificate-result')) return;
      report = result;
      verified = envelope;
      const statusSnapshot =
        statusLists.find(
          snapshot =>
            snapshot.payload?.issuerId === envelope.payload?.issuerId &&
            snapshot.payload?.issuedAt === result.statusIssuedAt
        ) || null;
      const labels = {
        format: 'Type of proof',
        issuer: 'Trusted lender signature key',
        signature: 'Digital signature (checks for changes)',
        dates: 'Is it still within its valid dates?',
        recipient: 'Who should receive it?',
        withdrawal: 'Cancellation check',
      };
      $('#certificate-result').innerHTML = `<h3 class="section-title">Document check results</h3>${table(
        ['Check', 'Result'],
        Object.entries(labels).map(
          ([key, label]) => `<tr><td>${label}</td><td>${esc(displayCertificateResult(report[key]))}</td></tr>`
        )
      )}<p class="field-help">Cancellation list saved: ${esc(report.statusIssuedAt || 'Not available')}. ${report.statusAgeHours === null ? 'We do not know how old the list is.' : `Age ${report.statusAgeHours.toFixed(2)} hours; maximum allowed ${settings().policy.maxStatusAgeHours} hours.`} A cancellation made after this list was saved may not appear here.</p><p class="explain">${report.evidenceValid ? 'The document checks pass using this saved list. Next, check who is presenting it and decide whether your organisation accepts the proof.' : 'Something still needs checking. Do not accept this proof yet.'}</p><form id="certificate-decision"><div class="form-grid">${select('Link to a member (optional)', 'applicantMemberId', '<option value="">Not linked to a member</option>' + opts(state().members), true)}${select('Does it belong to the person presenting it?', 'identity', '<option value="unresolved">Not checked yet</option><option value="matched">Yes — staff checked their identity separately</option><option value="mismatched">It does not match this person</option>', true)}${note('How did you check their identity, or what is still unclear?', 'identityNotes')}${select('Does your organisation accept this proof of repayment?', 'acceptance', '<option value="manual-review">Staff need to check further</option><option value="accepted">Accept as proof of this loan’s repayment only</option><option value="not-accepted">Not accepted</option>', true)}${note('Explain your decision or what needs checking', 'reason')}</div><p class="form-error" role="alert"></p><div class="form-actions"><button class="btn">Save this check</button></div></form>`;
      const decisionId = crypto.randomUUID();
      $('#certificate-decision').onsubmit = async event => {
        event.preventDefault();
        const f = event.currentTarget,
          submit = f.querySelector('button');
        submit.disabled = true;
        try {
          const body = Object.fromEntries(new FormData(f));
          if (body.acceptance === 'accepted' && (!report.evidenceValid || body.identity !== 'matched'))
            throw new Error('The document checks must pass, and you must check that it belongs to the person presenting it.');
          const payload = {
            ...body,
            id: decisionId,
            envelope: verified,
            statusSnapshot,
            applicantMemberId: body.applicantMemberId || null,
          };
          if (!navigator.onLine)
            await ctx.operationsUI.queueHealth('/certificates/decisions', 'POST', payload, 'Loan proof check');
          else await ctx.api('/certificates/decisions', 'POST', payload);
          if (!ctx.operationsUI.unlocked()) await ctx.refresh();
          ctx.render();
          toast('Check saved. This does not approve a loan.');
        } catch (error) {
          f.querySelector('.form-error').textContent = error.message;
        } finally {
          submit.disabled = false;
        }
      };
    } catch (error) {
      $('#certificate-error').textContent =
        error instanceof SyntaxError ? 'Paste the full text from the proof file.' : error.message;
    }
  }
  function enhance() {
    if (tab !== 'verify') return;
    $('#certificate-text').oninput = event => {
      inputText = event.target.value;
      clearVerification();
    };
    $('#certificate-verify').onclick = verify;
    $('#certificate-upload').onchange = async event => {
      try {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 20000) throw new Error('Certificate files must be under 20 KB.');
        inputText = await file.text();
        $('#certificate-text').value = inputText;
        clearVerification();
        await verify();
      } catch (error) {
        $('#certificate-error').textContent = error.message;
      }
    };
    $('#certificate-image').onchange = async event => {
      try {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 5000000) throw new Error('Use a QR image smaller than 5 MB.');
        if (!window.jsQR)
          throw new Error('The QR reader is not ready. Open the app while connected once, or use the proof file instead.');
        const image = await createImageBitmap(file),
          scale = Math.min(1, 2000 / image.width, 2000 / image.height),
          canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        image.close();
        const found = window.jsQR(
          context.getImageData(0, 0, canvas.width, canvas.height).data,
          canvas.width,
          canvas.height
        );
        if (!found)
          throw new Error('No readable QR found. Use a sharper image showing the full QR and its white border.');
        inputText = found.data;
        $('#certificate-text').value = inputText;
        clearVerification();
        await verify();
      } catch (error) {
        $('#certificate-error').textContent = error.message;
      }
    };
    $('#certificate-status').onchange = async event => {
      try {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 90000) throw new Error('Use a status snapshot smaller than 90 KB.');
        const envelope = JSON.parse(await file.text()),
          result = await verifyWithdrawalList(envelope, settings().keys);
        if (!result.valid) throw new Error(displayCertificateResult(result.reason));
        const prior = [...settings().statusLists, ...localStatus].filter(
          row => row.payload.issuerId === envelope.payload.issuerId
        );
        if (
          prior.some(
            row =>
              row.payload.sequence > envelope.payload.sequence ||
              row.payload.issuedAt > envelope.payload.issuedAt ||
              row.payload.withdrawn.some(
                old => !envelope.payload.withdrawn.some(next => next.id === old.id && next.at === old.at)
              )
          )
        )
          throw new Error('This list is older or is missing known cancellations. Ask for an updated signed list.');
        localStatus.push(envelope);
        try {
          await ctx.rawApi('/certificates/status/import', 'POST', { envelope });
          await ctx.refresh();
          toast('Verified status snapshot saved.');
        } catch (error) {
          if (error.status === 403) {
            toast(
              'This signed list will be saved with your check. Only a supervisor or administrator can update the list shared by your team.'
            );
          } else if (error.status && error.status < 500) {
            localStatus = localStatus.filter(row => row !== envelope);
            await ctx.refresh();
            throw error;
          } else toast('The signed list is attached. The server will check it again when you send this record.');
        }
        if (inputText) await verify();
      } catch (error) {
        $('#certificate-error').textContent = error.message;
      }
    };
  }
  document.addEventListener('click', async event => {
    const target = event.target.closest('[data-action^="cert-"]');
    if (!target) return;
    try {
      const id = target.dataset.id;
      switch (target.dataset.action) {
        case 'cert-tab':
          tab = id;
          ctx.render();
          break;
        case 'cert-prepare':
          prepare();
          break;
        case 'cert-review':
          review(id);
          break;
        case 'cert-delivery':
          await delivery(id);
          break;
        case 'cert-withdraw':
          withdraw(id);
          break;
        case 'cert-replace': {
          const prior = state().certificates.find(row => row.id === id);
          prepare(prior.loanId, id);
          break;
        }
        case 'cert-status':
          download('signed-withdrawals.json', await ctx.rawApi('/certificates/status'));
          break;
        case 'cert-policy':
          policy();
          break;
      }
    } catch (error) {
      toast(error.message);
    }
  });
  return { page, enhance };
}
