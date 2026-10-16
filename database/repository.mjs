import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { seed } from './seed.mjs';

/** Persistence boundary. Only this module accesses SQLite. */
export function openRepository({ dataDir, demo }) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(resolve(dataDir, 'fieldledger.sqlite'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(readFileSync(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version) VALUES (1)').run();

  function read() {
    const settings = db.prepare('SELECT name, country, currency, locale FROM organization WHERE id=1').get();
    const groups = db.prepare('SELECT id, name, location, officer, next_meeting AS nextMeeting, meeting_time AS time, color FROM community_groups ORDER BY rowid').all();
    const members = db.prepare('SELECT id, name, group_id AS groupId, business, income, expenses, household, earners, kyc_verified AS kycVerified, identity_type AS identityType, identity_suffix AS identitySuffix, joined FROM members ORDER BY rowid').all();
    const consents = db.prepare('SELECT member_id AS memberId, granted, recipient, purpose, recorded_at AS at, expires_at AS expires, officer FROM consents').all();
    for (const member of members) {
      member.kycVerified = Boolean(member.kycVerified);
      const consent = consents.find(c => c.memberId === member.id);
      if (consent) { delete consent.memberId; consent.granted = Boolean(consent.granted); }
      member.consent = consent || null;
    }
    const loans = db.prepare('SELECT id, member_id AS memberId, principal, installment, frequency, purpose, started_on AS date, status FROM loans ORDER BY rowid').all();
    const visits = db.prepare('SELECT id, member_id AS memberId, loan_id AS loanId, visited_on AS date, attendance, due, paid, savings, utilisation, note, officer, created_at AS createdAt FROM visits ORDER BY rowid').all();
    const audit = db.prepare('SELECT id, occurred_at AS at, actor, action FROM audit_events ORDER BY occurred_at DESC, rowid DESC').all();
    return { settings, groups, members, loans, visits, audit };
  }

  // Atomic upserts keep entity tables separate and preserve foreign-key constraints.
  // Snapshot updates are synchronous and performed after request-body parsing.
  function save(s) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const o = s.settings;
      db.prepare('INSERT INTO organization VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,country=excluded.country,currency=excluded.currency,locale=excluded.locale').run(o.name,o.country,o.currency,o.locale);
      const group = db.prepare('INSERT INTO community_groups VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,location=excluded.location,officer=excluded.officer,next_meeting=excluded.next_meeting,meeting_time=excluded.meeting_time,color=excluded.color');
      s.groups.forEach(g => group.run(g.id,g.name,g.location,g.officer,g.nextMeeting,g.time,g.color));
      const member = db.prepare('INSERT INTO members VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,group_id=excluded.group_id,business=excluded.business,income=excluded.income,expenses=excluded.expenses,household=excluded.household,earners=excluded.earners,kyc_verified=excluded.kyc_verified,identity_type=excluded.identity_type,identity_suffix=excluded.identity_suffix,joined=excluded.joined');
      const consent = db.prepare('INSERT INTO consents VALUES (?,?,?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET granted=excluded.granted,recipient=excluded.recipient,purpose=excluded.purpose,recorded_at=excluded.recorded_at,expires_at=excluded.expires_at,officer=excluded.officer');
      for (const m of s.members) {
        member.run(m.id,m.name,m.groupId,m.business,m.income,m.expenses,m.household,m.earners,Number(m.kycVerified),m.identityType,m.identitySuffix,m.joined);
        if (m.consent) { const c=m.consent; consent.run(m.id,Number(c.granted),c.recipient||null,c.purpose||null,c.at,c.expires||null,c.officer||null); }
      }
      const loan = db.prepare('INSERT INTO loans VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING');
      s.loans.forEach(l => loan.run(l.id,l.memberId,l.principal,l.installment,l.frequency,l.purpose,l.date,l.status));
      const visit = db.prepare('INSERT INTO visits VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING');
      s.visits.forEach(v => visit.run(v.id,v.memberId,v.loanId,v.date,v.attendance,v.due,v.paid,v.savings,v.utilisation,v.note,v.officer,v.createdAt));
      const event = db.prepare('INSERT OR IGNORE INTO audit_events VALUES (?,?,?,?)');
      s.audit.forEach(a => event.run(a.id,a.at,a.actor,a.action));
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }

  if (!db.prepare('SELECT id FROM organization WHERE id=1').get()) {
    // Preserve records made with the initial single-payload prototype, if present.
    const legacy = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspace'").get();
    const legacyRow = legacy ? db.prepare('SELECT payload FROM workspace WHERE id=1').get() : null;
    const initial = legacyRow ? JSON.parse(legacyRow.payload) : seed();
    if (!demo && !legacyRow) { initial.groups=[];initial.members=[];initial.loans=[];initial.visits=[];initial.audit=[];initial.settings.name='My NGO'; }
    save(initial);
  }
  return { read, save, close: () => db.close() };
}
