CREATE TABLE cashflow_scenarios (
 id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), payload TEXT NOT NULL
);
CREATE INDEX idx_scenario_member ON cashflow_scenarios(member_id);
