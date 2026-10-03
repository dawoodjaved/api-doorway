import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  hydrateApiOpenApi,
  isStubOnly,
} from "@/lib/services/openapi-hydrate";

const updateAPISchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  logo: z.string().optional(),
  baseUrl: z.string().url().optional().or(z.literal("")),
  isPublic: z.boolean().optional(),
});

/** Detail payload without pulling every version's full OpenAPI JSON */
const apiDetailSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  category: true,
  logo: true,
  baseUrl: true,
  authType: true,
  https: true,
  cors: true,
  docsUrl: true,
  openapiUrl: true,
  hasOpenApi: true,
  tags: true,
  arenaScore: true,
  endpointCount: true,
  tryReady: true,
  lastSyncedAt: true,
  isPublic: true,
  isApproved: true,
  isFeatured: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  source: true,
  sourceKey: true,
  user: {
    select: {
      id: true,
      name: true,
      image: true,
    },
  },
  versions: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      version: true,
      isDeprecated: true,
      deprecationDate: true,
      changelog: true,
      createdAt: true,
      endpoints: {
        select: {
          id: true,
          method: true,
          path: true,
          description: true,
        },
      },
    },
  },
  reviews: {
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      apiId: true,
      user: {
        select: {
          name: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
    take: 50,
  },
  _count: {
    select: {
      subscriptions: true,
      reviews: true,
    },
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: { apiId: string } }
) {
  try {
    const hydrateParam = request.nextUrl.searchParams.get("hydrate");
    // Accept either cuid id or marketplace slug (avoids a full catalog scan client-side)
    let api = await prisma.aPI.findFirst({
      where: {
        OR: [{ id: params.apiId }, { slug: params.apiId }],
      },
      select: apiDetailSelect,
    });

    if (!api) {
      return NextResponse.json({ error: "API not found" }, { status: 404 });
    }

    const latest = api.versions[0];
    const needsHydrate =
      Boolean(api.openapiUrl) &&
      (hydrateParam === "1" ||
        hydrateParam === "true" ||
        isStubOnly(latest?.endpoints || []) ||
        api.endpointCount < 2);

    if (needsHydrate && api.openapiUrl) {
      try {
        await hydrateApiOpenApi(api.id);
        api = await prisma.aPI.findUnique({
          where: { id: api.id },
          select: apiDetailSelect,
        });
      } catch (e) {
        console.warn("Lazy hydrate failed:", e);
      }
    }

    if (!api) {
      return NextResponse.json({ error: "API not found" }, { status: 404 });
    }

    const latestVersionId = api.versions[0]?.id;
    const keyIdsPromise = prisma.aPIKey.findMany({
      where: { apiId: api.id },
      select: { id: true },
    });

    const [ratingAgg, keyIds, latestSpec] = await Promise.all([
      prisma.review.aggregate({
        where: { apiId: api.id },
        _avg: { rating: true },
      }),
      keyIdsPromise,
      latestVersionId
        ? prisma.aPIVersion.findUnique({
            where: { id: latestVersionId },
            select: { openApiSpec: true },
          })
        : Promise.resolve(null),
    ]);

    const usageCalls =
      keyIds.length > 0
        ? await prisma.requestLog.count({
            where: { apiKeyId: { in: keyIds.map((k) => k.id) } },
          })
        : 0;

    const reviews = Array.isArray(api.reviews) ? api.reviews : [];
    const avgRating = ratingAgg._avg.rating || 0;

    // Keep source/sourceKey internal for sync — do not expose in the public payload
    const { source: _source, sourceKey: _sourceKey, ...publicApi } = api;

    const sanitizeChangelog = (text: string | null | undefined) => {
      if (!text) return text;
      if (/public-apis|apis\.guru|Synced from|Imported from/i.test(text)) {
        return "Listing updated";
      }
      return text;
    };

    return NextResponse.json({
      ...publicApi,
      tags: (api.tags || []).filter((t) => !t.startsWith("src:")),
      reviews,
      versions: (Array.isArray(api.versions) ? api.versions : []).map(
        (v, index) => ({
          ...v,
          // Only attach the heavy OpenAPI blob on the latest version (Swagger UI)
          openApiSpec: index === 0 ? latestSpec?.openApiSpec ?? null : null,
          changelog: sanitizeChangelog(v.changelog),
        })
      ),
      rating: avgRating,
      reviewCount: api._count.reviews,
      subscriberCount: api._count.subscriptions,
      usageCalls,
    });
  } catch (error) {
    console.error("Error fetching API:", error);
    return NextResponse.json(
      { error: "Failed to fetch API" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { apiId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const api = await prisma.aPI.findUnique({
      where: { id: params.apiId },
    });

    if (!api) {
      return NextResponse.json({ error: "API not found" }, { status: 404 });
    }

    if (api.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateAPISchema.parse(body);

    const updated = await prisma.aPI.update({
      where: { id: params.apiId },
      data: validated,
      include: {
        user: {
          select: {
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating API:", error);
    return NextResponse.json(
      { error: "Failed to update API" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { apiId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const api = await prisma.aPI.findUnique({
      where: { id: params.apiId },
    });

    if (!api) {
      return NextResponse.json({ error: "API not found" }, { status: 404 });
    }

    if (api.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.aPI.delete({
      where: { id: params.apiId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting API:", error);
    return NextResponse.json(
      { error: "Failed to delete API" },
      { status: 500 }
    );
  }
}
