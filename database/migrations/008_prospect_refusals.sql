CREATE TABLE prospect_refusals(id TEXT PRIMARY KEY, person_id TEXT NOT NULL REFERENCES support_people(id), payload TEXT NOT NULL);
CREATE INDEX idx_refusal_person ON prospect_refusals(person_id);
