export function indicators(member, visits, loans) {
  const records = visits.filter(v => v.memberId === member.id);
  const attendance = records.filter(v => v.attendance !== 'not-recorded');
  const due = records.filter(v => v.due > 0);
  const contribution = records.filter(v => v.savings > 0);
  const checks = records.filter(v => v.utilisation !== 'not-checked');
  return {
    visits: records.length,
    attendance: attendance.length ? Math.round(attendance.filter(v => v.attendance === 'present').length / attendance.length * 100) : null,
    attendanceTotal: attendance.length,
    attendancePresent: attendance.filter(v => v.attendance === 'present').length,
    repayment: due.length ? Math.round(due.filter(v => v.paid >= v.due).length / due.length * 100) : null,
    repaymentTotal: due.length,
    repaymentOnTime: due.filter(v => v.paid >= v.due).length,
    savings: records.reduce((n,v) => n + v.savings, 0),
    savingsWeeks: contribution.length,
    surplus: member.income - member.expenses,
    utilisation: checks.length ? checks.sort((a,b) => b.date.localeCompare(a.date))[0].utilisation : 'not-checked',
    outstanding: loans.filter(l => l.memberId === member.id).reduce((n,l) => n + Math.max(0,l.principal - records.filter(v => v.loanId === l.id).reduce((s,v) => s+v.paid,0)),0)
  };
}

export function reviewReasons(member, visits, loans) {
  const i = indicators(member, visits, loans);
  return [i.visits < 4 && 'Fewer than four recorded visits', i.attendance !== null && i.attendance < 80 && 'Attendance below 80%', i.repayment !== null && i.repayment < 90 && 'Full scheduled payments below 90%', i.surplus <= 0 && 'No reported household surplus', i.utilisation === 'follow-up' && 'Loan utilisation needs follow-up', !member.kycVerified && 'Identity verification pending'].filter(Boolean);
}
