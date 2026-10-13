import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  apiKeyPrefix,
  generateApiKeyPlaintext,
  hashApiKey,
} from "@/lib/api-keys";
import { z } from "zod";

const createKeySchema = z.object({
  name: z.string().min(1),
  apiId: z.string().min(1),
  scopes: z.array(z.string()).optional(),
  environment: z
    .enum(["development", "staging", "production"])
    .default("production"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await prisma.aPIKey.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        keyPrefix: true,
        name: true,
        userId: true,
        apiId: true,
        scopes: true,
        environment: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
        api: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Never return hashed key material
    return NextResponse.json(
      keys.map((rest) => ({
        ...rest,
        key: undefined,
        keyHint: rest.keyPrefix || "adw_****",
      }))
    );
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createKeySchema.parse(body);

    const api = await prisma.aPI.findUnique({
      where: { id: validated.apiId },
      select: { id: true, userId: true, isApproved: true },
    });

    if (!api) {
      return NextResponse.json({ error: "API not found" }, { status: 404 });
    }

    if (api.userId !== session.user.id) {
      const subscription = await prisma.subscription.findUnique({
        where: {
          userId_apiId: {
            userId: session.user.id,
            apiId: validated.apiId,
          },
        },
        select: { status: true },
      });

      // Allow keys for approved public APIs on free tier (implicit free access)
      if (subscription?.status !== "active" && !api.isApproved) {
        return NextResponse.json(
          { error: "You need access to this API first" },
          { status: 403 }
        );
      }
    }

    const plaintext = generateApiKeyPlaintext();
    const hashed = hashApiKey(plaintext);
    const prefix = apiKeyPrefix(plaintext);

    const apiKey = await prisma.aPIKey.create({
      data: {
        key: hashed,
        keyPrefix: prefix,
        name: validated.name,
        userId: session.user.id,
        apiId: validated.apiId,
        scopes: validated.scopes?.length ? validated.scopes : ["full"],
        environment: validated.environment,
      },
      include: {
        api: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    const { key: _omit, ...safe } = apiKey;

    return NextResponse.json(
      {
        ...safe,
        key: plaintext, // shown once
        message: "Copy this key now. It will not be shown again.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating API key:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}
