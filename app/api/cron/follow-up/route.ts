import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const FOLLOW_UP_THRESHOLD_DAYS = 3;

// Daily scheduled job (see vercel.json). For every unresolved maintenance
// request, sets needs_follow_up = true if it hasn't been updated in 3+ days,
// and false otherwise. This job never changes priority, status, responsible
// party, or any other field, and never contacts anyone.
export async function GET(request: NextRequest) {
  // Vercel sends "Authorization: Bearer <CRON_SECRET>" automatically for
  // scheduled invocations when CRON_SECRET is set as a project env var.
  // If CRON_SECRET isn't configured, this check is skipped.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseServerClient();
  const thresholdIso = new Date(
    Date.now() - FOLLOW_UP_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: staleFlagged, error: staleError } = await supabase
    .from("maintenance_requests")
    .update({ needs_follow_up: true })
    .neq("status", "Complete")
    .lte("updated_at", thresholdIso)
    .select("id");

  if (staleError) {
    return NextResponse.json({ error: staleError.message }, { status: 500 });
  }

  const { data: freshCleared, error: freshError } = await supabase
    .from("maintenance_requests")
    .update({ needs_follow_up: false })
    .neq("status", "Complete")
    .gt("updated_at", thresholdIso)
    .select("id");

  if (freshError) {
    return NextResponse.json({ error: freshError.message }, { status: 500 });
  }

  return NextResponse.json({
    flagged_needs_follow_up: staleFlagged?.length ?? 0,
    cleared_needs_follow_up: freshCleared?.length ?? 0,
  });
}
