PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  currency TEXT NOT NULL,
  locale TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS community_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  officer TEXT NOT NULL,
  next_meeting TEXT NOT NULL,
  meeting_time TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'teal'
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  group_id TEXT NOT NULL REFERENCES community_groups(id),
  business TEXT NOT NULL,
  income REAL NOT NULL CHECK (income >= 0),
  expenses REAL NOT NULL CHECK (expenses >= 0),
  household INTEGER NOT NULL CHECK (household >= 1),
  earners INTEGER NOT NULL CHECK (earners >= 0 AND earners <= household),
  kyc_verified INTEGER NOT NULL DEFAULT 0 CHECK (kyc_verified IN (0, 1)),
  identity_type TEXT NOT NULL,
  identity_suffix TEXT NOT NULL CHECK (length(identity_suffix) = 4),
  joined TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consents (
  member_id TEXT PRIMARY KEY REFERENCES members(id),
  granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
  recipient TEXT,
  purpose TEXT,
  recorded_at TEXT NOT NULL,
  expires_at TEXT,
  officer TEXT
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  principal REAL NOT NULL CHECK (principal > 0),
  installment REAL NOT NULL CHECK (installment > 0 AND installment <= principal),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly')),
  purpose TEXT NOT NULL,
  started_on TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  loan_id TEXT REFERENCES loans(id),
  visited_on TEXT NOT NULL,
  attendance TEXT NOT NULL CHECK (attendance IN ('present', 'absent', 'excused', 'not-recorded')),
  due REAL NOT NULL CHECK (due >= 0),
  paid REAL NOT NULL CHECK (paid >= 0),
  savings REAL NOT NULL CHECK (savings >= 0),
  utilisation TEXT NOT NULL CHECK (utilisation IN ('not-checked', 'verified', 'follow-up')),
  note TEXT NOT NULL DEFAULT '',
  officer TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (member_id, visited_on)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id);
CREATE INDEX IF NOT EXISTS idx_loans_member ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_visits_member_date ON visits(member_id, visited_on);
CREATE INDEX IF NOT EXISTS idx_visits_loan ON visits(loan_id);
