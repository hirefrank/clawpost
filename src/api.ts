import { Hono } from "hono";
import { getDb } from "./db/client";
import { sendEmail, replyToMessage } from "./mail";
import type { Env } from "./types";

const api = new Hono<{ Bindings: Env }>();

// Auth middleware — timing-safe API key comparison
api.use("/api/*", async (c, next) => {
  const key = c.req.header("X-API-Key");
  if (!key) return c.json({ error: "Missing API key" }, 401);

  const expected = new TextEncoder().encode(c.env.API_KEY);
  const provided = new TextEncoder().encode(key);

  if (expected.byteLength !== provided.byteLength) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  const match = crypto.subtle.timingSafeEqual(expected, provided);
  if (!match) return c.json({ error: "Invalid API key" }, 401);

  await next();
});

// Send email
api.post("/api/send", async (c) => {
  const body = await c.req.json<{
    to: string | string[];
    subject: string;
    body: string;
    cc?: string | string[];
    attachments?: { content?: string; filename: string; attachment_id?: string }[];
  }>();

  const db = getDb(c.env.DB);
  const result = await sendEmail(c.env, db, body);
  return c.json(result);
});

// List messages
api.get("/api/messages", async (c) => {
  const db = getDb(c.env.DB);
  const limit = Number(c.req.query("limit") ?? 50);
  const offset = Number(c.req.query("offset") ?? 0);
  const direction = c.req.query("direction");
  const from = c.req.query("from");

  let query = db
    .selectFrom("messages")
    .selectAll()
    .orderBy("created_at", "desc")
    .limit(limit)
    .offset(offset);

  if (direction) query = query.where("direction", "=", direction as any);
  if (from) query = query.where("from", "=", from);

  const messages = await query.execute();
  return c.json(messages);
});

// Read single message
api.get("/api/messages/:id", async (c) => {
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const message = await db
    .selectFrom("messages")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!message) return c.json({ error: "Not found" }, 404);

  const attachments = await db
    .selectFrom("attachments")
    .selectAll()
    .where("message_id", "=", id)
    .execute();

  return c.json({ ...message, attachments });
});

// Download attachment
api.get("/api/attachments/:id", async (c) => {
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const att = await db
    .selectFrom("attachments")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!att) return c.json({ error: "Not found" }, 404);

  const obj = await c.env.ATTACHMENTS.get(att.r2_key);
  if (!obj) return c.json({ error: "Attachment data not found" }, 404);

  return new Response(obj.body, {
    headers: {
      "Content-Type": att.content_type ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${att.filename ?? "attachment"}"`,
    },
  });
});

// Reply to message
api.post("/api/messages/:id/reply", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    body: string;
    attachments?: { content?: string; filename: string; attachment_id?: string }[];
  }>();

  const db = getDb(c.env.DB);
  const result = await replyToMessage(c.env, db, id, body.body, body.attachments);
  return c.json(result);
});

// Search messages
api.get("/api/search", async (c) => {
  const db = getDb(c.env.DB);
  const q = c.req.query("q");
  const limit = Number(c.req.query("limit") ?? 20);

  if (!q) return c.json({ error: "Missing query parameter 'q'" }, 400);

  const messages = await db
    .selectFrom("messages")
    .selectAll()
    .where((eb) =>
      eb.or([
        eb("subject", "like", `%${q}%`),
        eb("body_text", "like", `%${q}%`),
      ])
    )
    .orderBy("created_at", "desc")
    .limit(limit)
    .execute();

  return c.json(messages);
});

// List threads
api.get("/api/threads", async (c) => {
  const db = getDb(c.env.DB);
  const limit = Number(c.req.query("limit") ?? 50);
  const offset = Number(c.req.query("offset") ?? 0);

  const threads = await db
    .selectFrom("threads")
    .selectAll()
    .orderBy("last_message_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();

  return c.json(threads);
});

// Get thread with messages
api.get("/api/threads/:id", async (c) => {
  const db = getDb(c.env.DB);
  const id = c.req.param("id");

  const thread = await db
    .selectFrom("threads")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!thread) return c.json({ error: "Not found" }, 404);

  const messages = await db
    .selectFrom("messages")
    .selectAll()
    .where("thread_id", "=", id)
    .orderBy("created_at", "asc")
    .execute();

  return c.json({ ...thread, messages });
});

export { api };
