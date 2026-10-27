import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  apiKeyPrefix,
  generateApiKeyPlaintext,
  hashApiKey,
} from "@/lib/api-keys";
import { hydrateApiOpenApi } from "@/lib/services/openapi-hydrate";

/**
 * One-click: subscribe (free) + create API key + optional OpenAPI hydrate.
 * Returns plaintext key once for immediate playground use.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ apiId: string }> }
) {
  const { apiId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const api = await prisma.aPI.findUnique({ where: { id: apiId } });
    if (!api || !api.isApproved || !api.isPublic) {
      return NextResponse.json({ error: "API not found" }, { status: 404 });
    }

    await prisma.subscription.upsert({
      where: {
        userId_apiId: { userId: session.user.id, apiId: api.id },
      },
      update: {
        plan: "free",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      create: {
        userId: session.user.id,
        apiId: api.id,
        plan: "free",
        status: "active",
        stripeCustomerId: `cus_free_${session.user.id.slice(0, 10)}`,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Reuse an existing key for this API if present (don't mint endlessly)
    const existingKey = await prisma.aPIKey.findFirst({
      where: {
        userId: session.user.id,
        apiId: api.id,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let plaintext: string | null = null;
    let keyRecord = existingKey;
    let keyCreated = false;

    if (!existingKey) {
      plaintext = generateApiKeyPlaintext();
      const hashed = hashApiKey(plaintext);
      const prefix = apiKeyPrefix(plaintext);
      keyRecord = await prisma.aPIKey.create({
        data: {
          key: hashed,
          keyPrefix: prefix,
          name: `${api.name} playground`,
          userId: session.user.id,
          apiId: api.id,
          scopes: ["full"],
          environment: "development",
        },
      });
      keyCreated = true;
    }

    // Best-effort hydrate so playground has real endpoints
    let hydrate = { hydrated: false, endpointCount: api.endpointCount };
    if (api.openapiUrl && (!api.tryReady || api.endpointCount < 2)) {
      try {
        hydrate = await hydrateApiOpenApi(api.id);
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({
      ok: true,
      subscribed: true,
      keyCreated,
      apiKey: plaintext, // null if reusing existing (secret not recoverable)
      keyPrefix: keyRecord?.keyPrefix,
      keyId: keyRecord?.id,
      message: plaintext
        ? "Subscribed + key created. Copy the key — it won't be shown again."
        : "Already subscribed with a key. Paste your existing key in the playground, or create a new one from API Keys.",
      hydrate,
    });
  } catch (error) {
    console.error("quickstart error:", error);
    return NextResponse.json({ error: "Quickstart failed" }, { status: 500 });
  }
}
