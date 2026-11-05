import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewQueue } from '../shared/support.mjs';
import { launch, client } from './helpers.mjs';

const TODAY = '2026-11-05';
const person = (id, extra = {}) => ({
  id,
  name: id,
  kind: 'prospective',
  consented: true,
  createdAt: '2026-06-01T09:00:00.000Z',
  missingInformation: [],
  reviewDate: null,
  history: [],
  ...extra,
});
const state = (people, rest = {}) => ({
  supportPeople: people,
  participation: [],
  reconsiderations: [],
  refusals: [],
  ...rest,
});
const refusal = (personId, extra = {}) => ({
  id: personId + '-r',
  personId,
  date: '2026-09-01',
  category: 'documentation',
  fixable: 'yes',
  missingItems: [],
  reason: 'Address proof out of date',
  ...extra,
});

test('queue prompts name their rule and evidence and never carry a score', () => {
  const queue = reviewQueue(state([person('a', { reviewDate: '2026-10-01' })]), TODAY);
  assert.equal(queue.length, 1);
  const [prompt] = queue[0].prompts;
  assert.equal(prompt.key, 'review-due');
  assert.match(prompt.rule, /review date/i);
  assert.match(prompt.evidence, /2026-10-01/);
  assert.deepEqual(Object.keys(queue[0]).sort(), ['personId', 'prompts', 'since', 'waitingDays']);
  assert.ok(!JSON.stringify(queue).match(/score|probab|likel|rank/i));
});

test('each trigger fires only when its condition holds', () => {
  const s = state(
    [
      person('future-review', { reviewDate: '2026-12-01' }),
      person('fixable', {}),
      person('not-fixable', {}),
      person('reviewed-since', {}),
      person('stale-info', { missingInformation: ['Proof of address'], history: [{ at: '2026-08-01T09:00:00.000Z' }] }),
      person('fresh-info', { missingInformation: ['Proof of address'], history: [{ at: '2026-10-30T09:00:00.000Z' }] }),
      person('quiet'),
    ],
    {
      refusals: [refusal('fixable'), refusal('not-fixable', { fixable: 'no' }), refusal('reviewed-since')],
      reconsiderations: [
        { id: 'rv', personId: 'reviewed-since', date: '2026-09-10', outcome: 'reviewed', reason: 'Met applicant' },
      ],
      participation: ['fixable', 'not-fixable', 'reviewed-since'].flatMap(id =>
        [0, 1].map(n => ({ id: id + n, personId: id, date: `2026-09-0${n + 1}`, attendance: 'present', savings: 100 }))
      ),
    }
  );
  const byId = Object.fromEntries(reviewQueue(s, TODAY).map(e => [e.personId, e.prompts.map(p => p.key)]));
  assert.deepEqual(Object.keys(byId).sort(), ['fixable', 'stale-info']);
  assert.deepEqual(byId.fixable, ['fixable-refusal']);
  assert.deepEqual(byId['stale-info'], ['missing-information']);
});

test('context notes attach only to people already queued and unknown savings are never treated as zero', () => {
  const meetings = id => [
    { id: id + '1', personId: id, date: '2026-09-01', attendance: 'present', savings: null },
    { id: id + '2', personId: id, date: '2026-09-08', attendance: 'absent', savings: 0 },
  ];
  const s = state([person('listed', { reviewDate: '2026-10-01' }), person('unlisted')], {
    participation: [...meetings('listed'), ...meetings('unlisted')],
  });
  const queue = reviewQueue(s, TODAY);
  assert.deepEqual(
    queue.map(e => e.personId),
    ['listed']
  );
  const note = queue[0].prompts.find(p => p.key === 'unknown-contributions');
  assert.ok(note.note && /not zero/.test(note.evidence));
});

test('withdrawn, consent-withdrawn and voided records do not produce prompts', () => {
  const s = state(
    [
      person('withdrawn', { reviewDate: '2026-10-01' }),
      person('no-consent', { reviewDate: '2026-10-01', consented: false }),
      person('voided-refusal'),
      { ...person('worker', { reviewDate: '2026-10-01' }), kind: 'domestic-worker' },
    ],
    {
      reconsiderations: [
        { id: 'w', personId: 'withdrawn', date: '2026-10-05', outcome: 'withdrawn', reason: 'Chose not to proceed' },
      ],
      refusals: [refusal('voided-refusal', { voided: true })],
    }
  );
  assert.deepEqual(reviewQueue(s, TODAY), []);
});

test('people are ordered only by how long a prompt has waited', () => {
  const s = state([
    person('newer', { reviewDate: '2026-10-20' }),
    person('older', { reviewDate: '2026-08-01' }),
    person('middle', { reviewDate: '2026-09-15' }),
  ]);
  assert.deepEqual(
    reviewQueue(s, TODAY).map(e => e.personId),
    ['older', 'middle', 'newer']
  );
});

test('refusal reasons are validated, scoped to prospects and correctable by voiding', async () => {
  const app = await launch();
  const request = client(app);
  try {
    await request('/login', 'POST', { demo: true });
    await request('/support/demo', 'POST', {});
    const workspace = (await request('/workspace')).body;
    const prospect = workspace.supportPeople.find(p => p.kind === 'prospective');
    const worker = workspace.supportPeople.find(p => p.kind === 'domestic-worker');
    const base = {
      personId: prospect.id,
      source: 'member',
      date: '2026-10-01',
      category: 'documentation',
      fixable: 'yes',
      missingItems: ['Proof of address'],
      reason: 'Address proof was out of date',
    };
    const created = await request('/support/refusals', 'POST', { ...base, id: 'refusal-test-0001' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal((await request('/support/refusals', 'POST', { ...base, id: 'refusal-test-0001' })).status, 200); // safe retry
    assert.equal(
      (await request('/support/refusals', 'POST', { ...base, id: 'refusal-test-0002', category: 'creditworthy' }))
        .status,
      400
    );
    assert.equal(
      (await request('/support/refusals', 'POST', { ...base, id: 'refusal-test-0003', date: '2999-01-01' })).status,
      400
    );
    assert.equal(
      (await request('/support/refusals', 'POST', { ...base, id: 'refusal-test-0004', reason: 'no' })).status,
      400
    );
    assert.equal(
      (
        await request('/support/refusals', 'POST', {
          ...base,
          id: 'refusal-test-0005',
          personId: worker.id,
          source: 'worker',
        })
      ).status,
      400
    );
    const queued = reviewQueue((await request('/workspace')).body, '2026-11-05');
    assert.ok(queued.some(e => e.personId === prospect.id && e.prompts.some(p => p.key === 'fixable-refusal')));
    const voided = await request('/support/refusals/refusal-test-0001/void', 'POST', {
      version: 1,
      reason: 'Entered on the wrong person',
    });
    assert.equal(voided.status, 200);
    const after = reviewQueue((await request('/workspace')).body, '2026-11-05');
    assert.ok(!after.some(e => e.personId === prospect.id && e.prompts.some(p => p.key === 'fixable-refusal')));
  } finally {
    await app.close();
  }
});

test('the large fictional dataset is consistent, realistic in scale, and yields a usable review queue', async () => {
  const app = await launch();
  const request = client(app);
  try {
    await request('/login', 'POST', { demo: true });
    const loaded = await request('/demo/bulk', 'POST', {});
    assert.equal(loaded.status, 201, JSON.stringify(loaded.body));
    const w = (await request('/workspace')).body;
    assert.ok(w.members.length >= 200 && w.visits.length >= 2000 && w.supportPeople.length >= 180);
    assert.ok(
      w.supportPeople.some(p => p.id === 'demo-prospect-india'),
      'named walkthrough examples are included'
    );
    // Referential and arithmetic consistency.
    const memberIds = new Set(w.members.map(m => m.id));
    assert.equal(memberIds.size, w.members.length);
    assert.ok(w.visits.every(v => memberIds.has(v.memberId) && v.paid <= v.due + 1e-9));
    const paidByLoan = {};
    for (const v of w.visits) if (v.loanId) paidByLoan[v.loanId] = (paidByLoan[v.loanId] || 0) + v.paid;
    assert.ok(w.loans.every(l => (paidByLoan[l.id] || 0) <= l.principal));
    assert.equal(new Set(w.visits.map(v => `${v.memberId}|${v.date}|${v.currency}`)).size, w.visits.length);
    // Realistic mix rather than uniform data.
    const present = w.visits.filter(v => v.attendance === 'present').length / w.visits.length;
    assert.ok(present > 0.8 && present < 0.97, `attendance ${present}`);
    assert.ok(new Set(w.supportPeople.map(p => p.kind)).size === 4 && w.refusals.length >= 20);
    // The queue is a focused subset, not everyone, and every entry is explainable.
    const prospects = w.supportPeople.filter(p => p.kind === 'prospective' && p.consented);
    const queue = reviewQueue(w, new Date().toISOString().slice(0, 10));
    assert.ok(queue.length > 5 && queue.length < prospects.length * 0.7, `${queue.length}/${prospects.length}`);
    assert.ok(queue.every(e => e.prompts.every(p => p.rule && p.evidence)));
  } finally {
    await app.close();
  }
});
