import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function logo(seed: string) {
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0d7377,12333a,b8d9da`;
}

function avatar(seed: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

type CatalogRow = {
  sourceKey: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  authType?: string;
  https?: boolean;
  cors?: string;
  docsUrl?: string;
  baseUrl?: string | null;
  openapiUrl?: string | null;
  hasOpenApi?: boolean;
  openapiHydrated?: boolean;
  endpointCount?: number;
  tryReady?: boolean;
  logo?: string | null;
  source?: string;
  tags?: string[];
  arenaScore?: number;
  featured?: boolean;
};

type DemoApi = {
  name: string;
  slug: string;
  description: string;
  category: string;
  baseUrl: string;
  featured?: boolean;
  paths: Record<string, any>;
  reviews?: Array<{ email: string; rating: number; comment: string }>;
};

/** Hand-curated playground demos (always seeded, great for Try It). */
const demoCatalog: DemoApi[] = [
  {
    name: "Horizon Weather",
    slug: "horizon-weather",
    description:
      "Global weather conditions, forecasts, and historical climate data with city and geo lookup.",
    category: "Data",
    baseUrl: "https://httpbin.org",
    featured: true,
    paths: {
      "/get": {
        get: {
          summary: "Current conditions",
          responses: { "200": { description: "OK" } },
        },
      },
      "/post": {
        post: {
          summary: "Forecast query",
          responses: { "200": { description: "OK" } },
        },
      },
    },
    reviews: [
      {
        email: "dev@apidoorway.local",
        rating: 5,
        comment: "Clean docs and reliable responses for weather widgets.",
      },
    ],
  },
  {
    name: "Ledger Pay",
    slug: "ledger-pay",
    description:
      "Payment intents, refunds, and settlement status for marketplace checkouts.",
    category: "Payment",
    baseUrl: "https://httpbin.org",
    featured: true,
    paths: {
      "/post": {
        post: {
          summary: "Create payment intent",
          responses: { "200": { description: "OK" } },
        },
      },
      "/get": {
        get: {
          summary: "Get payment status",
          responses: { "200": { description: "OK" } },
        },
      },
    },
  },
  {
    name: "Pulse AI Insights",
    slug: "pulse-ai",
    description:
      "Text classification, embeddings, and summarization endpoints for product AI features.",
    category: "AI/ML",
    baseUrl: "https://httpbin.org",
    featured: true,
    paths: {
      "/post": {
        post: {
          summary: "Classify text",
          responses: { "200": { description: "OK" } },
        },
      },
    },
  },
];

function loadCatalogJson(): CatalogRow[] {
  const path = join(process.cwd(), "data/catalog/seed_catalog.json");
  if (!existsSync(path)) {
    console.warn(
      "Missing data/catalog/seed_catalog.json — run: python3 scripts/catalog/sync_catalog.py"
    );
    return [];
  }
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) return [];
  return data as CatalogRow[];
}

async function upsertUser(opts: {
  email: string;
  name: string;
  role: string;
  password: string;
  image?: string;
}) {
  const hashed = await bcrypt.hash(opts.password, 10);
  const user = await prisma.user.upsert({
    where: { email: opts.email },
    update: {
      name: opts.name,
      role: opts.role,
      image: opts.image,
    },
    create: {
      email: opts.email,
      name: opts.name,
      role: opts.role,
      image: opts.image,
    },
  });

  const existing = await prisma.account.findFirst({
    where: { userId: user.id, provider: "credentials" },
  });
  if (!existing) {
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "credentials",
        provider: "credentials",
        providerAccountId: user.id,
        access_token: hashed,
      },
    });
  } else {
    await prisma.account.update({
      where: { id: existing.id },
      data: { access_token: hashed },
    });
  }

  return user;
}

function buildOpenApi(item: {
  name: string;
  description: string;
  baseUrl?: string | null;
  docsUrl?: string | null;
  paths?: Record<string, any>;
}) {
  const server =
    item.baseUrl ||
    (item.docsUrl ? item.docsUrl.replace(/\/$/, "") : "https://example.com");
  return {
    openapi: "3.0.0",
    info: {
      title: item.name,
      version: "1.0.0",
      description: item.description,
    },
    servers: [{ url: server }],
    paths: item.paths || {
      "/": {
        get: {
          summary: "API root / docs entry",
          responses: { "200": { description: "OK" } },
        },
      },
    },
  };
}

async function upsertDemoApi(providerId: string, item: DemoApi) {
  const openApiSpec = buildOpenApi(item);
  const api = await prisma.aPI.upsert({
    where: { slug: item.slug },
    update: {
      name: item.name,
      description: item.description,
      category: item.category,
      logo: logo(item.slug),
      baseUrl: item.baseUrl,
      docsUrl: item.baseUrl,
      authType: "none",
      https: true,
      cors: "yes",
      hasOpenApi: true,
      source: "seed",
      sourceKey: `seed:${item.slug}`,
      tags: ["auth:none", "https", "openapi", "playground"],
      arenaScore: 92,
      endpointCount: Object.keys(item.paths || {}).length,
      tryReady: true,
      lastSyncedAt: new Date(),
      isPublic: true,
      isApproved: true,
      isFeatured: Boolean(item.featured),
      userId: providerId,
    },
    create: {
      name: item.name,
      slug: item.slug,
      description: item.description,
      category: item.category,
      logo: logo(item.slug),
      baseUrl: item.baseUrl,
      docsUrl: item.baseUrl,
      authType: "none",
      https: true,
      cors: "yes",
      hasOpenApi: true,
      source: "seed",
      sourceKey: `seed:${item.slug}`,
      tags: ["auth:none", "https", "openapi", "playground"],
      arenaScore: 92,
      endpointCount: Object.keys(item.paths || {}).length,
      tryReady: true,
      lastSyncedAt: new Date(),
      isPublic: true,
      isApproved: true,
      isFeatured: Boolean(item.featured),
      userId: providerId,
    },
  });

  await syncVersionAndEndpoints(api.id, openApiSpec, item.paths, `Demo seed: ${item.name}`);
  return api;
}

async function upsertCatalogApi(providerId: string, item: CatalogRow) {
  let slug = item.slug;
  const conflict = await prisma.aPI.findUnique({ where: { slug } });
  if (conflict && conflict.sourceKey !== item.sourceKey) {
    slug = `${item.slug}-${item.sourceKey.slice(0, 6)}`;
  }

  // Prefer hydrated OpenAPI file from catalog sync
  const specPath = join(
    process.cwd(),
    "data/catalog/specs",
    `${item.sourceKey}.json`
  );
  let openApiSpec: any = null;
  let paths: Record<string, any> | undefined;
  if (existsSync(specPath)) {
    try {
      openApiSpec = JSON.parse(readFileSync(specPath, "utf-8"));
      paths = openApiSpec?.paths;
    } catch {
      openApiSpec = null;
    }
  }
  if (!openApiSpec) {
    openApiSpec = buildOpenApi({
      name: item.name,
      description: item.description,
      baseUrl: item.baseUrl,
      docsUrl: item.docsUrl,
    });
  }

  const endpointCount =
    item.endpointCount && item.endpointCount > 0
      ? item.endpointCount
      : paths
        ? Object.values(paths).reduce((n: number, ops: any) => {
            if (!ops || typeof ops !== "object") return n;
            return (
              n +
              Object.keys(ops).filter((m) =>
                ["get", "post", "put", "patch", "delete", "head", "options"].includes(
                  m
                )
              ).length
            );
          }, 0)
        : 1;

  const tryReady =
    item.tryReady === true ||
    (endpointCount >= 2 && item.https !== false && Boolean(paths));

  const data = {
    name: item.name.slice(0, 200),
    description: item.description.slice(0, 4000),
    category: item.category || "Other",
    logo: item.logo || logo(slug),
    baseUrl: item.baseUrl || null,
    authType: item.authType || "unknown",
    https: item.https !== false,
    cors: item.cors || "unknown",
    docsUrl: item.docsUrl || null,
    openapiUrl: item.openapiUrl || null,
    hasOpenApi: Boolean(item.hasOpenApi) || Boolean(paths),
    source: item.source || "directory",
    sourceKey: item.sourceKey,
    tags: item.tags || [],
    arenaScore: Math.max(0, Math.min(100, item.arenaScore || 0)),
    endpointCount,
    tryReady,
    lastSyncedAt: new Date(),
    isPublic: true,
    isApproved: true,
    isFeatured: Boolean(item.featured),
    userId: providerId,
  };

  const bySource = item.sourceKey
    ? await prisma.aPI.findFirst({ where: { sourceKey: item.sourceKey } })
    : null;

  let api;
  if (bySource) {
    api = await prisma.aPI.update({
      where: { id: bySource.id },
      data: { ...data, slug: bySource.slug },
    });
  } else {
    api = await prisma.aPI.upsert({
      where: { slug },
      update: data,
      create: { ...data, slug },
    });
  }

  const existingVersion = await prisma.aPIVersion.findFirst({
    where: { apiId: api.id, version: "1.0.0" },
  });
  const changelog = [
    item.openapiUrl ? `OpenAPI available` : null,
    `Auth: ${item.authType || "unknown"}`,
    `APIDoorway Score: ${item.arenaScore ?? 0}`,
    `Endpoints: ${endpointCount}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!existingVersion) {
    const version = await prisma.aPIVersion.create({
      data: {
        apiId: api.id,
        version: "1.0.0",
        openApiSpec,
        changelog,
      },
    });
    if (paths && Object.keys(paths).length) {
      const endpoints: Array<{
        method: string;
        path: string;
        description?: string;
      }> = [];
      for (const [path, methods] of Object.entries(paths)) {
        for (const [method, op] of Object.entries(methods as Record<string, any>)) {
          if (
            !["get", "post", "put", "patch", "delete", "head", "options"].includes(
              method
            )
          ) {
            continue;
          }
          endpoints.push({
            method: method.toUpperCase(),
            path,
            description: op?.summary,
          });
          if (endpoints.length >= 120) break;
        }
        if (endpoints.length >= 120) break;
      }
      if (endpoints.length) {
        await prisma.endpoint.createMany({
          data: endpoints.map((e) => ({
            versionId: version.id,
            method: e.method,
            path: e.path,
            description: e.description,
          })),
        });
      }
    } else {
      await prisma.endpoint.create({
        data: {
          versionId: version.id,
          method: "GET",
          path: "/",
          description: `Access ${item.name}`,
        },
      });
    }
  } else if (paths && Object.keys(paths).length && tryReady) {
    // Refresh hydrated specs on re-seed
    await prisma.aPIVersion.update({
      where: { id: existingVersion.id },
      data: { openApiSpec, changelog },
    });
    await prisma.endpoint.deleteMany({ where: { versionId: existingVersion.id } });
    const endpoints: Array<{
      method: string;
      path: string;
      description?: string;
    }> = [];
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(methods as Record<string, any>)) {
        if (
          !["get", "post", "put", "patch", "delete", "head", "options"].includes(
            method
          )
        ) {
          continue;
        }
        endpoints.push({
          method: method.toUpperCase(),
          path,
          description: op?.summary,
        });
        if (endpoints.length >= 120) break;
      }
      if (endpoints.length >= 120) break;
    }
    if (endpoints.length) {
      await prisma.endpoint.createMany({
        data: endpoints.map((e) => ({
          versionId: existingVersion.id,
          method: e.method,
          path: e.path,
          description: e.description,
        })),
      });
    }
  } else {
    await prisma.aPIVersion.update({
      where: { id: existingVersion.id },
      data: { openApiSpec, changelog },
    });
  }

  return api;
}

async function syncVersionAndEndpoints(
  apiId: string,
  openApiSpec: any,
  paths?: Record<string, any>,
  changelog?: string
) {
  let version = await prisma.aPIVersion.findFirst({
    where: { apiId, version: "1.0.0" },
  });

  if (!version) {
    version = await prisma.aPIVersion.create({
      data: {
        apiId,
        version: "1.0.0",
        openApiSpec,
        changelog: changelog || "Initial catalog sync",
      },
    });
  } else {
    version = await prisma.aPIVersion.update({
      where: { id: version.id },
      data: { openApiSpec, changelog: changelog || version.changelog },
    });
    await prisma.endpoint.deleteMany({ where: { versionId: version.id } });
  }

  const pathMap = paths || openApiSpec.paths || {};
  const endpoints: Array<{ method: string; path: string; description?: string }> =
    [];
  for (const [path, methods] of Object.entries(pathMap)) {
    for (const [method, op] of Object.entries(methods as Record<string, any>)) {
      if (!["get", "post", "put", "patch", "delete", "head", "options"].includes(method)) {
        continue;
      }
      endpoints.push({
        method: method.toUpperCase(),
        path,
        description: op?.summary,
      });
    }
  }

  if (endpoints.length) {
    await prisma.endpoint.createMany({
      data: endpoints.map((e) => ({
        versionId: version!.id,
        method: e.method,
        path: e.path,
        description: e.description,
      })),
    });
  }
}

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_SEED !== "true"
  ) {
    console.error(
      "Refusing to seed demo users in production. Set ALLOW_DEMO_SEED=true only for disposable demo environments."
    );
    process.exit(1);
  }

  const admin = await upsertUser({
    email: "admin@apidoorway.local",
    name: "Alex Rivera",
    role: "admin",
    password: "admin123",
    image: avatar("alex-rivera"),
  });

  const provider = await upsertUser({
    email: "provider@apidoorway.local",
    name: "Nova Labs",
    role: "provider",
    password: "provider123",
    image: avatar("nova-labs"),
  });

  const catalogProvider = await upsertUser({
    email: "catalog@apidoorway.local",
    name: "APIDoorway Catalog",
    role: "provider",
    password: "catalog123",
    image: avatar("apidoorway-catalog"),
  });

  const reviewers = await Promise.all([
    upsertUser({
      email: "dev@apidoorway.local",
      name: "Sam Chen",
      role: "user",
      password: "user1234",
      image: avatar("sam-chen"),
    }),
    upsertUser({
      email: "maya@apidoorway.local",
      name: "Maya Okonkwo",
      role: "user",
      password: "user1234",
      image: avatar("maya-okonkwo"),
    }),
    upsertUser({
      email: "jordan@apidoorway.local",
      name: "Jordan Lee",
      role: "user",
      password: "user1234",
      image: avatar("jordan-lee"),
    }),
  ]);

  const reviewerByEmail = Object.fromEntries(reviewers.map((u) => [u.email, u]));

  await prisma.aPI.deleteMany({ where: { slug: "demo-weather" } }).catch(() => {});

  for (const item of demoCatalog) {
    const api = await upsertDemoApi(provider.id, item);
    for (const review of item.reviews || []) {
      const user = reviewerByEmail[review.email];
      if (!user) continue;
      await prisma.review.upsert({
        where: { userId_apiId: { userId: user.id, apiId: api.id } },
        update: { rating: review.rating, comment: review.comment },
        create: {
          userId: user.id,
          apiId: api.id,
          rating: review.rating,
          comment: review.comment,
        },
      });
    }
  }

  const catalog = loadCatalogJson();
  console.log(`Seeding ${catalog.length} catalog APIs from seed_catalog.json…`);

  let seeded = 0;
  let errors = 0;
  const batchSize = 50;
  for (let i = 0; i < catalog.length; i += batchSize) {
    const batch = catalog.slice(i, i + batchSize);
    for (const item of batch) {
      try {
        if (!item.slug || !item.name || !item.sourceKey) continue;
        await upsertCatalogApi(catalogProvider.id, item);
        seeded++;
      } catch (e) {
        errors++;
        if (errors < 8) {
          console.warn(`Skip ${item.slug}:`, e instanceof Error ? e.message : e);
        }
      }
    }
    if ((i / batchSize) % 10 === 0) {
      console.log(`  … ${Math.min(i + batchSize, catalog.length)} / ${catalog.length}`);
    }
  }

  const counts = {
    users: await prisma.user.count(),
    apis: await prisma.aPI.count(),
    reviews: await prisma.review.count(),
    versions: await prisma.aPIVersion.count(),
    endpoints: await prisma.endpoint.count(),
    catalogSeeded: seeded,
    catalogErrors: errors,
  };

  console.log("Seed complete.");
  console.log(counts);
  if (process.env.NODE_ENV !== "production") {
    console.log("Demo logins (local/dev only — rotate if this DB is shared):");
    console.log("  admin@apidoorway.local / admin123");
    console.log("  provider@apidoorway.local / provider123");
    console.log("  catalog@apidoorway.local / catalog123");
    console.log("  dev@apidoorway.local / user1234");
  }
  console.log("Admin id:", admin.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
