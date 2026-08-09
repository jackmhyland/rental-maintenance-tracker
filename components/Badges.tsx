const PRIORITY_STYLES: Record<string, string> = {
  Emergency: "bg-red-100 text-red-800 border-red-200",
  High: "bg-orange-100 text-orange-800 border-orange-200",
  Medium: "bg-amber-100 text-amber-800 border-amber-200",
  Low: "bg-slate-100 text-slate-700 border-slate-200",
};

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
        Not analyzed
      </span>
    );
  }
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.Low;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {priority}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  Open: "bg-blue-100 text-blue-800 border-blue-200",
  "In Progress": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "On Hold": "bg-slate-100 text-slate-700 border-slate-200",
  Complete: "bg-green-100 text-green-800 border-green-200",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.Open;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {status}
    </span>
  );
}

export function FollowUpFlag({ needsFollowUp }: { needsFollowUp: boolean }) {
  if (!needsFollowUp) {
    return <span className="text-sm text-slate-400">&mdash;</span>;
  }
  return (
    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
      Needs follow-up
    </span>
  );
}
