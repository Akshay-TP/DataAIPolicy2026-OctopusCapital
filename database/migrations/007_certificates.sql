CREATE TABLE closure_reviews(id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), loan_id TEXT NOT NULL REFERENCES loans(id), payload TEXT NOT NULL);
CREATE TABLE loan_certificates(id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), loan_id TEXT NOT NULL REFERENCES loans(id), review_id TEXT NOT NULL REFERENCES closure_reviews(id), payload TEXT NOT NULL);
CREATE TABLE certificate_decisions(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE certificate_status_cache(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
CREATE INDEX idx_closure_loan ON closure_reviews(loan_id);
CREATE INDEX idx_certificate_member ON loan_certificates(member_id);
