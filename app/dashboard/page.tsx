"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Key,
  BarChart3,
  CreditCard,
  Play,
  HelpCircle,
  ArrowRight,
  Compass,
  CheckCircle2,
  Circle,
  Sparkles,
  Zap,
} from "lucide-react";

type ApiPreview = {
  id: string;
  name: string;
  slug: string;
  category: string;
  arenaScore?: number;
  tryReady?: boolean;
  endpointCount?: number;
  authType?: string | null;
  logo?: string | null;
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [usage, setUsage] = useState<{ totalRequests?: number; avgLatency?: number } | null>(null);
  const [picks, setPicks] = useState<ApiPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [keysRes, subsRes, usageRes, apisRes] = await Promise.all([
          fetch("/api/api-keys"),
          fetch("/api/subscriptions"),
          fetch("/api/usage"),
          fetch("/api/apis?tryReady=true&sort=score&limit=6"),
        ]);

        const keysData = await keysRes.json();
        const subsData = await subsRes.json();
        const usageData = usageRes.ok ? await usageRes.json() : null;
        let apisData = await apisRes.json();
        if (!Array.isArray(apisData) || apisData.length === 0) {
          const fallback = await fetch("/api/apis?sort=score&limit=6");
          apisData = await fallback.json();
        }

        if (cancelled) return;
        setKeys(Array.isArray(keysData) ? keysData : []);
        setSubs(Array.isArray(subsData) ? subsData : []);
        setUsage(usageData && !usageData.error ? usageData : null);
        setPicks(Array.isArray(apisData) ? apisData.slice(0, 4) : []);
      } catch {
        if (!cancelled) {
          setKeys([]);
          setSubs([]);
          setUsage(null);
          setPicks([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  const steps = useMemo(() => {
    const hasKeys = keys.length > 0;
    const hasTraffic = (usage?.totalRequests || 0) > 0;
    return [
      {
        id: "browse",
        title: "Browse the marketplace",
        done: true,
        href: "/marketplace",
        hint: "Find try-ready APIs by APIDoorway Score",
      },
      {
        id: "key",
        title: "Create an API key",
        done: hasKeys,
        href: "/dashboard/api-keys",
        hint: "Scoped key for playground + gateway",
      },
      {
        id: "try",
        title: "Send a test request",
        done: hasTraffic,
        href: "/dashboard/playground",
        hint: "Hit the gateway and see real logs",
      },
      {
        id: "usage",
        title: "Check usage",
        done: hasTraffic,
        href: "/dashboard/usage",
        hint: "Volume and latency from RequestLog",
      },
    ];
  }, [keys.length, usage?.totalRequests]);

  const nextStep = steps.find((s) => !s.done) || steps[steps.length - 1];
  const doneCount = steps.filter((s) => s.done).length;

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink-muted">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-5">
        <h1 className="font-display text-2xl font-bold text-ink">Sign in to continue</h1>
        <p className="max-w-sm text-center text-sm text-ink-muted">
          Your keys, playground, and usage live here. Discovery stays in the marketplace.
        </p>
        <Link href="/auth/signin" className="btn btn-primary">
          Sign in
        </Link>
      </div>
    );
  }

  const tools = [
    {
      title: "API Keys",
      description: "Create scoped keys per API and environment.",
      icon: Key,
      href: "/dashboard/api-keys",
      meta: loading ? "…" : `${keys.length} key${keys.length === 1 ? "" : "s"}`,
    },
    {
      title: "Usage",
      description: "Request volume and latency from real gateway logs.",
      icon: BarChart3,
      href: "/dashboard/usage",
      meta: loading
        ? "…"
        : `${usage?.totalRequests ?? 0} req · 30d`,
    },
    {
      title: "Playground",
      description: "Send authenticated requests through the gateway.",
      icon: Play,
      href: "/dashboard/playground",
      meta: "Try it",
    },
    {
      title: "Billing",
      description: "Free or Pro, invoices, and Stripe portal.",
      icon: CreditCard,
      href: "/dashboard/billing",
      meta: "Plans",
    },
    {
      title: "Support",
      description: "Open a ticket when something breaks.",
      icon: HelpCircle,
      href: "/dashboard/support",
      meta: "Help",
    },
    {
      title: "Marketplace",
      description: "Discover and compare try-ready APIs.",
      icon: Compass,
      href: "/marketplace",
      meta: "Browse",
    },
  ];

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-container px-5 py-12 sm:py-16">
        {/* Header */}
        <div className="flex flex-col gap-6 border-b border-[rgba(11,18,32,0.08)] pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-accent">
              Developer portal
            </p>
            <h1 className="mt-2 break-words font-display text-3xl font-bold tracking-tight text-ink sm:text-5xl">
              {session.user?.name || "Welcome back"}
            </h1>
            <p className="mt-3 text-ink-muted">{session.user?.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={nextStep.href} className="btn btn-primary">
              {nextStep.done ? "Open playground" : nextStep.title}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/marketplace" className="btn btn-secondary">
              Browse APIs
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "API keys",
              value: loading ? "…" : String(keys.length),
              sub: "Active credentials",
            },
            {
              label: "Requests (30d)",
              value: loading ? "…" : String(usage?.totalRequests ?? 0),
              sub:
                usage?.avgLatency != null
                  ? `Avg ${Math.round(usage.avgLatency)}ms`
                  : "From gateway logs",
            },
            {
              label: "Subscriptions",
              value: loading ? "…" : String(subs.length),
              sub: "Linked APIs",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface p-5"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                {stat.label}
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-ink">{stat.value}</p>
              <p className="mt-1 text-sm text-ink-muted">{stat.sub}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Getting started */}
          <section className="rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface p-6 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-accent">
                  <Sparkles className="h-4 w-4" />
                  <p className="text-sm font-medium uppercase tracking-wide">
                    Getting started
                  </p>
                </div>
                <h2 className="mt-2 font-display text-xl font-semibold text-ink">
                  {doneCount}/{steps.length} steps complete
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Catalog discovery lives in Marketplace. Here you integrate and measure.
                </p>
              </div>
            </div>

            <ol className="mt-6 space-y-3">
              {steps.map((step) => (
                <li key={step.id}>
                  <Link
                    href={step.href}
                    className="group flex items-start gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-[rgba(11,18,32,0.08)] hover:bg-accent-soft/40"
                  >
                    {step.done ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 shrink-0 text-ink-faint" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-medium ${
                          step.done ? "text-ink-muted line-through decoration-ink-faint" : "text-ink"
                        } group-hover:text-accent`}
                      >
                        {step.title}
                      </p>
                      <p className="text-sm text-ink-faint">{step.hint}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 text-ink-faint group-hover:text-accent" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Recommended APIs */}
          <section className="rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-accent">
                  <Zap className="h-4 w-4" />
                  <p className="text-sm font-medium uppercase tracking-wide">Try next</p>
                </div>
                <h2 className="mt-2 font-display text-xl font-semibold text-ink">
                  High APIDoorway Score picks
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Prefer try-ready APIs with real OpenAPI paths.
                </p>
              </div>
              <Link
                href="/marketplace"
                className="shrink-0 text-sm font-medium text-accent hover:underline"
              >
                See all
              </Link>
            </div>

            <div className="mt-5 divide-y divide-[rgba(11,18,32,0.08)]">
              {loading ? (
                <p className="py-8 text-center text-sm text-ink-muted">Loading picks…</p>
              ) : picks.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-ink-muted">No catalog APIs yet.</p>
                  <Link href="/marketplace" className="mt-2 inline-block text-sm text-accent hover:underline">
                    Open marketplace
                  </Link>
                </div>
              ) : (
                picks.map((api) => (
                  <Link
                    key={api.id}
                    href={`/marketplace/api/${api.slug}`}
                    className="group flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent-soft font-display text-sm font-bold text-accent">
                      {api.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={api.logo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        api.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink group-hover:text-accent">
                        {api.name}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {api.category}
                        {api.endpointCount ? ` · ${api.endpointCount} endpoints` : ""}
                        {api.tryReady ? " · try-ready" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg font-bold text-accent leading-none">
                        {api.arenaScore ?? 0}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-faint">
                        Score
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Tools */}
        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold text-ink">Your tools</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Everything for keys, traffic, billing, and support — not the public catalog browser.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface p-5 transition-colors hover:border-accent/30 hover:bg-accent-soft/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink-muted">
                      {item.meta}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-ink group-hover:text-accent">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">{item.description}</p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
