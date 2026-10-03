"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ApiComparison } from "@/components/marketplace/api-comparison";

export default function CompareClient() {
  const searchParams = useSearchParams();
  const [apis, setApis] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [compared, setCompared] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const initialIds = useMemo(
    () => (searchParams.get("ids") || "").split(",").filter(Boolean),
    [searchParams]
  );

  useEffect(() => {
    fetch("/api/apis?limit=100&sort=score")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setApis(list);
        if (initialIds.length) {
          setSelected(initialIds.slice(0, 3));
        }
      })
      .finally(() => setLoading(false));
  }, [initialIds]);

  useEffect(() => {
    if (selected.length < 2) {
      setCompared([]);
      return;
    }
    fetch(`/api/apis/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiIds: selected }),
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.comparison)
          ? data.comparison.map((a: any) => ({
              ...a,
              rating: a.avgRating,
              isFeatured: a.isFeatured,
            }))
          : apis.filter((a) => selected.includes(a.id));
        setCompared(list);
      })
      .catch(() => {
        setCompared(apis.filter((a) => selected.includes(a.id)));
      });
  }, [selected, apis]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <Link href="/marketplace" className="text-sm text-accent">
          ← Marketplace
        </Link>
        <h1 className="mt-4 mb-2 font-display text-4xl font-bold text-ink">
          Compare APIs
        </h1>
        <p className="mb-8 text-ink-muted">
          Select 2–3 APIs to compare side by side.
        </p>

        {loading ? (
          <p className="text-ink-muted">Loading…</p>
        ) : (
          <>
            <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {apis.map((api) => (
                <label
                  key={api.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                    selected.includes(api.id)
                      ? "border-accent bg-accent-soft"
                      : "border-[rgba(11,18,32,0.08)] bg-surface"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(api.id)}
                    onChange={() => toggle(api.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium text-ink">{api.name}</span>
                    <span className="text-sm text-ink-muted">{api.category}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface p-6 shadow-soft">
              <ApiComparison
                apis={
                  compared.length
                    ? compared
                    : apis.filter((a) => selected.includes(a.id))
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
