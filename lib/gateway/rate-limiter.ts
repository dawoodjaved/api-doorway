import redis, { isRedisReady } from "../redis";

export type Plan = "free" | "pro" | "enterprise";

const limits: Record<Plan, number> = {
  free: 100,
  pro: 10000,
  enterprise: Infinity,
};

export async function checkRateLimit(
  apiKey: string,
  plan: Plan
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const limit = limits[plan];
  const hour = Math.floor(Date.now() / (60 * 60 * 1000));
  const resetAt = (hour + 1) * 60 * 60 * 1000;

  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity, resetAt };
  }

  try {
    const key = `ratelimit:${apiKey}:${hour}`;
    const current = await redis.incr(key);
    await redis.expire(key, 3600);
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetAt,
    };
  } catch (error) {
    console.warn("[rate-limit] store error — failing closed for free/pro", error);
    if (plan === "enterprise") {
      return { allowed: true, remaining: Infinity, resetAt };
    }
    return { allowed: false, remaining: 0, resetAt };
  }
}

export async function getRateLimitStatus(
  apiKey: string,
  plan: Plan
): Promise<{ remaining: number; resetAt: number }> {
  const limit = limits[plan];
  const hour = Math.floor(Date.now() / (60 * 60 * 1000));
  const resetAt = (hour + 1) * 60 * 60 * 1000;

  try {
    const key = `ratelimit:${apiKey}:${hour}`;
    const current = parseInt((await redis.get(key)) || "0", 10);
    return { remaining: Math.max(0, limit - current), resetAt };
  } catch {
    return { remaining: limit === Infinity ? Infinity : limit, resetAt };
  }
}

export { isRedisReady };
