import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb } from "./db/client";
import { sendEmail, replyToMessage } from "./mail";
import type { Env } from "./types";

export class EmailMCP extends McpAgent<Env, {}, {}> {
  server = new McpServer({
    name: "clawmail",
    version: "0.1.0",
  });

  async init() {
    // send_email
    this.server.registerTool(
      "send_email",
      {
        description: "Send an email via Resend",
        inputSchema: {
          to: z.union([z.string(), z.array(z.string())]).describe("Recipient email address(es)"),
          subject: z.string().describe("Email subject"),
          body: z.string().describe("Email body (plain text)"),
          cc: z.union([z.string(), z.array(z.string())]).optional().describe("CC recipients"),
          attachments: z.array(z.object({
            content: z.string().optional().describe("Base64-encoded content"),
            filename: z.string().describe("Filename"),
            attachment_id: z.string().optional().describe("Existing attachment ID to forward from R2"),
          })).optional().describe("Attachments to include"),
        },
      },
      async ({ to, subject, body, cc, attachments }) => {
        const db = getDb(this.env.DB);
        const result = await sendEmail(this.env, db, { to, subject, body, cc, attachments });
        return {
          content: [
            {
              type: "text" as const,
              text: `Email sent successfully.\nResend ID: ${result.messageId}\nDB ID: ${result.dbId}\nThread ID: ${result.threadId}`,
            },
          ],
        };
      }
    );

    // list_messages
    this.server.registerTool(
      "list_messages",
      {
        description: "List email messages with optional filters",
        inputSchema: {
          limit: z.number().optional().default(50).describe("Max messages to return"),
          offset: z.number().optional().default(0).describe("Offset for pagination"),
          direction: z.enum(["inbound", "outbound"]).optional().describe("Filter by direction"),
          from: z.string().optional().describe("Filter by sender address"),
        },
      },
      async ({ limit, offset, direction, from }) => {
        const db = getDb(this.env.DB);
        let query = db
          .selectFrom("messages")
          .selectAll()
          .orderBy("created_at", "desc")
          .limit(limit ?? 50)
          .offset(offset ?? 0);

        if (direction) query = query.where("direction", "=", direction);
        if (from) query = query.where("from", "=", from);

        const messages = await query.execute();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(messages, null, 2),
            },
          ],
        };
      }
    );

    // read_message
    this.server.registerTool(
      "read_message",
      {
        description: "Read a single email message with attachment metadata",
        inputSchema: {
          id: z.string().describe("Message ID"),
        },
      },
      async ({ id }) => {
        const db = getDb(this.env.DB);
        const message = await db
          .selectFrom("messages")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirst();

        if (!message) {
          return {
            content: [{ type: "text" as const, text: "Message not found" }],
            isError: true,
          };
        }

        const attachments = await db
          .selectFrom("attachments")
          .selectAll()
          .where("message_id", "=", id)
          .execute();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ ...message, attachments }, null, 2),
            },
          ],
        };
      }
    );

    // get_attachment
    this.server.registerTool(
      "get_attachment",
      {
        description: "Fetch attachment content from R2 (returns base64 + metadata)",
        inputSchema: {
          id: z.string().describe("Attachment ID"),
        },
      },
      async ({ id }) => {
        const db = getDb(this.env.DB);
        const att = await db
          .selectFrom("attachments")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirst();

        if (!att) {
          return {
            content: [{ type: "text" as const, text: "Attachment not found" }],
            isError: true,
          };
        }

        const obj = await this.env.ATTACHMENTS.get(att.r2_key);
        if (!obj) {
          return {
            content: [{ type: "text" as const, text: "Attachment data not found in R2" }],
            isError: true,
          };
        }

        const buf = await obj.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                id: att.id,
                filename: att.filename,
                content_type: att.content_type,
                size: att.size,
                content_base64: base64,
              }, null, 2),
            },
          ],
        };
      }
    );

    // reply_to_message
    this.server.registerTool(
      "reply_to_message",
      {
        description: "Reply to an existing email message",
        inputSchema: {
          id: z.string().describe("Message ID to reply to"),
          body: z.string().describe("Reply body (plain text)"),
          attachments: z.array(z.object({
            content: z.string().optional().describe("Base64-encoded content"),
            filename: z.string().describe("Filename"),
            attachment_id: z.string().optional().describe("Existing attachment ID to forward from R2"),
          })).optional().describe("Attachments to include"),
        },
      },
      async ({ id, body, attachments }) => {
        const db = getDb(this.env.DB);
        const result = await replyToMessage(this.env, db, id, body, attachments);
        return {
          content: [
            {
              type: "text" as const,
              text: `Reply sent successfully.\nResend ID: ${result.messageId}\nDB ID: ${result.dbId}`,
            },
          ],
        };
      }
    );

    // search_messages
    this.server.registerTool(
      "search_messages",
      {
        description: "Search messages by subject or body text",
        inputSchema: {
          query: z.string().describe("Search query"),
          limit: z.number().optional().default(20).describe("Max results"),
        },
      },
      async ({ query, limit }) => {
        const db = getDb(this.env.DB);
        const messages = await db
          .selectFrom("messages")
          .selectAll()
          .where((eb) =>
            eb.or([
              eb("subject", "like", `%${query}%`),
              eb("body_text", "like", `%${query}%`),
            ])
          )
          .orderBy("created_at", "desc")
          .limit(limit ?? 20)
          .execute();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(messages, null, 2),
            },
          ],
        };
      }
    );

    // list_threads
    this.server.registerTool(
      "list_threads",
      {
        description: "List email threads with preview",
        inputSchema: {
          limit: z.number().optional().default(50).describe("Max threads to return"),
          offset: z.number().optional().default(0).describe("Offset for pagination"),
        },
      },
      async ({ limit, offset }) => {
        const db = getDb(this.env.DB);
        const threads = await db
          .selectFrom("threads")
          .selectAll()
          .orderBy("last_message_at", "desc")
          .limit(limit ?? 50)
          .offset(offset ?? 0)
          .execute();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(threads, null, 2),
            },
          ],
        };
      }
    );
  }
}
