import { prisma } from "@/lib/prisma";

export type CatalogStats = {
  total: number;
  approved: number;
  withOpenApi: number;
  tryReady: number;
  hydrated: number;
  featured: number;
  openApiPct: number;
  tryReadyPct: number;
  avgArenaScore: number;
  lastSyncedAt: Date | null;
};

export async function getCatalogStats(): Promise<CatalogStats> {
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

  return {
    total,
    approved,
    withOpenApi,
    tryReady,
    hydrated,
    featured,
    openApiPct: total > 0 ? Math.round((withOpenApi / total) * 100) : 0,
    tryReadyPct: total > 0 ? Math.round((tryReady / total) * 100) : 0,
    avgArenaScore: Math.round(avgScore._avg.arenaScore || 0),
    lastSyncedAt: avgScore._max.lastSyncedAt,
  };
}

export function emptyCatalogStats(): CatalogStats {
  return {
    total: 0,
    approved: 0,
    withOpenApi: 0,
    tryReady: 0,
    hydrated: 0,
    featured: 0,
    openApiPct: 0,
    tryReadyPct: 0,
    avgArenaScore: 0,
    lastSyncedAt: null,
  };
}
