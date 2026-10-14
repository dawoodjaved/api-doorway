import Link from "next/link";
import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="border-t border-[rgba(11,18,32,0.08)] bg-surface">
      <div className="mx-auto flex max-w-container flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight"
            aria-label="APIDoorway home"
          >
            <Image
              src="/favicon.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-[0.5rem] border border-[rgba(11,18,32,0.08)] bg-surface"
            />
            <span>
              <span className="text-primary">API</span>
              <span className="text-ink">Doorway</span>
            </span>
          </Link>
          <p className="mt-1 text-sm text-ink-muted">
            Publish, discover, and use APIs with keys, docs, and usage in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-ink-muted">
          <Link href="/marketplace" className="hover:text-ink">
            Marketplace
          </Link>
          <Link href="/dashboard" className="hover:text-ink">
            Dashboard
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
