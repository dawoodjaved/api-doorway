"use client";

import { useEffect, useState } from "react";
import { APICard } from "@/components/marketplace/api-card";
import { Search } from "lucide-react";
import Link from "next/link";

const categories = [
  "All",
  "Data",
  "AI/ML",
  "Finance",
  "Social",
  "Communication",
  "Payment",
  "Analytics",
  "Storage",
  "Security",
  "Other",
];

export default function MarketplacePage() {
  const [apis, setApis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [featured, setFeatured] = useState<any[]>([]);
  const [openapiOnly, setOpenapiOnly] = useState(false);
  const [tryReadyOnly, setTryReadyOnly] = useState(true);
  const [httpsOnly, setHttpsOnly] = useState(false);
  const [authFilter, setAuthFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetch("/api/catalog/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));

    fetch("/api/apis?featured=true&sort=score&limit=8")
      .then((r) => r.json())
      .then((data) => setFeatured(Array.isArray(data) ? data.slice(0, 4) : []))
      .catch(() => setFeatured([]));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchAPIs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "48");
        params.set("sort", "score");
        if (selectedCategory !== "All") {
          params.append("category", selectedCategory);
        }
        if (debouncedSearch) params.append("search", debouncedSearch);
        if (openapiOnly) params.append("openapi", "true");
        if (tryReadyOnly) params.append("tryReady", "true");
        if (authFilter !== "all") params.append("auth", authFilter);
        if (minScore > 0) params.append("minScore", String(minScore));
        const res = await fetch(`/api/apis?${params}`);
        let data = await res.json();
        if (!Array.isArray(data)) data = [];
        // If try-ready filter yields nothing yet (pre-hydrate), fall back to scored list
        if (tryReadyOnly && data.length === 0 && !debouncedSearch) {
          params.delete("tryReady");
          const res2 = await fetch(`/api/apis?${params}`);
          data = await res2.json();
          if (!Array.isArray(data)) data = [];
        }
        if (httpsOnly) data = data.filter((a: any) => a.https !== false);
        if (!cancelled) setApis(data);
      } catch {
        if (!cancelled) setApis([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAPIs();
    return () => {
      cancelled = true;
    };
  }, [
    selectedCategory,
    debouncedSearch,
    openapiOnly,
    authFilter,
    minScore,
    httpsOnly,
    tryReadyOnly,
  ]);

  const lastSync = stats?.lastSyncedAt
    ? new Date(stats.lastSyncedAt).toLocaleDateString()
    : null;

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-container px-5 py-12 sm:py-16">
        <div className="flex flex-col gap-6 border-b border-[rgba(11,18,32,0.08)] pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Marketplace
            </h1>
            <p className="mt-3 max-w-xl text-ink-muted">
              Discover APIs ranked by APIDoorway Score — subscribe, create a key, and
              try them through the gateway.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <Link href="/marketplace/compare" className="btn btn-secondary">
              Compare APIs
            </Link>
            <a
              href="/api/catalog/export?limit=100&tryReady=true"
              className="text-xs text-ink-faint hover:text-accent"
            >
              Export catalog JSON
            </a>
          </div>
        </div>

        {stats && (
          <div className="mt-6 grid gap-3 rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Catalog</p>
              <p className="font-display text-2xl font-bold text-ink">{stats.total}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">OpenAPI linked</p>
              <p className="font-display text-2xl font-bold text-ink">{stats.openApiPct}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Try-ready</p>
              <p className="font-display text-2xl font-bold text-ink">{stats.tryReadyPct}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Avg APIDoorway Score</p>
              <p className="font-display text-2xl font-bold text-ink">{stats.avgArenaScore}</p>
              {lastSync && (
                <p className="mt-1 text-xs text-ink-faint">Synced {lastSync}</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              placeholder="Search by name or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[10px] border border-[rgba(11,18,32,0.08)] bg-surface py-3 pl-10 pr-4 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? "bg-accent !text-white border border-accent"
                  : "bg-surface text-ink-muted border border-[rgba(11,18,32,0.08)] hover:text-ink"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setTryReadyOnly((v) => !v)}
            className={`rounded-[8px] border px-3 py-1.5 font-medium ${
              tryReadyOnly
                ? "border-accent bg-accent-soft text-accent"
                : "border-[rgba(11,18,32,0.08)] bg-surface text-ink-muted"
            }`}
          >
            Try-ready
          </button>
          <button
            type="button"
            onClick={() => setOpenapiOnly((v) => !v)}
            className={`rounded-[8px] border px-3 py-1.5 font-medium ${
              openapiOnly
                ? "border-accent bg-accent-soft text-accent"
                : "border-[rgba(11,18,32,0.08)] bg-surface text-ink-muted"
            }`}
          >
            OpenAPI linked
          </button>
          <button
            type="button"
            onClick={() => setHttpsOnly((v) => !v)}
            className={`rounded-[8px] border px-3 py-1.5 font-medium ${
              httpsOnly
                ? "border-accent bg-accent-soft text-accent"
                : "border-[rgba(11,18,32,0.08)] bg-surface text-ink-muted"
            }`}
          >
            HTTPS
          </button>
          <select
            value={authFilter}
            onChange={(e) => setAuthFilter(e.target.value)}
            className="rounded-[8px] border border-[rgba(11,18,32,0.08)] bg-surface px-3 py-1.5 text-ink-muted outline-none"
          >
            <option value="all">Any auth</option>
            <option value="none">No auth</option>
            <option value="apiKey">API key</option>
            <option value="oauth">OAuth</option>
            <option value="http">HTTP / Bearer</option>
          </select>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="rounded-[8px] border border-[rgba(11,18,32,0.08)] bg-surface px-3 py-1.5 text-ink-muted outline-none"
          >
            <option value={0}>Any APIDoorway Score</option>
            <option value={50}>Score ≥ 50</option>
            <option value={70}>Score ≥ 70</option>
            <option value={85}>Score ≥ 85</option>
          </select>
        </div>

        {featured.length > 0 && selectedCategory === "All" && !search && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-semibold text-ink">Featured</h2>
            <p className="mt-1 text-sm text-ink-muted">
              High APIDoorway Score picks with strong developer readiness.
            </p>
            <div className="mt-2 divide-y divide-[rgba(11,18,32,0.08)] rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface px-2">
              {featured.map((api) => (
                <APICard key={api.id} api={api} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-12">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">
              {selectedCategory === "All" ? "All APIs" : selectedCategory}
            </h2>
            <p className="text-sm text-ink-faint">
              {loading ? "…" : `${apis.length} result${apis.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {loading ? (
            <p className="py-16 text-center text-ink-muted">Loading APIs…</p>
          ) : apis.length === 0 ? (
            <div className="rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface px-6 py-14 text-center">
              <p className="font-display text-lg font-semibold text-ink">No APIs yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
                Nothing matches these filters. Try clearing filters or{" "}
                <Link href="/api-publisher/new" className="text-accent hover:underline">
                  publish your own API
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(11,18,32,0.08)] rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface px-2">
              {apis.map((api) => (
                <APICard key={api.id} api={api} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
