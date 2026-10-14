import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

function isOAuthConfigured(id?: string, secret?: string) {
  if (!id?.trim() || !secret?.trim()) return false;
  const bad = (v: string) =>
    /placeholder|your_|xxx|changeme/i.test(v) || v.length < 8;
  return !bad(id) && !bad(secret);
}

export const authOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember me", type: "text" },
      },
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
          },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        const account = await prisma.account.findFirst({
          where: {
            userId: user.id,
            provider: "credentials",
          },
          select: { access_token: true },
        });

        if (!account?.access_token) {
          throw new Error("Please sign up first");
        }

        const isValid = await bcrypt.compare(password, account.access_token);

        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        const remember =
          credentials.remember === true ||
          credentials.remember === "true" ||
          credentials.remember === "on" ||
          credentials.remember === "1";

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          rememberMe: remember,
        };
      },
    }),
    ...(isOAuthConfigured(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            // Prevent takeover via pre-registering a victim email then linking OAuth
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
    ...(isOAuthConfigured(
      process.env.GITHUB_CLIENT_ID,
      process.env.GITHUB_CLIENT_SECRET
    )
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      try {
        if (user) {
          token.id = user.id;
          token.role = user.role ?? "user";
          token.email = user.email;
          const maxAge =
            user.rememberMe === false ? 12 * 60 * 60 : 30 * 24 * 60 * 60;
          token.exp = Math.floor(Date.now() / 1000) + maxAge;
          token.roleCheckedAt = Date.now();
        }

        // Refresh role so demoted admins lose access without waiting for JWT expiry
        const shouldRefreshRole =
          Boolean(token.id) &&
          (!token.role ||
            !token.roleCheckedAt ||
            Date.now() - Number(token.roleCheckedAt) > 5 * 60 * 1000);

        if (shouldRefreshRole && token.id) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { id: true, role: true },
            });
            if (dbUser) {
              token.id = dbUser.id;
              token.role = dbUser.role;
              token.roleCheckedAt = Date.now();
            }
          } catch (e) {
            if (process.env.NODE_ENV === "development") {
              console.error("JWT callback DB error:", e);
            }
          }
        } else if (token.email && !token.role) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: token.email as string },
              select: { id: true, role: true },
            });
            if (dbUser) {
              token.id = dbUser.id;
              token.role = dbUser.role;
              token.roleCheckedAt = Date.now();
            }
          } catch (e) {
            if (process.env.NODE_ENV === "development") {
              console.error("JWT callback DB error:", e);
            }
          }
        }
        return token;
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("JWT callback error:", err);
        }
        return token;
      }
    },
    async session({ session, token }: any) {
      try {
        if (!session?.user || !token) {
          return session ?? null;
        }
        const userId = (token.id ?? token.sub ?? "") as string;
        const role = (token.role as string) || "user";
        session.user.id = userId || "";
        session.user.role = role;

        // Trust JWT when already enriched — avoids a DB hit on every request
        const email = session.user.email;
        if (email && typeof email === "string" && (!userId || !token.role)) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email },
              select: { id: true, role: true, name: true, image: true },
            });
            if (dbUser) {
              session.user.id = dbUser.id;
              session.user.role = dbUser.role;
              session.user.name = dbUser.name ?? session.user.name ?? null;
              session.user.image = dbUser.image ?? session.user.image ?? null;
            }
          } catch (dbError) {
            if (process.env.NODE_ENV === "development") {
              console.error("Error fetching user in session callback:", dbError);
            }
          }
        }
        return session;
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("Session callback error:", err);
        }
        return session ?? null;
      }
    },
    async signIn({ user, account }: any) {
      try {
        if (account?.provider === "credentials") return true;
        if (user?.email) return true;
        return false;
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("SignIn callback error:", error);
        }
        return false;
      }
    },
    async redirect({ url, baseUrl }: any) {
      // Relative paths stay on the current deployment host.
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const dest = new URL(url);
        if (dest.origin === new URL(baseUrl).origin) return url;

        // Allow known deploy origins so a stale NEXTAUTH_URL cannot trap redirects.
        const allowed = [
          process.env.NEXT_PUBLIC_APP_URL,
          process.env.AUTH_URL,
          process.env.NEXTAUTH_URL,
          process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : undefined,
          process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : undefined,
        ]
          .filter(Boolean)
          .map((u) => {
            try {
              return new URL(String(u)).origin;
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        if (allowed.includes(dest.origin)) return url;
      } catch {
        /* fall through */
      }
      return baseUrl;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: (() => {
    const secret =
      process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
    if (!secret || secret.length < 16) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "AUTH_SECRET or NEXTAUTH_SECRET must be set to a strong value in production"
        );
      }
      console.warn(
        "[auth] AUTH_SECRET/NEXTAUTH_SECRET missing — set a strong secret before deploying"
      );
      return `dev-only-${process.env.USER || "local"}-not-for-production`;
    }
    return secret;
  })(),
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions as any);
