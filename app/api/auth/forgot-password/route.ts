import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import { getRequestAppUrl } from "@/lib/app-url";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = schema.parse(body);
    const normalized = email.trim().toLowerCase();

    const generic = {
      message:
        "If an account exists for that email, a password reset link is ready.",
    };

    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (!user) {
      return NextResponse.json(generic);
    }

    const account = await prisma.account.findFirst({
      where: { userId: user.id, provider: "credentials" },
    });
    if (!account) {
      return NextResponse.json({
        ...generic,
        hint: "This account uses a social sign-in provider. Use Google or GitHub instead.",
      });
    }

    const token = randomBytes(32).toString("hex");
    const redis = getRedis();
    await redis.setex(
      `password-reset:${hashToken(token)}`,
      60 * 60,
      JSON.stringify({ userId: user.id, email: normalized })
    );

    const resetUrl = `${getRequestAppUrl(request)}/auth/reset-password?token=${token}`;

    // No email provider in MVP — surface the link in development / local.
    const exposeLink =
      process.env.NODE_ENV === "development" ||
      process.env.EXPOSE_RESET_LINKS === "true";

    return NextResponse.json({
      ...generic,
      ...(exposeLink ? { resetUrl } : {}),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Unable to process reset request" },
      { status: 500 }
    );
  }
}
