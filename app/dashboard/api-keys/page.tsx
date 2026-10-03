"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";

export default function APIKeysPage() {
  const { data: session } = useSession();
  const [keys, setKeys] = useState<any[]>([]);
  const [apis, setApis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    apiId: "",
    environment: "production",
    scopes: "full",
  });

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json();
      setKeys(Array.isArray(data) ? data : []);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    fetch("/api/apis?limit=50&sort=score")
      .then((r) => r.json())
      .then((d) => setApis(Array.isArray(d) ? d : []));
  }, []);

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.apiId) {
      alert("Name and API are required");
      return;
    }
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          apiId: form.apiId,
          environment: form.environment,
          scopes: [form.scopes],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create key");
        return;
      }
      setCreatedSecret(data.key);
      setShowForm(false);
      setForm({ name: "", apiId: "", environment: "production", scopes: "full" });
      fetchKeys();
    } catch {
      alert("Failed to create key");
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Delete this API key?")) return;
    const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    if (res.ok) setKeys(keys.filter((k) => k.id !== id));
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <Link href="/auth/signin" className="text-[#4F7FFF]">
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="mb-2 text-3xl font-bold text-white sm:text-4xl">API Keys</h1>
            <p className="text-gray-400">Create keys per API and environment</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-white sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>

        {createdSecret && (
          <div className="mb-6 p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30">
            <p className="text-[#10B981] font-medium mb-2">
              Copy this key now — it will not be shown again.
            </p>
            <code className="block p-3 rounded bg-[#0A0E1A] text-white text-sm break-all">
              {createdSecret}
            </code>
            <button
              type="button"
              className="mt-2 text-sm text-gray-400"
              onClick={() => {
                navigator.clipboard.writeText(createdSecret);
              }}
            >
              Copy to clipboard
            </button>
          </div>
        )}

        {showForm && (
          <form
            onSubmit={createKey}
            className="mb-8 p-6 rounded-2xl bg-[#151B2B] border border-[rgba(255,255,255,0.05)] space-y-4"
          >
            <input
              required
              placeholder="Key name"
              className="w-full px-4 py-3 rounded-lg bg-[#0A0E1A] border border-[rgba(255,255,255,0.05)] text-white"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              required
              className="w-full px-4 py-3 rounded-lg bg-[#0A0E1A] border border-[rgba(255,255,255,0.05)] text-white"
              value={form.apiId}
              onChange={(e) => setForm({ ...form, apiId: e.target.value })}
            >
              <option value="">Select API</option>
              {apis.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              className="w-full px-4 py-3 rounded-lg bg-[#0A0E1A] border border-[rgba(255,255,255,0.05)] text-white"
              value={form.environment}
              onChange={(e) => setForm({ ...form, environment: e.target.value })}
            >
              <option value="development">development</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
            <select
              className="w-full px-4 py-3 rounded-lg bg-[#0A0E1A] border border-[rgba(255,255,255,0.05)] text-white"
              value={form.scopes}
              onChange={(e) => setForm({ ...form, scopes: e.target.value })}
            >
              <option value="full">full</option>
              <option value="read">read</option>
              <option value="write">write</option>
            </select>
            <button
              type="submit"
              className="px-6 py-3 rounded-lg bg-[#4F7FFF] text-white"
            >
              Create key
            </button>
          </form>
        )}

        {keys.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#151B2B] border border-[rgba(255,255,255,0.05)] text-gray-400">
            No API keys yet. Create one to use the playground.
          </div>
        ) : (
          <div className="space-y-4">
            {keys.map((key) => (
              <div
                key={key.id}
                className="p-6 rounded-2xl bg-[#151B2B] border border-[rgba(255,255,255,0.05)] flex items-center justify-between gap-4"
              >
                <div>
                  <h3 className="text-lg font-semibold text-white">{key.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {key.api?.name || "API"} · {key.environment} ·{" "}
                    {(key.scopes || []).join(", ") || "full"}
                  </p>
                  <code className="text-xs text-gray-500 font-mono">
                    {key.keyHint || key.keyPrefix || "adw_****"}…
                  </code>
                </div>
                <button
                  onClick={() => deleteKey(key.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
