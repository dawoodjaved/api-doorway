import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { authOptions } from "@/lib/auth";
import { stripe, PLANS, isStripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getRequestAppUrl } from "@/lib/app-url";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured. Add a real STRIPE_SECRET_KEY to .env.local to enable upgrades.",
          code: "STRIPE_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { plan, apiId } = body;

    if (!plan || plan !== "pro") {
      return NextResponse.json(
        {
          error:
            plan === "enterprise"
              ? "Please contact sales for enterprise plans"
              : "Invalid plan. Use plan: \"pro\".",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email || undefined,
        metadata: { userId: session.user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: session.user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${PLANS.pro.name} Plan`,
            },
            recurring: { interval: "month" },
            unit_amount: PLANS.pro.price * 100,
          },
          quantity: 1,
        },
      ],
      success_url: `${getRequestAppUrl(request)}/dashboard/billing?success=true`,
      cancel_url: `${getRequestAppUrl(request)}/dashboard/billing?canceled=true`,
      metadata: {
        userId: session.user.id,
        plan,
        apiId: apiId || "",
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
