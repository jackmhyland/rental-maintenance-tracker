import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PRIORITIES, RESPONSIBLE_PARTIES, STATUSES } from "@/lib/constants";

export const runtime = "nodejs";

type Action =
  | { action: "update_status"; status: string }
  | { action: "update_responsible_party"; responsible_party: string }
  | { action: "add_note"; note: string }
  | {
      action: "set_recommendation";
      decision: "accepted" | "overridden";
      final_priority: string;
    }
  | { action: "complete" };

function appendNote(existing: string | null, note: string): string {
  const timestamp = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const entry = `[${timestamp}] ${note.trim()}`;
  return existing && existing.trim().length > 0 ? `${existing}\n\n${entry}` : entry;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
  }

  let body: Action;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  switch (body.action) {
    case "update_status": {
      if (!STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      update.status = body.status;
      break;
    }
    case "update_responsible_party": {
      if (!RESPONSIBLE_PARTIES.includes(body.responsible_party)) {
        return NextResponse.json(
          { error: "Invalid responsible party" },
          { status: 400 }
        );
      }
      update.responsible_party = body.responsible_party;
      break;
    }
    case "add_note": {
      if (typeof body.note !== "string" || body.note.trim().length === 0) {
        return NextResponse.json({ error: "Note cannot be empty" }, { status: 400 });
      }
      const { data: existing, error: fetchError } = await supabase
        .from("maintenance_requests")
        .select("notes")
        .eq("id", id)
        .single();
      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }
      update.notes = appendNote(existing?.notes ?? null, body.note);
      break;
    }
    case "set_recommendation": {
      if (body.decision !== "accepted" && body.decision !== "overridden") {
        return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
      }
      if (!PRIORITIES.includes(body.final_priority as (typeof PRIORITIES)[number])) {
        return NextResponse.json(
          { error: "Invalid final priority" },
          { status: 400 }
        );
      }
      update.recommendation_decision = body.decision;
      update.final_priority = body.final_priority;
      break;
    }
    case "complete": {
      update.status = "Complete";
      update.completed_at = new Date().toISOString();
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("maintenance_requests")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ request: data });
}
