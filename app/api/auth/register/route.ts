import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  checkAuthRateLimit,
  clientIp,
} from "@/lib/security/rate-limit";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection check failed:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Feature abuse: throttle mass account creation
    const ip = clientIp(request);
    const limit = await checkAuthRateLimit(`register:ip:${ip}`, 5, 60 * 60);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many signup attempts. Try again later." },
        { status: 429 }
      );
    }

    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      return NextResponse.json(
        {
          error: "Database connection failed",
          message:
            "Could not reach the database. Check DATABASE_URL in your environment (Neon pooled URL with sslmode=require).",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const validated = registerSchema.parse(body);
    const email = validated.email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validated.password, 10);

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create user first
      const user = await tx.user.create({
        data: {
          name: validated.name.trim(),
          email,
        },
      });

      // Then create account with credentials
      await tx.account.create({
        data: {
          userId: user.id,
          type: "credentials",
          provider: "credentials",
          providerAccountId: user.id,
          access_token: hashedPassword,
        },
      });

      return user;
    }, {
      timeout: 10000,
    });

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: result.id,
          email: result.email,
          name: result.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "Validation error", 
          details: error.issues.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    console.error("Registration error:", error);
    
    // Handle Prisma-specific errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; message: string };
      
      // Unique constraint violation
      if (prismaError.code === 'P2002') {
        const target = (prismaError as any).meta?.target;
        if (target && Array.isArray(target) && target.includes('email')) {
          return NextResponse.json(
            { error: "User with this email already exists" },
            { status: 400 }
          );
        }
        if (target && Array.isArray(target) && target.includes('providerAccountId')) {
          return NextResponse.json(
            { error: "Account already exists for this user" },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: "A record with this information already exists" },
          { status: 400 }
        );
      }
      
      // Database connection errors
      if (prismaError.code === 'P1001' || prismaError.code === 'P1000' || prismaError.code === 'P1002') {
        return NextResponse.json(
          { 
            error: "Database connection failed",
            message: "Could not reach the database. Verify DATABASE_URL on the host (Neon pooled + sslmode=require).",
            code: prismaError.code
          },
          { status: 503 }
        );
      }

      // Transaction timeout
      if (prismaError.code === 'P1008') {
        return NextResponse.json(
          { error: "Operation timed out. Please try again." },
          { status: 504 }
        );
      }
    }

    // Check for connection error in message
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    if (errorMessage.includes("fetch failed") || errorMessage.includes("Cannot fetch data")) {
      return NextResponse.json(
        { 
          error: "Database connection failed",
          message: "Could not reach the database. Verify DATABASE_URL on the host.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        error: "Failed to create user",
        message: errorMessage,
        ...(process.env.NODE_ENV === "development" && {
          details: error instanceof Error ? error.stack : String(error)
        })
      },
      { status: 500 }
    );
  }
}
