import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertToPostmanCollection } from "@/lib/services/postman-collection";

export async function GET(
  request: NextRequest,
  { params }: { params: { apiId: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const version = searchParams.get("version");
    const baseUrl = searchParams.get("baseUrl");

    const api = await prisma.aPI.findUnique({
      where: { id: params.apiId },
      select: {
        name: true,
        versions: {
          where: version ? { version } : undefined,
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            openApiSpec: true,
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

    const openApiSpec = api.versions[0].openApiSpec as any;

    const collection = convertToPostmanCollection(
      openApiSpec,
      api.name,
      baseUrl || undefined
    );

    return NextResponse.json(collection, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${api.name}-postman-collection.json"`,
      },
    });
  } catch (error) {
    console.error("Error generating Postman collection:", error);
    return NextResponse.json(
      { error: "Failed to generate Postman collection" },
      { status: 500 }
    );
  }
}
