"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaintenanceRequest, RecommendationDecision } from "@/lib/types";
import { PRIORITIES, RESPONSIBLE_PARTIES, STATUSES } from "@/lib/constants";
import { PriorityBadge, StatusBadge, FollowUpFlag } from "@/components/Badges";

async function patchRequest(id: number, body: Record<string, unknown>) {
  const response = await fetch(`/api/requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? "Request failed");
  }
  return json.request as MaintenanceRequest;
}

export default function RequestDetailClient({
  initialRequest,
}: {
  initialRequest: MaintenanceRequest;
}) {
  const router = useRouter();
  const [req, setReq] = useState(initialRequest);
  const [error, setError] = useState<string | null>(null);

  const [statusValue, setStatusValue] = useState(req.status);
  const [responsibleValue, setResponsibleValue] = useState(
    req.responsible_party ?? ""
  );
  const [noteText, setNoteText] = useState("");
  const [finalPriorityChoice, setFinalPriorityChoice] = useState<string>(
    req.final_priority ?? req.claude_priority ?? PRIORITIES[2]
  );

  const [analyzing, setAnalyzing] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingResponsible, setSavingResponsible] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingRecommendation, setSavingRecommendation] = useState(false);
  const [completing, setCompleting] = useState(false);

  function applyUpdate(updated: MaintenanceRequest) {
    setReq(updated);
    router.refresh();
  }

  async function withErrorHandling(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    await withErrorHandling(async () => {
      const response = await fetch(`/api/requests/${req.id}/analyze`, {
        method: "POST",
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Analysis failed");
      }
      applyUpdate(json.request as MaintenanceRequest);
      setFinalPriorityChoice(json.request.claude_priority);
    });
    setAnalyzing(false);
  }

  async function handleSaveStatus() {
    setSavingStatus(true);
    await withErrorHandling(async () => {
      const updated = await patchRequest(req.id, {
        action: "update_status",
        status: statusValue,
      });
      applyUpdate(updated);
    });
    setSavingStatus(false);
  }

  async function handleSaveResponsible() {
    setSavingResponsible(true);
    await withErrorHandling(async () => {
      const updated = await patchRequest(req.id, {
        action: "update_responsible_party",
        responsible_party: responsibleValue,
      });
      applyUpdate(updated);
    });
    setSavingResponsible(false);
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    await withErrorHandling(async () => {
      const updated = await patchRequest(req.id, {
        action: "add_note",
        note: noteText,
      });
      applyUpdate(updated);
      setNoteText("");
    });
    setSavingNote(false);
  }

  async function handleRecommendationDecision(decision: RecommendationDecision) {
    setSavingRecommendation(true);
    await withErrorHandling(async () => {
      const finalPriority =
        decision === "accepted" ? req.claude_priority! : finalPriorityChoice;
      const updated = await patchRequest(req.id, {
        action: "set_recommendation",
        decision,
        final_priority: finalPriority,
      });
      applyUpdate(updated);
    });
    setSavingRecommendation(false);
  }

  async function handleComplete() {
    setCompleting(true);
    await withErrorHandling(async () => {
      const updated = await patchRequest(req.id, { action: "complete" });
      applyUpdate(updated);
      setStatusValue(updated.status);
    });
    setCompleting(false);
  }

  const isComplete = req.status === "Complete";

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Original request info */}
      <Section title="Request Information">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <InfoField label="Property" value={req.property} />
          <InfoField label="Tenant" value={req.tenant_name} />
          <InfoField
            label="Preferred Contact"
            value={req.preferred_contact ?? "Not provided"}
          />
          <InfoField
            label="How Received"
            value={req.received_via ?? "Not provided"}
          />
          <InfoField label="Date Received" value={req.date_received} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Status
            </p>
            <div className="mt-1">
              <StatusBadge status={req.status} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Follow-Up
            </p>
            <div className="mt-1">
              <FollowUpFlag needsFollowUp={req.needs_follow_up} />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Full Description
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
            {req.description}
          </p>
        </div>
      </Section>

      {/* Claude analysis */}
      <Section title="Claude Analysis (advisory only)">
        {req.claude_priority ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">
                Claude&apos;s recommended priority:
              </span>
              <PriorityBadge priority={req.claude_priority} />
            </div>
            <InfoBlock label="Explanation" value={req.claude_explanation} />
            <InfoBlock
              label="Suggested Next Action"
              value={req.claude_suggested_action}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            This request hasn&apos;t been analyzed yet.
          </p>
        )}
        <div className="mt-4">
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
          >
            {analyzing
              ? "Analyzing... (this can take up to a minute)"
              : req.claude_priority
              ? "Re-analyze Request"
              : "Analyze Request"}
          </button>
        </div>
      </Section>

      {/* Accept / override recommendation */}
      {req.claude_priority && (
        <Section title="Priority Decision">
          {req.recommendation_decision && (
            <p className="mb-3 text-sm text-slate-600">
              Current decision:{" "}
              <span className="font-medium">
                {req.recommendation_decision === "accepted"
                  ? "Accepted Claude's recommendation"
                  : "Overridden by property manager"}
              </span>{" "}
              &mdash; final priority: <PriorityBadge priority={req.final_priority} />
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleRecommendationDecision("accepted")}
              disabled={savingRecommendation}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Accept Recommendation
            </button>
            <span className="text-sm text-slate-500">or override:</span>
            <select
              className="input w-auto"
              value={finalPriorityChoice}
              onChange={(e) => setFinalPriorityChoice(e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleRecommendationDecision("overridden")}
              disabled={savingRecommendation}
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
            >
              Save Override
            </button>
          </div>
        </Section>
      )}

      {/* Status + responsible party */}
      <Section title="Status & Responsible Party">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Status
            </label>
            <div className="flex gap-2">
              <select
                className="input"
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSaveStatus}
                disabled={savingStatus}
                className="whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Responsible Party
            </label>
            <div className="flex gap-2">
              <select
                className="input"
                value={responsibleValue}
                onChange={(e) => setResponsibleValue(e.target.value)}
              >
                <option value="">Unassigned</option>
                {RESPONSIBLE_PARTIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSaveResponsible}
                disabled={savingResponsible}
                className="whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* Notes */}
      <Section title="Notes & Updates">
        {req.notes ? (
          <pre className="mb-4 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            {req.notes}
          </pre>
        ) : (
          <p className="mb-4 text-sm text-slate-500">No notes yet.</p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <textarea
            className="input min-h-[80px] flex-1"
            placeholder="Add a note or update..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <button
            onClick={handleAddNote}
            disabled={savingNote || !noteText.trim()}
            className="self-start whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Add Note
          </button>
        </div>
      </Section>

      {/* Mark complete */}
      <Section title="Close Request">
        {isComplete ? (
          <p className="text-sm text-green-700">
            This request was marked complete
            {req.completed_at
              ? ` on ${new Date(req.completed_at).toLocaleString()}`
              : ""}
            .
          </p>
        ) : (
          <button
            onClick={handleComplete}
            disabled={completing}
            className="inline-flex items-center justify-center rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-800 disabled:opacity-50"
          >
            {completing ? "Marking Complete..." : "Mark Request Complete"}
          </button>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-900">{value}</p>
    </div>
  );
}

function InfoBlock({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
        {value}
      </p>
    </div>
  );
}
