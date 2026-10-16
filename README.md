# FieldLedger

Free, MIT-licensed, self-hosted field operations for NGOs serving informal savings and group lending communities. Inspired by the verification workflows described in the Sahayog interview; Sahayog is a research reference, not the customer or a connected banking provider.

## Run the demo

Install Node.js 24 or later, then run:

```sh
npm start
```

Open http://127.0.0.1:3000 and choose **Explore the demo**. No dependencies or paid services are needed. The fictional Bayanihan Community Foundation workspace includes 24 synthetic members, 3 groups, 18 loans, and eight visits per member. Changes persist in `data/fieldledger.sqlite`. Demo login is intentionally passwordless and binds to loopback by default.

```sh
npm test
```

## What works

- Group setup and member enrollment with household income, expenses, earners and masked identity reference; identity checks require a separate officer attestation.
- Principal-only loan register, repayment frequency, remaining principal, and scheduled installment observations. Approval happens outside the app.
- Field visits recording attendance, principal repayment, savings contributions, utilisation checks and notes.
- Indicators calculated from records, with denominators and readable follow-up reasons. Missing observations remain unknown; there is no composite credit score or automated credit decision.
- Explicit member permission naming a recipient and purpose; 30-day expiry, revocation, and minimized JSON export with an audit event. Export omits document references, full visit notes and household composition.
- Offline app shell, synthetic demo cache, local pending visit queue, and automatic sync after reconnect. Server-issued IDs and idempotent visit submission prevent retry duplicates. Records rejected by the server remain in the local queue.
- Organization settings, activity history, server-side SQLite persistence, and administrator authentication.

## Project structure

```text
frontend/
  public/                  Browser UI, styles, offline service worker
backend/
  server.mjs               HTTP entry point and static frontend delivery
  routes/api.mjs           Authenticated JSON API and workflow validation
  middleware/http.mjs      Request parsing, responses, input helpers
  services/auth.mjs        Sessions, passwords, login throttling
  services/indicators.mjs  Descriptive indicators and follow-up rules
database/
  migrations/001_initial.sql  Relational schema, foreign keys, constraints, indexes
  repository.mjs           SQLite access, migrations, atomic persistence
  seed.mjs                 Synthetic demonstration fixtures
tests/                     Indicator, persistence, and API integration tests
data/                      Local runtime database (ignored by Git)
```

The frontend talks exclusively to `/api/` over HTTP; it never imports backend or database modules. API routes use the database repository; SQL lives in `database/`. Organization, groups, members, consent, loans, visits and audit events have separate relational tables. One Node process serves both layers for easy NGO installation, while the source and data boundaries remain distinct. The repository uses synchronous atomic transactions; this MVP is intended for a single application process, not multiple concurrent application replicas.

## Self-host an empty workspace

Production starts without synthetic groups or members. Use a separate data directory from the demo.

PowerShell:

```powershell
$env:NODE_ENV='production'
$env:DEMO_MODE='false'
$env:ADMIN_PASSWORD='your-long-unique-password'
$env:DATA_DIR='./private-data'
npm start
```

Linux:

```sh
NODE_ENV=production DEMO_MODE=false ADMIN_PASSWORD='your-long-unique-password' DATA_DIR=./private-data npm start
```

Alternatively, copy `.env.example` to `.env`, set a unique administrator password, and run `docker compose up --build -d`. Compose binds only to loopback and stores records in a named volume. Put an HTTPS reverse proxy in front for other devices; set `COOKIE_SECURE=true` for HTTPS. Service workers and offline capture need HTTPS except on localhost. No automatic publication or external data transfer is configured.

Environment variables: `PORT` (3000), `HOST` (127.0.0.1), `DATA_DIR` (`./data`), `ADMIN_PASSWORD` (required outside demo), `DEMO_MODE` (`false` disables demo), `NODE_ENV`, `COOKIE_SECURE`. Production disables demo regardless of `DEMO_MODE`. Keep the password out of source control. The password hash is derived at startup; sessions are held in memory, expire after 8 hours, and clear on restart.

To back up this prototype, stop the application and copy the entire data directory or Docker volume. Restore it while the app is stopped. Keep backups protected. Do not change currency after recording transactions: preferences change labels, not values.

## Product scope and source interpretation

The user's NGO/self-hosting direction and `OctopusCapital_Phase2_Submission.docx` define this implementation: low-cost structured field capture and explainable group/member profiles for smaller organizations. The final submission PDF instead emphasizes portable credentials. This MVP includes consent-controlled exports as a bridge, but does not claim to implement verified credentials or reciprocal lender acceptance. Submission-form instructions in the supplied documents are reference material, not actions executed by the app.

The interview informs group meetings, cash-flow review, identity verification without mandatory PAN, attendance, utilisation monitoring and repeated visits. It does not establish that attendance alone predicts creditworthiness. Dashboard quantities describe only this workspace and are not Sahayog portfolio figures. The scanned document had no extractable text; no product requirements were inferred from it. No source documents or partner contact information are bundled into the web app.

## Indicator definitions

- Attendance = present / all observations except “not recorded.” Excused absence stays in the denominator; missing dates are not inferred.
- Full scheduled payments = observations paid at least the recorded installment / observations with dues. This records visit-level completeness, not contractual delinquency or payment timing inferred from a separate schedule.
- Savings = sum of recorded contributions. There are no withdrawals, interest or deposit-account accounting.
- Surplus = self-reported monthly household income minus expenses, before loan payments.
- Loan balance = principal minus repayments explicitly attributed to that loan, floored at zero. Overpayments are rejected. No interest or fee model.
- Follow-up reasons: fewer than 4 visits; attendance below 80%; full payments below 90%; non-positive surplus; utilisation follow-up; pending identity. These are visible demonstration thresholds, not validated lending policy. Group attendance is not a proxy for personal worth.

## Prototype limits before real member use

This is a functional MVP, not a production core banking system. It has one administrator role, no fine-grained user permissions, no accounting double entry, loan restructuring, interest calculation, disbursements, arrears calendar, KYC service integration, signed credentials, or connection to Finacle/BR.NET. Audit history is application-level and not tamper-evident. Consent is an officer-recorded attestation, not a digital signature; downloaded exports cannot be recalled.

Offline pending observations are unencrypted browser storage. Real workspace records are not cached in full across reloads; an already-open page can prepare visits offline, but only demo data is cached for offline reopening. Device loss, shared browsers and expired sessions need an operational policy. Synced queues are cleared; signing out clears the demo cache and requires pending visits to be synced first. No queue correction interface is included yet; validation conflicts require an administrator to resolve before sync can continue.

Before live deployment, add staff accounts and role permissions, protected device storage, record correction workflows, tested backup/restore, monitoring, a documented lending policy and appropriate local privacy review. Application security includes HttpOnly/SameSite cookies, same-origin mutations, JSON-only writes, bounded/validated inputs, login throttling, HTML escaping, CSP, no third-party scripts, and SQL parameterization. SQLite uses Node's built-in `node:sqlite`, which may emit an experimental API warning.
