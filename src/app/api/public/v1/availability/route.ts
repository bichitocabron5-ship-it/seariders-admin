import { z } from "zod";

import { buildPublicAvailability } from "@/lib/public-api/availability";
import {
  PublicApiError,
  getRequestId,
  publicApiErrorResponse,
  publicApiJson,
  requirePublicApiAuth,
} from "@/lib/public-api/http";

export const runtime = "nodejs";

const Query = z.object({
  serviceCode: z.string().trim().min(1),
  optionCode: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const parsed = Query.safeParse({
      serviceCode: url.searchParams.get("serviceCode"),
      optionCode: url.searchParams.get("optionCode"),
      date: url.searchParams.get("date"),
      quantity: url.searchParams.get("quantity") ?? "1",
      time: url.searchParams.get("time") ?? undefined,
    });

    if (!parsed.success) {
      return publicApiErrorResponse({
        requestId,
        code: "INVALID_INPUT",
        status: 400,
        message: "Query inválida.",
        details: parsed.error.flatten(),
      });
    }

    const availability = await buildPublicAvailability(parsed.data);
    return publicApiJson({
      requestId,
      payload: {
        ok: true,
        ...availability,
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
