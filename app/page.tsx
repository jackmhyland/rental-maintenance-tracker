import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { MaintenanceRequest } from "@/lib/types";
import { PriorityBadge, StatusBadge, FollowUpFlag } from "@/components/Badges";

export const dynamic = "force-dynamic";

async function getUnresolvedRequests(): Promise<MaintenanceRequest[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("maintenance_requests")
    .select("*")
    .neq("status", "Complete")
    .order("date_received", { ascending: false });

  if (error) {
    throw new Error(`Failed to load maintenance requests: ${error.message}`);
  }

  return data ?? [];
}

export default async function DashboardPage() {
  const requests = await getUnresolvedRequests();
  const openCount = requests.length;
  const followUpCount = requests.filter((r) => r.needs_follow_up).length;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Rental Maintenance Tracker
        </h1>
        <Link
          href="/new"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
        >
          + Add Maintenance Request
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Open Requests</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">
            {openCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Needing Follow-Up
          </p>
          <p className="mt-1 text-3xl font-semibold text-red-600">
            {followUpCount}
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {requests.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No open maintenance requests. Everything is resolved.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Title</Th>
                  <Th>Property</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                  <Th>Owner</Th>
                  <Th>Flag</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
                      <Link
                        href={`/requests/${r.id}`}
                        className="block hover:underline"
                      >
                        {r.request_title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      <Link href={`/requests/${r.id}`} className="block">
                        {r.property}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <Link href={`/requests/${r.id}`} className="block">
                        <PriorityBadge
                          priority={r.final_priority ?? r.claude_priority}
                        />
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <Link href={`/requests/${r.id}`} className="block">
                        <StatusBadge status={r.status} />
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      <Link href={`/requests/${r.id}`} className="block">
                        {r.responsible_party ?? "Unassigned"}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <Link href={`/requests/${r.id}`} className="block">
                        <FollowUpFlag needsFollowUp={r.needs_follow_up} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}
