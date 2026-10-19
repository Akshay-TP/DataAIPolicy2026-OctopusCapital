# FieldLedger

Free, MIT-licensed, self-hosted field operations for NGOs serving informal savings and group lending communities. Sahayog's interview informs the workflows; it is a research reference, not a connected banking provider or the app's customer.

## Quickstart

Install **Node.js 24 or later**, then run in Bash (Git Bash on Windows):

```sh
bash quickstart.sh
```

Or run `npm start`. Open **http://127.0.0.1:3000** and choose **Open demo workspace**. The script works from any directory when invoked with its full path. No packages, paid APIs or cloud accounts are required. Press Ctrl+C to stop.

The demo starts with 24 synthetic members, three groups, 18 loans and eight observations per member. Changes persist locally in `data/fieldledger.sqlite`. Demo login is intentionally passwordless and binds to loopback. Existing workspaces migrate automatically without dropping their records.

```sh
npm test
```

## Daily workflows

### Members and group meetings

Create a group, enroll members, record household cash flow and attest identity checks separately. Full identity numbers are never collected; only an ID type and its final four digits are stored. PAN is not mandatory.

Under **Groups** or **Field visits**, choose **Group meeting** to capture attendance and collections for multiple members on one sheet. Only checked rows are submitted, and online meetings save all selected records atomically. There is one collection per member, date and currency; another currency can be recorded separately on the same date. Repeated submissions with matching identifiers and contents are safe to retry. Attendance counts each date once across currencies, and conflicting same-date attendance observations are flagged for review.

Offline meetings become individual pending observations; their eventual sync is per-record, not an atomic meeting transaction. Select a loan explicitly when recording principal repayments. Zero repayment with a selected loan records a payment observation; an absent visit does not silently invent a payment.

### Repayment schedules and receipts

**Loan register → Schedule** shows installments, paid amounts, remaining principal and past-due amounts. This release supports interest-free, principal-only loans with weekly, fortnightly or monthly installments, up to 600 installments. The first installment falls one interval after the loan start date. Monthly schedules preserve the original day where possible, clamping to month end when necessary. The final installment is adjusted to the remaining cents.

Payments cover the oldest installments first, including early payment toward future installments. Schedules use recorded payment dates and calculate as of the current date in the organization’s configured time zone. Currency precision is enforced: for example, USD accepts two decimal places while JPY and VND accept whole amounts. Overpayments and pre-loan repayment records are rejected.

**Field visits → Receipt** opens a printable receipt showing principal received, savings contributed, total and the loan balance on that date. Use **Print receipt** to print or save using the browser's PDF option. Corrected records generate a new receipt version; older printed copies must be reconciled operationally.

### Corrections and case management

Administrators and supervisors can **Correct** a field observation. A reason is mandatory. Original and revised values, actor, timestamp and record version are retained in **History**. Stale edits are rejected rather than overwriting someone else's correction. Member, loan and date attribution remain fixed; correction currently covers attendance, amounts, utilisation and notes. Records are not deleted.

**Follow-up cases** supports assignment, a due date, open/in-progress/resolved states, and resolution notes. Start a case from a member profile or the case list. Officers assign cases to themselves; supervisors and administrators can assign an active officer responsible for the member's group or another supervisor/administrator. A resolved case requires a written outcome. Cases can be reopened.

### Staff accounts and permissions

The server administrator uses username **admin** and the server's `ADMIN_PASSWORD`. In demo mode, **Open demo workspace** signs in as the demonstration administrator. The administrator account cannot be disabled through the interface.

| Role | Access |
| --- | --- |
| Administrator | All groups and workflows; staff accounts, form configuration, organization settings and encrypted backups. |
| Supervisor | All groups; enrollment, approved-loan registration, meetings, corrections, follow-ups, consent-controlled profile exports and CSV member import. Cannot manage accounts, organization configuration or backups. |
| Field officer | Assigned groups only; enrollment, identity attestations, observations, receipts, schedules, consent logging and their assigned follow-up cases. Cannot approve/register loans, correct server records, export member profiles, import CSV or create staff. |

Use **Staff accounts** to create accounts, assign groups, change roles, reset passwords or disable access. Staff passwords require 12–200 characters and use salted scrypt hashes. Existing sessions recheck current account status and permissions on every request, so disabling an account blocks its session immediately. Staff can sign in from the sign-in form, including in demo mode. Initial credentials must be shared by the NGO; no email delivery is configured. Enforce HTTPS for non-local use.

### Protected offline records

Before losing connectivity, open **Offline records → Unlock records** and enter a device passphrase of at least 12 characters. An already-open workspace can then prepare single or group observations offline. Pending records are encrypted in browser storage with AES-GCM; the key is derived with PBKDF2-SHA-256 (210,000 iterations) and retained only in memory. Each account/workspace has a separate vault. Passphrases are never sent to the server.

The vault locks on reload or sign-out. Use the same passphrase to recover pending records. There is no passphrase recovery. Signing out preserves the encrypted vault. Device locking, browser isolation and trusted software still matter; this is not protection against a compromised device or malicious code running in an unlocked session.

Reconnect, sign in and unlock the vault, then choose **Sync now**. Each successful item is removed only after server acknowledgment. Failed records remain with individual error messages; other records can still sync. Use **Review / edit** to correct the pending date, loan, amounts or notes, or explicitly discard a checked duplicate. Server records are never overwritten by the queue. Earlier unencrypted `fl-queue` records can be migrated by the administrator after unlocking the new vault; legacy data is removed only after successful encryption.

The app shell is cached offline. Only synthetic demo workspace data is cached in full for offline reopening. Real workspace pages must already be open before going offline; full private offline reopening is not implemented. A valid server session is required to sync. Service workers and Web Crypto require HTTPS except on localhost.

### CSV import

Under **Members → Import CSV**, download the template, choose a file, preview validation, then import. Files are limited to 80 KB and 200 members. The preview shows row errors and the first five valid members. Import is all-or-nothing, rejects duplicate names within a group, and does not attest identity or grant sharing permission.

Required columns:

```text
name,groupId,business,income,expenses,household,earners,identityType,identitySuffix
```

Use existing group identifiers and configured identity types. The optional `currency` column sets the household budget currency; it defaults to the organization currency when omitted, and is included in the downloaded template. Quoted commas, escaped quotes, CRLF and UTF-8 BOM are supported. Additional configured questions use `question:Question label` headers; the downloaded template includes them. Required custom questions must be answered. Import supports member enrollment, not historical loan/transaction migration.

### Multiple currencies

Supported currencies: **PHP, INR, USD, IDR, KHR, VND, THB, MYR, SGD, HKD, CNY, BDT, NPR, LKR, JPY, KRW, EUR, GBP and AUD**.

Household budgets, loans and collection entries each store their currency. A member may have loans in different currencies. A repayment must use the loan's recorded currency; savings on the same receipt use that collection currency. Record another currency as a separate entry. Existing loan and collection currencies are immutable, including during corrections. Receipts, schedules, history, offline records, CSV enrollment and encrypted backups retain explicit currency codes.

The **Overview → Reporting currency** selector filters the financial totals and chart to one currency. Member and attendance counts continue to cover the whole accessible community. Group and member savings display separate currency subtotals. Currency codes are shown alongside amounts, so dollar symbols are not ambiguous. There is no exchange-rate lookup, conversion or combined cross-currency grand total.

The organization currency is a default for new records, not a display conversion. Changing it does not relabel household budgets, loans, or collections already recorded. Existing databases migrate their old amounts using their original organization currency. The migration retains `data/before-multicurrency.sqlite` (or the corresponding file inside your `DATA_DIR`) before rebuilding the collection uniqueness constraint, and checks foreign-key integrity before committing. Keep this file protected like any other database backup.

### Forms and language

**Organization → Configure forms & language** controls the organization’s time zone, accepted ID types and up to ten additional enrollment questions. The initial time zone is `Asia/Manila`; use a valid IANA name such as `Asia/Kolkata` or `Asia/Jakarta` for another region. Questions can be text or numeric, optional or required. Existing answers and their captured question labels remain with member records if the form changes.

The language selector is available on the sign-in screen and in the workspace header. Supported languages are **English, Filipino, Hindi, Bengali, Indonesian, Vietnamese, Thai and Traditional Chinese**. Preferences are stored per workspace/account in the current browser, independently of the organization default language. Selecting a language does not modify member data or monetary values. Number and date formatting follows the selected locale.

Fixed translations cover navigation, shared actions, core enrollment/visit fields, money labels and common workflow controls. Longer guidance, some dynamic sentences and server validation errors still fall back to English. Switching back to English restores source labels. User names, field notes, and organization-defined question labels are preserved verbatim. Translations are bundled for offline use and do not call a paid or external translation service. Translation review with field officers is still needed before a local-language pilot.

### Consent and sharing

Named member profile exports require a recorded recipient, purpose and explicit member attestation. Permission expires after 30 days and can be revoked. Only supervisors and administrators export profiles. Exports omit identity references, full observation notes and household composition. Revocation blocks future exports; downloaded copies cannot be recalled. These descriptive JSON profiles are not signed credentials or credit approvals.

## Back up and restore

Administrators can use **Organization → Download backup**. Choose a 12–200 character passphrase. The JSON archive contains an authenticated AES-256-GCM encrypted snapshot of records, staff password hashes and assignments, form configuration, cases and correction history. A scrypt-derived key protects the archive. Keep the passphrase separately; it cannot be recovered. The server administrator password is not included and must be set on the restored server.

Restore into a **new data directory**, with the application stopped. Existing databases are never overwritten. The restore command authenticates the encrypted archive, restores the records, and verifies member/visit counts. The tests exercise a full export/restore including staff, case resolution and correction history.

Bash:

```sh
BACKUP_FILE=/path/to/fieldledger-backup.json \
BACKUP_PASSWORD='your-backup-passphrase' \
DATA_DIR=./restored-data npm run restore
```

PowerShell:

```powershell
$env:BACKUP_FILE='C:/path/to/fieldledger-backup.json'
$env:BACKUP_PASSWORD='your-backup-passphrase'
$env:DATA_DIR='./restored-data'
npm run restore
```

Set `DATA_DIR` to the restored directory and start the app with the usual production variables. Remove backup passphrases from the shell environment afterward. `backups/` is ignored by Git; keep exported archives outside source control. Alternatively, stop the app and copy the entire SQLite data directory or Docker volume as a protected filesystem backup.

## Self-host an empty workspace

Use a separate directory from the demo:

```sh
NODE_ENV=production DEMO_MODE=false ADMIN_PASSWORD='your-long-unique-password' DATA_DIR=./private-data bash quickstart.sh
```

PowerShell:

```powershell
$env:NODE_ENV='production'
$env:DEMO_MODE='false'
$env:ADMIN_PASSWORD='your-long-unique-password'
$env:DATA_DIR='./private-data'
npm start
```

Or copy `.env.example` to `.env`, set a unique password, and run `docker compose up --build -d`. Compose uses a named volume and binds to loopback. For other devices, use an HTTPS reverse proxy, `COOKIE_SECURE=true`, and, where needed, `APP_ORIGIN=https://your-ngo-host`.

Environment: `PORT` (3000), `HOST` (127.0.0.1), `DATA_DIR` (`./data`), `NODE_ENV`, `DEMO_MODE`, `ADMIN_PASSWORD`, `COOKIE_SECURE`, `APP_ORIGIN`. Production always disables the demo. Sessions expire after eight hours and clear on server restart. Each financial record keeps its original currency; changing the default does not convert or relabel it.

## Structure

```text
frontend/public/
  app.js              Core pages and forms
  features.js         Operations screens and UI integration
  offline.js          Passphrase-protected device vault
  i18n.js             Language preferences and reversible translation
  translations.js     Bundled interface translations for eight languages
  styles.css          Responsive UI and receipt print layout
  sw.js               Offline app shell
backend/
  server.mjs          HTTP entry point and frontend delivery
  routes/             Core API and operational endpoints
  middleware/         Parsing, responses and validation helpers
  services/           Authentication, access, schedules, visits, CSV and backups
  scripts/restore.mjs Encrypted archive restoration into a new database
database/
  migrations/         Versioned relational schema
  repository.mjs      SQLite access and atomic persistence
  seed.mjs            Synthetic fixtures
shared/catalog.mjs    Supported currencies/languages, formatting and precision
tests/                Permissions, workflow, encryption and persistence tests
data/                 Ignored local runtime database
```

The frontend uses only HTTP API endpoints and never imports server/database modules. SQL stays in `database/`. One Node process serves both layers; synchronous repository transactions support single-process operation, not concurrent application replicas. Migrations preserve records from earlier prototypes.

## Indicators and limits

Attendance is present observations divided by all observations except “not recorded”; excused absences remain in the denominator. Full scheduled payments measures recorded payment observations paid in full, separately from the date-based repayment schedule. Savings are contributions only, with no withdrawals or deposit-account accounting. Surplus is self-reported monthly household income minus expenses, before loan payments. Missing observations remain unknown.

Follow-up flags use visible demonstration thresholds: fewer than four observations, attendance below 80%, full recorded payments below 90%, non-positive surplus, pending identity, or utilisation follow-up. These are not validated lending policy. No composite credit score or automatic credit decision is produced.

This remains an MVP, not a production core banking system: no double-entry accounting, interest/fee models, restructuring, disbursement rails, external KYC, signed credentials or Finacle/BR.NET integration. The application audit log and correction history are not tamper-evident against a database administrator. Production still needs operational monitoring, deployment review, field testing, device policy and an appropriate data-governance process. SQLite may emit Node's experimental API warning.

## Source interpretation

The user's NGO/self-hosting direction and `OctopusCapital_Phase2_Submission.docx` define the product scope. The final submission PDF instead emphasizes portable credentials; consent-controlled exports provide a bridge without claiming cryptographic verifiability or lender acceptance. Instructions in submission forms were reference material, not actions executed by the app. The scanned PDF had no extractable text; no requirements were inferred from it. Source documents and partner contact information are not bundled into the web app.
