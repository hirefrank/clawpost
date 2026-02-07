---
name: clawmail
description: >-
  Manage email through the Clawmail MCP server — send, receive, reply, search,
  and manage threads and sender approvals. Use when the user asks to check email,
  send a message, reply to someone, search their inbox, or manage approved senders.
license: MIT
metadata:
  author: hirefrank
  version: "0.1.0"
compatibility: Requires a deployed Clawmail worker with MCP connection configured.
---

# Clawmail

Email tools for AI agents via MCP. All messages go through a sender approval system — only approved senders' messages are visible to query tools.

## Sender Approval (Important)

Inbound emails default to unapproved. You must approve senders before their messages appear.

1. Call `list_pending` to see unapproved messages (returns metadata only — sender, subject, timestamp, no body content)
2. Call `approve_sender` with the sender's email to allowlist them — this retroactively approves all their existing messages
3. Future emails from that sender are auto-approved

Outbound messages (sent by you) are always approved.

## Sending Email

Use `send_email` for new messages:

```
send_email(to: "alice@example.com", subject: "Hello", body: "Message text")
```

Supports `cc`, and `attachments` (base64 content + filename, or an existing `attachment_id` to forward).

## Replying

Use `reply_to_message` with the message `id` (not the email Message-ID). Threading headers (In-Reply-To, References) are set automatically:

```
reply_to_message(id: "uuid-of-message", body: "Reply text")
```

## Reading Email

- `list_messages` — paginated list, filterable by `direction` (inbound/outbound) and `from`
- `read_message` — full message with attachment metadata
- `search_messages` — search by subject or body text
- `list_threads` — conversation threads sorted by most recent activity

## Attachments

- `get_attachment` returns base64-encoded content + metadata
- To forward an attachment, pass its `attachment_id` in the `attachments` array of `send_email` or `reply_to_message`
- To attach new content, pass `content` (base64) + `filename`

## Managing Senders

- `list_approved_senders` — see the current allowlist
- `approve_sender` — add a sender (retroactively approves their messages)
- `remove_sender` — remove from allowlist (does not unapprove already-approved messages)
