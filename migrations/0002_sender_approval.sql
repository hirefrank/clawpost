CREATE TABLE approved_senders (
  email TEXT PRIMARY KEY,
  name TEXT,
  created_at INTEGER NOT NULL
);

ALTER TABLE messages ADD COLUMN approved INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_messages_approved ON messages(approved);
