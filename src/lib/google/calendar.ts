// Google Calendar fetch utilities — read-only.

export interface CalendarAttendee {
  email: string;
  displayName?: string;
  organizer?: boolean;
  self?: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  startIso: string;
  endIso: string;
  startMs: number;
  hangoutLink: string | null;
  attendees: CalendarAttendee[];
  organizerEmail: string | null;
}

interface RawEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: { entryPoints?: Array<{ uri?: string; entryPointType?: string }> };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    organizer?: boolean;
    self?: boolean;
    responseStatus?: string;
  }>;
  organizer?: { email?: string };
  eventType?: string;
}

export type FetchCalendarResult =
  | { ok: true; events: CalendarEvent[] }
  | { ok: false; error: string };

const CAL_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Fetch upcoming events between now and `lookaheadMs` from now, single-event
 * expanded (recurring instances split out), ordered by start time. Skips
 * cancelled events, all-day events, and events without a real attendee.
 */
export async function fetchUpcomingEvents(
  token: string,
  lookaheadMs: number,
  max = 25
): Promise<FetchCalendarResult> {
  const now = new Date();
  const future = new Date(now.getTime() + lookaheadMs);
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(Math.min(Math.max(max, 1), 100)),
  });

  const res = await fetch(`${CAL_BASE}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401) {
      const err = new Error(`calendar 401`);
      (err as Error & { status?: number }).status = 401;
      throw err;
    }
    return { ok: false, error: `calendar fetch failed: ${res.status}` };
  }

  const json = (await res.json()) as { items?: RawEvent[] };
  const events: CalendarEvent[] = [];
  for (const raw of json.items ?? []) {
    if (raw.status === "cancelled") continue;
    if (!raw.id || !raw.start?.dateTime) continue; // skip all-day
    const startIso = raw.start.dateTime;
    const endIso = raw.end?.dateTime ?? startIso;
    const startMs = Date.parse(startIso);
    if (!Number.isFinite(startMs)) continue;

    const attendees: CalendarAttendee[] = (raw.attendees ?? [])
      .filter((a) => a.email && a.responseStatus !== "declined")
      .map((a) => ({
        email: a.email!,
        displayName: a.displayName,
        organizer: a.organizer,
        self: a.self,
      }));

    // Solo events (no attendees, just a calendar block) aren't meetings worth briefing.
    const externalAttendees = attendees.filter((a) => !a.self);
    if (externalAttendees.length === 0) continue;

    const hangoutLink =
      raw.hangoutLink ??
      raw.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
      null;

    events.push({
      id: raw.id,
      summary: (raw.summary ?? "(no title)").slice(0, 200),
      description: raw.description ? raw.description.slice(0, 4000) : null,
      location: raw.location ?? null,
      startIso,
      endIso,
      startMs,
      hangoutLink,
      attendees,
      organizerEmail: raw.organizer?.email ?? null,
    });
  }

  return { ok: true, events };
}

/**
 * Search Gmail for the most recent threads with a given email address.
 * Returns short subject+snippet pairs we can feed Claude as context.
 */
export interface AttendeeContextSnippet {
  date: string;
  from: string;
  subject: string;
  snippet: string;
}

export async function fetchAttendeeEmailContext(
  token: string,
  attendeeEmail: string,
  max = 5
): Promise<AttendeeContextSnippet[]> {
  const q = encodeURIComponent(`from:${attendeeEmail} OR to:${attendeeEmail}`);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${q}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) {
    if (listRes.status === 401) {
      const err = new Error("gmail 401");
      (err as Error & { status?: number }).status = 401;
      throw err;
    }
    return [];
  }
  const list = (await listRes.json()) as { messages?: Array<{ id: string }> };
  const ids = (list.messages ?? []).map((m) => m.id).slice(0, max);
  if (ids.length === 0) return [];

  const snippets: AttendeeContextSnippet[] = [];
  for (const id of ids) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!msgRes.ok) continue;
    const msg = (await msgRes.json()) as {
      snippet?: string;
      payload?: { headers?: Array<{ name: string; value: string }> };
      internalDate?: string;
    };
    const headers = msg.payload?.headers ?? [];
    const get = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";
    const ts = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString().slice(0, 10) : "";
    snippets.push({
      date: ts,
      from: get("From").slice(0, 200),
      subject: get("Subject").slice(0, 200),
      snippet: (msg.snippet ?? "").slice(0, 300),
    });
  }
  return snippets;
}
