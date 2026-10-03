import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public metrics — cache briefly so home/marketplace stay snappy */
export const revalidate = 60;

/**
 * Marketplace catalog health stats (public product metrics only).
 */
export async function GET() {
  try {
    const [
      total,
      approved,
      withOpenApi,
      tryReady,
      hydrated,
      featured,
      avgScore,
    ] = await Promise.all([
      prisma.aPI.count({ where: { isPublic: true, isApproved: true } }),
      prisma.aPI.count({ where: { isApproved: true } }),
      prisma.aPI.count({
        where: { isPublic: true, isApproved: true, hasOpenApi: true },
      }),
      prisma.aPI.count({
        where: { isPublic: true, isApproved: true, tryReady: true },
      }),
      prisma.aPI.count({
        where: {
          isPublic: true,
          isApproved: true,
          endpointCount: { gte: 2 },
        },
      }),
      prisma.aPI.count({
        where: { isPublic: true, isApproved: true, isFeatured: true },
      }),
      prisma.aPI.aggregate({
        where: { isPublic: true, isApproved: true },
        _avg: { arenaScore: true },
        _max: { lastSyncedAt: true },
      }),
    ]);

    const openApiPct = total > 0 ? Math.round((withOpenApi / total) * 100) : 0;
    const tryReadyPct = total > 0 ? Math.round((tryReady / total) * 100) : 0;

    return NextResponse.json(
      {
        total,
        approved,
        withOpenApi,
        tryReady,
        hydrated,
        featured,
        openApiPct,
        tryReadyPct,
        avgArenaScore: Math.round(avgScore._avg.arenaScore || 0),
        lastSyncedAt: avgScore._max.lastSyncedAt,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("catalog stats error:", error);
    return NextResponse.json(
      {
        total: 0,
        withOpenApi: 0,
        tryReady: 0,
        openApiPct: 0,
        tryReadyPct: 0,
        avgArenaScore: 0,
      },
      { status: 200 }
    );
  }
}
