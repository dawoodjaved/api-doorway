"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { APIPlayground } from "@/components/playground/APIPlayground";

export default function PlaygroundPage() {
  const { data: session, status } = useSession();
  const [apis, setApis] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [apiId, setApiId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/apis?limit=50&sort=score")
      .then((r) => r.json())
      .then((d) => setApis(Array.isArray(d) ? d : []));
    fetch("/api/api-keys")
      .then((r) => r.json())
      .then((d) => setKeys(Array.isArray(d) ? d : []));
  }, [session]);

  useEffect(() => {
    if (!apiId) {
      setDetail(null);
      return;
    }
    fetch(`/api/apis/${apiId}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [apiId]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <Link href="/auth/signin" className="text-[#4F7FFF]">
          Sign in
        </Link>
      </div>
    );
  }

  const latest = detail?.versions?.[0];

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link href="/dashboard" className="text-[#4F7FFF] text-sm">
          ← Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mt-4 mb-8">API Playground</h1>

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div>
            <label className="block text-sm text-gray-400 mb-1">API</label>
            <select
              className="w-full px-4 py-3 rounded-lg bg-[#151B2B] border border-[rgba(255,255,255,0.05)] text-white"
              value={apiId}
              onChange={(e) => setApiId(e.target.value)}
            >
              <option value="">Select an API</option>
              {apis.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">API key</label>
            <input
              type="password"
              placeholder="Paste your adw_… key"
              className="w-full px-4 py-3 rounded-lg bg-[#151B2B] border border-[rgba(255,255,255,0.05)] text-white"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            {keys.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                You have {keys.length} key(s). Secrets are only shown once at creation.
              </p>
            )}
          </div>
        </div>

        {latest && detail ? (
          <APIPlayground
            apiKey={apiKey || undefined}
            apiSlug={detail.slug}
            version={latest.version}
            endpoints={(latest.endpoints || []).map((ep: any) => ({
              method: ep.method,
              path: ep.path,
              description: ep.description,
            }))}
          />
        ) : (
          <p className="text-gray-400">Select an API to start testing.</p>
        )}
      </div>
    </div>
  );
}
