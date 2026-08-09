"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PROPERTIES,
  PREFERRED_CONTACT_METHODS,
  RECEIVED_VIA_OPTIONS,
} from "@/lib/constants";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewRequestPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    property: PROPERTIES[0] ?? "",
    tenant_name: "",
    preferred_contact: PREFERRED_CONTACT_METHODS[0],
    request_title: "",
    description: "",
    received_via: RECEIVED_VIA_OPTIONS[0],
    date_received: todayIsoDate(),
  });

  function updateField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to create request");
      }
      router.push(`/requests/${body.request.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-slate-500 hover:underline">
          &larr; Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          New Maintenance Request
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <Field label="Rental Property">
          <select
            className="input"
            value={form.property}
            onChange={(e) => updateField("property", e.target.value)}
            required
          >
            {PROPERTIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tenant Name">
          <input
            className="input"
            type="text"
            value={form.tenant_name}
            onChange={(e) => updateField("tenant_name", e.target.value)}
            required
          />
        </Field>

        <Field label="Preferred Contact Method">
          <select
            className="input"
            value={form.preferred_contact}
            onChange={(e) => updateField("preferred_contact", e.target.value)}
          >
            {PREFERRED_CONTACT_METHODS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Request Title">
          <input
            className="input"
            type="text"
            value={form.request_title}
            onChange={(e) => updateField("request_title", e.target.value)}
            required
          />
        </Field>

        <Field label="Full Description">
          <textarea
            className="input min-h-[120px]"
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            required
          />
        </Field>

        <Field label="How Received">
          <select
            className="input"
            value={form.received_via}
            onChange={(e) => updateField("received_via", e.target.value)}
          >
            {RECEIVED_VIA_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date Received">
          <input
            className="input"
            type="date"
            value={form.date_received}
            onChange={(e) => updateField("date_received", e.target.value)}
            required
          />
        </Field>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Request"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
