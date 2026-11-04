# Final-position audit

This audit separates implemented behaviour from partner interview evidence, research hypotheses and pilot commitments. Sahayog is a research partner; actual adoption of FieldLedger and acceptance of its certificates have not been established.

| Position | Status and evidence boundary |
| --- | --- |
| Free, open-source, offline group-lending app; no credit score | Implemented. MIT licence; encrypted offline capture and self-hosted persistence; meetings, principal-only loans, repayments, receipts and descriptive flags. Offline access requires preparing the device online once. |
| Consent-controlled member sharing | Implemented for member-profile export; certificates add separate permission for the exact claim and named recipient. Downloaded copies cannot be recalled, though certificates can be withdrawn. |
| Sahayog: approximately 70,000 active women, 84 branches, collateral-free lending, income checks and weekly meetings | Attributed to the team’s interview with Shahbaz Ahmad, Business Head, 26 August 2026. These are interview claims, not independently established by the software. |
| BR.NET for microfinance; Finacle for banking; Aadhaar/Voter ID rather than PAN | Interview attribution. No live integration or actual identity verification is implemented. Member intake stores a four-digit reference only; standalone workers need no banking record or ID number. |
| 10–15 refusals per 100, with limited reconsideration | Interview attribution. The figure covers overall refusals; it does not establish that every refusal was caused by missing information. The second-chance module records actual missing items and human review outcomes without guaranteeing approval. |
| Worker niches are outside Sahayog’s established local-livelihood lending | Team’s research position, to reconfirm with the partner. Product support for these workers is implemented; deployment by Sahayog is not established. |
| BR.NET material did not identify salary, deductions or remittance workflows | Describe this as the team’s finding in material reviewed, not proof that BR.NET lacks these capabilities. A definitive comparison requires a current product demonstration or vendor confirmation. |
| Small organisations cannot afford BR.NET-class systems | Cost/access hypothesis requiring adopter interviews and actual quotations. FieldLedger itself has no licence fee; hosting, devices, training and operation still cost money. |
| Main A: work/advance debt in India | Implemented: reported opening balances, advances, repayments, pay cycles, deductions, explainable flags and assigned support cases. The ledger neither validates a debt’s legality nor determines bonded-labour status. |
| Main B: Indian overseas workers and their families | Implemented: recruitment debt, expected/received take-home pay, remittances, fees, deductions and follow-up. Uses “Indian overseas workers”; no Filipino terminology in current workflows. |
| Smaller C: second chance | Implemented: prospective-member meetings before a loan decision, voluntary contributions, unknowns, missing information and external human reconsideration outcomes. Attendance and savings are not scores. |
| Earlier smaller loan-use module | Retained as an existing supplementary feature. The latest position lists second chance as its smaller niche; the extra livelihood-check module does not change that positioning. |
| Entries from worker/family, never employer/recruiter feeds | Worker-profile sources are restricted to worker/family. Prospective-member and livelihood records may use a member’s account. Staff record the account supplied; the app cannot prove that an operator’s source declaration is truthful. |
| No location data | Worker intake has no location or geolocation fields and does not request camera/location permissions. New group intake does not request a location. Historical community-group service-area labels are retained to avoid destructive data changes; this is not a claim that every legacy database field is location-free. |
| Minimum fields stored on device | Correction: data is encrypted on the NGO’s self-hosted server and in a prepared browser’s offline workspace. Sync therefore leaves the field device for the NGO server. There is no required third-party cloud service. |
| Adjustable early warning before missed installments | Implemented descriptive late/short-pay rules, including “unconfirmed” receipts. Thresholds are unvalidated and do not establish predictive accuracy or root causation. |
| Bonded labour and legal remedies | The app supports safe follow-up and specialist referrals; it does not legalise an arrangement, decide a legal claim or replace remedies. The 1976 Act abolishes the bonded labour system; terminology, referrals and pilot procedures still need partner/legal review. |
| iDE Cambodia email contact; ARK Solves outreach | Team-reported engagement only, not adoption, endorsement or a formal partnership. Kept in future_scope.md. |
| Test with a relevant lender/NGO within 30 days | Team commitment, subject to an organisation agreeing to a scoped pilot. No participant count, date or confirmed adopter is asserted. |

## Certificate constraint

The two-workspace demonstration simulates Sahayog’s issuance and receipt of evidence; it is not an actual Sahayog certificate or adoption. Each workspace has its own encrypted database, session cookie and signing key. Approved public keys and initial signed status snapshots are provisioned out of band for the demonstration. No certificate can add its own key to the recipient’s trust registry.

The defined claim is closure of one specified institutional loan, not a worker-debt report or a creditworthiness assessment. Source reconciliation, borrower review and authorised signing are distinct steps. The principal-only ledger alone cannot establish settlement of obligations held in another authoritative system; the officer must reconcile and attest that source.

The receiving institution records signature/date/status results, presenter identity matching and documentary acceptance separately. A valid signature does not prove source truth, presenter identity or acceptance. Offline verification exposes the timestamp and age of the available signed status snapshot and cannot exclude a newer withdrawal. A policy requiring live issuer confirmation remains unmet by this prototype’s cached-only check.

## Sources and limits

- Partner facts above: team-supplied interview notes attributed to Shahbaz Ahmad, 26 August 2026; preserve this attribution in submissions.
- [Bonded Labour System (Abolition) Act, 1976 — Ministry of Labour](https://labour.gov.in/sites/default/files/thebondedlaboursystemabolitionact1976.pdf).
- [Node.js native cryptography](https://nodejs.org/api/crypto.html) and [Web Crypto](https://nodejs.org/api/webcrypto.html) provide signing and independent verification; FieldLedger does not implement Ed25519 mathematics.
- Pilot acceptance, production key custody/rotation, organisational authorisation and real-world impact remain subsequent validation work.
