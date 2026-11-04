// Test-only key, inherited by test servers. Never imported by application code.
process.env.DATABASE_KEY='fieldledger-automated-tests-only-key-2026';
delete process.env.DATABASE_KEY_FILE;
