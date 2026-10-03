/**
 * Optional admin catalog import helpers.
 * Feed URLs come from env (never hardcode third-party directory brands here).
 *
 * CATALOG_DIRECTORY_FEED_URL  — JSON entries list
 * CATALOG_DIRECTORY_FEED_URL_2 — optional fallback
 * CATALOG_OPENAPI_INDEX_URL   — OpenAPI index JSON
 */
import { prisma } from "../prisma";
import axios from "axios";

const fetchAPIData = async (url: string, options: any = {}) => {
  if (typeof fetch !== "undefined") {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          "User-Agent": "APIDoorway/1.0",
          ...options.headers,
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (fetchError: any) {
      console.warn(`Native fetch failed: ${fetchError.message}, trying axios...`);
    }
  }
  const response = await axios.get(url, {
    timeout: options.timeout || 60000,
    headers: {
      Accept: "application/json",
      "User-Agent": "APIDoorway/1.0",
      ...options.headers,
    },
  });
  return response.data;
};

interface DirectoryEntry {
  API: string;
  Description: string;
  Auth: string;
  HTTPS: boolean;
  Cors: string;
  Link: string;
  Category: string;
}

interface OpenApiIndexEntry {
  name: string;
  description?: string;
  image?: string;
  url: string;
  openapi?: string;
  swagger?: string;
}

function directoryFeedUrls(): string[] {
  return [
    process.env.CATALOG_DIRECTORY_FEED_URL,
    process.env.CATALOG_DIRECTORY_FEED_URL_2,
  ].filter((u): u is string => Boolean(u?.trim()));
}

function openApiIndexUrl(): string | null {
  const u = process.env.CATALOG_OPENAPI_INDEX_URL?.trim();
  return u || null;
}

function parseEntriesPayload(data: any): DirectoryEntry[] {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.entries)) return data.entries;
  if (Array.isArray(data)) return data;
  return [];
}

/** Fetch directory entries from configured feed URL(s). */
export async function fetchPublicAPIsFromGitHub(): Promise<DirectoryEntry[]> {
  const urls = directoryFeedUrls();
  if (urls.length === 0) {
    console.warn(
      "Catalog directory feed not configured (set CATALOG_DIRECTORY_FEED_URL)."
    );
    return [];
  }

  for (const url of urls) {
    try {
      console.log("Fetching catalog directory feed…");
      const data = await fetchAPIData(url, { timeout: 60000 });
      const entries = parseEntriesPayload(data);
      if (entries.length > 0) {
        console.log(`Directory feed: ${entries.length} entries`);
        return entries;
      }
    } catch (error: any) {
      console.warn(`Directory feed failed: ${error.message}`);
    }
  }

  console.error("All directory feed attempts failed");
  return [];
}

/** Fetch OpenAPI index entries from configured URL. */
export async function fetchAPIsFromGuru(): Promise<OpenApiIndexEntry[]> {
  const url = openApiIndexUrl();
  if (!url) {
    console.warn(
      "OpenAPI index feed not configured (set CATALOG_OPENAPI_INDEX_URL)."
    );
    return [];
  }

  try {
    const data = await fetchAPIData(url, { timeout: 60000 });
    if (!data || typeof data !== "object") return [];

    return Object.entries(data).map(([key, value]) => ({
      name: (value as { name?: string }).name || key,
      description: (value as { description?: string }).description,
      image: (value as { image?: string }).image,
      url: (value as { url?: string }).url || "",
      openapi: (value as { openapi?: string }).openapi,
      swagger: (value as { swagger?: string }).swagger,
    }));
  } catch (error) {
    console.error("Error fetching OpenAPI index:", error);
    return [];
  }
}

function mapCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    Animals: "Other",
    Anime: "Other",
    "Anti-Malware": "Security",
    "Art & Design": "Other",
    Books: "Data",
    Business: "Data",
    Calendar: "Other",
    "Cloud Storage & File Sharing": "Storage",
    "Continuous Integration": "Other",
    Cryptocurrency: "Finance",
    "Currency Exchange": "Finance",
    "Data Validation": "Data",
    Development: "Other",
    Dictionaries: "Data",
    "Documents & Productivity": "Other",
    Email: "Communication",
    Entertainment: "Other",
    Environment: "Data",
    Events: "Other",
    Finance: "Finance",
    "Food & Drink": "Other",
    "Games & Comics": "Other",
    Geocoding: "Data",
    Government: "Data",
    Health: "Data",
    Jobs: "Data",
    "Machine Learning": "AI/ML",
    Music: "Other",
    News: "Data",
    "Open Data": "Data",
    "Open Source Projects": "Other",
    Patent: "Data",
    Personality: "Other",
    Phone: "Communication",
    Photography: "Other",
    Programming: "Other",
    "Science & Math": "Data",
    Security: "Security",
    Shopping: "Other",
    Social: "Social",
    "Sports & Fitness": "Other",
    "Test Data": "Data",
    "Text Analysis": "AI/ML",
    Tracking: "Analytics",
    Transportation: "Other",
    "URL Shorteners": "Other",
    Vehicle: "Other",
    Video: "Other",
    Weather: "Data",
  };

  return categoryMap[category] || "Other";
}

async function getOrCreateSystemUser(userId?: string): Promise<string> {
  if (userId) return userId;
  const systemUser = await prisma.user.findFirst({
    where: { email: "system@apidoorway.com" },
  });
  if (systemUser) return systemUser.id;
  const newUser = await prisma.user.create({
    data: {
      name: "System",
      email: "system@apidoorway.com",
      role: "provider",
    },
  });
  return newUser.id;
}

/** Import APIs from the configured OpenAPI index feed. */
export async function importFromAPIsGuru(
  userId?: string,
  limit: number = 50
): Promise<{ imported: number; skipped: number; errors: number }> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const indexApis = await fetchAPIsFromGuru();
    console.log(`Fetched ${indexApis.length} APIs from OpenAPI index`);

    if (indexApis.length === 0) {
      return { imported: 0, skipped: 0, errors: 0 };
    }

    const valid = indexApis.filter(
      (a) => a.name && a.name.trim() && a.url && a.url.trim()
    );
    const toImport = valid.slice(0, limit);
    const systemUserId = await getOrCreateSystemUser(userId);

    for (const api of toImport) {
      try {
        const slug = api.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .substring(0, 100);
        if (!slug) {
          skipped++;
          continue;
        }

        const existing = await prisma.aPI.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }

        const name = api.name.trim().substring(0, 200);
        const description = (api.description || `API: ${name}`)
          .trim()
          .substring(0, 2000);

        const created = await prisma.aPI.create({
          data: {
            name,
            slug,
            description,
            category: "Other",
            logo: api.image || null,
            isPublic: true,
            isApproved: true,
            isFeatured: false,
            userId: systemUserId,
            source: "openapi",
          },
          select: { id: true },
        });

        const specUrl = api.openapi || api.swagger || "";
        const version = await prisma.aPIVersion.create({
          data: {
            apiId: created.id,
            version: "1.0.0",
            openApiSpec: {
              openapi: "3.0.0",
              info: { title: name, description, version: "1.0.0" },
              servers: [{ url: api.url, description: "API base URL" }],
              paths: {},
            },
            changelog: specUrl
              ? `Catalog import. OpenAPI: ${specUrl}`
              : "Catalog import",
          },
          select: { id: true },
        });

        await prisma.endpoint.create({
          data: {
            versionId: version.id,
            method: "GET",
            path: "/",
            description: `Base URL: ${api.url}`,
          },
        });

        imported++;
      } catch (err) {
        console.error(`Error importing ${api.name}:`, err);
        errors++;
      }
    }

    console.log(
      `OpenAPI index import: ${imported} imported, ${skipped} skipped, ${errors} errors`
    );
    return { imported, skipped, errors };
  } catch (error) {
    console.error("Error in importFromAPIsGuru:", error);
    throw error;
  }
}

/** Import APIs from the configured directory feed. */
export async function importPublicAPIs(
  userId?: string,
  limit: number = 50
): Promise<{ imported: number; skipped: number; errors: number }> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const publicAPIs = await fetchPublicAPIsFromGitHub();
    console.log(`Fetched ${publicAPIs.length} APIs from directory feed`);

    if (publicAPIs.length === 0) {
      console.warn("No APIs fetched. Configure catalog feed env vars.");
      return { imported: 0, skipped: 0, errors: 0 };
    }

    const validAPIs = publicAPIs.filter(
      (api) =>
        api.API && api.API.trim() && api.Link && api.Link.trim() && api.Category
    );
    console.log(
      `Found ${validAPIs.length} valid APIs out of ${publicAPIs.length} total`
    );

    const apisToImport = validAPIs.slice(0, limit);
    const systemUserId = await getOrCreateSystemUser(userId);

    for (const api of apisToImport) {
      try {
        const slug = api.API.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .substring(0, 100);

        if (!slug) {
          skipped++;
          continue;
        }

        const existing = await prisma.aPI.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }

        const apiName = api.API.trim().substring(0, 200);
        const apiDescription = (api.Description || `API: ${apiName}`)
          .trim()
          .substring(0, 2000);
        const apiCategory = mapCategory(api.Category);

        const createdAPI = await prisma.aPI.create({
          data: {
            name: apiName,
            slug,
            description: apiDescription,
            category: apiCategory,
            isPublic: true,
            isApproved: true,
            isFeatured: false,
            userId: systemUserId!,
            source: "directory",
            authType: api.Auth || "none",
            https: Boolean(api.HTTPS),
            cors: api.Cors || "unknown",
            docsUrl: api.Link,
          },
          select: { id: true },
        });

        const version = await prisma.aPIVersion.create({
          data: {
            apiId: createdAPI.id,
            version: "1.0.0",
            openApiSpec: {
              openapi: "3.0.0",
              info: {
                title: api.API,
                description: api.Description || `API: ${api.API}`,
                version: "1.0.0",
              },
              servers: [{ url: api.Link, description: "API endpoint" }],
              paths: {
                "/": {
                  get: {
                    summary: "API Root",
                    responses: { "200": { description: "Success" } },
                  },
                },
              },
            },
            changelog: `Catalog import\nAuth: ${api.Auth || "None"}\nHTTPS: ${api.HTTPS}\nCORS: ${api.Cors || "Unknown"}`,
          },
          select: { id: true },
        });

        await prisma.endpoint.create({
          data: {
            versionId: version.id,
            method: "GET",
            path: "/",
            description: `Access ${api.API} API`,
          },
        });

        imported++;
      } catch (error) {
        console.error(`Error importing API ${api.API}:`, error);
        errors++;
      }
    }

    console.log(
      `Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`
    );
    return { imported, skipped, errors };
  } catch (error) {
    console.error("Error in importPublicAPIs:", error);
    throw error;
  }
}
