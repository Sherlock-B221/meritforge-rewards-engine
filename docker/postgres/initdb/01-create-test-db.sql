-- Runs once, on first initialization of an empty Postgres data volume.
-- Creates the dedicated test database used by the pytest suite (TEST_DATABASE_URL).
CREATE DATABASE meritforge_test;
