import {LANGUAGES,CURRENCIES,currencyDigits} from '../../shared/catalog.mjs';
import { OfflineVault } from './offline.js';
import {translate,activeLanguage,languagePicker} from './i18n.js';

export function createOperationsUI(ctx) {
  const {api,esc,money,field,select,opts,button,heading,openModal,formHtml,handleForm,toast}=ctx;
  const state=()=>ctx.getState();
  const $=s=>document.querySelector(s);
  const supervisor=()=>state().user.role!=='officer';
  const administrator=()=>state().user.role==='admin';
  let vault=null,syncing=false,importCsv='';
  function bindVault(){const owner=state().config.workspaceId+'-'+state().user.id;if(vault?.owner!==owner){vault?.lock();vault=new OfflineVault(owner);ctx.setPending([]);}return vault;}
  function download(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function inferCurrency(v){return v.currency||state().loans.find(l=>l.id===v.loanId)?.currency||state().members.find(m=>m.id===v.memberId)?.currency||state().settings.currency;}
  function setMoneySteps(scope,currency){if(!scope)return;for(const input of scope.querySelectorAll('input[name="income"],input[name="expenses"],input[name="principal"],input[name="installment"],input[name="paid"],input[name="savings"]'))input.step=String(10**-currencyDigits(currency));}
  document.addEventListener('change',e=>{if(e.target.matches('#modal-form select[name="currency"]')){setMoneySteps($('#modal-form'),e.target.value);const paid=$('#modal-form [name="paid"]'),savings=$('#modal-form [name="savings"]');if(paid)paid.value=0;if(savings)savings.value=0;}});
  function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>${!rows.length?'<div class="empty">No records yet.</div>':''}</div>`;}
  function refreshUI(){return ctx.refresh().then(()=>ctx.render());}
  function staffOptions(memberId){const m=state().members.find(m=>m.id===memberId);return state().staff.filter(u=>u.active&&(u.role!=='officer'||u.groupIds.includes(m?.groupId)));}
  function enhance(page) {
    bindVault();
    $('.top-actions').insertAdjacentHTML('afterbegin',languagePicker(activeLanguage(state())));
    if(!administrator())document.querySelectorAll('[data-nav="staff"],[data-nav="settings"]').forEach(el=>el.remove());
    if(!supervisor())document.querySelectorAll('[data-action="group"],[data-action="loan"],[data-action="export"]').forEach(el=>el.remove());
    if(page==='members'&&supervisor())$('.page-heading .actions').insertAdjacentHTML('afterbegin',button('Import CSV','import','down',true));
    if(page==='groups')document.querySelectorAll('.group-card').forEach((card,i)=>card.querySelector('.actions').insertAdjacentHTML('afterbegin',button('Group meeting','meeting','calendar',false,`data-id="${state().groups[i].id}"`)));
    if(page==='meetings') {
      document.querySelectorAll('.schedule-card').forEach((row,i)=>row.insertAdjacentHTML('beforeend',button('Group meeting','meeting','group',true,`data-id="${state().groups[i].id}"`)));
      const visits=state().visits.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).slice(0,8);
      document.querySelectorAll('.visit-item').forEach((row,i)=>row.insertAdjacentHTML('beforeend',visitActions(visits[i])));
      const note=$('.content>.explain');if(note)note.innerHTML='<strong>Offline capture</strong><br>Unlock Offline records with a device passphrase before working without a connection. Pending visits are encrypted on this device. Reconnect and sign in to sync. Keep the passphrase: it cannot be recovered.';
    }
    if(page==='loans')document.querySelectorAll('tbody tr').forEach((row,i)=>row.lastElementChild.insertAdjacentHTML('beforeend',`<div><button class="text-btn" data-action="schedule" data-id="${state().loans[i].id}">Schedule</button></div>`));
    if(page==='settings')enhanceSettings();
    translate($('#app'),activeLanguage(state()));
  }
  function visitActions(v){return `<div class="actions visit-actions"><button class="text-btn" data-action="receipt" data-id="${v.id}">Receipt</button><button class="text-btn" data-action="history" data-id="${v.id}">History</button>${supervisor()?`<button class="text-btn" data-action="correct" data-id="${v.id}">Correct</button>`:''}</div>`;}
  function enhanceModal(title) {
    if(!state())return;
    if(title==='Add a member') {
      $('#modal-form .form-grid').insertAdjacentHTML('beforeend',state().config.questions.map(q=>field(esc(q.label),'custom_'+q.id,q.type==='number'?'number':'text','',(q.required?'required ':'')+(q.type==='number'?'step="any" min="-100000000" max="100000000"':'maxlength="300"'),true).replace('<label','<label data-no-translate')).join(''));
    }
    if(!supervisor())document.querySelectorAll('#dialog [data-action="loan"],#dialog [data-action="export"]').forEach(el=>el.remove());
    const memberBtn=$('#dialog [data-action="visit"][data-id]');
    if(memberBtn) {
      const id=memberBtn.dataset.id;
      memberBtn.parentElement.insertAdjacentHTML('beforeend',button('Create follow-up','followup','calendar',true,`data-id="${id}"`));
      const records=state().visits.filter(v=>v.memberId===id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
      document.querySelectorAll('#dialog .visit-item').forEach((row,i)=>row.insertAdjacentHTML('beforeend',visitActions(records[i])));
      const m=state().members.find(m=>m.id===id);
      if(Object.keys(m.customFields||{}).length)$('#dialog .kv').insertAdjacentHTML('beforeend',Object.entries(m.customFields).map(([key,value])=>`<div data-no-translate><small>${esc(m.customFieldLabels?.[key]||state().config.questions.find(q=>q.id===key)?.label||'Archived question')}</small>${esc(value)}</div>`).join(''));
    }
    const sections={
      'Add a member':[['currency','Member details'],['income','Household budget'],['identityType','Identity details']],
      'Record a field visit':[['currency','Visit details'],['paid','Collections'],['utilisation','Observations']],
      'Record an approved loan':[['memberId','Member & currency'],['principal','Repayment plan']]
    };
    const grid=$('#modal-form .form-grid');
    if(grid&&sections[title]) {
      for(const [name,label] of sections[title]) {
        const field=grid.querySelector(`[name="${name}"]`)?.closest('.field');
        if(field)field.insertAdjacentHTML('beforebegin',`<h3 class="form-section">${label}</h3>`);
      }
      $('#modal-form').insertAdjacentHTML('afterbegin','<p class="form-guide">Review the details before saving. Fields marked * are required.</p>');
    }
    setMoneySteps($('#dialog'),$('#dialog select[name="currency"]')?.value||state().settings.currency);
    translate($('#dialog'),activeLanguage(state()));
  }
  function memberFields(form){return Object.fromEntries(state().config.questions.filter(q=>form['custom_'+q.id]!==undefined&&form['custom_'+q.id]!=='').map(q=>[q.id,q.type==='number'?Number(form['custom_'+q.id]):form['custom_'+q.id]]));}

  function meetingModal(groupId) {
    const group=state().groups.find(g=>g.id===groupId),members=state().members.filter(m=>m.groupId===groupId);
    openModal('Group meeting',esc(group.name)+' · Select the members you observed.',`<form id="meeting-form"><label class="field">Meeting date<input type="date" name="date" value="${ctx.today()}" max="${ctx.today()}" required></label><p class="field-help">Only checked rows are saved. Enter amounts actually received. All online rows save together.</p><div class="table-wrap"><table><thead><tr><th>Include / member</th><th>Attendance</th><th>Loan</th><th>Currency</th><th>Repaid</th><th>Saved</th></tr></thead><tbody>${members.map(m=>{
      const loans=state().loans.filter(l=>l.memberId===m.id&&ctx.outstanding(l)>0);
      return `<tr data-member="${m.id}" data-visit="${crypto.randomUUID()}"><td><label class="check"><input type="checkbox" name="included"><span data-no-translate>${esc(m.name)}</span></label></td><td><select name="attendance" aria-label="Attendance for ${esc(m.name)}"><option value="present">Present</option><option value="absent">Absent</option><option value="excused">Excused</option></select></td><td><select name="loanId" aria-label="Loan for ${esc(m.name)}"><option value="">No payment</option>${loans.map(l=>`<option value="${l.id}">${l.currency} · ${l.id}</option>`).join('')}</select></td><td><select name="currency" aria-label="Currency for ${esc(m.name)}">${ctx.currencyOptions(m.currency||state().settings.currency)}</select></td><td><input name="paid" aria-label="Repayment for ${esc(m.name)}" type="number" min="0" step="0.01" value="0"></td><td><input name="savings" aria-label="Savings for ${esc(m.name)}" type="number" min="0" step="0.01" value="0"></td></tr>`;
    }).join('')}</tbody></table></div><div class="form-error" role="alert"></div><div class="form-actions"><button type="button" class="btn secondary" data-action="close">Cancel</button><button class="btn" type="submit">Save meeting</button></div></form>`);
    $('#dialog').classList.add('wide-dialog');
    $('#meeting-form').addEventListener('change',e=>{
      const row=e.target.closest('tr[data-member]');if(!row)return;
      const currency=row.querySelector('[name="currency"]');
      if(e.target.name==='loanId'){
        const loan=state().loans.find(l=>l.id===e.target.value);
        if(loan&&currency.value!==loan.currency){currency.value=loan.currency;row.querySelector('[name="paid"]').value=0;row.querySelector('[name="savings"]').value=0;}
        currency.disabled=Boolean(loan);
      }
      if(e.target.name==='currency'){row.querySelector('[name="paid"]').value=0;row.querySelector('[name="savings"]').value=0;}
      setMoneySteps(row,currency.value);
    });
    document.querySelectorAll('#meeting-form tr[data-member]').forEach(row=>setMoneySteps(row,row.querySelector('[name="currency"]').value));
    $('#meeting-form').addEventListener('submit',async e=>{
      e.preventDefault();const f=e.currentTarget,submit=f.querySelector('[type="submit"]');submit.disabled=true;
      try{
        const date=f.elements.date.value,visits=[...f.querySelectorAll('tr[data-member]')].filter(row=>row.querySelector('[name="included"]').checked).map(row=>({id:row.dataset.visit,memberId:row.dataset.member,date,attendance:row.querySelector('[name="attendance"]').value,loanId:row.querySelector('[name="loanId"]').value,currency:row.querySelector('[name="currency"]').value,paid:Number(row.querySelector('[name="paid"]').value),savings:Number(row.querySelector('[name="savings"]').value),utilisation:'not-checked',note:''}));
        if(!visits.length)throw new Error('Select at least one member.');
        if(navigator.onLine)await api('/meetings','POST',{groupId,date,visits});else await queueVisits(visits);
        $('#dialog').close();if(navigator.onLine)await ctx.refresh();ctx.render();toast(navigator.onLine?'Group meeting saved.':'Meeting records encrypted on this device.');
      }catch(err){f.querySelector('.form-error').textContent=err.message;}finally{submit.disabled=false;}
    });
  }

  async function receipt(id) {
    const r=await api(`/visits/${id}/receipt`);
    openModal('Collection receipt',`${esc(r.number)} · Version ${r.version}`,`<div class="receipt-sheet"><div class="receipt-brand">FieldLedger / ${esc(r.organization)}</div><h3>Collection receipt</h3><p><span data-no-translate>${esc(r.member.name)}</span> · ${esc(r.member.id)}</p><p>${esc(r.date)} · Recorded by ${esc(r.officer)}</p><div class="receipt-lines"><div>Principal repayment <strong>${money(r.paid,r.currency)}</strong></div><div>Savings contribution <strong>${money(r.savings,r.currency)}</strong></div><div class="receipt-total">Total received <strong>${money(r.total,r.currency)}</strong></div>${r.loanId?`<div>Loan balance on this date <strong>${money(r.loanBalanceOnDate,r.currency)}</strong></div>`:''}</div><p class="field-help">Receipt ${esc(r.number)} / revision ${r.version}${r.corrected?' · Corrected record: this version supersedes earlier receipts.':''}</p><p class="field-help">Currency: ${esc(r.currency)}. Savings are recorded contributions, not a deposit-account balance.</p></div><div class="form-actions"><button class="btn" data-action="print">Print receipt</button></div>`);
    $('#dialog').classList.add('printable');
  }
  async function loanSchedule(id) {
    const data=await api(`/loans/${id}/schedule`);
    openModal('Repayment schedule',`${id} · Principal only, interest free`,`<div class="profile-stats"><div class="profile-stat"><small>Paid</small><b>${money(data.totalPaid,data.currency)}</b></div><div class="profile-stat"><small>Balance</small><b>${money(data.balance,data.currency)}</b></div><div class="profile-stat"><small>Past-due amount</small><b>${money(data.arrears,data.currency)}</b></div></div><p class="field-help">As of ${esc(data.asOf)}. First installment is one repayment interval after the start date. Payments cover the oldest installments first.</p>${table(['#','Due date','Scheduled','Paid','Remaining','Status'],data.rows.map(r=>`<tr><td>${r.number}</td><td>${r.dueDate}</td><td>${money(r.due,data.currency)}</td><td>${money(r.paid,data.currency)}</td><td>${money(r.remaining,data.currency)}</td><td><span class="badge ${['overdue','partial'].includes(r.status)?'amber':''}">${r.status}</span></td></tr>`))}`);
  }
  function correctModal(id) {
    const v=state().visits.find(v=>v.id===id);
    openModal('Correct a field record','The original values remain in correction history. Currency: '+v.currency,formHtml(field('Principal repayment received','paid','number',v.paid,'required min="0" step="0.01"')+field('Savings contributed','savings','number',v.savings,'required min="0" step="0.01"')+select('Attendance','attendance',opts(['present','absent','excused','not-recorded'].map(x=>({id:x,name:x})),'id','name',v.attendance))+select('Loan utilisation check','utilisation',opts(['not-checked','verified','follow-up'].map(x=>({id:x,name:x})),'id','name',v.utilisation))+field('Field notes','note','text',v.note,'maxlength="1000"',true)+field('Reason for correction','reason','text','','required minlength="5" maxlength="500"',true),'Save correction'));
    setMoneySteps($('#dialog'),v.currency);
    handleForm(async b=>{await api(`/visits/${id}`,'PATCH',{...b,paid:+b.paid,savings:+b.savings,version:v.version});toast('Correction saved with original values in history.');});
  }
  async function history(id) {
    const data=await api(`/visits/${id}/history`);
    openModal('Correction history',`Visit ${esc(id)} · Current version ${data.visit.version}`,data.revisions.map(r=>`<section class="history-entry"><strong>${esc(r.actor)} · ${esc(new Date(r.at).toLocaleString())}</strong><p data-no-translate>${esc(r.reason)}</p>${table(['Field','Before','After'],['attendance','paid','savings','utilisation','note'].filter(key=>r.before[key]!==r.after[key]).map(key=>`<tr><td>${key}</td><td data-no-translate>${['paid','savings'].includes(key)?money(r.before[key],data.visit.currency):esc(r.before[key])}</td><td data-no-translate>${['paid','savings'].includes(key)?money(r.after[key],data.visit.currency):esc(r.after[key])}</td></tr>`))}</section>`).join('')||'<div class="empty">No corrections. This is the original observation.</div>');
  }

  function followupsPage() {
    const open=state().followups.filter(f=>f.status!=='resolved').length;
    return heading('Member support','Follow-up cases',`${open} open ${open===1?'case':'cases'}. Assign responsibility and record the outcome.`,button('Create follow-up','followup'))+`<section class="panel">${table(['Member / case','Assigned to','Due date','Status',''],state().followups.map(f=>`<tr><td><strong data-no-translate>${esc(f.title)}</strong><div class="field-help">${esc(state().members.find(m=>m.id===f.memberId)?.name)}</div></td><td>${esc(f.assignee)}</td><td>${f.dueDate}</td><td><span class="badge ${f.status!=='resolved'&&f.dueDate<ctx.today()?'amber':''}">${f.status}</span></td><td><button class="text-btn" data-action="case" data-id="${f.id}">Open case</button></td></tr>`))}</section>`;
  }
  function followupModal(memberId) {
    if(!state().members.length){toast('Enroll a member first.');return;}
    const selected=memberId||state().members[0].id;
    openModal('Create follow-up','Describe the support needed and who will follow through.',formHtml(select('Member','memberId',opts(state().members,'id','name',selected),true)+field('Case title','title','text','','required maxlength="120"',true)+select('Assigned to','assigneeId',opts(staffOptions(selected),'id','name',state().user.id))+field('Due date','dueDate','date',ctx.today(),'required')+field('Notes','notes','text','','maxlength="1000"',true),'Create case'));
    $('#modal-form [name="memberId"]').addEventListener('change',e=>$('#modal-form [name="assigneeId"]').innerHTML=opts(staffOptions(e.target.value),'id','name',state().user.id));
    handleForm(async b=>{await api('/followups','POST',b);toast('Follow-up assigned.');});
  }
  function caseModal(id) {
    const linked=state().supportPlans?.find(p=>p.followupId===id);if(linked){document.dispatchEvent(new CustomEvent('open-support-plan',{detail:linked.id}));return;}
    const f=state().followups.find(f=>f.id===id),canEdit=supervisor()||f.assigneeId===state().user.id;
    openModal(esc(f.title),`${esc(f.assignee)} · Due ${f.dueDate}`,`<p data-no-translate>${esc(f.notes||'No extra notes.')}</p>${canEdit?formHtml(select('Status','status',opts(['open','in-progress','resolved'].map(x=>({id:x,name:x})),'id','name',f.status),true)+field('Outcome / resolution notes','resolution','text',f.resolution,'maxlength="1000"',true),'Update case'):`<p>${esc(f.status)} · ${esc(f.resolution)}</p>`}`);
    if(canEdit)handleForm(async b=>{await api(`/followups/${id}`,'PATCH',{...b,version:f.version});toast('Case updated.');});
  }

  function staffPage() {
    return heading('Access management','Staff accounts','Officers see assigned groups. Supervisors review records. Administrators manage the workspace.',button('Add staff account','staff'))+`<section class="panel">${table(['Name / username','Role','Groups','Status',''],state().staff.map(u=>`<tr><td><strong>${esc(u.name)}</strong><div class="field-help">${esc(u.username)}</div></td><td>${u.role}</td><td>${u.role==='officer'?u.groupIds.map(id=>esc(state().groups.find(g=>g.id===id)?.name||id)).join(', ')||'No groups assigned':'All groups'}</td><td><span class="badge ${u.active?'':'gray'}">${u.active?'Active':'Disabled'}</span></td><td>${u.id!=='admin'?`<button class="text-btn" data-action="staff" data-id="${u.id}">Manage</button>`:'Server administrator'}</td></tr>`))}</section>`;
  }
  function staffModal(id) {
    const u=state().staff.find(u=>u.id===id);
    openModal(u?'Manage staff account':'Add staff account','Passwords are hashed on the server. Share initial credentials directly with the staff member.',formHtml((!u?field('Name','name','text','','required')+field('Username','username','text','','required pattern="[a-zA-Z0-9._-]{3,40}"'):'')+select('Role','role',opts(['officer','supervisor','admin'].map(x=>({id:x,name:x})),'id','name',u?.role||'officer'))+field(u?'New password (leave blank to keep)':'Initial password','password','password','',`${u?'':'required'} minlength="12" maxlength="200" autocomplete="new-password"`)+`<fieldset class="field wide"><legend>Assigned groups (for field officers)</legend>${state().groups.map(g=>`<label class="check"><input type="checkbox" name="groupId" value="${g.id}" ${u?.groupIds.includes(g.id)?'checked':''}><span>${esc(g.name)}</span></label>`).join('')||'<p>Create a group first.</p>'}</fieldset>`+(u?`<label class="check field wide"><input type="checkbox" name="active" ${u.active?'checked':''}><span>Account active</span></label>`:''),u?'Save account':'Create account'));
    handleForm(async b=>{const payload={...b,groupIds:[...document.querySelectorAll('#modal-form [name="groupId"]:checked')].map(el=>el.value),active:b.active==='on'};await api(id?`/staff/${id}`:'/staff',id?'PATCH':'POST',payload);toast('Staff account saved.');});
  }

  function queuePage() {
    const meta=bindVault().metadata(),legacy=localStorage.getItem('fl-queue');
    return heading('Device storage','Offline records','Pending visits, check-ins and support updates stay encrypted until they sync.',button(meta.locked?'Unlock records':'Lock records',meta.locked?'unlock':'lock','shield',true)+button('Sync now','sync','activity'))+`<div class="explain">Use a device passphrase of at least 12 characters. It is never sent to the server. Records lock when you reload or sign out. A forgotten passphrase cannot be recovered. Encryption protects stored records; use a trusted, locked device.</div>${legacy&&state().user.id==='admin'?'<div class="review-strip">Earlier unencrypted pending visits were found. Unlock this vault, then use “Protect earlier records” to migrate them.<button class="text-btn" data-action="migrate-queue">Protect earlier records</button></div>':''}<section class="panel" style="margin-top:24px">${meta.locked?`<div class="empty">${meta.count} encrypted records · Locked</div>`:table(['Member','Date','Amounts','Sync status',''],vault.records.map(v=>`<tr><td>${esc(state().members.find(m=>m.id===v.memberId)?.name||v.memberId)}</td><td>${v.date}</td><td>${v._kind?esc(v._kind):money(v.paid,v.currency)+' repaid / '+money(v.savings,v.currency)+' saved'}</td><td>${esc(v._error||'Waiting')}</td><td><button class="text-btn" data-action="queue-edit" data-id="${v.id}">Review / edit</button></td></tr>`))}</section>`;
  }
  function unlockModal() {
    openModal('Unlock offline records','Use the same device passphrase each time. Choose one now if this vault is new.',formHtml(field('Device passphrase','password','password','','required minlength="12" autocomplete="off"',true),'Unlock'));
    handleForm(async b=>{await bindVault().unlock(b.password);await vault.save(vault.records.map(v=>({...v,currency:inferCurrency(v)})));ctx.setPending(vault.records);toast('Offline records unlocked for this tab.');});
  }
  async function queueVisits(visits) {
    bindVault();if(!vault.key)throw new Error('Unlock Offline records before capturing visits without a connection.');
    const next=[...vault.records];
    for(const v of visits){if(next.some(p=>!p._kind&&p.memberId===v.memberId&&p.date===v.date&&inferCurrency(p)===inferCurrency(v))||state().visits.some(p=>p.memberId===v.memberId&&p.date===v.date&&p.currency===inferCurrency(v)))throw new Error('A visit already exists for a selected member and date.');next.push({...v,currency:inferCurrency(v),capturedBy:state().user.id});}
    await vault.save(next);ctx.setPending(vault.records);
  }
  function queueEdit(id) {
    const v=vault.records.find(v=>v.id===id);
    if(v._kind){
      const labels={date:'Date',memberId:'Member',response:'Response status',shortfallDays:'Days unable to afford essentials',stress:'Financial stress',essentials:'Unmet essentials',causes:'Reported circumstances',currency:'Currency',income:'Income',expenses:'Spending',explanation:'Household explanation',officerNotes:'Officer observations',supportPreference:'Support preference',borrowing:'Borrowing response',supportHelpfulness:'Support feedback',milestone:'Outcome milestone',action:'Agreed action',notes:'Notes',startDate:'Plan start',dueDate:'Next action due',deliveryStatus:'Delivery status',status:'Case status',receivedDate:'Date received',requestedDate:'Date requested',endedDate:'Support ended',deliveryNotes:'Delivery notes',resolution:'Closure reason',amount:'Expected amount',kind:'Entry type',label:'Purpose',voluntaryConfirmed:'Voluntary response confirmed',agreed:'Household agreement'};
      const values=Object.entries(v.payload).filter(([key])=>labels[key]).map(([key,value])=>`<div><small>${labels[key]}</small><span data-no-translate>${esc(key==='memberId'?state().members.find(m=>m.id===value)?.name||value:value===null||value===''?'Unknown / not provided':Array.isArray(value)?value.join(', '):typeof value==='boolean'?value?'Yes':'No':value)}</span></div>`).join('');
      openModal('Review pending household record',esc(v._kind),`<p class="form-error">${esc(v._error||'Waiting to sync')}</p><div class="kv">${values}</div><p class="field-help">For a conflict, compare with the current household record, discard this copy, and re-enter the corrected details. Nothing is discarded automatically.</p><button class="btn secondary" data-action="queue-discard" data-id="${id}">Discard this pending copy…</button>`);return;
    }
    openModal('Review pending visit','Edits affect this unsynced copy only. Currency: '+v.currency+'. A matching server record is never overwritten.',formHtml(field('Visit date','date','date',v.date,`required max="${ctx.today()}"`)+select('Attendance','attendance',opts(['present','absent','excused','not-recorded'].map(x=>({id:x,name:x})),'id','name',v.attendance))+field('Repayment','paid','number',v.paid,'required min="0" step="0.01"')+field('Savings','savings','number',v.savings,'required min="0" step="0.01"')+select('Loan','loanId','<option value="">No loan payment</option>'+opts(state().loans.filter(l=>l.memberId===v.memberId&&l.currency===v.currency),'id','id',v.loanId),true)+field('Notes','note','text',v.note,'maxlength="1000"',true),'Save pending changes',`<p class="field-help">${esc(v._error||'Not synced yet.')} If the server already has this visit, correct that server record or discard this pending duplicate after checking it.</p><button class="text-btn" type="button" data-action="queue-discard" data-id="${id}">Discard this pending copy…</button>`));
    setMoneySteps($('#dialog'),v.currency);
    handleForm(async b=>{await vault.save(vault.records.map(r=>r.id===id?{...r,...b,paid:+b.paid,savings:+b.savings,_error:''}:r));ctx.setPending(vault.records);toast('Pending copy updated.');});
  }
  async function sync() {
    if(!state())return;if(syncing)return;bindVault();
    if(!navigator.onLine){toast('Offline. Pending records remain on this device.');return;}
    if(vault.metadata().count&&!vault.key){toast('Unlock Offline records to sync pending records.');return;}
    syncing=true;let saved=0,sessionExpired=false;
    try {
      for(const record of [...vault.records]) {
        try{const {_error,...payload}=record;if(record._kind)await api(record._path,record._method,record.payload);else await api('/visits','POST',payload);await vault.save(vault.records.filter(v=>v.id!==record.id));saved++;}
        catch(e){if(e.status===401){sessionExpired=true;break;}await vault.save(vault.records.map(v=>v.id===record.id?{...v,_error:e.message}:v));}
      }
      if(sessionExpired){toast('Sign in and unlock the vault to continue syncing. Remaining records are preserved.');return;}
      ctx.setPending(vault.records);await refreshUI();toast(`${saved} synced. ${vault.records.length} pending${vault.records.length?' — review individual errors in Offline records':''}.`);
    }finally{syncing=false;}
  }

  function importModal() {
    importCsv='';openModal('Import members from CSV','Preview validates every row. Import is all-or-nothing.',`<p class="field-help">Use existing group IDs. Identity references contain four digits only. Imports do not verify identity or grant sharing permission.</p><button class="btn secondary" data-action="csv-template">Download CSV template</button><label class="field" style="margin-top:20px">Choose CSV file<input id="csv-file" type="file" accept=".csv,text/csv"></label><div id="csv-preview"></div><div class="form-error" role="alert"></div><div class="form-actions"><button class="btn secondary" data-action="csv-preview">Preview CSV</button><button class="btn" id="csv-commit" data-action="csv-commit" disabled>Import members</button></div>`);
    $('#csv-file').addEventListener('change',async e=>{importCsv=await e.target.files[0]?.text()||'';$('#csv-commit').disabled=true;$('#csv-preview').textContent='';});
  }
  async function csvPreview(){const result=await api('/import/members','POST',{csv:importCsv,commit:false});$('#csv-preview').innerHTML=`<p>${result.valid} of ${result.total} valid rows.</p>${result.errors.map(e=>`<p class="form-error">Row ${e.row}: ${esc(e.error)}</p>`).join('')}${table(['Name','Group','Livelihood'],result.preview.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.groupId)}</td><td>${esc(m.business)}</td></tr>`))}`;$('#csv-commit').disabled=result.errors.length>0;}
  function enhanceSettings() {
    const panel=$('.settings-grid .panel:last-child .panel-body');
    panel.innerHTML=`<div class="explain"><strong>Protected backups</strong><br>Download an encrypted backup of records, staff accounts, configuration and correction history. Keep the passphrase separate from the backup file.</div><div class="actions" style="margin:20px 0">${button('Download backup','backup','down',true)}${button('Configure forms & language','config','settings',true)}</div><p class="online-note">Restore with the documented command into a new data directory. The administrator password is configured on the server and is not included in backups.</p>`;
  }
  function configModal() {
    const c=state().config;
    openModal('Forms & language','Changes apply to new enrollments. Existing answers remain in member history.',formHtml(select('Language','language',opts(LANGUAGES,'code','name',c.language),true)+field('Time zone','timeZone','text',c.timeZone||'Asia/Manila','required',true)+`<label class="field wide">Accepted identity document types (one per line)<textarea name="acceptedIds" required>${esc(c.acceptedIds.join('\n'))}</textarea></label><div class="field wide"><span>Additional enrollment questions</span><div id="question-list">${c.questions.map(q=>questionRow(q)).join('')}</div><button class="text-btn" type="button" data-action="add-question">Add question</button></div>`,'Save configuration'));
    handleForm(async b=>{const questions=[...$('#question-list').querySelectorAll('.question-row')].map(row=>({id:row.dataset.id||undefined,label:row.querySelector('[name="q-label"]').value,type:row.querySelector('[name="q-type"]').value,required:row.querySelector('[name="q-required"]').checked}));await api('/config','POST',{language:b.language,timeZone:b.timeZone,acceptedIds:b.acceptedIds.split('\n').map(x=>x.trim()).filter(Boolean),questions});toast('Enrollment configuration saved.');});
  }
  function questionRow(q={}){return `<div class="question-row" data-id="${esc(q.id||'')}"><input name="q-label" aria-label="Question label" placeholder="Question label" value="${esc(q.label||'')}" required maxlength="80"><select name="q-type" aria-label="Answer type"><option value="text">Text</option><option value="number" ${q.type==='number'?'selected':''}>Number</option></select><label class="check"><input name="q-required" type="checkbox" ${q.required?'checked':''}>Required</label><button type="button" class="text-btn" data-action="remove-question">Remove</button></div>`;}
  function backupModal(){openModal('Download encrypted backup','Use a unique passphrase and keep it somewhere safe.',formHtml(field('Backup passphrase','password','password','','required minlength="12" maxlength="200" autocomplete="new-password"',true),'Encrypt & download'));handleForm(async b=>{const archive=await api('/backup','POST',b);download(`fieldledger-backup-${ctx.today()}.json`,archive);toast('Encrypted backup downloaded.');});}

  document.addEventListener('click',async e=>{
    const target=e.target.closest('[data-action]');if(!target)return;const id=target.dataset.id;
    try{if(syncing&&['queue-edit','queue-discard','lock','unlock','migrate-queue'].includes(target.dataset.action))throw new Error('Wait for syncing to finish before changing pending records.');switch(target.dataset.action){
      case 'meeting':meetingModal(id);break;
      case 'receipt':await receipt(id);break;
      case 'print':window.print();break;
      case 'schedule':await loanSchedule(id);break;
      case 'correct':correctModal(id);break;
      case 'history':await history(id);break;
      case 'followup':followupModal(id);break;
      case 'case':caseModal(id);break;
      case 'staff':staffModal(id);break;
      case 'unlock':unlockModal();break;
      case 'lock':vault.lock();ctx.setPending([]);ctx.render();break;
      case 'queue-edit':queueEdit(id);break;
      case 'queue-discard':openModal('Discard pending copy?','This removes only the unsynced copy on this device. Check the server record first.',formHtml('<label class="check field wide"><input type="checkbox" required>I checked this copy and want to discard it.</label>','Discard copy'));handleForm(async()=>{await vault.save(vault.records.filter(v=>v.id!==id));ctx.setPending(vault.records);});break;
      case 'migrate-queue':if(!vault.key)throw new Error('Unlock the vault first.');if(state().user.id!=='admin')throw new Error('Administrator access required.');await queueVisits(JSON.parse(localStorage.getItem('fl-queue')||'[]'));localStorage.removeItem('fl-queue');ctx.render();break;
      case 'import':importModal();break;
      case 'csv-template':{const quote=v=>'\"'+String(v).replaceAll('\"','\"\"')+'\"';const questions=state().config.questions;const headers=['name','groupId','business','income','expenses','household','earners','identityType','identitySuffix','currency',...questions.map(q=>'question:'+q.label)];const row=['Example Member',state().groups[0]?.id||'GROUP_ID','Market trading',15000,10000,4,2,state().config.acceptedIds[0],'1234',state().settings.currency,...questions.map(q=>q.type==='number'?'0':'Example answer')];download('fieldledger-members-template.csv',headers.map(quote).join(',')+'\n'+row.map(quote).join(',')+'\n','text/csv');break;}
      case 'csv-preview':await csvPreview();break;
      case 'csv-commit':target.disabled=true;try{const result=await api('/import/members','POST',{csv:importCsv,commit:true});$('#dialog').close();await refreshUI();toast(`${result.imported} members imported.`);}finally{target.disabled=false;}break;
      case 'backup':backupModal();break;
      case 'config':configModal();break;
      case 'add-question':if($('#question-list').children.length>=10)throw new Error('At most 10 questions supported.');$('#question-list').insertAdjacentHTML('beforeend',questionRow());break;
      case 'remove-question':target.closest('.question-row').remove();break;
    }}catch(err){const error=$('#dialog[open] .form-error');if(error)error.textContent=err.message;else toast(err.message);}
  });
  async function queueHealth(path,method,payload,kind){bindVault();if(!vault.key)throw new Error('Unlock Offline records before capturing household records.');const id=payload.operationId||payload.id;if(vault.records.some(r=>r.id===id))throw new Error('This record is already queued. Review Offline records.');await vault.save([...vault.records,{id,memberId:payload.memberId,date:payload.date||ctx.today(),_kind:kind,_path:path,_method:method,payload:{...payload,capturedBy:state().user.id}}]);ctx.setPending(vault.records);}
  return {queueHealth,enhance,enhanceModal,memberFields,queueVisit:v=>queueVisits([v]),sync,isSyncing:()=>syncing,lock:()=>{vault?.lock();ctx.setPending([]);},pages:{followups:followupsPage,queue:queuePage,staff:staffPage}};
}
