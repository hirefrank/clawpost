CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  last_message_at INTEGER NOT NULL,
  message_count INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id),
  message_id TEXT,
  in_reply_to TEXT,
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  cc TEXT,
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  headers TEXT,
  direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
  created_at INTEGER NOT NULL
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id),
  filename TEXT,
  content_type TEXT,
  size INTEGER,
  r2_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_from ON messages("from");
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_messages_message_id ON messages(message_id);
CREATE INDEX idx_attachments_message ON attachments(message_id);
