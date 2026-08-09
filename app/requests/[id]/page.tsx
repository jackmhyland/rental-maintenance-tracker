import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { MaintenanceRequest } from "@/lib/types";
import RequestDetailClient from "@/components/RequestDetailClient";

export const dynamic = "force-dynamic";

async function getRequest(id: number): Promise<MaintenanceRequest | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }
  return data;
}

export default async function RequestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    notFound();
  }

  const maintenanceRequest = await getRequest(id);
  if (!maintenanceRequest) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-slate-500 hover:underline">
          &larr; Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {maintenanceRequest.request_title}
        </h1>
      </div>

      <RequestDetailClient initialRequest={maintenanceRequest} />
    </div>
  );
}
