import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCatalogStats } from "@/lib/catalog-stats";

export default async function Home() {
  // Query DB directly — avoid self-HTTP via stale NEXTAUTH_URL (e.g. old Vercel host).
  const stats = await getCatalogStats().catch(() => null);

  return (
    <div className="page-shell">
      {/* Hero — one composition: brand, headline, line, CTAs, product visual */}
      <section className="relative overflow-hidden border-b border-[rgba(11,18,32,0.08)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(13,115,119,0.12),_transparent_55%)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-4.25rem)] max-w-container items-end gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-20 lg:pt-10">
          <div className="animate-fade-up">
            <p className="font-display text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              <span className="text-primary">API</span>
              <span className="text-ink">Doorway</span>
            </p>
            <h1 className="mt-5 max-w-xl font-display text-3xl font-semibold leading-tight tracking-tight text-ink-soft sm:text-4xl">
              Publish, discover, and ship APIs without the platform sprawl.
            </h1>
            <p className="mt-4 max-w-md text-base text-ink-muted sm:text-lg">
              Enriched marketplace with APIDoorway Score, OpenAPI docs, keys, playground, and real usage — one loop for providers and developers.
            </p>
            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap">
              <Link href="/marketplace" className="btn btn-primary w-full sm:w-auto">
                Browse marketplace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/auth/signup" className="btn btn-secondary w-full sm:w-auto">
                Get started free
              </Link>
            </div>
            {stats?.total != null && (
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3 border-t border-[rgba(11,18,32,0.08)] pt-6 sm:gap-4">
                <div className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wide text-ink-faint sm:text-xs">APIs</dt>
                  <dd className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">{stats.total}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wide text-ink-faint sm:text-xs">Try-ready</dt>
                  <dd className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">{stats.tryReadyPct}%</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wide text-ink-faint sm:text-xs">Avg score</dt>
                  <dd className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">{stats.avgArenaScore}</dd>
                </div>
              </dl>
            )}
          </div>

          <div
            className="animate-fade-up relative min-h-[280px] overflow-hidden rounded-[1.25rem] border border-[rgba(11,18,32,0.1)] bg-ink shadow-lift sm:min-h-[360px]"
            style={{ animationDelay: "120ms" }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(145deg,#0B1220_0%,#12333A_55%,#0D7377_120%)]" />
            <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:28px_28px]" />
            <div className="on-dark relative flex h-full flex-col justify-between p-6 sm:p-8">
              <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                <span className="h-2 w-2 rounded-sm bg-accent" />
                gateway · live
              </div>
              <pre
                className="overflow-hidden font-mono text-[11px] leading-relaxed sm:text-xs"
                style={{ color: "rgba(255,255,255,0.82)" }}
              >
{`GET /api/gateway/demo-weather/1.0.0/get
X-API-Key: adw_••••••••

← 200 OK  ·  84ms
{
  "args": {},
  "url": "https://httpbin.org/get"
}`}
              </pre>
              <svg
                className="mt-6 h-16 w-full text-accent"
                viewBox="0 0 320 64"
                fill="none"
                aria-hidden
              >
                <path
                  d="M0 48 C40 48, 40 20, 80 20 S120 52, 160 40 S200 8, 240 18 S280 44, 320 28"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="240"
                  className="animate-draw-line"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — one job */}
      <section className="section border-b border-[rgba(11,18,32,0.08)]">
        <div className="mx-auto max-w-container px-5">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            One loop. Three roles.
          </h2>
          <p className="mt-3 max-w-lg text-ink-muted">
            From OpenAPI to live traffic without bolting on five different tools.
          </p>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Providers publish",
                body: "Import OpenAPI or YAML, version it, and set an upstream base URL.",
              },
              {
                step: "02",
                title: "Developers integrate",
                body: "Discover APIs, create scoped keys, try requests, export Postman.",
              },
              {
                step: "03",
                title: "Everyone measures",
                body: "Gateway logs feed real usage charts—no mock dashboards.",
              },
            ].map((item) => (
              <li key={item.step} className="animate-fade-up">
                <p className="font-mono text-sm text-accent">{item.step}</p>
                <h3 className="mt-3 font-display text-xl font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Product surfaces — one job */}
      <section className="section border-b border-[rgba(11,18,32,0.08)] bg-surface">
        <div className="mx-auto max-w-container px-5">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Built for the work you actually do
          </h2>
          <p className="mt-3 max-w-lg text-ink-muted">
            Docs, keys, billing, and support—kept simple on purpose.
          </p>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[rgba(11,18,32,0.08)] bg-[rgba(11,18,32,0.08)] sm:grid-cols-2">
            {[
              {
                title: "Interactive docs",
                body: "Swagger UI from your OpenAPI spec, plus code samples and Postman export.",
                href: "/marketplace",
              },
              {
                title: "Developer portal",
                body: "Keys by environment, playground, usage from RequestLog, Free/Pro billing.",
                href: "/dashboard",
              },
              {
                title: "Gateway",
                body: "API-key auth, Redis rate limits, upstream proxy—Kong optional.",
                href: "/marketplace",
              },
              {
                title: "Admin approval",
                body: "Approve listings and feature the ones that should lead the catalog.",
                href: "/admin",
              },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group bg-surface p-8 transition-colors hover:bg-accent-soft"
              >
                <h3 className="font-display text-xl font-semibold text-ink group-hover:text-accent">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-ink-muted">{item.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA — one job */}
      <section className="section">
        <div className="mx-auto max-w-container px-5 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Start with the marketplace
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ink-muted">
            Explore seeded demos or publish your own OpenAPI in minutes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/auth/signup" className="btn btn-primary">
              Create account
            </Link>
            <Link href="/marketplace" className="btn btn-secondary">
              View APIs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
