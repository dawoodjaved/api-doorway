import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { apiId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const api = await prisma.aPI.update({
      where: { id: params.apiId },
      data: { isApproved: true },
      select: {
        id: true,
        name: true,
        isApproved: true,
        isFeatured: true,
      },
    });

    return NextResponse.json(api);
  } catch (error) {
    console.error("Error approving API:", error);
    return NextResponse.json(
      { error: "Failed to approve API" },
      { status: 500 }
    );
  }
}
