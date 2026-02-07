import type { Insertable, Selectable } from "kysely";

export interface ThreadTable {
  id: string;
  subject: string;
  last_message_at: number;
  message_count: number;
  created_at: number;
}

export interface MessageTable {
  id: string;
  thread_id: string;
  message_id: string | null;
  in_reply_to: string | null;
  from: string;
  to: string;
  cc: string | null;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  headers: string | null;
  direction: "inbound" | "outbound";
  created_at: number;
}

export interface AttachmentTable {
  id: string;
  message_id: string;
  filename: string | null;
  content_type: string | null;
  size: number | null;
  r2_key: string;
  created_at: number;
}

export interface Database {
  threads: ThreadTable;
  messages: MessageTable;
  attachments: AttachmentTable;
}

export type Thread = Selectable<ThreadTable>;
export type NewThread = Insertable<ThreadTable>;
export type Message = Selectable<MessageTable>;
export type NewMessage = Insertable<MessageTable>;
export type Attachment = Selectable<AttachmentTable>;
export type NewAttachment = Insertable<AttachmentTable>;
