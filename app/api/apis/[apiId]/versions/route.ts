import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireApiViewAccess } from "@/lib/security/api-access";

const createVersionSchema = z.object({
  version: z.string().min(1),
  openApiSpec: z.any(),
  changelog: z.string().optional(),
  isDeprecated: z.boolean().default(false),
  deprecationDate: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { apiId: string } }
) {
  try {
    const access = await requireApiViewAccess(params.apiId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "API not found" : "Forbidden" },
        { status: access.status }
      );
    }

    // List view: metadata + endpoints only (no openApiSpec JSON blobs)
    const versions = await prisma.aPIVersion.findMany({
      where: { apiId: access.api.id },
      select: {
        id: true,
        apiId: true,
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
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(versions);
  } catch (error) {
    console.error("Error fetching versions:", error);
    return NextResponse.json([]);
  }
}

export async function POST(
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
    const validated = createVersionSchema.parse(body);

    // Check if version already exists
    const existing = await prisma.aPIVersion.findFirst({
      where: {
        apiId: params.apiId,
        version: validated.version,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Version already exists" },
        { status: 400 }
      );
    }

    // Extract endpoints from OpenAPI spec
    const paths = validated.openApiSpec.paths || {};
    const endpoints: Array<{
      method: string;
      path: string;
      description?: string;
    }> = [];

    for (const [path, methods] of Object.entries(paths)) {
      if (typeof methods === "object" && methods !== null) {
        for (const [method, operation] of Object.entries(methods)) {
          if (
            ["get", "post", "put", "delete", "patch"].includes(
              method.toLowerCase()
            )
          ) {
            endpoints.push({
              method: method.toUpperCase(),
              path,
              description:
                (operation as any)?.summary ||
                (operation as any)?.description ||
                undefined,
            });
          }
        }
      }
    }

    // Create version
    const version = await prisma.aPIVersion.create({
      data: {
        apiId: params.apiId,
        version: validated.version,
        openApiSpec: validated.openApiSpec,
        changelog: validated.changelog,
        isDeprecated: validated.isDeprecated,
        deprecationDate: validated.deprecationDate
          ? new Date(validated.deprecationDate)
          : null,
      },
    });

    // Create endpoints
    await prisma.endpoint.createMany({
      data: endpoints.map((endpoint) => ({
        versionId: version.id,
        method: endpoint.method,
        path: endpoint.path,
        description: endpoint.description,
      })),
    });

    return NextResponse.json(
      {
        version,
        endpointsCreated: endpoints.length,
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
    console.error("Error creating version:", error);
    return NextResponse.json(
      { error: "Failed to create version" },
      { status: 500 }
    );
  }
}
