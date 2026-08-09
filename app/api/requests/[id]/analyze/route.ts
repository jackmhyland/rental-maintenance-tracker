import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Explicit higher execution time limit than the platform default, so a slow
// Claude response doesn't get cut off mid-request. (Default serverless
// function timeout on Vercel is 10s on Hobby / 15s on Pro.)
export const maxDuration = 60;

const RECOMMENDATION_TOOL: Anthropic.Tool = {
  name: "submit_recommendation",
  description:
    "Submit the priority recommendation for this rental property maintenance request.",
  input_schema: {
    type: "object",
    properties: {
      priority: {
        type: "string",
        enum: ["Emergency", "High", "Medium", "Low"],
        description:
          "Exactly one priority level for this maintenance request.",
      },
      explanation: {
        type: "string",
        description:
          "A short (1-3 sentence) explanation of why this priority level is appropriate.",
      },
      suggested_action: {
        type: "string",
        description:
          "A concise, concrete next action the property manager should take.",
      },
    },
    required: ["priority", "explanation", "suggested_action"],
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

  const anthropic = new Anthropic();

  const prompt = `You are assisting a rental property manager in triaging a maintenance request. Review the request below and recommend a priority.

Property: ${maintenanceRequest.property}
Tenant: ${maintenanceRequest.tenant_name}
Request title: ${maintenanceRequest.request_title}
Full description: ${maintenanceRequest.description}
How received: ${maintenanceRequest.received_via ?? "Unknown"}
Date received: ${maintenanceRequest.date_received}

Recommend exactly one priority (Emergency, High, Medium, or Low), a short explanation for that priority, and a concise suggested next action. You are advisory only — the property manager will review and may accept or override your recommendation.`;

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      thinking: { type: "disabled" },
      tools: [RECOMMENDATION_TOOL],
      tool_choice: { type: "tool", name: "submit_recommendation" },
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
      { error: "Claude did not return a structured recommendation" },
      { status: 502 }
    );
  }

  const recommendation = toolUseBlock.input as unknown as {
    priority: string;
    explanation: string;
    suggested_action: string;
  };

  const { data: updated, error: updateError } = await supabase
    .from("maintenance_requests")
    .update({
      claude_priority: recommendation.priority,
      claude_explanation: recommendation.explanation,
      claude_suggested_action: recommendation.suggested_action,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ request: updated });
}
