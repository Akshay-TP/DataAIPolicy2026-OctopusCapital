-- Historical PHP defaults are retained to preserve the meaning of older installations.
-- Current application defaults and forms are configured in shared/catalog.mjs.
ALTER TABLE members ADD COLUMN currency TEXT NOT NULL DEFAULT 'PHP';
UPDATE members SET currency=COALESCE((SELECT currency FROM organization WHERE id=1),'PHP');
ALTER TABLE loans ADD COLUMN currency TEXT NOT NULL DEFAULT 'PHP';
UPDATE loans SET currency=COALESCE((SELECT currency FROM organization WHERE id=1),'PHP');

CREATE TABLE visits_v3 (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  loan_id TEXT REFERENCES loans(id),
  visited_on TEXT NOT NULL,
  attendance TEXT NOT NULL CHECK(attendance IN ('present','absent','excused','not-recorded')),
  due REAL NOT NULL CHECK(due>=0), paid REAL NOT NULL CHECK(paid>=0),
  savings REAL NOT NULL CHECK(savings>=0),
  utilisation TEXT NOT NULL CHECK(utilisation IN ('not-checked','verified','follow-up')),
  note TEXT NOT NULL DEFAULT '',officer TEXT NOT NULL,created_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,currency TEXT NOT NULL,
  UNIQUE(member_id,visited_on,currency)
);
INSERT INTO visits_v3 SELECT id,member_id,loan_id,visited_on,attendance,due,paid,savings,utilisation,note,officer,created_at,version,COALESCE((SELECT currency FROM organization WHERE id=1),'PHP') FROM visits;
DROP TABLE visits;
ALTER TABLE visits_v3 RENAME TO visits;
CREATE INDEX idx_visits_member_date ON visits(member_id,visited_on);
CREATE INDEX idx_visits_loan ON visits(loan_id);
CREATE TRIGGER visits_currency_insert BEFORE INSERT ON visits
WHEN NEW.loan_id IS NOT NULL AND NEW.currency<>(SELECT currency FROM loans WHERE id=NEW.loan_id)
BEGIN SELECT RAISE(ABORT,'Repayment currency must match loan currency'); END;
CREATE TRIGGER visits_currency_update BEFORE UPDATE ON visits
WHEN NEW.currency<>OLD.currency OR (NEW.loan_id IS NOT NULL AND NEW.currency<>(SELECT currency FROM loans WHERE id=NEW.loan_id))
BEGIN SELECT RAISE(ABORT,'Recorded currency is immutable and must match the loan'); END;
CREATE TRIGGER loans_currency_update BEFORE UPDATE OF currency ON loans
WHEN NEW.currency<>OLD.currency
BEGIN SELECT RAISE(ABORT,'Recorded loan currency is immutable'); END;
