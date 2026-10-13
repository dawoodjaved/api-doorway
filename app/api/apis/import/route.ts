import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import * as yaml from "js-yaml";

function parseOpenApiSpec(raw: unknown): Record<string, any> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, any>;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    try {
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return JSON.parse(trimmed);
      }
      return yaml.load(trimmed) as Record<string, any>;
    } catch {
      return null;
    }
  }
  return null;
}

function isValidOpenApi(spec: Record<string, any>): boolean {
  if (!spec.openapi && !spec.swagger) return false;
  if (!spec.info || typeof spec.info !== "object") return false;
  if (!spec.paths || typeof spec.paths !== "object") return false;
  return true;
}

function extractEndpoints(paths: Record<string, any>) {
  const endpoints: Array<{ method: string; path: string; description?: string }> = [];
  for (const [path, methods] of Object.entries(paths || {})) {
    if (typeof methods !== "object" || methods === null) continue;
    for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
      if (!["get", "post", "put", "delete", "patch"].includes(method.toLowerCase())) continue;
      endpoints.push({
        method: method.toUpperCase(),
        path,
        description: operation?.summary || operation?.description || undefined,
      });
    }
  }
  return endpoints;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { apiName, apiDescription, category, baseUrl } = body;
    const openApiSpec = parseOpenApiSpec(body.openApiSpec ?? body.spec ?? body.yaml);

    if (!openApiSpec || !apiName) {
      return NextResponse.json(
        { error: "OpenAPI spec and API name are required" },
        { status: 400 }
      );
    }

    if (!isValidOpenApi(openApiSpec)) {
      return NextResponse.json(
        {
          error:
            "Invalid OpenAPI specification. Expected openapi/swagger, info, and paths.",
        },
        { status: 400 }
      );
    }

    const version = openApiSpec.info?.version || "1.0.0";
    const slug = slugify(apiName);
    const resolvedBaseUrl =
      baseUrl ||
      openApiSpec.servers?.[0]?.url ||
      null;

    let api = await prisma.aPI.findUnique({ where: { slug } });

    if (!api) {
      api = await prisma.aPI.create({
        data: {
          name: apiName,
          slug,
          description: apiDescription || openApiSpec.info?.description || "",
          category: category || "Other",
          baseUrl: resolvedBaseUrl,
          userId: session.user.id,
          isPublic: true,
          isApproved: false,
        },
      });
    } else {
      // IDOR: never add versions / update baseUrl on someone else's API
      if (api.userId !== session.user.id) {
        return NextResponse.json(
          { error: "An API with this name already exists and you do not own it" },
          { status: 403 }
        );
      }
      if (resolvedBaseUrl && !api.baseUrl) {
        api = await prisma.aPI.update({
          where: { id: api.id },
          data: { baseUrl: resolvedBaseUrl },
        });
      }
    }

    const existingVersion = await prisma.aPIVersion.findFirst({
      where: { apiId: api.id, version },
    });

    if (existingVersion) {
      return NextResponse.json(
        { error: `Version ${version} already exists for this API` },
        { status: 400 }
      );
    }

    const endpoints = extractEndpoints(openApiSpec.paths || {});

    const apiVersion = await prisma.aPIVersion.create({
      data: {
        apiId: api.id,
        version,
        openApiSpec: openApiSpec as any,
        changelog: `Initial version ${version} imported from OpenAPI spec`,
      },
    });

    if (endpoints.length > 0) {
      await prisma.endpoint.createMany({
        data: endpoints.map((endpoint) => ({
          versionId: apiVersion.id,
          method: endpoint.method,
          path: endpoint.path,
          description: endpoint.description,
        })),
      });
    }

    return NextResponse.json(
      {
        api,
        version: apiVersion,
        endpointsCreated: endpoints.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error importing OpenAPI spec:", error);
    return NextResponse.json(
      { error: "Failed to import OpenAPI spec" },
      { status: 500 }
    );
  }
}
