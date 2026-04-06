import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createContractSignatureToken } from "@/lib/contracts/signature-link";

export const runtime = "nodejs";

function resolvePublicBaseUrl(req: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const requestUrl = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    const protocol = (forwardedProto || requestUrl.protocol.replace(":", "")).replace(/:$/, "");
    return `${protocol}://${forwardedHost}`.replace(/\/+$/, "");
  }

  return requestUrl.origin.replace(/\/+$/, "");
}

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  const contract = await prisma.reservationContract.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!contract) return new NextResponse("Contrato no encontrado", { status: 404 });

  const token = createContractSignatureToken({ contractId: contract.id, expiresInMinutes: 45 });
  const baseUrl = resolvePublicBaseUrl(req);

  return NextResponse.json({
    ok: true,
    url: `${baseUrl}/sign/contracts/${encodeURIComponent(token)}`,
    expiresInMinutes: 45,
  });
}
