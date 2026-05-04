import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withGoogleToken } from "@/lib/google/auth";
import { createGmailDraftReply } from "@/lib/google/gmail";

type ActionStatus = "pending_review" | "processing" | "approved" | "dismissed";

interface ActionRow {
  id: string;
  user_id: string;
  type: string;
  content: Record<string, unknown>;
  status: ActionStatus;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status: requestedStatus } = await request.json();

  if (!["approved", "dismissed"].includes(requestedStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Dismissals only apply to pending_review actions. Allowing dismiss on
  // `processing` would race approval: the approve handler could create a
  // Gmail draft while dismiss flips the row, leaving an orphaned draft
  // tied to a "dismissed" action. If a user wants to revoke an approval
  // after the draft exists, that's a separate "delete draft" flow.
  if (requestedStatus === "dismissed") {
    const { data: dismissed, error } = await supabaseAdmin
      .from("agent_actions")
      .update({ status: "dismissed" })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "pending_review")
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!dismissed) {
      // Either action doesn't exist OR it's already approved/processing/
      // dismissed. Inspect to give a useful response.
      const { data: current } = await supabaseAdmin
        .from("agent_actions")
        .select("status")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!current) {
        return NextResponse.json({ error: "Action not found" }, { status: 404 });
      }
      const s = (current as { status: ActionStatus }).status;
      if (s === "dismissed") {
        return NextResponse.json({ success: true, idempotent: true });
      }
      // approved or processing — refuse so user can't undo a real side effect
      return NextResponse.json(
        {
          error: "cannot_dismiss",
          message:
            s === "processing"
              ? "This action is being processed. Try again in a moment."
              : "This action was already approved.",
          status: s,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  }

  // ── APPROVAL ─────────────────────────────────────────────────────────
  //
  // Approval may have a non-idempotent side effect (Gmail draft creation).
  // To make double-clicks / retries safe, we use a 3-step protocol:
  //
  //   1. ATOMIC CLAIM: UPDATE status='processing' WHERE status='pending_review'
  //      Only one concurrent request wins.
  //   2. PERFORM SIDE EFFECT (Gmail draft).
  //      On failure → roll back to pending_review so user can retry.
  //   3. FINALIZE: UPDATE status='approved', persist draft id, etc.
  //
  // For requests that lose the race (status was already 'approved' or
  // 'processing'), we look up the existing record and return it idempotently
  // so retries see the same draft id rather than triggering new work.

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("agent_actions")
    .update({ status: "processing" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "pending_review")
    .select("id, user_id, type, content, status")
    .maybeSingle();

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  if (!claimed) {
    // Either action doesn't exist, was dismissed, or already approved/processing.
    return idempotentReplay(id, user.id);
  }

  const action = claimed as ActionRow;

  // FYI / no-side-effect action types: just flip to approved.
  if (!actionNeedsGmailDraft(action.type)) {
    const { error } = await supabaseAdmin
      .from("agent_actions")
      .update({ status: "approved" })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "processing");
    if (error) {
      // Best-effort rollback so the action doesn't sit stuck in 'processing'.
      await rollbackToPending(id, user.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // Email reply / urgent / follow-up: create the Gmail draft.
  // Follow-up drafts use a slightly different content shape (we replied to
  // OUR own thread, recipient = original to, draft_reply field instead of
  // draft). Normalize both shapes into the args createGmailDraftReply needs.
  const c = action.content as {
    gmail_thread_id?: string;
    thread_id?: string;
    gmail_id?: string;
    from?: string;
    recipient?: string;
    subject?: string;
    draft?: string | null;
    draft_reply?: string | null;
  };

  const draftArgs = {
    threadId: c.gmail_thread_id ?? c.thread_id ?? "",
    inReplyToMessageId: c.gmail_id ?? "",
    to: c.from ?? c.recipient ?? "",
    subject: c.subject ?? "",
    bodyText: c.draft ?? c.draft_reply ?? "",
  };

  if (
    !draftArgs.bodyText ||
    !draftArgs.threadId ||
    !draftArgs.inReplyToMessageId ||
    !draftArgs.to ||
    !draftArgs.subject
  ) {
    // Action is malformed — roll the claim back so the row doesn't stay in
    // 'processing' forever. Caller should dismiss it.
    await rollbackToPending(id, user.id);
    return NextResponse.json(
      {
        error: "incomplete_action",
        message:
          "This action is missing the data needed to create a Gmail draft. Mark it dismissed instead.",
      },
      { status: 422 }
    );
  }

  const draftResult = await withGoogleToken(user.id, async (token) =>
    createGmailDraftReply(token, draftArgs)
  );

  if (!draftResult.ok) {
    await rollbackToPending(id, user.id);
    return NextResponse.json(
      {
        error: "draft_failed",
        reason: draftResult.reason,
        message:
          draftResult.reason === "no_token" || draftResult.reason === "no_refresh_token"
            ? "Your Google connection expired. Sign out and back in to grant Gmail access again."
            : "We couldn't create the draft in Gmail. Try again in a moment.",
      },
      { status: 502 }
    );
  }

  // Use .select() so we can detect zero-row updates (which would mean
  // someone changed the row out from under us — e.g. a delete or status
  // override). The Gmail draft is already real and undo-able only with
  // delete-permission we don't have, so a 0-row finalize is a partial
  // success that needs explicit handling.
  const { data: finalized, error: finalizeError } = await supabaseAdmin
    .from("agent_actions")
    .update({
      status: "approved",
      content: {
        ...c,
        draft_id: draftResult.data.draftId,
        draft_message_id: draftResult.data.messageId,
        drafted_at: new Date().toISOString(),
      },
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();

  if (finalizeError) {
    // The Gmail draft is real but we couldn't promote the row to 'approved'.
    // Best-effort: at least record the orphan draft id on the row (and
    // attempt to flip status back to pending_review so the dashboard keeps
    // showing it). If this also fails, the row stays in 'processing' but
    // the dashboard now fetches that state too — see dashboard/page.tsx.
    console.error("Approval finalize failed but draft was created:", finalizeError);
    await supabaseAdmin
      .from("agent_actions")
      .update({
        status: "pending_review",
        content: {
          ...c,
          orphan_draft_id: draftResult.data.draftId,
          orphan_draft_message_id: draftResult.data.messageId,
          orphaned_at: new Date().toISOString(),
          orphan_reason: `finalize_failed: ${finalizeError.message}`,
        },
      })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json(
      {
        error: "finalize_failed",
        draftId: draftResult.data.draftId,
        message:
          "We created the draft in your Gmail but couldn't update the dashboard. Check your Gmail drafts and re-approve here once we recover.",
      },
      { status: 500 }
    );
  }

  if (!finalized) {
    // Row was changed (or deleted) while the draft was being created. The
    // draft is real and orphaned. Best we can do is record it on whatever
    // row exists for forensics, then tell the caller it's an orphan so
    // they don't believe the dismiss/cancel was clean.
    console.warn(
      `Approval orphan: action ${id} not in 'processing' at finalize. Draft ${draftResult.data.draftId} created in Gmail.`
    );
    await supabaseAdmin
      .from("agent_actions")
      .update({
        content: {
          ...c,
          orphan_draft_id: draftResult.data.draftId,
          orphan_draft_message_id: draftResult.data.messageId,
          orphaned_at: new Date().toISOString(),
        },
      })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json(
      {
        error: "orphaned_draft",
        draftId: draftResult.data.draftId,
        message:
          "A Gmail draft was created but the action was changed before we could finalize. Check your Gmail drafts and delete it if you no longer want it.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    draftId: draftResult.data.draftId,
    message: "Draft created in your Gmail. Open Gmail Drafts to review and send.",
  });
}

function actionNeedsGmailDraft(type: string): boolean {
  return (
    type === "email_reply" ||
    type === "urgent_email" ||
    type === "follow_up_draft"
  );
}

async function rollbackToPending(actionId: string, userId: string): Promise<void> {
  // Best-effort rollback. If this also fails the action will sit in
  // 'processing' until the user dismisses it, but that's the safest
  // failure mode — better than losing data.
  await supabaseAdmin
    .from("agent_actions")
    .update({ status: "pending_review" })
    .eq("id", actionId)
    .eq("user_id", userId)
    .eq("status", "processing");
}

async function idempotentReplay(actionId: string, userId: string): Promise<NextResponse> {
  const { data: current } = await supabaseAdmin
    .from("agent_actions")
    .select("status, content")
    .eq("id", actionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!current) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }
  const row = current as { status: ActionStatus; content: Record<string, unknown> };

  if (row.status === "approved") {
    // Idempotent retry of an already-completed approval. Return the existing
    // draft id so the client treats it the same as a successful first call.
    const draftId = (row.content as { draft_id?: string })?.draft_id ?? null;
    return NextResponse.json({
      success: true,
      idempotent: true,
      draftId,
      message: "This action was already approved.",
    });
  }
  if (row.status === "dismissed") {
    return NextResponse.json(
      { error: "already_dismissed", message: "This action was already dismissed." },
      { status: 409 }
    );
  }
  if (row.status === "processing") {
    // Another request is mid-flight. Tell the caller to retry shortly.
    return NextResponse.json(
      {
        error: "processing",
        message: "This action is being processed. Try again in a moment.",
      },
      { status: 409 }
    );
  }
  // Should never happen, but be defensive.
  return NextResponse.json(
    { error: "unexpected_state", status: row.status },
    { status: 500 }
  );
}
