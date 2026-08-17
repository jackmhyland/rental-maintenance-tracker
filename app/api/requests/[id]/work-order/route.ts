import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PRIORITIES } from "@/lib/constants";

export const runtime = "nodejs";

// Explicit higher execution time limit than the platform default, so a slow
// Claude response doesn't get cut off mid-request. (Default serverless
// function timeout on Vercel is 10s on Hobby / 15s on Pro.)
export const maxDuration = 60;

const WORK_ORDER_TOOL: Anthropic.Tool = {
  name: "submit_work_order",
  description:
    "Submit the completed contractor-ready maintenance work order draft.",
  input_schema: {
    type: "object",
    properties: {
      work_order_draft: {
        type: "string",
        description:
          "The complete, formatted contractor work order draft, including all required sections.",
      },
    },
    required: ["work_order_draft"],
  },
};

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: maintenanceRequest, error: fetchError } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !maintenanceRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // The API route enforces the workflow itself rather than trusting the UI:
  // a work order may only be generated once the human has made the final
  // priority call and assigned the request to a contractor.
  if (maintenanceRequest.responsible_party !== "Contractor") {
    return NextResponse.json(
      {
        error:
          "A work order can only be generated once Responsible Party is set to Contractor.",
      },
      { status: 400 }
    );
  }

  if (
    !maintenanceRequest.final_priority ||
    !PRIORITIES.includes(
      maintenanceRequest.final_priority as (typeof PRIORITIES)[number]
    )
  ) {
    return NextResponse.json(
      {
        error:
          "A work order can only be generated once a final priority (Emergency, High, Medium, or Low) has been set.",
      },
      { status: 400 }
    );
  }

  const anthropic = new Anthropic();

  // Deliberately excludes tenant_name and preferred_contact — the contractor
  // work order must never include the tenant's identity or contact details.
  const prompt = `You are drafting a contractor-ready maintenance work order for a rental property. Use ONLY the information provided below. No tenant identity or contact information has been provided to you, and none should appear in the draft.

Property: ${maintenanceRequest.property}
Request Title: ${maintenanceRequest.request_title}
Full Description (as reported): ${maintenanceRequest.description}
Date Received: ${maintenanceRequest.date_received}
Final Priority: ${maintenanceRequest.final_priority}
Responsible Party: ${maintenanceRequest.responsible_party}
Notes / Updates on file: ${maintenanceRequest.notes ?? "None on file."}
Prior Suggested Next Action (advisory, from an earlier AI triage step): ${
    maintenanceRequest.claude_suggested_action ?? "None on file."
  }

Draft a work order for a maintenance contractor with exactly these sections, in this order:
- Property
- Priority
- Issue
- Reported Condition
- Relevant History / Troubleshooting
- Requested Scope
- Important Limitations

Strict rules — follow all of them:
- Use only facts contained in the information provided above. Do not invent facts, symptoms, measurements, repair history, or access information.
- Do not state an uncertain diagnosis or root cause as fact. If the cause of the problem is not established in the record, say so explicitly and preserve that uncertainty in the draft.
- Do not choose, name, or suggest a specific contractor or company.
- Do not contact anyone, or imply that anyone has been contacted.
- Do not authorize work or repairs.
- Do not authorize spending, or imply spending has been approved.
- Do not provide, estimate, or promise any pricing or cost.
- Do not change, recommend changing, or restate a different final priority than the one given above.
- Do not make legal, lease, warranty, building-code, or other regulatory claims.
- Do not instruct the contractor that replacement (rather than repair) is required unless the record above explicitly establishes that replacement is necessary.
- For "Requested Scope", generally ask the contractor to inspect, diagnose, and repair the reported condition as appropriate, rather than assuming a specific diagnosis or fix, unless the record above already establishes it.
- Do not include the tenant's name or any contact information — none was provided to you and none should appear in the draft.

Write the draft in a concise, professional tone suitable for handing directly to a maintenance contractor.`;

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1536,
      thinking: { type: "disabled" },
      tools: [WORK_ORDER_TOOL],
      tool_choice: { type: "tool", name: "submit_work_order" },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Anthropic API request failed: ${message}` },
      { status: 502 }
    );
  }

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUseBlock) {
    return NextResponse.json(
      { error: "Claude did not return a structured work order draft" },
      { status: 502 }
    );
  }

  const rawInput = toolUseBlock.input as unknown as Record<string, unknown>;
  const rawDraft = rawInput.work_order_draft;

  if (rawDraft === undefined || rawDraft === null) {
    return NextResponse.json(
      { error: "Claude did not include a work_order_draft in its response" },
      { status: 502 }
    );
  }

  if (typeof rawDraft !== "string") {
    return NextResponse.json(
      { error: "Claude's work_order_draft was not returned as a string" },
      { status: 502 }
    );
  }

  const draft = rawDraft.trim();

  if (draft.length === 0) {
    return NextResponse.json(
      { error: "Claude returned an empty work order draft" },
      { status: 502 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("maintenance_requests")
    .update({
      work_order_draft: draft,
      work_order_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  // A missing row with no explicit error means the UPDATE matched zero rows
  // (e.g. blocked by Row Level Security or a permissions issue) — that must
  // be treated as a failure, not a silent success, matching the same
  // hardened pattern used by the Analyze route and the PATCH route.
  if (updateError || !updated) {
    return NextResponse.json(
      {
        error:
          updateError?.message ??
          "The work order draft was generated but did not persist — no row was returned by Supabase. Check RLS policies and table privileges for the key used by SUPABASE_SECRET_KEY.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ request: updated });
}
