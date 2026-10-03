import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createReviewSchema = z.object({
  apiId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const apiId = searchParams.get("apiId");
    const userId = searchParams.get("userId");

    if (!apiId && !userId) {
      return NextResponse.json(
        { error: "apiId or userId is required" },
        { status: 400 }
      );
    }

    const where: { apiId?: string; userId?: string } = {};
    if (apiId) where.apiId = apiId;
    if (userId) where.userId = userId;

    const reviews = await prisma.review.findMany({
      where,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        apiId: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        api: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createReviewSchema.parse(body);

    // Check if user already reviewed this API
    const existing = await prisma.review.findUnique({
      where: {
        userId_apiId: {
          userId: session.user.id,
          apiId: validated.apiId,
        },
      },
    });

    if (existing) {
      // Update existing review
      const review = await prisma.review.update({
        where: { id: existing.id },
        data: {
          rating: validated.rating,
          comment: validated.comment || null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      return NextResponse.json(review);
    }

    // Create new review
    const review = await prisma.review.create({
      data: {
        userId: session.user.id,
        apiId: validated.apiId,
        rating: validated.rating,
        comment: validated.comment || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating review:", error);
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    );
  }
}
