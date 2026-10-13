import { NextRequest, NextResponse } from "next/server";
import {
  importPublicAPIs,
  importFromAPIsGuru,
} from "@/lib/services/catalog-import";
import { requireAdmin } from "@/lib/security/require-admin";

type SyncSource = "directory" | "openapi" | "all";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 500);
    const raw = String(body.source ?? "directory");
    const source: SyncSource =
      raw === "openapi" || raw === "guru"
        ? "openapi"
        : raw === "all"
          ? "all"
          : "directory";

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const details: Record<
      string,
      { imported: number; skipped: number; errors: number }
    > = {};

    if (source === "directory" || source === "all") {
      const r = await importPublicAPIs(undefined, limit);
      imported += r.imported;
      skipped += r.skipped;
      errors += r.errors;
      details.directory = r;
    }

    if (source === "openapi" || source === "all") {
      const r = await importFromAPIsGuru(undefined, limit);
      imported += r.imported;
      skipped += r.skipped;
      errors += r.errors;
      details.openapi = r;
    }

    return NextResponse.json({
      message: "Catalog sync complete",
      source,
      imported,
      skipped,
      errors,
      ...(Object.keys(details).length > 1 ? { details } : {}),
    });
  } catch (error) {
    console.error("Error syncing catalog:", error);
    return NextResponse.json(
      { error: "Failed to sync catalog" },
      { status: 500 }
    );
  }
}
