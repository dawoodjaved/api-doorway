import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";
import { authOptions } from "@/lib/auth";

type ApiVisibility = {
  id: string;
  userId: string;
  isPublic: boolean;
  isApproved: boolean;
};

/** Public+approved listings are open; private/unapproved need owner or admin. */
export async function canViewApi(api: ApiVisibility): Promise<boolean> {
  if (api.isPublic && api.isApproved) return true;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  if (api.userId === session.user.id) return true;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "admin";
}

export async function requireApiViewAccess(
  apiIdOrSlug: string
): Promise<
  | { ok: true; api: ApiVisibility }
  | { ok: false; status: 404 | 403 }
> {
  const api = await prisma.aPI.findFirst({
    where: {
      OR: [{ id: apiIdOrSlug }, { slug: apiIdOrSlug }],
    },
    select: {
      id: true,
      userId: true,
      isPublic: true,
      isApproved: true,
    },
  });

  if (!api) return { ok: false, status: 404 };
  if (!(await canViewApi(api))) return { ok: false, status: 403 };
  return { ok: true, api };
}
