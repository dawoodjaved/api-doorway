import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const emptyUsage = {
  totalRequests: 0,
  successRequests: 0,
  errorRequests: 0,
  successRate: 0,
  errorRate: 0,
  avgLatency: 0,
  daily: [] as Array<{ date: string; requests: number; errors: number }>,
  endpoints: [] as Array<{
    endpoint: string;
    requests: number;
    avgLatency: number;
  }>,
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKeys = await prisma.aPIKey.findMany({
      where: { userId: session.user.id },
      select: { id: true },
      take: 200,
    });
    const keyIds = apiKeys.map((k) => k.id);

    if (keyIds.length === 0) {
      // Still return a 30-day zero series so charts stay stable
      const daily = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        return { date: d.toISOString().slice(5, 10), requests: 0, errors: 0 };
      });
      return NextResponse.json({ ...emptyUsage, daily });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const keyList = Prisma.join(keyIds.map((id) => Prisma.sql`${id}`));

    const [totals, dailyRows, endpointRows] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          total: number;
          success: number;
          avg_latency: number;
        }>
      >`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "statusCode" < 400)::int AS success,
          COALESCE(AVG(latency), 0)::float AS avg_latency
        FROM "RequestLog"
        WHERE "apiKeyId" IN (${keyList})
          AND timestamp >= ${thirtyDaysAgo}
      `,
      prisma.$queryRaw<
        Array<{ day: string; requests: number; errors: number }>
      >`
        SELECT
          to_char(date_trunc('day', timestamp AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS requests,
          COUNT(*) FILTER (WHERE "statusCode" >= 400)::int AS errors
        FROM "RequestLog"
        WHERE "apiKeyId" IN (${keyList})
          AND timestamp >= ${thirtyDaysAgo}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<
        Array<{ endpoint: string; requests: number; avgLatency: number }>
      >`
        SELECT
          (COALESCE(e.method, r.method) || ' ' || COALESCE(e.path, r.path)) AS endpoint,
          COUNT(*)::int AS requests,
          ROUND(AVG(r.latency))::int AS "avgLatency"
        FROM "RequestLog" r
        LEFT JOIN "Endpoint" e ON e.id = r."endpointId"
        WHERE r."apiKeyId" IN (${keyList})
          AND r.timestamp >= ${thirtyDaysAgo}
        GROUP BY 1
        ORDER BY requests DESC
        LIMIT 10
      `,
    ]);

    const totalRequests = Number(totals[0]?.total || 0);
    const successRequests = Number(totals[0]?.success || 0);
    const errorRequests = totalRequests - successRequests;
    const successRate =
      totalRequests > 0 ? (successRequests / totalRequests) * 100 : 0;
    const errorRate =
      totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
    const avgLatency = Math.round(Number(totals[0]?.avg_latency || 0));

    const dailyMap = new Map(
      dailyRows.map((r) => [
        r.day,
        { requests: Number(r.requests), errors: Number(r.errors) },
      ])
    );
    const daily = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().slice(0, 10);
      const entry = dailyMap.get(key) || { requests: 0, errors: 0 };
      return { date: key.slice(5), requests: entry.requests, errors: entry.errors };
    });

    const endpoints = endpointRows.map((r) => ({
      endpoint: r.endpoint,
      requests: Number(r.requests),
      avgLatency: Number(r.avgLatency),
    }));

    return NextResponse.json({
      totalRequests,
      successRequests,
      errorRequests,
      successRate: Number(successRate.toFixed(2)),
      errorRate: Number(errorRate.toFixed(2)),
      avgLatency,
      daily,
      endpoints,
    });
  } catch (error) {
    console.error("Error fetching usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage" },
      { status: 500 }
    );
  }
}
