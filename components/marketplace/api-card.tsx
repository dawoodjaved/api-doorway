"use client";

import Link from "next/link";
import { Star, Shield, FileJson, Lock, Zap } from "lucide-react";
import { useState } from "react";

interface APICardProps {
  api: {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    rating: number;
    reviewCount: number;
    logo?: string | null;
    authType?: string | null;
    https?: boolean | null;
    cors?: string | null;
    hasOpenApi?: boolean;
    tryReady?: boolean;
    endpointCount?: number;
    arenaScore?: number;
    docsUrl?: string | null;
    subscriberCount?: number;
  };
}

function scoreTone(score: number) {
  if (score >= 75) return "text-accent";
  if (score >= 50) return "text-ink-soft";
  return "text-ink-faint";
}

export function APICard({ api }: APICardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const rating = Number.isFinite(api.rating) ? api.rating : 0;
  const reviews = api.reviewCount || 0;
  const showLogo = Boolean(api.logo) && !imgFailed;
  const score = Number.isFinite(api.arenaScore) ? Number(api.arenaScore) : 0;
  const auth = api.authType || "unknown";
  const endpoints = api.endpointCount || 0;
  const tryReady = Boolean(api.tryReady) && endpoints >= 2;

  return (
    <Link
      href={`/marketplace/api/${api.slug}`}
      className="group block border-b border-[rgba(11,18,32,0.08)] py-6 transition-colors hover:bg-accent-soft/40 sm:px-3"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {showLogo ? (
          <img
            src={api.logo!}
            alt={`${api.name} logo`}
            width={44}
            height={44}
            loading="lazy"
            decoding="async"
            className="h-10 w-10 shrink-0 rounded-md object-cover bg-accent-soft sm:h-11 sm:w-11"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-soft font-display text-lg font-bold text-accent sm:h-11 sm:w-11">
            {api.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-display text-base font-semibold text-ink group-hover:text-accent sm:text-lg">
                {api.name}
              </h3>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
                {api.category}
                {endpoints > 0 ? ` · ${endpoints} endpoints` : ""}
              </p>
            </div>
            <div className={`shrink-0 text-right ${scoreTone(score)}`}>
              <p className="font-display text-lg font-bold leading-none">{score}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-faint">
                Score
              </p>
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-ink-muted">
            {api.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-ink-soft">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              {rating.toFixed(1)}
              <span className="text-ink-faint">({reviews})</span>
            </span>
            {tryReady ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent-soft px-1.5 py-0.5 font-medium text-accent">
                <Zap className="h-3 w-3" />
                Try-ready
              </span>
            ) : api.hasOpenApi ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(11,18,32,0.08)] bg-surface px-1.5 py-0.5 text-ink-muted">
                <FileJson className="h-3 w-3" />
                OpenAPI link
              </span>
            ) : null}
            {api.https && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(11,18,32,0.08)] bg-surface px-1.5 py-0.5 text-ink-muted">
                <Shield className="h-3 w-3" />
                HTTPS
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(11,18,32,0.08)] bg-surface px-1.5 py-0.5 text-ink-muted">
              <Lock className="h-3 w-3" />
              {auth === "none" ? "No auth" : auth}
            </span>
            {typeof api.subscriberCount === "number" && api.subscriberCount > 0 && (
              <span className="text-ink-faint">{api.subscriberCount} subscribers</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
