import { CERTIFICATE_TABLES, reconcileCertificates } from '../shared/certificates.mjs';
import { SUPPORT_TABLES } from '../shared/support.mjs';
import { databaseKey, openEncryptedDatabase, encryptedMigrationSnapshot } from './encryption.mjs';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { seed } from './seed.mjs';
import { randomUUID } from 'node:crypto';

/** Persistence boundary. Only this module accesses SQLite. */
export function openRepository({ dataDir, demo, key, keyFile }) {
  mkdirSync(dataDir, { recursive: true });
  const encryptionKey = databaseKey({ dataDir, demo, key, keyFile });
  const db = openEncryptedDatabase(resolve(dataDir, 'fieldledger.sqlite'), encryptionKey);
  const statements = new Map(),
    prepare = sql => {
      if (!statements.has(sql)) statements.set(sql, db.prepare(sql));
      return statements.get(sql);
    };
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(readFileSync(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8'));
  prepare('INSERT OR IGNORE INTO schema_migrations(version) VALUES (1)').run();
  if (!prepare('SELECT version FROM schema_migrations WHERE version=2').get()) {
    db.exec('BEGIN');
    try {
      db.exec(readFileSync(new URL('./migrations/002_operations.sql', import.meta.url), 'utf8'));
      db.exec('ALTER TABLE visits ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
      prepare('INSERT INTO schema_migrations(version) VALUES (2)').run();
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  if (!prepare('SELECT version FROM schema_migrations WHERE version=3').get()) {
    if (prepare('SELECT id FROM organization WHERE id=1').get()) {
      const snapshot = resolve(dataDir, 'before-multicurrency.sqlite.enc');
      if (!existsSync(snapshot)) encryptedMigrationSnapshot(db, snapshot, encryptionKey);
    }
    db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
    try {
      db.exec(readFileSync(new URL('./migrations/003_currencies.sql', import.meta.url), 'utf8'));
      if (prepare('PRAGMA foreign_key_check').all().length)
        throw new Error('Currency migration failed foreign-key verification');
      prepare('INSERT INTO schema_migrations(version) VALUES(3)').run();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      db.exec('PRAGMA foreign_keys=ON');
    }
  }
  for (const [version, file] of [
    [4, '004_household_health.sql'],
    [5, '005_cashflow_scenarios.sql'],
    [6, '006_worker_support.sql'],
    [7, '007_certificates.sql'],
  ]) {
    if (prepare('SELECT version FROM schema_migrations WHERE version=?').get(version)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(readFileSync(new URL('./migrations/' + file, import.meta.url), 'utf8'));
      prepare('INSERT INTO schema_migrations(version) VALUES(?)').run(version);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  const defaults = {
    workspaceId: randomUUID(),
    language: 'en',
    timeZone: 'Asia/Kolkata',
    acceptedIds: ['Aadhaar', 'Voter ID', 'Other approved ID'],
    questions: [],
  };
  prepare('INSERT OR IGNORE INTO workspace_config VALUES (1,?)').run(JSON.stringify(defaults));

  function read() {
    const settings = prepare('SELECT name, country, currency, locale FROM organization WHERE id=1').get();
    const groups = prepare(
      'SELECT id, name, location, officer, next_meeting AS nextMeeting, meeting_time AS time, color FROM community_groups ORDER BY rowid'
    ).all();
    const members = prepare(
      'SELECT id, name, group_id AS groupId, business, income, expenses, household, earners, kyc_verified AS kycVerified, identity_type AS identityType, identity_suffix AS identitySuffix, joined, currency FROM members ORDER BY rowid'
    ).all();
    const consents = new Map(
      prepare(
        'SELECT member_id AS memberId, granted, recipient, purpose, recorded_at AS at, expires_at AS expires, officer FROM consents'
      )
        .all()
        .map(row => [row.memberId, row])
    );
    for (const member of members) {
      member.kycVerified = Boolean(member.kycVerified);
      const consent = consents.get(member.id);
      if (consent) {
        delete consent.memberId;
        consent.granted = Boolean(consent.granted);
      }
      member.consent = consent || null;
    }
    const loans = prepare(
      'SELECT id, member_id AS memberId, principal, installment, frequency, purpose, started_on AS date, status, currency FROM loans ORDER BY rowid'
    ).all();
    const fields = new Map(
      prepare('SELECT member_id,payload FROM member_fields')
        .all()
        .map(row => [row.member_id, row.payload])
    );
    members.forEach(m => {
      const stored = JSON.parse(fields.get(m.id) || '{}');
      m.customFields = stored.values || stored;
      m.customFieldLabels = stored.labels || {};
      m.householdKey = stored.householdKey || m.id;
    });
    const visits = prepare(
      'SELECT id, member_id AS memberId, loan_id AS loanId, visited_on AS date, attendance, due, paid, savings, utilisation, note, officer, created_at AS createdAt, version, currency FROM visits ORDER BY rowid'
    ).all();
    const audit = prepare(
      'SELECT id, occurred_at AS at, actor, action FROM audit_events ORDER BY occurred_at DESC, rowid DESC'
    ).all();
    const config = {
      timeZone: 'Asia/Kolkata',
      ...JSON.parse(prepare('SELECT payload FROM workspace_config WHERE id=1').get().payload),
    };
    const revisions = prepare(
      'SELECT id,visit_id AS visitId,occurred_at AS at,actor,reason,before_json,after_json FROM visit_revisions ORDER BY occurred_at DESC'
    )
      .all()
      .map(r => ({
        id: r.id,
        visitId: r.visitId,
        at: r.at,
        actor: r.actor,
        reason: r.reason,
        before: JSON.parse(r.before_json),
        after: JSON.parse(r.after_json),
      }));
    const followups = prepare(
      'SELECT id,member_id AS memberId,title,assignee_id AS assigneeId,assignee,due_on AS dueDate,status,notes,resolution,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt,version FROM followups ORDER BY due_on'
    ).all();
    const payloads = table =>
      prepare(`SELECT payload FROM ${table} ORDER BY rowid`)
        .all()
        .map(r => JSON.parse(r.payload));
    return {
      settings,
      config,
      groups,
      members,
      loans,
      visits,
      audit,
      revisions,
      followups,
      checkins: payloads('household_checkins'),
      services: payloads('support_services'),
      supportPlans: payloads('support_plans'),
      cashflow: payloads('household_cashflow'),
      scenarios: payloads('cashflow_scenarios'),
      ...Object.fromEntries(
        Object.entries({ ...SUPPORT_TABLES, ...CERTIFICATE_TABLES }).map(([key, table]) => [key, payloads(table)])
      ),
    };
  }

  // Atomic upserts keep entity tables separate and preserve foreign-key constraints.
  // Snapshot updates are synchronous and performed after request-body parsing.
  function save(s) {
    reconcileCertificates(s);
    db.exec('BEGIN IMMEDIATE');
    try {
      const o = s.settings;
      if (s.config) prepare('UPDATE workspace_config SET payload=? WHERE id=1').run(JSON.stringify(s.config));
      prepare(
        'INSERT INTO organization VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,country=excluded.country,currency=excluded.currency,locale=excluded.locale'
      ).run(o.name, o.country, o.currency, o.locale);
      const group = prepare(
        'INSERT INTO community_groups VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,location=excluded.location,officer=excluded.officer,next_meeting=excluded.next_meeting,meeting_time=excluded.meeting_time,color=excluded.color'
      );
      s.groups.forEach(g => group.run(g.id, g.name, g.location, g.officer, g.nextMeeting, g.time, g.color));
      const member = prepare(
        'INSERT INTO members VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,group_id=excluded.group_id,business=excluded.business,income=excluded.income,expenses=excluded.expenses,household=excluded.household,earners=excluded.earners,kyc_verified=excluded.kyc_verified,identity_type=excluded.identity_type,identity_suffix=excluded.identity_suffix,joined=excluded.joined'
      );
      const consent = prepare(
        'INSERT INTO consents VALUES (?,?,?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET granted=excluded.granted,recipient=excluded.recipient,purpose=excluded.purpose,recorded_at=excluded.recorded_at,expires_at=excluded.expires_at,officer=excluded.officer'
      );
      for (const m of s.members) {
        member.run(
          m.id,
          m.name,
          m.groupId,
          m.business,
          m.income,
          m.expenses,
          m.household,
          m.earners,
          Number(m.kycVerified),
          m.identityType,
          m.identitySuffix,
          m.joined,
          m.currency || o.currency
        );
        prepare(
          'INSERT INTO member_fields VALUES (?,?) ON CONFLICT(member_id) DO UPDATE SET payload=excluded.payload'
        ).run(
          m.id,
          JSON.stringify({
            values: m.customFields || {},
            labels: m.customFieldLabels || {},
            householdKey: m.householdKey || m.id,
          })
        );
        if (m.consent) {
          const c = m.consent;
          consent.run(
            m.id,
            Number(c.granted),
            c.recipient || null,
            c.purpose || null,
            c.at,
            c.expires || null,
            c.officer || null
          );
        }
      }
      const loan = prepare('INSERT INTO loans VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING');
      s.loans.forEach(l =>
        loan.run(
          l.id,
          l.memberId,
          l.principal,
          l.installment,
          l.frequency,
          l.purpose,
          l.date,
          l.status,
          l.currency || o.currency
        )
      );
      const visit = prepare(
        'INSERT INTO visits VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET attendance=excluded.attendance,paid=excluded.paid,savings=excluded.savings,utilisation=excluded.utilisation,note=excluded.note,version=excluded.version'
      );
      s.visits.forEach(v =>
        visit.run(
          v.id,
          v.memberId,
          v.loanId,
          v.date,
          v.attendance,
          v.due,
          v.paid,
          v.savings,
          v.utilisation,
          v.note,
          v.officer,
          v.createdAt,
          v.version || 1,
          v.currency || s.loans.find(l => l.id === v.loanId)?.currency || o.currency
        )
      );
      const revision = prepare('INSERT OR IGNORE INTO visit_revisions VALUES (?,?,?,?,?,?,?)');
      (s.revisions || []).forEach(r =>
        revision.run(r.id, r.visitId, r.at, r.actor, r.reason, JSON.stringify(r.before), JSON.stringify(r.after))
      );
      const followup = prepare(
        'INSERT INTO followups VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,assignee_id=excluded.assignee_id,assignee=excluded.assignee,due_on=excluded.due_on,status=excluded.status,notes=excluded.notes,resolution=excluded.resolution,updated_at=excluded.updated_at,version=excluded.version'
      );
      (s.followups || []).forEach(f =>
        followup.run(
          f.id,
          f.memberId,
          f.title,
          f.assigneeId,
          f.assignee,
          f.dueDate,
          f.status,
          f.notes,
          f.resolution,
          f.createdBy,
          f.createdAt,
          f.updatedAt,
          f.version
        )
      );
      const checkin = prepare(
        'INSERT INTO household_checkins VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload'
      );
      (s.checkins || []).forEach(c => checkin.run(c.id, c.memberId, c.date, c.planId || null, JSON.stringify(c)));
      const service = prepare(
        'INSERT INTO support_services VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload'
      );
      (s.services || []).forEach(x => service.run(x.id, JSON.stringify(x)));
      const plan = prepare(
        'INSERT INTO support_plans VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET service_id=excluded.service_id,payload=excluded.payload'
      );
      (s.supportPlans || []).forEach(p =>
        plan.run(p.id, p.memberId, p.baselineId, p.serviceId || null, p.followupId, JSON.stringify(p))
      );
      const scenario = prepare(
        'INSERT INTO cashflow_scenarios VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload'
      );
      (s.scenarios || []).forEach(e => scenario.run(e.id, e.memberId, JSON.stringify(e)));
      const cashflow = prepare(
        'INSERT INTO household_cashflow VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload'
      );
      (s.cashflow || []).forEach(e => cashflow.run(e.id, e.memberId, e.date, JSON.stringify(e)));
      for (const [key, table] of Object.entries({ ...SUPPORT_TABLES, ...CERTIFICATE_TABLES })) {
        const columns =
          key === 'supportPeople'
            ? ['id', 'group_id', 'member_id']
            : key === 'certificateDecisions' || key === 'certificateStatusCache'
              ? ['id']
              : key === 'closureReviews' || key === 'certificates'
                ? ['id', 'member_id', 'loan_id', ...(key === 'certificates' ? ['review_id'] : [])]
                : [
                    'id',
                    'person_id',
                    ...(key === 'payReceipts' || key === 'deductions'
                      ? ['pay_id']
                      : key === 'debtEntries'
                        ? ['debt_id']
                        : []),
                  ];
        const statement = prepare(
          `INSERT INTO ${table} (${[...columns, 'payload'].join(',')}) VALUES (${[...columns, 'payload'].map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE payload!=excluded.payload`
        );
        const values = {
          group_id: 'groupId',
          member_id: 'memberId',
          person_id: 'personId',
          loan_id: 'loanId',
          pay_id: 'payId',
          debt_id: 'debtId',
          review_id: 'reviewId',
          id: 'id',
        };
        for (const record of s[key] || [])
          statement.run(...columns.map(column => record[values[column]] ?? null), JSON.stringify(record));
      }
      const event = prepare('INSERT OR IGNORE INTO audit_events VALUES (?,?,?,?)');
      s.audit.forEach(a => event.run(a.id, a.at, a.actor, a.action));
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }

  if (!prepare('SELECT id FROM organization WHERE id=1').get()) {
    // Preserve records made with the initial single-payload prototype, if present.
    const legacy = prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspace'").get();
    const legacyRow = legacy ? prepare('SELECT payload FROM workspace WHERE id=1').get() : null;
    const initial = legacyRow ? JSON.parse(legacyRow.payload) : seed();
    if (!demo && !legacyRow) {
      initial.groups = [];
      initial.members = [];
      initial.loans = [];
      initial.visits = [];
      initial.audit = [];
      initial.settings.name = 'My NGO';
    }
    save(initial);
  }
  function listStaff(includeSecrets = false) {
    return prepare('SELECT id,username,name,role,salt,password_hash AS passwordHash,active FROM staff ORDER BY name')
      .all()
      .map(u => {
        u.active = Boolean(u.active);
        u.groupIds = prepare('SELECT group_id FROM staff_groups WHERE staff_id=?')
          .all(u.id)
          .map(g => g.group_id);
        if (!includeSecrets) {
          delete u.salt;
          delete u.passwordHash;
        }
        return u;
      });
  }
  function saveStaff(u) {
    db.exec('BEGIN');
    try {
      prepare(
        'INSERT INTO staff VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,role=excluded.role,salt=excluded.salt,password_hash=excluded.password_hash,active=excluded.active'
      ).run(u.id, u.username, u.name, u.role, u.salt, u.passwordHash, Number(u.active));
      prepare('DELETE FROM staff_groups WHERE staff_id=?').run(u.id);
      for (const groupId of u.groupIds) prepare('INSERT INTO staff_groups VALUES (?,?)').run(u.id, groupId);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return { read, save, listStaff, saveStaff, encrypted: true, close: () => db.close() };
}
