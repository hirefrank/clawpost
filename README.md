# Clawmail

Self-hosted email worker on Cloudflare. Receives inbound email via Email Routing, sends outbound via Resend, stores everything in D1 + R2. Exposes a REST API and MCP server for AI agents.

## Architecture

```
Inbound:  email → CF Email Routing → Worker → postal-mime → D1 + R2
Outbound: API / MCP tool → Resend → D1
Query:    API / MCP tool → D1 → results
```

- **D1** — messages, threads, attachment metadata
- **R2** — attachment blobs
- **McpAgent** — Durable Object, Streamable HTTP transport at `/mcp`
- **Hono** — REST API at `/api/*`
- **Auth** — API key with timing-safe comparison (`X-API-Key` header for REST, `Bearer` token for MCP)

## Setup

```bash
# Clone and install
git clone <repo-url> && cd clawmail
bun install

# Create Cloudflare resources
wrangler d1 create clawmail-db
wrangler r2 bucket create clawmail-attachments

# Configure
cp wrangler.toml.example wrangler.toml   # fill in database_id, bucket name, FROM_EMAIL
cp .dev.vars.example .dev.vars           # fill in API_KEY, RESEND_API_KEY

# Apply D1 migrations
bun run db:migrate

# Set production secrets
wrangler secret put API_KEY
wrangler secret put RESEND_API_KEY

# Deploy
bun run deploy
```

Then in the Cloudflare dashboard: **Email Routing → Routing rules** → forward your address to the clawmail Worker.

## API

All routes require `X-API-Key` header.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/send` | Send email |
| `GET` | `/api/messages` | List messages (`?limit=&offset=&direction=&from=`) |
| `GET` | `/api/messages/:id` | Read message + attachments |
| `POST` | `/api/messages/:id/reply` | Reply to message |
| `GET` | `/api/attachments/:id` | Download attachment |
| `GET` | `/api/search` | Search messages (`?q=&limit=`) |
| `GET` | `/api/threads` | List threads (`?limit=&offset=`) |
| `GET` | `/api/threads/:id` | Thread with all messages |

## MCP

Connect to `https://<worker>/mcp` with `Authorization: Bearer <API_KEY>`.

Tools: `send_email`, `list_messages`, `read_message`, `get_attachment`, `reply_to_message`, `search_messages`, `list_threads`

## License

MIT
