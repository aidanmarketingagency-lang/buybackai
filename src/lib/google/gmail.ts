// Strip CR/LF — non-negotiable for any header value. CRLF injection lets
// an attacker who controls the original email's From/Subject/Message-ID
// inject extra headers (Bcc, additional To, Reply-To, etc.) into the
// outgoing draft.
function stripCrlf(s: string): string {
  return s.replace(/[\r\n\u0085\u2028\u2029]/g, " ").trim();
}

// Allow only RFC-5322-shaped Message-IDs: `<local@domain>` with safe chars.
// Reject anything weird so attacker-supplied IDs can't smuggle headers.
function isValidMessageId(raw: string | undefined | null): raw is string {
  if (!raw) return false;
  const cleaned = stripCrlf(raw);
  // <local-part@domain> — angle brackets required, no whitespace inside.
  return /^<[^\s<>@]+@[^\s<>@]+>$/.test(cleaned);
}

// Validate a single email address. Local-part and domain rules are kept
// intentionally simple — no quoted local-parts, no IP-literal domains, no
// unicode. We're not trying to accept every RFC-valid address; we're trying
// to GUARANTEE the result has exactly one mailbox and zero header-injection
// surface. Rejects: commas, semicolons, multiple `@`, parens, brackets,
// angle-brackets, quotes, whitespace.
function isSingleMailbox(addr: string): boolean {
  if (!addr || addr.length > 254) return false;
  if (!/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(addr)) return false;
  // Belt-and-suspenders: explicitly forbid any character that could split
  // the address into a list or smuggle a second header.
  if (/[,;()<>\[\]"\\\s@]/.test(addr.replace(/^[^@]*@/, ""))) return false;
  // Exactly one '@'.
  if ((addr.match(/@/g) || []).length !== 1) return false;
  return true;
}

// Sanitize a "To:" / address header. Strip CRLF, parse out the single
// mailbox, validate it, return a normalized form. Returns null on any
// validation failure — the approval handler treats null as "incomplete
// action" rather than risking a multi-recipient draft.
function sanitizeAddressHeader(raw: string): string | null {
  const cleaned = stripCrlf(raw);
  if (!cleaned) return null;

  // Bare email: alice@example.com
  if (isSingleMailbox(cleaned)) return cleaned;

  // Display + email: `Name <alice@example.com>` or `"Name" <alice@example.com>`
  // Only the bracketed address is what gets sent — the display name is
  // cosmetic and we requote it safely.
  const display = cleaned.match(/^([^<]*)<\s*([^\s<>",;()@]+@[^\s<>",;()]+)\s*>$/);
  if (display) {
    const name = display[1].trim().replace(/^"+|"+$/g, "");
    const addr = display[2];
    if (!isSingleMailbox(addr)) return null;
    if (!name) return `<${addr}>`;
    const escapedName = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escapedName}" <${addr}>`;
  }

  return null;
}

// MIME-encode a Subject header so non-ASCII characters survive correctly
// AND so any leftover CRLF (already stripped, but defense in depth) can't
// break out of the header. RFC 2047 encoded-word, B-encoding (base64).
function encodeMimeSubject(s: string): string {
  const cleaned = stripCrlf(s);
  // ASCII-only subjects don't need encoding.
  if (/^[\x20-\x7e]*$/.test(cleaned)) return cleaned;
  const b64 = Buffer.from(cleaned, "utf8").toString("base64");
  return `=?UTF-8?B?${b64}?=`;
}

/**
 * Create a Gmail draft as a reply to an existing thread. Returns the new
 * draft's id on success. Throws on Gmail API errors so callers can decide
 * whether to retry / surface the failure.
 *
 * The body is the raw text the user (well, the user's AI agent) wants to
 * send. We construct a minimal RFC-822 message and base64url-encode it,
 * which Gmail expects in the `raw` field.
 */
export async function createGmailDraftReply(
  token: string,
  args: {
    threadId: string;
    inReplyToMessageId: string; // Gmail message ID we're replying to
    to: string;
    subject: string;
    bodyText: string;
  }
): Promise<{ draftId: string; messageId: string }> {
  // Fetch the original message's Message-ID header so we can set proper
  // In-Reply-To and References headers (without these, Gmail won't thread
  // the reply correctly).
  const original = (await (async () => {
    const r = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(args.inReplyToMessageId)}?format=metadata&metadataHeaders=Message-ID`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!r.ok) throw new GmailError(`Gmail ${r.status}: ${await r.text()}`, r.status);
    return r.json();
  })()) as { payload: { headers: Array<{ name: string; value: string }> } };

  const rawOriginalMessageId = original.payload.headers.find(
    (h) => h.name.toLowerCase() === "message-id"
  )?.value;

  // ─── HEADER SANITIZATION ──────────────────────────────────────────────
  // Email headers are attacker-influenced (a malicious sender controls their
  // own From/Subject/Message-ID). Interpolating those raw into the RFC-822
  // headers is a classic CRLF-injection vector — `\r\n` in `to` would let a
  // sender add their own Bcc, Reply-To, or extra recipients to the user's
  // outgoing draft. Strip CRLF from every header value and validate format.

  const safeTo = sanitizeAddressHeader(args.to);
  if (!safeTo) {
    throw new GmailError("Invalid recipient address", 400);
  }
  const safeSubject = encodeMimeSubject(
    stripCrlf(
      args.subject.toLowerCase().startsWith("re:") ? args.subject : `Re: ${args.subject}`
    )
  );
  const safeOriginalMessageId = isValidMessageId(rawOriginalMessageId)
    ? rawOriginalMessageId
    : null;

  const headerLines = [
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    ...(safeOriginalMessageId ? [`In-Reply-To: ${safeOriginalMessageId}`] : []),
    ...(safeOriginalMessageId ? [`References: ${safeOriginalMessageId}`] : []),
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
  ];
  const headers = headerLines.join("\r\n");
  const rfc822 = `${headers}\r\n\r\n${args.bodyText}`;
  // Base64url encoding (RFC 4648 §5) — Gmail's required format
  const raw = Buffer.from(rfc822, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: { threadId: args.threadId, raw },
      }),
    }
  );

  if (!res.ok) {
    throw new GmailError(`Gmail draft create ${res.status}: ${await res.text()}`, res.status);
  }

  const created = (await res.json()) as {
    id: string;
    message: { id: string };
  };
  return { draftId: created.id, messageId: created.message.id };
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    parts?: Array<{ mimeType: string; body: { data?: string }; parts?: GmailMessage["payload"]["parts"] }>;
    body?: { data?: string };
    mimeType?: string;
  };
  internalDate: string;
}

export interface ParsedEmail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: Date;
}

class GmailError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function gmailFetch(token: string, path: string): Promise<unknown> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new GmailError(`Gmail ${res.status}: ${await res.text()}`, res.status);
  }
  return res.json();
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

type Part = NonNullable<GmailMessage["payload"]["parts"]>[number];

function extractBody(payload: GmailMessage["payload"]): string {
  // Prefer text/plain, fall back to text/html stripped, fall back to first part with body
  const findPart = (parts: Part[], mime: string): Part | null => {
    for (const part of parts) {
      if (part.mimeType === mime && part.body?.data) return part;
      if (part.parts) {
        const found = findPart(part.parts, mime);
        if (found) return found;
      }
    }
    return null;
  };

  if (payload.body?.data) return decodeBase64Url(payload.body.data);

  if (payload.parts) {
    const plain = findPart(payload.parts, "text/plain");
    if (plain?.body?.data) return decodeBase64Url(plain.body.data);

    const html = findPart(payload.parts, "text/html");
    if (html?.body?.data) {
      return decodeBase64Url(html.body.data)
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  return "";
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

export interface FetchInboxResult {
  emails: ParsedEmail[];
  /** True when Gmail had more matching messages than `max` allowed us to fetch. */
  truncated: boolean;
}

/**
 * List inbox messages received in (sinceMs, beforeMs]. Skips sent, drafts,
 * spam, Promotions, Social. Returns up to `max` parsed emails plus a
 * `truncated` flag.
 *
 * The `beforeMs` ceiling is the cursor used to drain truncated backlogs.
 * Gmail's `before:` filter is at SECOND resolution, which creates a tie-
 * breaker hazard: if 26+ messages share the same second as our oldest
 * fetched message, naively setting beforeSecs=floor(oldest/1000) excludes
 * the entire second and permanently skips the unfetched same-second peers.
 *
 * Fix: we set `before:floor(beforeMs/1000) + 1`, which makes the bound
 * INCLUDE the cursor's second. Same-second peers we already inserted are
 * caught by the per-agent gmail_message_id unique index + pre-dedup query
 * in the cron, so we don't waste Anthropic calls on them. The unfetched
 * peers in that second get processed on the next run, and the cursor only
 * advances once we move past that second naturally.
 */
export async function fetchRecentInboxMessages(
  token: string,
  sinceMs: number,
  max = 25,
  beforeMs?: number
): Promise<FetchInboxResult> {
  const sinceSecs = Math.floor(sinceMs / 1000);
  let query = `in:inbox -category:promotions -category:social after:${sinceSecs}`;
  if (beforeMs !== undefined) {
    // +1 so the second containing beforeMs is INCLUDED in results — see
    // the docblock above for the same-second-peer rationale.
    const beforeSecs = Math.floor(beforeMs / 1000) + 1;
    query += ` before:${beforeSecs}`;
  }

  // Gmail caps maxResults per page at 500 but we keep it bounded so a single
  // cron invocation can't blow past time/cost budgets. Caller decides `max`.
  // Returns whether more results exist past the cap so caller can decide
  // whether to advance the checkpoint to "now" or only to the last fetched.
  const ids: Array<{ id: string }> = [];
  let pageToken: string | undefined = undefined;

  do {
    const pageSize = Math.min(50, max - ids.length);
    if (pageSize <= 0) break;
    const params = new URLSearchParams({
      q: query,
      maxResults: String(pageSize),
    });
    if (pageToken) params.set("pageToken", pageToken);

    const list = (await gmailFetch(token, `/messages?${params}`)) as {
      messages?: Array<{ id: string }>;
      nextPageToken?: string;
    };

    if (list.messages?.length) ids.push(...list.messages);
    pageToken = list.nextPageToken;
  } while (pageToken && ids.length < max);

  // Did Gmail still have more matching messages we didn't fetch?
  const truncated = !!pageToken;

  if (!ids.length) {
    return { emails: [], truncated };
  }

  const emails = await Promise.all(
    ids.map(async (m) => {
      const msg = (await gmailFetch(
        token,
        `/messages/${m.id}?format=full`
      )) as GmailMessage;
      return {
        id: msg.id,
        threadId: msg.threadId,
        from: getHeader(msg.payload.headers, "From"),
        to: getHeader(msg.payload.headers, "To"),
        subject: getHeader(msg.payload.headers, "Subject"),
        snippet: msg.snippet,
        body: extractBody(msg.payload),
        date: new Date(parseInt(msg.internalDate, 10)),
      } as ParsedEmail;
    })
  );

  return { emails, truncated };
}
