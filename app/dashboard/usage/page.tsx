"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import Link from "next/link";

const UsageCharts = dynamic(
  () =>
    import("@/components/dashboard/usage-charts").then((m) => m.UsageCharts),
  {
    ssr: false,
    loading: () => (
      <p className="py-16 text-center text-gray-400">Loading charts…</p>
    ),
  }
);

export default function UsagePage() {
  const { data: session } = useSession();
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => setUsage(null))
      .finally(() => setLoading(false));
  }, []);

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

  const daily = usage?.daily || [];
  const endpoints = usage?.endpoints || [];

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-white mb-8">Usage Analytics</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Requests", value: usage?.totalRequests ?? 0 },
            { label: "Success Rate", value: `${usage?.successRate ?? 0}%` },
            { label: "Avg Latency", value: `${usage?.avgLatency ?? 0}ms` },
            { label: "Errors", value: usage?.errorRequests ?? 0 },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl p-5 bg-[#151B2B] border border-[rgba(255,255,255,0.05)]"
            >
              <p className="text-xs text-gray-400 uppercase mb-2">{card.label}</p>
              <p className="text-3xl font-bold text-white">{card.value}</p>
            </div>
          ))}
        </div>

        {daily.length === 0 || daily.every((d: any) => d.requests === 0) ? (
          <div className="rounded-2xl p-10 text-center bg-[#151B2B] border border-[rgba(255,255,255,0.05)] text-gray-400 mb-8">
            No request logs yet. Use the{" "}
            <Link href="/dashboard/playground" className="text-[#4F7FFF]">
              playground
            </Link>{" "}
            with an API key to generate usage data.
          </div>
        ) : (
          <UsageCharts daily={daily} endpoints={endpoints} />
        )}
      </div>
    </div>
  );
}
