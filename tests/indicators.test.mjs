import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indicators, reviewReasons } from '../backend/services/indicators.mjs';

const member = { id: 'm', income: 1000, expenses: 700, kycVerified: true };
test('missing observations remain unknown, not zero or perfect', () => {
  const i = indicators(member, [], []);
  assert.equal(i.attendance, null);
  assert.equal(i.repayment, null);
  assert.equal(i.surplus, 300);
  assert.deepEqual(reviewReasons(member, [], []), ['Fewer than four recorded visits']);
});
test('indicators use relevant denominators and attribute repayments to loans', () => {
  const visits = [
    {
      memberId: 'm',
      attendance: 'present',
      due: 100,
      paid: 100,
      savings: 10,
      loanId: 'l',
      date: '2026-10-01',
      utilisation: 'verified',
    },
    {
      memberId: 'm',
      attendance: 'absent',
      due: 100,
      paid: 20,
      savings: 0,
      loanId: 'l',
      date: '2026-10-08',
      utilisation: 'follow-up',
    },
    {
      memberId: 'm',
      attendance: 'not-recorded',
      due: 0,
      paid: 0,
      savings: 30,
      date: '2026-10-09',
      utilisation: 'not-checked',
    },
    {
      memberId: 'other',
      attendance: 'present',
      due: 100,
      paid: 100,
      savings: 99,
      date: '2026-10-08',
      utilisation: 'verified',
    },
  ];
  const i = indicators(member, visits, [{ id: 'l', memberId: 'm', principal: 1000 }]);
  assert.equal(i.attendance, 50);
  assert.equal(i.attendanceTotal, 2);
  assert.equal(i.repayment, 50);
  assert.equal(i.repaymentTotal, 2);
  assert.equal(i.savings, 40);
  assert.equal(i.outstanding, 880);
  assert.equal(i.utilisation, 'follow-up');
  assert.ok(reviewReasons(member, visits, []).includes('Loan utilisation needs follow-up'));
});
