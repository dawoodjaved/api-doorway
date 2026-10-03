"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Star, Code, BookOpen, Copy, Check } from "lucide-react";
import Link from "next/link";
import { CodeExamplesTabs } from "@/components/marketplace/code-examples-tabs";
import { ReviewForm } from "@/components/marketplace/review-form";

const SwaggerDocs = dynamic(
  () =>
    import("@/components/marketplace/swagger-docs").then((m) => m.SwaggerDocs),
  {
    ssr: false,
    loading: () => (
      <p className="py-8 text-center text-ink-muted">Loading documentation…</p>
    ),
  }
);

const APIPlayground = dynamic(
  () =>
    import("@/components/playground/APIPlayground").then((m) => m.APIPlayground),
  {
    ssr: false,
    loading: () => (
      <p className="py-8 text-center text-ink-muted">Loading playground…</p>
    ),
  }
);

export default function APIDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [api, setApi] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPlayground, setShowPlayground] = useState(false);
  const [showDocumentation, setShowDocumentation] = useState(true);
  const [userKey, setUserKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState<string | null>(null);
  const [quickstarting, setQuickstarting] = useState(false);

  const fetchAPI = async () => {
    try {
      const slug = String(params.slug || "");
      if (!slug) return;
      const detailRes = await fetch(
        `/api/apis/${encodeURIComponent(slug)}?hydrate=1`
      );
      if (detailRes.ok) {
        setApi(await detailRes.json());
      }
    } catch (error) {
      console.error("Error fetching API:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.slug) fetchAPI();
  }, [params.slug]);

  useEffect(() => {
    if (!session || !api?.id) return;
    fetch("/api/subscriptions")
      .then((r) => r.json())
      .then((subs) => {
        if (!Array.isArray(subs)) return;
        setSubscribed(
          subs.some(
            (s: any) => s.apiId === api.id && s.status === "active"
          )
        );
      })
      .catch(() => {});
  }, [session, api?.id]);

  const handleSubscribe = async () => {
    if (!session) {
      router.push(
        `/auth/signin?callbackUrl=${encodeURIComponent(
          `/marketplace/api/${params.slug}`
        )}`
      );
      return;
    }
    if (!api?.id || subscribed || subscribing) return;
    setSubscribing(true);
    setSubscribeMsg(null);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiId: api.id, plan: "free" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubscribeMsg(data.error || "Subscribe failed");
        return;
      }
      setSubscribed(true);
      setSubscribeMsg("Subscribed on the Free plan. Create an API key to call the gateway.");
    } catch {
      setSubscribeMsg("Subscribe failed");
    } finally {
      setSubscribing(false);
    }
  };

  const handleQuickstart = async () => {
    if (!session) {
      router.push(
        `/auth/signin?callbackUrl=${encodeURIComponent(
          `/marketplace/api/${params.slug}`
        )}`
      );
      return;
    }
    if (!api?.id || quickstarting) return;
    setQuickstarting(true);
    setSubscribeMsg(null);
    try {
      const res = await fetch(`/api/apis/${api.id}/quickstart`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setSubscribeMsg(data.error || "Quickstart failed");
        return;
      }
      setSubscribed(true);
      if (data.apiKey) {
        setUserKey(data.apiKey);
        setSubscribeMsg(
          "Ready: subscribed + key created. Key is filled below — copy it now."
        );
      } else {
        setSubscribeMsg(data.message || "Subscribed. Use your existing API key in the playground.");
      }
      setShowPlayground(true);
      await fetchAPI();
    } catch {
      setSubscribeMsg("Quickstart failed");
    } finally {
      setQuickstarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink-muted">
        Loading…
      </div>
    );
  }

  if (!api) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">API Not Found</h1>
        <Link href="/marketplace" className="text-accent">
          Back to Marketplace
        </Link>
      </div>
    );
  }

  const latestVersion = api.versions?.[0];
  const gatewayBase = `/api/gateway/${api.slug}/${latestVersion?.version || "1.0.0"}`;

  const copyBase = () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${gatewayBase}`
        : gatewayBase;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {latestVersion?.isDeprecated && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <strong>Deprecated:</strong> version v{latestVersion.version}
            {latestVersion.deprecationDate && (
              <>
                {" "}
                — sunset{" "}
                {new Date(latestVersion.deprecationDate).toLocaleDateString()}
              </>
            )}
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface p-6 shadow-soft sm:p-8">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-4">
              {api.logo ? (
                <img
                  src={api.logo}
                  alt={`${api.name} logo`}
                  className="h-16 w-16 rounded-lg object-cover bg-accent-soft"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-accent-soft font-display text-2xl font-bold text-accent">
                  {api.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="mb-2 font-display text-3xl font-bold text-ink">
                  {api.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent">
                    {api.category}
                  </span>
                  {api.tryReady && (
                    <span className="rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
                      Try-ready · {api.endpointCount || 0} endpoints
                    </span>
                  )}
                  <span className="rounded-full border border-[rgba(11,18,32,0.08)] px-3 py-1 text-sm text-ink-muted">
                    Score {api.arenaScore ?? 0}
                  </span>
                  {api.user?.name && (
                    <span className="text-sm text-ink-muted">by {api.user.name}</span>
                  )}
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-emerald-500 text-emerald-500" />
                    <span className="font-semibold text-ink">
                      {api.rating?.toFixed(1) || "0.0"}
                    </span>
                    <span className="text-ink-muted">({api.reviewCount || 0})</span>
                  </div>
                  {typeof api.usageCalls === "number" && (
                    <span className="text-sm text-ink-faint">
                      {api.usageCalls} gateway calls
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="mb-4 text-ink-soft">{api.description}</p>

          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
            <code className="rounded-lg bg-canvas px-3 py-1.5 font-mono text-ink-soft">
              {gatewayBase}
            </code>
            <button
              type="button"
              onClick={copyBase}
              className="inline-flex items-center gap-1 rounded-lg border border-[rgba(11,18,32,0.08)] px-3 py-1.5 text-ink-muted hover:text-ink"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copy base URL
            </button>
          </div>

          {subscribeMsg && (
            <p className="mb-4 text-sm text-accent">{subscribeMsg}</p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleQuickstart}
              disabled={quickstarting}
              className="btn btn-primary disabled:cursor-default disabled:opacity-70"
            >
              {quickstarting
                ? "Setting up…"
                : "Subscribe + key + try"}
            </button>
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={subscribed || subscribing}
              className="btn btn-secondary disabled:cursor-default disabled:opacity-70"
            >
              {subscribed
                ? "Subscribed"
                : subscribing
                  ? "Subscribing…"
                  : "Subscribe only"}
            </button>
            <button
              type="button"
              onClick={() => setShowPlayground(!showPlayground)}
              className="btn btn-secondary"
            >
              <Code className="h-5 w-5" /> Playground
            </button>
            <button
              type="button"
              onClick={() => setShowDocumentation(!showDocumentation)}
              className="btn btn-secondary"
            >
              <BookOpen className="h-5 w-5" /> Documentation
            </button>
            <Link
              href={`/marketplace/compare?ids=${api.id}`}
              className="btn btn-secondary"
            >
              Compare
            </Link>
            <Link href="/dashboard/billing" className="btn btn-ghost text-sm">
              Platform billing
            </Link>
          </div>
        </div>

        {showPlayground && latestVersion && (
          <div className="mb-6 rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface p-6 shadow-soft sm:p-8">
            <h2 className="mb-4 font-display text-2xl font-semibold text-ink">
              Try It Out
            </h2>
            {!session ? (
              <p className="mb-4 text-ink-muted">
                <Link href="/auth/signin" className="text-accent">
                  Sign in
                </Link>{" "}
                and create an API key to call the gateway.
              </p>
            ) : (
              <div className="mb-4">
                <label className="mb-1 block text-sm text-ink-muted">
                  API key (paste the secret shown when you created it)
                </label>
                <input
                  type="password"
                  value={userKey}
                  onChange={(e) => setUserKey(e.target.value)}
                  placeholder="adw_…"
                  className="w-full max-w-md rounded-lg border border-[rgba(11,18,32,0.08)] bg-canvas px-4 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <Link
                  href="/dashboard/api-keys"
                  className="mt-2 block text-sm text-accent"
                >
                  Manage API keys
                </Link>
              </div>
            )}
            <APIPlayground
              apiKey={userKey || undefined}
              apiSlug={api.slug}
              version={latestVersion.version}
              endpoints={(latestVersion.endpoints || []).map((ep: any) => ({
                method: ep.method,
                path: ep.path,
                description: ep.description,
              }))}
            />
          </div>
        )}

        {showDocumentation && latestVersion && (
          <div className="mb-6 rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface p-6 shadow-soft sm:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Documentation
              </h2>
              <a
                href={`/api/apis/${api.id}/postman-collection?version=${latestVersion.version}`}
                className="btn btn-primary text-sm"
              >
                Download Postman
              </a>
            </div>
            <SwaggerDocs spec={latestVersion.openApiSpec} />
            <div className="mt-8">
              <h3 className="mb-3 text-lg font-semibold text-ink">Code examples</h3>
              <CodeExamplesTabs apiId={api.id} version={latestVersion.version} />
            </div>
          </div>
        )}

        {api.versions?.length > 0 && (
          <div className="mb-6 rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface p-6 shadow-soft sm:p-8">
            <h2 className="mb-4 font-display text-2xl font-semibold text-ink">
              Versions
            </h2>
            <div className="space-y-4">
              {api.versions.map((version: any) => (
                <div
                  key={version.id}
                  className="rounded-lg border border-[rgba(11,18,32,0.08)] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-ink">
                        v{version.version}
                      </h3>
                      {version.isDeprecated && (
                        <span className="text-sm text-amber-700">
                          Deprecated
                          {version.deprecationDate &&
                            ` · sunset ${new Date(
                              version.deprecationDate
                            ).toLocaleDateString()}`}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-ink-muted">
                      {new Date(version.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {version.changelog && (
                    <p className="mt-2 text-ink-muted">{version.changelog}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[rgba(11,18,32,0.08)] bg-surface p-6 shadow-soft sm:p-8">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Reviews
            </h2>
            <p className="text-sm text-ink-faint">
              {api.subscriberCount || 0} subscribers · {api.usageCalls || 0} gateway
              calls
            </p>
          </div>
          <ReviewForm apiId={api.id} onSubmitted={fetchAPI} />
          {api.reviews?.length > 0 ? (
            <div className="space-y-4">
              {api.reviews.map((review: any) => (
                <div
                  key={review.id}
                  className="rounded-lg border border-[rgba(11,18,32,0.08)] p-4"
                >
                  <div className="mb-2 flex items-center gap-3">
                    {review.user?.image ? (
                      <img
                        src={review.user.image}
                        alt={review.user?.name || "Reviewer"}
                        className="h-10 w-10 rounded-full object-cover bg-accent-soft"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">
                        {review.user?.name?.charAt(0) || "U"}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-ink">
                        {review.user?.name || "Anonymous"}
                      </p>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating
                                ? "fill-emerald-500 text-emerald-500"
                                : "text-ink-faint"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-ink-soft">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              No reviews yet. Subscribe and try the gateway, then leave the first
              review.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
