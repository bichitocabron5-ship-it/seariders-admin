import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { getSignedPrivateFileUrl } from "@/lib/s3";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireStoreOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const contract = await prisma.reservationContract.findUnique({
    where: { id },
    select: {
      id: true,
      minorAuthorizationFileKey: true,
    },
  });

  if (!contract?.minorAuthorizationFileKey) {
    return new NextResponse("Autorización no encontrada", { status: 404 });
  }

  const url = await getSignedPrivateFileUrl(
    contract.minorAuthorizationFileKey,
    300
  );

  return NextResponse.json({
    ok: true,
    url,
  });
}
