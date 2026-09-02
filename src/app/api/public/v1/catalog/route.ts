import { buildPublicCatalogSnapshot } from "@/lib/public-api/catalog";
import {
  PublicApiError,
  getRequestId,
  publicApiErrorResponse,
  publicApiJson,
  requirePublicApiAuth,
} from "@/lib/public-api/http";

export const runtime = "nodejs";
export const revalidate = 0;

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

    const snapshot = await buildPublicCatalogSnapshot();
    return publicApiJson({
      requestId,
      payload: {
        ok: true,
        auth: {
          enforced: auth.enforced,
          clientId: auth.clientId,
        },
        ...snapshot,
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
