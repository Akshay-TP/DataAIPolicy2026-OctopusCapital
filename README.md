# FieldLedger

FieldLedger is a free, self-hosted app for NGOs supporting households in the Philippines. It helps field teams understand recurring gaps in essential spending, coordinate practical support, and follow up on what changes over time.

The app brings household support, member records, community groups and lending records into one workspace. It works in English and Filipino, uses Philippine pesos by default, and also supports USD. No paid APIs, subscriptions or cloud accounts are required.

## What the app does

- **Household check-ins:** record essential-spending shortfalls over the previous 30 days, reported circumstances, optional household budgets, financial stress and support preferences. Members can skip questions or decline the conversation.
- **Household history:** keep dated reports, household explanations and field-worker observations together. Link members who report for the same household so household outcomes are not counted twice.
- **Support plans:** agree on an action, assign an owner, set a follow-up date, and record whether support was requested, received, unavailable or cancelled. Plans connect to the existing case list.
- **Support directory:** maintain the NGO's actual services and referral partners, including access requirements and availability.
- **Outcome tracking:** compare baseline and 30/90-day follow-up reports. Show changes in shortfall days, stress and borrowing, alongside missing responses and support delivery. Download aggregate summaries as CSV.
- **Cash-flow planning:** enter expected income and expense dates, then see where listed expenses exceed the money available. PHP and USD are kept separate.
- **Community operations:** manage members and groups, record meeting attendance and collections, track loan utilisation, and assign follow-up cases.
- **Lending records:** track principal-only, interest-free loans, weekly/fortnightly/monthly schedules, partial repayments, remaining balances and printable receipts.
- **Offline capture:** save visits, check-ins, support plans and updates in an encrypted device queue, then sync when connected.
- **Team access and backups:** restrict field officers to assigned groups, retain correction history, and download encrypted workspace backups.

## A typical visit

1. Open **Household support** and choose a member.
2. Record a voluntary **Household check-in**, including the household's own explanation of any shortfall.
3. If support is requested, create an agreed plan using an available service or referral.
4. Record what was actually delivered and any barriers to receiving it.
5. Return for a follow-up check-in and review the household's circumstances again.

Use **Field visits** for attendance and collections, **Follow-up cases** for outstanding actions, and **Outcomes** to review the programme's results.

## Run locally

Install **Node.js 24 or later**. From the project folder, run:

```sh
bash quickstart.sh
```

On Windows, use Git Bash. You can also run `npm start` directly.

Open **http://127.0.0.1:3000** and choose **Open demo workspace**. The demo contains fictional Philippine members, groups and peso-denominated records. In **Household support**, use **Load sample household records** to explore example support plans and outcomes. This only works when household-support tables are empty.

The server initializes SQLite automatically. No dependency installation is needed. Changes persist in `data/fieldledger.sqlite`; press Ctrl+C to stop the server.

## Host a private workspace

For an empty workspace with password-protected access:

```sh
DEMO_MODE=false ADMIN_PASSWORD='replace-with-a-long-unique-password' bash quickstart.sh
```

Use at least 12 characters for the administrator password. Sign in with username `admin`, then create staff accounts and assign groups.

Docker is also supported: copy `.env.example` to `.env`, set a unique password, and run:

```sh
docker compose up --build -d
```

The app binds to loopback by default. To serve other devices, place it behind an HTTPS reverse proxy, set `COOKIE_SECURE=true`, and configure `APP_ORIGIN` for the external address when needed.

| Setting | Purpose |
| --- | --- |
| `PORT` | Server port; default `3000` |
| `HOST` | Bind address; default `127.0.0.1` |
| `DATA_DIR` | Database folder; default `./data` |
| `DEMO_MODE` | Set `false` for a private, empty workspace |
| `ADMIN_PASSWORD` | Private-workspace administrator password |
| `COOKIE_SECURE` | Set `true` when serving over HTTPS |
| `APP_ORIGIN` | External origin used for request validation |

Production mode always disables the demo. One Node process serves the app and database; concurrent application replicas are not supported.

## Data and measurement

Check-ins cover a fixed 30-day recall period. Blank answers mean unknown; zero means none. Household explanations and officer observations remain separate. Overlapping recall periods should not be added together.

Outcome comparisons use one baseline per reporting household within the selected date range. Follow-up windows begin 30 or 90 days after the baseline and remain open for 14 additional days. Only matched, answered reports enter the averages. Declined, unavailable, unknown, late and missing responses remain visible. Delivery statistics count support plans; household outcomes count reporting households.

These comparisons describe observed change. They do not prove that the app or support caused that change. Case closure, repayment and savings contributions are separate from household financial health.

Staff access stays scoped to assigned groups even when members share a reporting household. Sharing a named member profile requires recorded permission. Corrections and voided reports preserve their original history. The server database is stored on the NGO's infrastructure; encrypted backups and offline records have separate passphrases.

Before offline fieldwork, unlock **Offline records** while signed in. Private workspaces require an already open session for offline capture. Review sync conflicts before discarding or replacing a pending copy; server records are never silently overwritten.

## Backups and recovery

Administrators can download an encrypted backup from **Organization**. Keep its passphrase separate from the file. To restore, stop the app and select a new, empty data directory:

```sh
BACKUP_FILE='/path/to/backup.json' BACKUP_PASSWORD='your-backup-passphrase' DATA_DIR='./restored-data' npm run restore
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

Run the checks with `npm test`. Database migrations run on startup and preserve existing records.

## Current scope

FieldLedger records and coordinates support; it does not send referrals, transfer funds or determine eligibility. Lending is principal-only: interest, fees, restructuring and double-entry accounting are not implemented. Recorded savings are contributions, not a deposit-account balance. Cash-flow plans use entered assumptions rather than predictions.

Some dynamic guidance and validation messages use English. Filipino terminology should be reviewed with field teams before a pilot. Operational monitoring, device security and data-governance arrangements remain the responsibility of the hosting NGO.

## License

[MIT](LICENSE). Free to use, modify and self-host.
