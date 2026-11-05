# FieldLedger

FieldLedger is free, open-source, self-hosted software for field teams supporting workers and financially vulnerable households in India. It brings worker pay and debt records, practical support cases, prospective-member participation and livelihood checks into one offline-first workspace. It produces no credit score and requires no BR.NET, banking, payroll or employer integration.

## Worker and family support

The two main pathways cover work and advance debt in India, including concerns that may require bonded-labour specialist assistance, and Indian overseas workers and their families. A worker can have a standalone support profile; an existing Sahayog or other organisation member reference is optional.

- **Pay:** record expected take-home pay by period and due date, followed by actual receipts. Partial receipts accumulate; no record or an unknown amount stays unconfirmed. Expected take-home is already after anticipated deductions.
- **Debt:** record recruitment loans, work advances and other reported debt, with opening balances, subsequent advances and repayments. Unknown opening amounts produce unknown balances; interest and fees are not inferred. Disputed debt remains labelled.
- **Deductions:** record amounts, descriptions and whether the worker agrees or disputes them. A deduction reduces a debt balance only when explicitly linked and confirmed as an actual reported repayment. The resulting entry is created once, atomically. Do not enter it again as a separate repayment. Deductions are not subtracted from expected take-home pay again.
- **Remittances:** record sent and received amounts in their original currencies, actual dates and known fees. A remittance does not create salary income or automatically repay a debt. No exchange rate is inferred.
- **Flags:** adjustable late-day and short-pay thresholds show the rule and triggering records. Unknown receipts are flagged as unconfirmed, not established non-payment. These rules are unvalidated prompts for a conversation, not predictions or legal findings.
- **Follow-ups:** open an agreed case from a pay flag or livelihood check, assign an owner and due date, record assistance requested versus actually received, and retain dated outcome notes. One pay period shares one case across its late/short flags. Cases remain available after a flag clears.

Each observation records its worker, family or member source, recording date and staff author. No employer/recruiter submission or geolocation field is provided in worker intake. Collect only the minimum information needed and agree safe contact instructions. Consent withdrawal blocks new capture while protected history remains available. The tool coordinates support and family follow-up; it does not determine legal status, send referrals automatically or replace legal remedies.

## Smaller support modules

**Second chance:** keep a prospective-member record before a lending decision; record voluntary meeting attendance and contributions, explicitly unknown amounts, missing information and a review date. Supervisors can record external human reconsideration outcomes. Attendance and savings are factual observations, not eligibility scores or conditions for assistance. Records do not approve a loan or automatically enroll a member.

**Loan-use and livelihoods:** record intended purchase, actual reported use, functioning status, household explanation and separate officer observation. Optionally link an existing member loan and open a support action from the check. Follow-up records preserve a timeline; the app does not diagnose an animal or certify an asset’s value or repayment capacity. The brief form is intended for meeting use; a 30-second completion target has not been validated with field teams.

## Existing community operations

Members and groups, meeting attendance and collections, principal-only interest-free loans and schedules, partial repayments, receipts, consent-controlled member sharing and correction history remain available. Identity references contain only the last four digits, with no PAN requirement. Household check-ins cover voluntary 30-day essential-spending shortfalls, with explanations kept separate from officer observations. Baseline and 30/90-day outcome reports retain missing and declined responses and describe observed changes without claiming causation. Expected household cash-flow entries are plans, not transactions.

## Specified-loan closure evidence

A separate certificate workflow connects authoritative source review, an exact borrower preview and permission, authorised Ed25519 signing, and independent receipt. A signed JSON file or printed QR discloses one limited closure claim rather than a repayment history. Recipients check approved keys, integrity, dates and available withdrawal information, then record identity matching and documentary acceptance separately. Source changes conservatively withdraw issued evidence, with original history retained.

Run `npm run demo:exchange` for two fictional institutional workspaces. Sahayog issuance/receipt is simulated; adoption and real acceptance have not been established. [Demonstration, encoding, offline limits and private configuration](docs/certificate-demo.md) explain the workflow. [Position audit](docs/position-audit.md) separates implemented features from attributed interview facts, hypotheses and pilot commitments.

## Try the support journeys

1. Open **Workers & families** and choose **Load support examples** in the demo. This creates fictional Indian records only when support tables are empty.
2. Open Ramesh Kumar to inspect advance debt, a linked wage deduction, pay shortfalls and an assigned follow-up.
3. Open Imran Ali / family to inspect overseas salary, an INR recruitment loan, deductions and an AED-to-INR remittance. Create a follow-up from a flag.
4. Open **Second chance** to record a meeting for Kavita Deshmukh, identify missing information, set a review date and record reconsideration.
5. Open **Loan-use & livelihoods** to add a check and follow-up for the fictional livelihood profile. Use **Follow-up cases** to see both community and worker cases.

New demo installations default to India, INR and Asia/Kolkata. Worker forms offer INR, USD, AED and SAR; legacy KHR records remain readable. The interface is English. Obsolete country-specific language options and new-entry flows have been removed; historical records retain their original currency labels. Further language/currency corridors need partner review. [Future scope](future_scope.md) describes the proposed Cambodia and Philippines adaptations, engagement status and validation needs.

## Run locally

Install **Node.js 24 or later**. From the project folder, run:

```sh
bash quickstart.sh
```

On Windows, use Git Bash. You can also run `npm ci` followed by `npm start` directly.

Open **http://127.0.0.1:3000** and choose **Open demo workspace**. The demo contains fictional Indian members, groups and rupee-denominated records. In **Household support**, use **Load sample household records** to explore example support plans and outcomes. This only works when household-support tables are empty.

The quickstart installs dependencies on the first run. The server initializes encrypted SQLite automatically. Demo changes persist in `data/india-demo/fieldledger.sqlite`; press Ctrl+C to stop the server.

## Host a private workspace

For an empty workspace with password-protected access:

```sh
DEMO_MODE=false ADMIN_PASSWORD='replace-with-a-long-unique-password' DATABASE_KEY='replace-with-a-separate-random-key-at-least-32-characters' bash quickstart.sh
```

Use at least 12 characters for the administrator password. Sign in with username `admin`, then create staff accounts and assign groups.

Docker is also supported: copy `.env.example` to `.env`, set independent administrator and database secrets, and run:

```sh
docker compose up --build -d
```

The app binds to loopback by default. To serve other devices, place it behind an HTTPS reverse proxy, set `COOKIE_SECURE=true`, and configure `APP_ORIGIN` for the external address when needed.

| Setting | Purpose |
| --- | --- |
| `PORT` | Server port; default `3000` |
| `HOST` | Bind address; default `127.0.0.1` |
| `DATA_DIR` | Database folder; default `./data/india-demo` for demo and `./private-data` for private hosting |
| `DEMO_MODE` | Set `false` for a private, empty workspace |
| `ADMIN_PASSWORD` | Private-workspace administrator password |
| `DATABASE_KEY` | Independent 32–1024-character database secret; required for private hosting |
| `DATABASE_KEY_FILE` | Alternative UTF-8 secret file outside `DATA_DIR`; do not set both key options |
| `COOKIE_SECURE` | Set `true` when serving over HTTPS |
| `APP_ORIGIN` | External origin used for request validation |

Production mode always disables the demo. One Node process serves the app and database; concurrent application replicas are not supported.

## Data and measurement

Check-ins cover a fixed 30-day recall period. Blank answers mean unknown; zero means none. Household explanations and officer observations remain separate. Overlapping recall periods should not be added together.

Outcome comparisons use one baseline per reporting household within the selected date range. Follow-up windows begin 30 or 90 days after the baseline and remain open for 14 additional days. Only matched, answered reports enter the averages. Declined, unavailable, unknown, late and missing responses remain visible. Delivery statistics count support plans; household outcomes count reporting households.

These comparisons describe observed change. They do not prove that the app or support caused that change. Case closure, repayment and savings contributions are separate from household financial health.

Staff access stays scoped to assigned groups even when members share a reporting household. Sharing a named member profile requires recorded permission. Corrections and voided reports preserve their original history. The server database is stored on the NGO's infrastructure; encrypted backups and offline records have separate passphrases.

Support profiles, pay, debt, deduction and remittance records, prospective-member observations, livelihood checks and support-case changes use the same encrypted outbox as visits. New support records are local-first after the device is prepared. Server-side validation and permissions are checked again on sync; rejected records remain in the queue for review. Supervisors can void erroneous observations with a reason, retaining the original. A linked deduction repayment is reversed with its deduction.

Before fieldwork, sign in online and open **Offline records → Unlock records**. Choose a device passphrase of at least 12 characters. The current account’s scoped workspace and pending records are encrypted with AES-GCM in IndexedDB; PBKDF2 derives the device key. The passphrase stays in this tab. No household data is stored in the service-worker cache. The optional workspace/account chooser retains organisation and staff display labels locally; household values are encrypted. Earlier encrypted pending queues migrate on unlock; the old plaintext demo cache is removed.

After reopening the app, select the saved workspace and enter the device passphrase. The server can be stopped or unreachable. A workspace prepared online permits capture for 7 days; an expired copy remains readable and preserves pending records, but requires online sign-in/refresh before new capture. Offline revocations cannot take immediate effect on disconnected copies. Current server permissions are checked before every sync.

Supported field writes go to durable encrypted storage first, including while connected. Pending records appear provisionally in the workspace; they are excluded from outcome measures until synced. Sync uses stable record IDs and version checks, retains conflicts for review, and atomically updates the cached server snapshot when removing an acknowledged record. Changes made in another tab trigger a reload/unlock requirement rather than overwriting records. Organization administration, new enrollments/loans, sharing, receipts and corrections require a connection.

Use **Lock workspace** or sign out on shared devices. Reload also clears the in-memory key. Keep the passphrase: it cannot be recovered. Use HTTPS (or localhost) and allow browser storage/service workers; the page must have loaded online once on that browser. Private browsing, browser data clearing or device loss can remove unsynced records. Review conflicts before discarding a pending copy.

## Encrypted database

SQLite pages and journals are encrypted at rest using SQLite3 Multiple Ciphers in SQLCipher-compatible mode (`better-sqlite3-multiple-ciphers`). Private hosting requires a separate `DATABASE_KEY` or `DATABASE_KEY_FILE` before startup. A missing or incorrect key fails closed; existing records are not replaced. Generate a random key, for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, and keep it in your own secret manager or restricted file outside the data volume.

Local demo mode creates a random key under ignored `.local/keys/`, outside `data/`. Retain that key when moving a demo database. Database encryption, browser encryption and backup encryption use separate secrets. SQLite encryption protects stored files, not a compromised running host or an unlocked browser.

For an existing **plaintext** installation, stop FieldLedger, configure the database key, and run `npm run encrypt-db` using the same `DATA_DIR` and hosting environment as startup. This explicitly encrypts the main database and any legacy SQLite migration snapshot in place, then checks integrity. Normal startup refuses plaintext files. No plaintext safety copy is created. Take an encrypted application backup before an installation upgrade where possible, and retain the encryption key. Deleting or losing the only key makes the database unrecoverable. Older plaintext copies elsewhere are not erased by encryption.

## Backups and recovery

Administrators can download an encrypted backup from **Organization**. Keep its passphrase separate from the file. To restore, stop the app and select a new, empty data directory:

```sh
BACKUP_FILE='/path/to/backup.json' BACKUP_PASSWORD='your-backup-passphrase' DATA_DIR='./restored-data' DATABASE_KEY='your-new-or-existing-database-key-at-least-32-characters' npm run restore
```

Restart with the same `DATA_DIR`. Restore refuses to overwrite an existing database. Backups include members, financial records, support records, staff accounts, configuration and correction history; the server administrator password is configured separately.

## Project structure

```text
frontend/public/    Screens, forms, translations and offline device storage
backend/           HTTP API, validation, authentication and business rules
database/          SQLite schema, migrations, persistence and demo fixtures
shared/            Currency formatting and household outcome calculations
tests/             Workflow, permissions, encryption and persistence checks
```

Run the checks with `npm test`. Database migrations run on startup and preserve existing records. Migrations 006–007 add separate support and certificate tables; encrypted backups include all new modules (schema 7), and restore still accepts earlier supported schemas.

Earlier default demo files under `data/fieldledger.sqlite` are left intact. To open an older workspace, explicitly set `DATA_DIR` to its folder. The new India demo uses a separate folder so previous records are not relabelled, converted or deleted.

## Current scope

FieldLedger records and coordinates support; it does not send referrals, transfer funds or determine eligibility. Lending is principal-only: interest, fees, restructuring and double-entry accounting are not implemented. Recorded savings are contributions, not a deposit-account balance. Cash-flow plans use entered assumptions rather than predictions.

New support screens and validation messages use English. Additional language coverage and local terminology should be reviewed with field teams before a pilot. Operational monitoring, device security and data-governance arrangements remain the responsibility of the hosting NGO.

## License

[MIT](LICENSE). Free to use, modify and self-host.

## Deploying (Render, one Docker web service)

The Node server serves both the frontend and the API, so deploy it as a single service from the `Dockerfile`.

- **Public demo** (synthetic data, passwordless demo login): use `render.yaml` as a Blueprint. It sets `DEMO_MODE=true`, `NODE_ENV=demo`, `COOKIE_SECURE=true` and a generated `DATABASE_KEY`. Data resets whenever the free instance restarts.
- **Real records:** set `DEMO_MODE=false`, `NODE_ENV=production`, `ADMIN_PASSWORD` (12+ characters), `DATABASE_KEY` (32+ random characters, stored outside the disk), `COOKIE_SECURE=true`, and attach a persistent disk mounted at `/app/data`. Run a single instance only (sessions are in memory).

- **Behind a reverse proxy:** set `TRUSTED_PROXY_HOPS` (for example `1`) so login throttling counts each client address separately instead of treating all users as the proxy. Leave it unset when the app is reached directly.
