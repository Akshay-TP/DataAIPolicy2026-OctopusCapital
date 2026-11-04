# Future scope

FieldLedger’s current implementation focuses on India: support for workers in India and Indian overseas workers and their families, with smaller second-chance and loan-use modules. Cambodia and the Philippines are proposed adaptations of the same open-source, self-hosted core. They are not current deployments or part of the Manila build commitment.

## Cambodia: household debt and essential-spending shortfalls

The proposed Cambodian adaptation would help local NGOs support households under microfinance debt pressure. Its purpose would be to coordinate practical assistance and document changes in household financial health, rather than produce a credit score.

Potential workflows:
- Record household-reported debts and repayment dates alongside seasonal agricultural income and essential spending.
- Plan across Cambodian riel (KHR) income and US dollar (USD) installments using an explicit, dated exchange-rate assumption; retain original currencies and show uncertainty.
- Capture voluntary 30-day essential-spending shortfalls, coping strategies and the household’s explanation, separately from officer observations.
- Track reported pressure involving land or other collateral and coordinate appropriate specialist or legal-support referrals without making legal determinations.
- Maintain locally reviewed referral information, potentially including IDPoor-related assistance, with eligibility and availability checked by the responsible organisation.
- Record any community bridge assistance separately from commercial debt, with transparent terms and human decisions.
- Compare baseline and 30/90-day follow-up observations, keeping declined, unavailable and missing responses visible.

Before a pilot: confirm the adopting organisation and intervention, review Khmer terminology, verify referral procedures and applicable data requirements, and test offline use with field teams. Earlier KHR/USD planning work is retained in the codebase for compatibility and experimentation; it does not establish that a Cambodian pilot is ready or validated.

## Philippines: overseas Filipino workers and their families

The proposed Philippine adaptation would support overseas Filipino workers (OFWs) and their households, using the worker-pay and support-case approach developed for India.

Potential workflows:
- Record recruitment costs and recruitment loans, expected salary, actual receipts and reported deductions.
- Track remittances using both sent and received amounts, their original currencies, transfer fees where known and actual receipt dates. Keep remittances distinct from earnings and debt repayments.
- Identify reported late or short pay using adjustable, explainable rules; distinguish an unconfirmed payment from established non-payment.
- Plan household essentials and debt installments around salary and remittance timing.
- Agree safe contact preferences and coordinate locally appropriate worker-support, legal or welfare referrals.
- Track whether assistance was received and whether essential-spending shortfalls or emergency borrowing changed.

Before a pilot: confirm the adopting organisation, review English/Filipino and any additional language needs, select the actual currency corridors, verify referral responsibilities and service eligibility, and test with workers and families. The term OFW applies to the Philippine adaptation; the Indian implementation uses “Indian overseas workers.”

## Shared foundation and adaptation work

The reusable core includes consented intake, organisation-scoped access, source-labelled records, explicit unknown values, encrypted offline storage, pay and debt ledgers, assigned follow-ups, correction history and protected backups. Financial records remain in their original currencies; an exchange-rate assumption is not a financial transaction.

Each adaptation still needs its own language review, workflow and service-eligibility validation, data-governance arrangements, user testing and outcome definitions. There is no automatic pooling of individual records across countries or organisations, no employer/recruiter data feed, no location collection in worker-support intake and no live banking integration.

## Engagement and validation status

The team reports email contact with iDE Cambodia and outreach to ARK Solves. These are engagement steps, not confirmation of adoption, deployment, endorsement or a formal partnership. The team also reports discussions validating the country ideas; that is distinct from validating the software or proving impact. Any stronger description should be supported by the organisation’s agreement.

The intended next step is to test with a lender or NGO serving the relevant families within 30 days, subject to agreement, consent and a scoped pilot plan. Recruitment, participant counts and pilot dates are not yet established here.

## Evidence needed before expansion

For each pilot, agree a primary household outcome, record a baseline, and follow up after an appropriate period. Potential measures include essential-spending shortfall days, time to first support action, assistance actually received, reported wages recovered and borrowing for essentials. Report the number eligible for follow-up and all missing/declined responses. Observed changes alone do not prove that FieldLedger caused the outcome.

Predictive ML is a separate future experiment. It would require suitable consented longitudinal data, a transparent baseline, evaluation on later periods and separate households, uncertainty reporting and human review. Synthetic demonstrations do not validate real-world accuracy. Automated credit decisions and legal classifications remain outside this proposed scope.
