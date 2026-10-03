import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const compareSchema = z.object({
  apiIds: z.array(z.string()).min(2).max(3),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = compareSchema.parse(body);
    const apiIds = validated.apiIds;

    const [apis, ratingAgg, keys] = await Promise.all([
      prisma.aPI.findMany({
        where: {
          id: { in: apiIds },
          isPublic: true,
          isApproved: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          category: true,
          logo: true,
          arenaScore: true,
          tryReady: true,
          hasOpenApi: true,
          authType: true,
          https: true,
          endpointCount: true,
          isFeatured: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              name: true,
              image: true,
            },
          },
          versions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { version: true },
          },
          _count: {
            select: {
              subscriptions: true,
              reviews: true,
            },
          },
        },
      }),
      prisma.review.groupBy({
        by: ["apiId"],
        where: { apiId: { in: apiIds } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      prisma.aPIKey.findMany({
        where: { apiId: { in: apiIds } },
        select: { id: true, apiId: true },
      }),
    ]);

    if (apis.length !== apiIds.length) {
      return NextResponse.json(
        { error: "Some APIs not found" },
        { status: 404 }
      );
    }

    const keyIdsByApi = new Map<string, string[]>();
    for (const key of keys) {
      const list = keyIdsByApi.get(key.apiId) || [];
      list.push(key.id);
      keyIdsByApi.set(key.apiId, list);
    }

    const allKeyIds = keys.map((k) => k.id);
    const usageByApi = new Map<string, number>();
    if (allKeyIds.length > 0) {
      const usageRows = await prisma.requestLog.groupBy({
        by: ["apiKeyId"],
        where: { apiKeyId: { in: allKeyIds } },
        _count: { _all: true },
      });
      const countByKey = new Map(
        usageRows.map((r) => [r.apiKeyId, r._count._all])
      );
      for (const [apiId, keyIds] of keyIdsByApi) {
        usageByApi.set(
          apiId,
          keyIds.reduce((sum, id) => sum + (countByKey.get(id) || 0), 0)
        );
      }
    }

    const ratingByApi = new Map(
      ratingAgg.map((r) => [
        r.apiId,
        { avg: r._avg.rating || 0, count: r._count.rating },
      ])
    );

    // Preserve request order
    const byId = new Map(apis.map((a) => [a.id, a]));
    const comparison = apiIds.map((id) => {
      const api = byId.get(id)!;
      const ratingInfo = ratingByApi.get(api.id);
      const avgRating = ratingInfo?.avg || 0;
      return {
        id: api.id,
        name: api.name,
        slug: api.slug,
        description: api.description,
        category: api.category,
        logo: api.logo,
        provider: api.user,
        rating: avgRating,
        avgRating,
        reviewCount: ratingInfo?.count ?? api._count.reviews,
        subscriptionCount: api._count.subscriptions,
        subscriberCount: api._count.subscriptions,
        endpointCount: api.endpointCount || 0,
        arenaScore: api.arenaScore,
        tryReady: api.tryReady,
        hasOpenApi: api.hasOpenApi,
        authType: api.authType,
        https: api.https,
        usageCalls: usageByApi.get(api.id) || 0,
        latestVersion: api.versions[0]?.version || "N/A",
        isFeatured: api.isFeatured,
        createdAt: api.createdAt,
        updatedAt: api.updatedAt,
      };
    });

    return NextResponse.json({
      comparison,
      comparedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error comparing APIs:", error);
    return NextResponse.json(
      { error: "Failed to compare APIs" },
      { status: 500 }
    );
  }
}
