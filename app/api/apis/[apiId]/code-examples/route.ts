import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCodeExamples } from "@/lib/services/code-examples";
import { requireApiViewAccess } from "@/lib/security/api-access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ apiId: string }> }
) {
  const { apiId } = await params;

  try {
    const access = await requireApiViewAccess(apiId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "API not found" : "Forbidden" },
        { status: access.status }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const version = searchParams.get("version");
    const endpointPath = searchParams.get("path");
    const method = searchParams.get("method");

    const api = await prisma.aPI.findUnique({
      where: { id: access.api.id },
      select: {
        name: true,
        versions: {
          where: version ? { version } : undefined,
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            version: true,
            openApiSpec: true,
            endpoints:
              endpointPath && method
                ? {
                    where: {
                      path: endpointPath,
                      method: method.toUpperCase(),
                    },
                    select: { method: true, path: true },
                    take: 1,
                  }
                : false,
          },
        },
      },
    });

    if (!api) {
      return NextResponse.json({ error: "API not found" }, { status: 404 });
    }

    if (api.versions.length === 0) {
      return NextResponse.json(
        { error: "No version found for this API" },
        { status: 404 }
      );
    }

    const apiVersion = api.versions[0];
    const openApiSpec = apiVersion.openApiSpec as any;

    const endpoint =
      endpointPath && method && apiVersion.endpoints?.length > 0
        ? {
            method: apiVersion.endpoints[0].method,
            path: apiVersion.endpoints[0].path,
          }
        : undefined;

    const examples = generateCodeExamples(openApiSpec, api.name, endpoint);

    return NextResponse.json({
      examples,
      apiName: api.name,
      version: apiVersion.version,
    });
  } catch (error) {
    console.error("Error generating code examples:", error);
    return NextResponse.json(
      { error: "Failed to generate code examples" },
      { status: 500 }
    );
  }
}
