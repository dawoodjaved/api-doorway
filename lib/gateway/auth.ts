import { prisma } from "../prisma";
import { hashApiKey } from "../api-keys";

export async function validateApiKey(
  apiKey: string
): Promise<{
  valid: boolean;
  keyId?: string;
  userId?: string;
  apiId?: string;
  plan?: string;
  scopes?: string[];
}> {
  const hashed = hashApiKey(apiKey);

  // Hashed lookup only — plaintext key storage is no longer accepted
  const key = await prisma.aPIKey.findUnique({
    where: { key: hashed },
    select: {
      id: true,
      userId: true,
      apiId: true,
      scopes: true,
      isActive: true,
      expiresAt: true,
    },
  });

  if (!key || !key.isActive) {
    return { valid: false };
  }

  if (key.expiresAt && key.expiresAt < new Date()) {
    return { valid: false };
  }

  // Do not block the request on last-used bookkeeping
  void prisma.aPIKey
    .update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  // Only the subscription for this API (not all active subs for the user)
  const subscription = await prisma.subscription.findUnique({
    where: {
      userId_apiId: {
        userId: key.userId,
        apiId: key.apiId,
      },
    },
    select: { plan: true, status: true },
  });
  const plan =
    subscription?.status === "active" ? subscription.plan || "free" : "free";

  return {
    valid: true,
    keyId: key.id,
    userId: key.userId,
    apiId: key.apiId,
    plan: plan as string,
    scopes: key.scopes,
  };
}

export function hasScope(
  scopes: string[] | undefined,
  method: string
): boolean {
  if (!scopes || scopes.length === 0) return true;
  if (scopes.includes("full") || scopes.includes("*")) return true;
  if (scopes.includes("read") && method === "GET") return true;
  if (scopes.includes("write") && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return true;
  }
  return false;
}
