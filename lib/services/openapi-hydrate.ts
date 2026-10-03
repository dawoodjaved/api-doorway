/**
 * Fetch + apply OpenAPI specs onto an API record (lazy hydrate / seed helper).
 */
import { prisma } from "@/lib/prisma";

const METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
]);

export function countEndpointsFromSpec(spec: any): number {
  const paths = spec?.paths;
  if (!paths || typeof paths !== "object") return 0;
  let n = 0;
  for (const ops of Object.values(paths) as any[]) {
    if (!ops || typeof ops !== "object") continue;
    for (const m of Object.keys(ops)) {
      if (METHODS.has(m.toLowerCase())) n++;
    }
  }
  return n;
}

export function extractEndpoints(
  spec: any
): Array<{ method: string; path: string; description?: string }> {
  const paths = spec?.paths;
  if (!paths || typeof paths !== "object") return [];
  const out: Array<{ method: string; path: string; description?: string }> = [];
  for (const [path, ops] of Object.entries(paths) as [string, any][]) {
    if (!ops || typeof ops !== "object") continue;
    for (const [method, op] of Object.entries(ops)) {
      if (!METHODS.has(method.toLowerCase())) continue;
      out.push({
        method: method.toUpperCase(),
        path,
        description: (op as any)?.summary || (op as any)?.operationId,
      });
      if (out.length >= 200) return out;
    }
  }
  return out;
}

export function extractBaseUrl(spec: any): string | null {
  const servers = spec?.servers;
  if (Array.isArray(servers) && servers[0]?.url) {
    return String(servers[0].url).replace(/\/$/, "");
  }
  if (spec?.host) {
    const scheme = (spec.schemes && spec.schemes[0]) || "https";
    const base = spec.basePath || "";
    return `${scheme}://${spec.host}${base}`.replace(/\/$/, "");
  }
  return null;
}

export async function fetchOpenApiSpec(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json, application/yaml, text/yaml, */*",
        "User-Agent": "APIDoorway/1.0",
      },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json && (json.openapi || json.swagger || json.paths)) return json;
    } catch {
      // YAML: dynamic import optional
      try {
        const yaml = await import("js-yaml");
        const data = yaml.load(text);
        if (data && typeof data === "object" && ((data as any).openapi || (data as any).swagger || (data as any).paths)) {
          return data;
        }
      } catch {
        return null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function isStubOnly(endpoints: Array<{ path: string }>): boolean {
  if (!endpoints.length) return true;
  if (endpoints.length === 1 && endpoints[0].path === "/") return true;
  return false;
}

export async function hydrateApiOpenApi(
  apiId: string,
  options?: { force?: boolean }
): Promise<{ hydrated: boolean; endpointCount: number; reason?: string }> {
  const api = await prisma.aPI.findUnique({
    where: { id: apiId },
    select: {
      id: true,
      openapiUrl: true,
      endpointCount: true,
      tryReady: true,
      baseUrl: true,
      https: true,
      arenaScore: true,
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          endpoints: { select: { path: true }, take: 5 },
        },
      },
    },
  });
  if (!api) return { hydrated: false, endpointCount: 0, reason: "not_found" };
  if (!api.openapiUrl) {
    return { hydrated: false, endpointCount: api.endpointCount, reason: "no_openapi_url" };
  }

  const latest = api.versions[0];
  const stub = !latest || isStubOnly(latest.endpoints || []);
  if (!options?.force && api.tryReady && !stub && api.endpointCount >= 2) {
    return { hydrated: true, endpointCount: api.endpointCount, reason: "already" };
  }

  const spec = await fetchOpenApiSpec(api.openapiUrl);
  if (!spec) return { hydrated: false, endpointCount: api.endpointCount, reason: "fetch_failed" };

  const endpoints = extractEndpoints(spec);
  const endpointCount = endpoints.length;
  const baseUrl = extractBaseUrl(spec) || api.baseUrl;
  const tryReady = endpointCount >= 2 && api.https !== false;
  const arenaScore = Math.min(100, (api.arenaScore || 0) + (endpointCount >= 2 ? 8 : 0));

  let versionId = latest?.id;
  if (!versionId) {
    const created = await prisma.aPIVersion.create({
      data: {
        apiId: api.id,
        version: "1.0.0",
        openApiSpec: spec,
        changelog: `Hydrated OpenAPI from ${api.openapiUrl}`,
      },
      select: { id: true },
    });
    versionId = created.id;
  } else {
    await prisma.$transaction([
      prisma.endpoint.deleteMany({ where: { versionId } }),
      prisma.aPIVersion.update({
        where: { id: versionId },
        data: {
          openApiSpec: spec,
          changelog: `Hydrated OpenAPI from ${api.openapiUrl}`,
        },
      }),
    ]);
  }

  if (endpoints.length) {
    await prisma.endpoint.createMany({
      data: endpoints.map((e) => ({
        versionId: versionId!,
        method: e.method,
        path: e.path,
        description: e.description,
      })),
    });
  }

  await prisma.aPI.update({
    where: { id: api.id },
    data: {
      hasOpenApi: true,
      endpointCount,
      tryReady,
      baseUrl,
      arenaScore,
      lastSyncedAt: new Date(),
    },
  });

  return { hydrated: true, endpointCount };
}
