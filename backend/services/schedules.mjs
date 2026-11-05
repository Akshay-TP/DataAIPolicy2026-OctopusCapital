// Integer cents avoid accumulating binary floating-point errors.
export const cents = n => Math.round(n * 100);
export const amount = n => n / 100;
export function installmentDate(start, frequency, index) {
  const base = new Date(start + 'T00:00:00Z');
  if (frequency === 'monthly') {
    const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + index, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(base.getUTCDate(), last));
    return target.toISOString().slice(0, 10);
  }
  base.setUTCDate(base.getUTCDate() + index * (frequency === 'weekly' ? 7 : 14));
  return base.toISOString().slice(0, 10);
}
export function schedule(loan, visits, asOf = new Date().toISOString().slice(0, 10)) {
  const principal = cents(loan.principal),
    installment = cents(loan.installment);
  if (principal <= 0 || installment <= 0 || Math.ceil(principal / installment) > 600)
    throw new RangeError('Repayment schedules support 1–600 installments');
  let credit = visits.filter(v => v.loanId === loan.id && v.date <= asOf).reduce((n, v) => n + cents(v.paid), 0);
  const totalPaid = credit,
    rows = [];
  for (let remaining = principal, index = 1; remaining > 0; index++) {
    const due = Math.min(remaining, installment),
      paid = Math.min(due, credit),
      dueDate = installmentDate(loan.date, loan.frequency, index);
    credit -= paid;
    remaining -= due;
    rows.push({
      number: index,
      dueDate,
      due: amount(due),
      paid: amount(paid),
      remaining: amount(due - paid),
      status:
        paid === due
          ? 'paid'
          : dueDate > asOf
            ? 'upcoming'
            : paid > 0
              ? 'partial'
              : dueDate === asOf
                ? 'due'
                : 'overdue',
    });
  }
  const arrears = rows.filter(r => r.dueDate < asOf).reduce((n, r) => n + cents(r.remaining), 0);
  return {
    loanId: loan.id,
    currency: loan.currency || 'INR',
    asOf,
    totalPaid: amount(totalPaid),
    balance: amount(Math.max(0, principal - totalPaid)),
    arrears: amount(arrears),
    rows,
  };
}
