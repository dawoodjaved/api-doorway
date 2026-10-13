import { NextRequest, NextResponse } from "next/server";
import { importPublicAPIs } from "@/lib/services/catalog-import";

/**
 * Cron sync — always requires Authorization: Bearer $CRON_SECRET (fail closed).
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET?.trim();

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await importPublicAPIs(undefined, 100);

    return NextResponse.json({
      message: "Public APIs synced successfully",
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("Error in cron sync:", error);
    return NextResponse.json(
      { error: "Failed to sync public APIs" },
      { status: 500 }
    );
  }
}
