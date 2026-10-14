import { NextResponse } from "next/server";
import { emptyCatalogStats, getCatalogStats } from "@/lib/catalog-stats";

/** Public metrics — cache briefly so home/marketplace stay snappy */
export const revalidate = 60;

/**
 * Marketplace catalog health stats (public product metrics only).
 */
export async function GET() {
  try {
    const stats = await getCatalogStats();
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("catalog stats error:", error);
    return NextResponse.json(emptyCatalogStats(), { status: 200 });
  }
}
