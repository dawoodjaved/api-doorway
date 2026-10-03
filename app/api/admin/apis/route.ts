import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const take = Math.min(
      Number(request.nextUrl.searchParams.get("limit") || "200") || 200,
      500
    );

    const apis = await prisma.aPI.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        category: true,
        isApproved: true,
        isFeatured: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    return NextResponse.json(apis);
  } catch (error) {
    console.error("Error fetching APIs:", error);
    return NextResponse.json([]);
  }
}
