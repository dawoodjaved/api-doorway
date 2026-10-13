import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureRedis, getRedis, getRedisMode } from "@/lib/redis";
import { isStripeConfigured } from "@/lib/stripe";
import { requireAdmin } from "@/lib/security/require-admin";

export const dynamic = "force-dynamic";

function oauthConfigured(id?: string, secret?: string) {
  if (!id?.trim() || !secret?.trim()) return false;
  const bad = (v: string) =>
    /placeholder|your_|xxx|changeme/i.test(v) || v.length < 8;
  return !bad(id) && !bad(secret);
}

async function isDetailedAllowed(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  const admin = await requireAdmin();
  return admin.ok;
}

export async function GET(request: NextRequest) {
  const checks: Record<string, string> = {
    database: "unknown",
    redis: "unknown",
  };

  const dbCheck = (async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "connected";
    } catch {
      checks.database = "disconnected";
    }
  })();

  const redisCheck = (async () => {
    try {
      await ensureRedis(true);
      const client = getRedis();
      await client.ping();
      checks.redis =
        getRedisMode() === "redis" ? "connected" : "memory-fallback";
    } catch {
      checks.redis = "unavailable";
    }
  })();

  await Promise.all([dbCheck, redisCheck]);

  const healthy = checks.database === "connected";

  // Public: status only — no counts / config (internal exposure)
  if (!(await isDetailedAllowed(request))) {
    return NextResponse.json(
      {
        status: healthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
      },
      { status: healthy ? 200 : 503 }
    );
  }

  let userCount = 0;
  let apiCount = 0;
  try {
    const [users, apis] = await Promise.all([
      prisma.user.count(),
      prisma.aPI.count(),
    ]);
    userCount = users;
    apiCount = apis;
  } catch {
    /* keep zeros */
  }

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      checks,
      counts: { users: userCount, apis: apiCount },
      config: {
        authUrl: process.env.NEXTAUTH_URL || null,
        stripeConfigured: isStripeConfigured(),
        oauthGoogle: oauthConfigured(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        ),
        oauthGithub: oauthConfigured(
          process.env.GITHUB_CLIENT_ID,
          process.env.GITHUB_CLIENT_SECRET
        ),
        kongEnabled: process.env.KONG_ENABLED === "true",
      },
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
