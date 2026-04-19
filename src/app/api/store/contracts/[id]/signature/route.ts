import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { saveContractSignature } from "@/lib/contracts/save-contract-signature";

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

const BodySchema = z.object({
  signerName: z.string().trim().min(2),
  imageDataUrl: z.string().trim().min(30),
  imageConsentAccepted: z.boolean().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireStoreOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const contractId = id;

  try {
    const body = BodySchema.parse(await req.json());
    const contract = await saveContractSignature({
      contractId,
      signerName: body.signerName,
      imageDataUrl: body.imageDataUrl,
      imageConsentAccepted: body.imageConsentAccepted,
    });

    return NextResponse.json({
      ok: true,
      contract,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
