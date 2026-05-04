import { appLink, unsubLink } from "./resend";

// All emails follow the same restrained editorial style as the app:
// dark, plain typography, hairline dividers, accent color #d4ff3a sparingly.
// HTML is inlined-styles only (no <style> blocks) for client compatibility.
// Plain-text fallbacks are written like real emails, not auto-stripped HTML.

const BG = "#08090b";
const SURFACE = "#0f1012";
const TEXT = "#f7f8f8";
const DIM = "#8a8f98";
const FAINT = "#5d626c";
const ACCENT = "#d4ff3a";
const HAIRLINE = "#1a1c20";

function shell(args: {
  preheader: string;
  body: string;
  userId: string;
}): string {
  const unsub = unsubLink(args.userId);
  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:${BG};font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${TEXT};">
<div style="display:none;max-height:0;overflow:hidden;color:${BG};">${escape(args.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:${SURFACE};border:1px solid ${HAIRLINE};">
<tr><td style="padding:20px 28px;border-bottom:1px solid ${HAIRLINE};">
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ACCENT};vertical-align:middle;"></span>
<span style="font-weight:600;font-size:15px;letter-spacing:-0.011em;color:${TEXT};margin-left:8px;vertical-align:middle;">BuybackAI</span>
</td></tr>
<tr><td style="padding:32px 28px 24px;">${args.body}</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid ${HAIRLINE};font-size:11px;color:${FAINT};letter-spacing:0.06em;text-transform:uppercase;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
<a href="${appLink("/dashboard")}" style="color:${FAINT};text-decoration:none;">Dashboard</a>
&nbsp;·&nbsp;
<a href="${appLink("/agents")}" style="color:${FAINT};text-decoration:none;">Agents</a>
&nbsp;·&nbsp;
<a href="${unsub}" style="color:${FAINT};text-decoration:none;">Unsubscribe</a>
</td></tr>
</table>
<div style="font-size:11px;color:${FAINT};margin-top:14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.04em;">
BuybackAI · sent because you signed up. <a href="${unsub}" style="color:${FAINT};">Unsubscribe</a>.
</div>
</td></tr>
</table>
</body></html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Audit ready ──────────────────────────────────────────────────────────

export function auditReadyTemplate(args: {
  userId: string;
  firstName: string | null;
  totalHours: number;
  totalDollars: number;
  hourlyRate: number;
  topThief: string | null;
}) {
  const greet = args.firstName ? `Hey ${escape(args.firstName)},` : "Hey,";
  const dollars = `$${Math.round(args.totalDollars).toLocaleString()}`;
  const hours = args.totalHours.toFixed(1);
  const subject = `Your audit: ${dollars} recoverable / wk`;

  const preheader = `Your last 14 days, scored at $${args.hourlyRate}/hr. ${dollars} in recoverable hours. Open the report.`;

  const text = `${greet}

Your BuybackAI audit is ready.

At your $${args.hourlyRate}/hr rate, you spent ${hours} hours over the last 14 days on tasks an AI agent could have handled.

That's ${dollars} per week of work you don't need to do yourself${args.topThief ? `. Biggest single category: ${args.topThief}.` : "."}

Open the full report: ${appLink("/dashboard")}

Hire your first agent (free): ${appLink("/agents")}

— Aidan
BuybackAI

Unsubscribe: ${unsubLink(args.userId)}`;

  const body = `
<p style="margin:0 0 12px;font-size:11px;color:${FAINT};letter-spacing:0.06em;text-transform:uppercase;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Audit complete</p>
<h1 style="margin:0 0 18px;font-size:28px;line-height:1.15;font-weight:500;letter-spacing:-0.025em;color:${TEXT};">
${greet} your audit found <span style="font-family:'Instrument Serif',Georgia,serif;font-style:italic;color:${ACCENT};font-weight:400;">${dollars} / week</span> of work an agent can take.
</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${DIM};">
At your <strong style="color:${TEXT};">$${args.hourlyRate}/hr</strong> rate, you spent <strong style="color:${TEXT};">${hours} hours</strong> over the last 14 days on tasks
an AI agent could have handled${args.topThief ? `. Your biggest single category was <strong style="color:${TEXT};">${escape(args.topThief)}</strong>.` : "."}
</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid ${HAIRLINE};border-bottom:1px solid ${HAIRLINE};margin:24px 0;">
<tr>
<td style="padding:18px 0;border-right:1px solid ${HAIRLINE};text-align:center;width:50%;">
<div style="font-size:11px;color:${FAINT};letter-spacing:0.06em;text-transform:uppercase;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-bottom:6px;">RECOVERABLE / WK</div>
<div style="font-size:24px;color:${ACCENT};font-weight:500;letter-spacing:-0.02em;">${dollars}</div>
</td>
<td style="padding:18px 0;text-align:center;width:50%;">
<div style="font-size:11px;color:${FAINT};letter-spacing:0.06em;text-transform:uppercase;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-bottom:6px;">HOURS / 14d</div>
<div style="font-size:24px;color:${TEXT};font-weight:500;letter-spacing:-0.02em;">${hours}</div>
</td>
</tr>
</table>
<p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:${DIM};">
Free plan starts you with one agent. The audit told you which one will earn its keep first.
</p>
<a href="${appLink("/agents")}" style="display:inline-block;background:${ACCENT};color:${BG};padding:12px 22px;text-decoration:none;font-size:14px;font-weight:500;border-radius:6px;">Hire your first agent →</a>
<p style="margin:28px 0 0;font-size:13px;color:${FAINT};">
Or <a href="${appLink("/dashboard")}" style="color:${DIM};text-decoration:underline;">open the dashboard</a> to see the full breakdown.
</p>
<p style="margin:24px 0 0;font-size:13px;color:${FAINT};">— Aidan</p>
`;

  return {
    subject,
    text,
    html: shell({ preheader, body, userId: args.userId }),
  };
}

// ─── Daily digest ─────────────────────────────────────────────────────────

export interface DigestActionItem {
  agentName: string;
  summary: string;
}

export function dailyDigestTemplate(args: {
  userId: string;
  firstName: string | null;
  pendingCount: number;
  items: DigestActionItem[];
}) {
  const greet = args.firstName ? `Hey ${escape(args.firstName)},` : "Hey,";
  const subject = `${args.pendingCount} draft${args.pendingCount === 1 ? "" : "s"} waiting for your call`;
  const preheader = `Your agents worked overnight. ${args.pendingCount} thing${args.pendingCount === 1 ? "" : "s"} need a 1-second review.`;

  const itemsHtml = args.items
    .slice(0, 8)
    .map(
      (item) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${HAIRLINE};">
<div style="font-size:11px;color:${FAINT};letter-spacing:0.06em;text-transform:uppercase;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-bottom:4px;">${escape(item.agentName)}</div>
<div style="font-size:14px;color:${TEXT};line-height:1.5;">${escape(item.summary)}</div>
</td></tr>`
    )
    .join("");

  const itemsText = args.items
    .slice(0, 8)
    .map((item) => `· [${item.agentName}] ${item.summary}`)
    .join("\n");

  const text = `${greet}

Your agents have ${args.pendingCount} thing${args.pendingCount === 1 ? "" : "s"} waiting for your call.

${itemsText}

Review them: ${appLink("/dashboard")}

— Aidan
BuybackAI

Unsubscribe: ${unsubLink(args.userId)}`;

  const body = `
<p style="margin:0 0 12px;font-size:11px;color:${FAINT};letter-spacing:0.06em;text-transform:uppercase;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Inbox · needs your call</p>
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.2;font-weight:500;letter-spacing:-0.025em;color:${TEXT};">
${greet} your agents queued <span style="font-family:'Instrument Serif',Georgia,serif;font-style:italic;color:${ACCENT};font-weight:400;">${args.pendingCount} thing${args.pendingCount === 1 ? "" : "s"}</span> for your review.
</h1>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${DIM};">
Each one is a one-click approve / dismiss. Drafts go to your Gmail; nothing sends without you.
</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid ${HAIRLINE};margin:18px 0;">
${itemsHtml}
</table>
<a href="${appLink("/dashboard")}" style="display:inline-block;background:${ACCENT};color:${BG};padding:12px 22px;text-decoration:none;font-size:14px;font-weight:500;border-radius:6px;margin-top:16px;">Open dashboard →</a>
<p style="margin:24px 0 0;font-size:13px;color:${FAINT};">— Aidan</p>
`;

  return {
    subject,
    text,
    html: shell({ preheader, body, userId: args.userId }),
  };
}
