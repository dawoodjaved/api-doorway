import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json([]);
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        userId: true,
        apiId: true,
        plan: true,
        status: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        currentPeriodEnd: true,
        trialEnd: true,
        createdAt: true,
        updatedAt: true,
        api: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json([]);
  }
}

const createSchema = z.object({
  apiId: z.string().min(1),
  plan: z.enum(["free", "pro"]).default("free"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { apiId, plan } = createSchema.parse(body);

    if (plan === "pro") {
      return NextResponse.json(
        {
          error:
            "Pro is a platform plan. Use Billing → Upgrade, or subscribe to this API on the Free plan first.",
          code: "USE_BILLING_UPGRADE",
        },
        { status: 400 }
      );
    }

    const api = await prisma.aPI.findFirst({
      where: { id: apiId, isPublic: true, isApproved: true },
    });

    if (!api) {
      return NextResponse.json({ error: "API not found" }, { status: 404 });
    }

    const existing = await prisma.subscription.findUnique({
      where: {
        userId_apiId: {
          userId: session.user.id,
          apiId,
        },
      },
      include: {
        api: {
          select: { id: true, name: true, slug: true, logo: true, category: true },
        },
      },
    });

    if (existing) {
      if (existing.status === "active") {
        return NextResponse.json(existing);
      }
      const reactivated = await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          status: "active",
          plan: "free",
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
        include: {
          api: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo: true,
              category: true,
            },
          },
        },
      });
      return NextResponse.json(reactivated);
    }

    const subscription = await prisma.subscription.create({
      data: {
        userId: session.user.id,
        apiId,
        plan: "free",
        status: "active",
        stripeCustomerId: "local_free",
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      include: {
        api: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            category: true,
          },
        },
      },
    });

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    );
  }
}
