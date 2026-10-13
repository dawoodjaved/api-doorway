import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/security/require-admin";

export async function POST(
  request: NextRequest,
  { params }: { params: { apiId: string } }
) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;

    const body = await request.json().catch(() => ({}));

    let isFeatured: boolean;
    if (typeof body.isFeatured === "boolean") {
      isFeatured = body.isFeatured;
    } else {
      const current = await prisma.aPI.findUnique({
        where: { id: params.apiId },
        select: { isFeatured: true },
      });
      if (!current) {
        return NextResponse.json({ error: "API not found" }, { status: 404 });
      }
      isFeatured = !current.isFeatured;
    }

    const updated = await prisma.aPI.update({
      where: { id: params.apiId },
      data: { isFeatured },
      select: {
        id: true,
        name: true,
        isFeatured: true,
        isApproved: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error toggling featured:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
