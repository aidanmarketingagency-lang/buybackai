// Find Gmail threads where the user was the LAST to write and N days have
// passed without a reply. Used by Follow-up Fred.

export interface QuietThread {
  threadId: string;
  lastMessageId: string;
  lastMessageMs: number;
  recipient: string;
  recipientName: string | null;
  subject: string;
  lastBodyExcerpt: string;
}

interface ThreadListItem {
  id: string;
  historyId?: string;
  snippet?: string;
}

interface ThreadDetail {
  id: string;
  messages?: ThreadMessage[];
}

interface ThreadMessage {
  id: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string };
      parts?: ThreadMessage["payload"];
    }>;
  };
  snippet?: string;
}

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * Query Gmail for threads the user sent into recently and pick the ones where
 * THEY were the last to write and `quietDays` have passed since.
 *
 * `userEmail` is the user's own primary address — used to confirm the last
 * message is theirs.
 */
export async function fetchQuietThreads(
  token: string,
  userEmail: string,
  quietDays: number,
  windowDays: number,
  max: number
): Promise<{ ok: true; threads: QuietThread[] } | { ok: false; error: string }> {
  const q = `in:sent newer_than:${windowDays}d older_than:${quietDays}d -in:chats`;
  const listUrl = `${GMAIL_BASE}/threads?maxResults=${Math.min(
    Math.max(max * 3, 10),
    50
  )}&q=${encodeURIComponent(q)}`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) {
    if (listRes.status === 401) {
      const err = new Error("gmail 401");
      (err as Error & { status?: number }).status = 401;
      throw err;
    }
    return { ok: false, error: `gmail threads list ${listRes.status}` };
  }
  const list = (await listRes.json()) as { threads?: ThreadListItem[] };
  const threadIds = (list.threads ?? []).map((t) => t.id);

  const cutoffMs = Date.now() - quietDays * 24 * 60 * 60 * 1000;
  const results: QuietThread[] = [];
  const userEmailLower = userEmail.toLowerCase();

  for (const threadId of threadIds) {
    if (results.length >= max) break;
    const detailRes = await fetch(
      `${GMAIL_BASE}/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!detailRes.ok) {
      if (detailRes.status === 401) {
        const err = new Error("gmail 401");
        (err as Error & { status?: number }).status = 401;
        throw err;
      }
      continue;
    }
    const detail = (await detailRes.json()) as ThreadDetail;
    const messages = detail.messages ?? [];
    if (messages.length === 0) continue;

    const last = messages[messages.length - 1];
    const lastMs = last.internalDate ? Number(last.internalDate) : 0;
    if (!lastMs || lastMs > cutoffMs) continue;

    const headers = last.payload?.headers ?? [];
    const get = (n: string) =>
      headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";
    const fromHeader = get("From");
    const fromEmail = extractEmail(fromHeader);
    if (!fromEmail || fromEmail.toLowerCase() !== userEmailLower) {
      // Last message wasn't from the user — they already got a reply, or
      // someone else closed it. Skip.
      continue;
    }

    const toHeader = get("To");
    const recipientEmail = extractEmail(toHeader);
    if (!recipientEmail) continue;
    const recipientName = extractDisplayName(toHeader);

    // Skip if recipient is the user themselves (self-notes) or no-reply.
    if (recipientEmail.toLowerCase() === userEmailLower) continue;
    if (/^no[-_.]?reply@|@noreply\./i.test(recipientEmail)) continue;

    const subject = get("Subject").slice(0, 200);
    const snippet = (last.snippet ?? "").slice(0, 400);

    results.push({
      threadId,
      lastMessageId: last.id,
      lastMessageMs: lastMs,
      recipient: recipientEmail,
      recipientName,
      subject,
      lastBodyExcerpt: snippet,
    });
  }

  return { ok: true, threads: results };
}

function extractEmail(header: string): string | null {
  if (!header) return null;
  const m = header.match(/<([^>]+)>/);
  const candidate = (m ? m[1] : header).trim();
  if (!/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(candidate)) return null;
  return candidate;
}

function extractDisplayName(header: string): string | null {
  const m = header.match(/^\s*"?([^"<]+?)"?\s*</);
  if (!m) return null;
  const name = m[1].trim();
  return name && name !== "" ? name.slice(0, 100) : null;
}
