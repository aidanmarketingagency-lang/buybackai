/**
 * Lightweight metadata fetchers used by the Buyback Audit. We pull headers
 * (no bodies) for email and event metadata for calendar — enough to find
 * patterns without ballooning token usage or latency.
 */

interface GmailMetaMessage {
  id: string;
  payload: { headers: Array<{ name: string; value: string }> };
  internalDate: string;
}

export interface EmailMeta {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: Date;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  durationMin: number;
  attendeeCount: number;
  isRecurring: boolean;
  organizerEmail: string;
}

class GoogleApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function googleFetch(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new GoogleApiError(`${res.status}: ${await res.text()}`, res.status);
  }
  return res.json();
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

/**
 * Fetch metadata (headers only) for inbox messages received in the last
 * `days` days. Pages through results until exhausted or `cap` is hit so the
 * audit reflects the full window, not just the most recent page.
 */
export async function fetchInboxMetadata(
  token: string,
  days: number,
  cap = 500
): Promise<EmailMeta[]> {
  const sinceSecs = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
  const query = `in:inbox -category:promotions -category:social after:${sinceSecs}`;

  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(Math.min(100, cap - ids.length)),
    });
    if (pageToken) params.set("pageToken", pageToken);

    const list = (await googleFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      token
    )) as { messages?: Array<{ id: string }>; nextPageToken?: string };

    if (list.messages?.length) ids.push(...list.messages.map((m) => m.id));
    pageToken = list.nextPageToken;
  } while (pageToken && ids.length < cap);

  if (ids.length === 0) return [];

  // Fetch headers in chunks of 20 in parallel to avoid blowing the API
  const results: EmailMeta[] = [];
  const CHUNK = 20;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const metas = await Promise.all(
      chunk.map(async (id) => {
        const msg = (await googleFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          token
        )) as GmailMetaMessage;
        return {
          id: msg.id,
          from: getHeader(msg.payload.headers, "From"),
          to: getHeader(msg.payload.headers, "To"),
          subject: getHeader(msg.payload.headers, "Subject"),
          date: new Date(parseInt(msg.internalDate, 10)),
        } as EmailMeta;
      })
    );
    results.push(...metas);
  }

  return results;
}

interface RawCalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string; responseStatus?: string }>;
  recurringEventId?: string;
  organizer?: { email?: string };
  eventType?: string;
}

export async function fetchCalendarEvents(
  token: string,
  days: number
): Promise<CalendarEvent[]> {
  const timeMin = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date().toISOString();

  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const data = (await googleFetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      token
    )) as { items?: RawCalendarEvent[]; nextPageToken?: string };

    for (const ev of data.items || []) {
      // Skip all-day events (no dateTime)
      if (!ev.start?.dateTime || !ev.end?.dateTime) continue;
      const start = new Date(ev.start.dateTime);
      const end = new Date(ev.end.dateTime);
      const durationMin = Math.max(
        0,
        Math.round((end.getTime() - start.getTime()) / 60000)
      );
      events.push({
        id: ev.id,
        summary: ev.summary || "(no title)",
        start,
        end,
        durationMin,
        attendeeCount: ev.attendees?.length ?? 0,
        isRecurring: !!ev.recurringEventId,
        organizerEmail: ev.organizer?.email || "",
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return events;
}

// ─── Aggregation: turn raw activity into a structured summary ──────────────

export interface ActivitySummary {
  windowDays: number;
  emailsTotal: number;
  emailsFromTopSenders: Array<{ sender: string; count: number }>;
  emailsByHour: number[]; // 24 buckets
  meetingsTotal: number;
  meetingHoursTotal: number;
  averageMeetingDurationMin: number;
  recurringMeetingsCount: number;
  topRecurringMeetings: Array<{ title: string; weeklyCount: number; weeklyHours: number }>;
  meetingsBack2Back: number;
}

function normalizeSender(from: string): string {
  // Extract just the email portion to dedup "Name <email>" variants
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).toLowerCase().trim();
}

export function summarizeActivity(
  emails: EmailMeta[],
  events: CalendarEvent[],
  windowDays: number
): ActivitySummary {
  // Email aggregates
  const senderCounts = new Map<string, number>();
  const hourBuckets = new Array(24).fill(0);
  for (const e of emails) {
    const sender = normalizeSender(e.from);
    senderCounts.set(sender, (senderCounts.get(sender) || 0) + 1);
    hourBuckets[e.date.getHours()] += 1;
  }
  const emailsFromTopSenders = Array.from(senderCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([sender, count]) => ({ sender, count }));

  // Meeting aggregates
  const meetingHoursTotal =
    events.reduce((sum, e) => sum + e.durationMin, 0) / 60;
  const averageMeetingDurationMin =
    events.length > 0 ? meetingHoursTotal * 60 / events.length : 0;
  const recurringMeetingsCount = events.filter((e) => e.isRecurring).length;

  // Group recurring meetings by normalized title
  const recurringTitleCounts = new Map<string, { count: number; hours: number }>();
  for (const e of events) {
    if (!e.isRecurring) continue;
    const key = e.summary.toLowerCase().trim();
    const existing = recurringTitleCounts.get(key) || { count: 0, hours: 0 };
    existing.count += 1;
    existing.hours += e.durationMin / 60;
    recurringTitleCounts.set(key, existing);
  }
  const weeksInWindow = Math.max(1, windowDays / 7);
  const topRecurringMeetings = Array.from(recurringTitleCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([title, agg]) => ({
      title,
      weeklyCount: Math.round((agg.count / weeksInWindow) * 10) / 10,
      weeklyHours: Math.round((agg.hours / weeksInWindow) * 10) / 10,
    }));

  // Back-to-back: count events that start within 5 minutes of the previous end
  const sortedByStart = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );
  let back2back = 0;
  for (let i = 1; i < sortedByStart.length; i++) {
    const gap =
      (sortedByStart[i].start.getTime() - sortedByStart[i - 1].end.getTime()) / 60000;
    if (gap >= 0 && gap <= 5) back2back += 1;
  }

  return {
    windowDays,
    emailsTotal: emails.length,
    emailsFromTopSenders,
    emailsByHour: hourBuckets,
    meetingsTotal: events.length,
    meetingHoursTotal: Math.round(meetingHoursTotal * 10) / 10,
    averageMeetingDurationMin: Math.round(averageMeetingDurationMin),
    recurringMeetingsCount,
    topRecurringMeetings,
    meetingsBack2Back: back2back,
  };
}
