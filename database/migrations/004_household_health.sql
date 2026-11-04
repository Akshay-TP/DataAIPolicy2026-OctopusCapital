CREATE TABLE household_checkins (
 id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id),
 recorded_on TEXT NOT NULL, plan_id TEXT REFERENCES support_plans(id) DEFERRABLE INITIALLY DEFERRED,
 payload TEXT NOT NULL
);
CREATE INDEX idx_checkins_member_date ON household_checkins(member_id,recorded_on);
CREATE TABLE support_services (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE support_plans (
 id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id),
 baseline_id TEXT NOT NULL REFERENCES household_checkins(id) DEFERRABLE INITIALLY DEFERRED,
 service_id TEXT REFERENCES support_services(id), followup_id TEXT NOT NULL REFERENCES followups(id), payload TEXT NOT NULL
);
CREATE INDEX idx_support_member ON support_plans(member_id);
CREATE TABLE household_cashflow (
 id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), expected_on TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE INDEX idx_cashflow_member_date ON household_cashflow(member_id,expected_on);
