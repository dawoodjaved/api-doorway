import { getRedis } from "@/lib/redis";

/** Counter rate limit for abuse paths (signup mass-creation, etc.). */
export async function checkAuthRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const resetAt = Date.now() + windowSeconds * 1000;
  try {
    const redis = getRedis();
    const key = `auth-rl:${bucket}`;
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, windowSeconds);
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetAt,
    };
  } catch {
    return { allowed: false, remaining: 0, resetAt };
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
