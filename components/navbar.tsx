"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";

export function Navbar() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `text-sm font-medium transition-colors ${
      pathname === href || pathname?.startsWith(href + "/")
        ? "text-ink"
        : "text-ink-muted hover:text-ink"
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-[rgba(11,18,32,0.08)] bg-[rgba(243,245,247,0.9)] backdrop-blur-md">
      <div className="mx-auto flex h-[4.25rem] max-w-container items-center justify-between px-5">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 font-display text-lg font-bold tracking-tight sm:gap-2.5 sm:text-xl"
          aria-label="APIDoorway home"
          onClick={() => setMobileMenuOpen(false)}
        >
          <Image
            src="/favicon.png"
            alt=""
            width={36}
            height={36}
            className="h-8 w-8 shrink-0 rounded-[0.55rem] sm:h-9 sm:w-9"
            priority
          />
          <span className="truncate leading-none tracking-tight">
            <span className="text-primary">API</span>
            <span className="text-ink">Doorway</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link href="/marketplace" className={linkClass("/marketplace")}>
            Marketplace
          </Link>
          <Link href="/marketplace/compare" className={linkClass("/marketplace/compare")}>
            Compare
          </Link>
          {session && (
            <>
              <Link href="/dashboard" className={linkClass("/dashboard")}>
                Dashboard
              </Link>
              <Link href="/api-publisher/new" className={linkClass("/api-publisher")}>
                Publish
              </Link>
              {(session.user as any)?.role === "admin" && (
                <Link href="/admin" className={linkClass("/admin")}>
                  Admin
                </Link>
              )}
            </>
          )}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {session ? (
            <>
              <Link href="/dashboard" className="btn btn-secondary">
                My portal
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="btn btn-ghost"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="btn btn-ghost">
                Sign in
              </Link>
              <Link href="/auth/signup" className="btn btn-primary">
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          className="p-2 text-ink-muted md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-[rgba(11,18,32,0.08)] bg-canvas px-5 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <Link href="/marketplace" onClick={() => setMobileMenuOpen(false)} className="py-2 text-ink">
              Marketplace
            </Link>
            <Link
              href="/marketplace/compare"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 text-ink"
            >
              Compare
            </Link>
            {session && (
              <>
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="py-2 text-ink">
                  Dashboard
                </Link>
                <Link
                  href="/api-publisher/new"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2 text-ink"
                >
                  Publish
                </Link>
                {(session.user as any)?.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2 text-ink"
                  >
                    Admin
                  </Link>
                )}
              </>
            )}
            {session ? (
              <button
                onClick={() => {
                  signOut({ callbackUrl: "/" });
                  setMobileMenuOpen(false);
                }}
                className="btn btn-secondary mt-2 w-full"
              >
                Sign out
              </button>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <Link href="/auth/signin" className="btn btn-secondary w-full" onClick={() => setMobileMenuOpen(false)}>
                  Sign in
                </Link>
                <Link href="/auth/signup" className="btn btn-primary w-full" onClick={() => setMobileMenuOpen(false)}>
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
