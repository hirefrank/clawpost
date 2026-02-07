# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # wrangler dev --remote (requires wrangler.toml with real IDs)
bun run deploy       # wrangler deploy
bun run db:migrate   # wrangler d1 migrations apply DB --remote
npx tsc --noEmit     # type check (no tests yet)
```

## Architecture

Cloudflare Worker with two entry points: `fetch` (HTTP) and `email` (inbound email via Email Routing). Both defined in `src/index.ts`.

**Request routing in `src/index.ts`:**
- `/mcp` → Bearer token auth → `EmailMCP.serve()` (Durable Object)
- Everything else → Hono app (`src/api.ts`) which handles `/api/*` with `X-API-Key` auth

**Data flow:**
- Inbound email (`src/email.ts`): `postal-mime` parses raw email → threads by `In-Reply-To`/`References` headers → D1 for message data, R2 for attachment blobs
- Outbound email (`src/mail.ts`): Resend SDK sends → stores sent message in D1, attachments in R2
- Both API routes and MCP tools call the same `sendEmail()`/`replyToMessage()` functions from `src/mail.ts`

**MCP server (`src/mcp.ts`):** `McpAgent` Durable Object (from `agents/mcp`) with `McpServer` (from `@modelcontextprotocol/sdk`). Tools registered in `init()` using `this.server.registerTool()` with Zod schemas.

**Database:** Kysely over D1 via `kysely-d1`. Schema types in `src/db/schema.ts`, factory in `src/db/client.ts`. Use `sql` template tag from Kysely for raw expressions (e.g., `sql\`message_count + 1\``), not `db.raw()`.

## Key Patterns

- `Env` interface in `src/types.ts` defines all Worker bindings — update it when adding new bindings to `wrangler.toml`
- Auth is timing-safe comparison via `crypto.subtle.timingSafeEqual` in both API middleware and MCP routing
- Threading: messages link to threads via `thread_id`; inbound emails match existing threads by looking up `In-Reply-To` and `References` against `messages.message_id`
- Attachments support two input modes: inline base64 (`content` + `filename`) or R2 reference (`attachment_id` to forward an existing attachment)
- R2 keys follow `{messageId}/{attachmentId}/{filename}` pattern
- All timestamps are Unix milliseconds (`Date.now()`)
- `wrangler.toml` is gitignored; `wrangler.toml.example` is the committed template
