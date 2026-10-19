CREATE TABLE IF NOT EXISTS workspace_config (
  id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','supervisor','officer')),
  salt TEXT NOT NULL, password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE IF NOT EXISTS staff_groups (
  staff_id TEXT NOT NULL REFERENCES staff(id), group_id TEXT NOT NULL REFERENCES community_groups(id),
  PRIMARY KEY(staff_id,group_id)
);
CREATE TABLE IF NOT EXISTS member_fields (
  member_id TEXT PRIMARY KEY REFERENCES members(id), payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS visit_revisions (
  id TEXT PRIMARY KEY, visit_id TEXT NOT NULL REFERENCES visits(id),
  occurred_at TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL,
  before_json TEXT NOT NULL, after_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS followups (
  id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id),
  title TEXT NOT NULL, assignee_id TEXT NOT NULL, assignee TEXT NOT NULL,
  due_on TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('open','in-progress','resolved')),
  notes TEXT NOT NULL, resolution TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_followups_member ON followups(member_id);
CREATE INDEX IF NOT EXISTS idx_revisions_visit ON visit_revisions(visit_id);
