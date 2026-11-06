-- Reference schema: the user has already created this table in aiconnector-enquiries.
-- No migration or table recreation is required.
CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  organisation TEXT CHECK (length(organisation) <= 200),
  interest TEXT NOT NULL CHECK (interest IN (
    'learning_agentic_ai', 'applying_my_knowledge', 'organisation_transformation',
    'building_a_poc', 'other'
  )),
  message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 5000),
  source_page TEXT CHECK (length(source_page) <= 2048),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'replied', 'meeting_scheduled', 'closed'
  )),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
