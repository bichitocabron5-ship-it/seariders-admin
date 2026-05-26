import { z } from "zod";
import { JetskiLicenseMode } from "@prisma/client";

import { buildPublicQuote } from "@/lib/public-api/pricing";
import {
  PublicApiError,
  getRequestId,
  publicApiErrorResponse,
  publicApiJson,
  requirePublicApiAuth,
} from "@/lib/public-api/http";

export const runtime = "nodejs";

const Body = z.object({
  serviceCode: z.string().trim().min(1),
  optionCode: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(20).default(1),
  pax: z.number().int().min(1).max(30).default(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  jetskiLicenseMode: z.nativeEnum(JetskiLicenseMode).optional(),
  customerCountry: z.string().trim().length(2).nullable().optional(),
  promoCode: z.string().trim().min(1).max(50).nullable().optional(),
});

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const auth = await requirePublicApiAuth(req);
    if (!auth.ok) {
      return publicApiErrorResponse({
        requestId,
        code: "UNAUTHORIZED",
        status: 401,
        message: "No autorizado.",
      });
    }

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return publicApiErrorResponse({
        requestId,
        code: "INVALID_INPUT",
        status: 400,
        message: "Body inválido.",
        details: parsed.error.flatten(),
      });
    }

    const quote = await buildPublicQuote(parsed.data);
    return publicApiJson({
      requestId,
      payload: {
        ok: true,
        ...quote,
      },
    });
  } catch (error: unknown) {
    if (error instanceof PublicApiError) {
      return publicApiErrorResponse({
        requestId,
        code: error.code,
        status: error.status,
        message: error.message,
        details: error.details,
      });
    }

    return publicApiErrorResponse({
      requestId,
      code: "INVALID_INPUT",
      status: 500,
      message: error instanceof Error ? error.message : "Error interno.",
    });
  }
}
