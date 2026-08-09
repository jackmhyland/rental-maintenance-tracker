import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface CreateRequestBody {
  property: string;
  tenant_name: string;
  preferred_contact: string;
  request_title: string;
  description: string;
  received_via: string;
  date_received: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: NextRequest) {
  let body: CreateRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requiredFields: (keyof CreateRequestBody)[] = [
    "property",
    "tenant_name",
    "request_title",
    "description",
    "date_received",
  ];
  const missing = requiredFields.filter((field) => !isNonEmptyString(body[field]));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required field(s): ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("maintenance_requests")
    .insert({
      property: body.property,
      tenant_name: body.tenant_name,
      preferred_contact: body.preferred_contact || null,
      request_title: body.request_title,
      description: body.description,
      received_via: body.received_via || null,
      date_received: body.date_received,
      status: "Open",
      needs_follow_up: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ request: data }, { status: 201 });
}
