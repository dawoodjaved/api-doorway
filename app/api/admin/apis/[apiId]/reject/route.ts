import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ apiId: string }> }
) {
  const { apiId } = await params;

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

    await prisma.aPI.delete({
      where: { id: apiId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting API:", error);
    return NextResponse.json(
      { error: "Failed to reject API" },
      { status: 500 }
    );
  }
}
