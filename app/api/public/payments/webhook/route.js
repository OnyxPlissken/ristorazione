import { db } from "../../../../../lib/db";
import { markPaymentRequestStatus } from "../../../../../lib/payments";

export const dynamic = "force-dynamic";

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();

  if (["PAID", "SUCCESS", "SUCCEEDED", "COMPLETED"].includes(normalized)) {
    return "PAID";
  }

  if (["FAILED", "ERROR", "DECLINED"].includes(normalized)) {
    return "FAILED";
  }

  if (["CANCELLED", "CANCELED"].includes(normalized)) {
    return "CANCELLED";
  }

  return "";
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const token = String(payload?.token || "");
  const externalReference = String(payload?.reference || payload?.externalReference || "");
  const status = normalizeStatus(payload?.status);

  if (!token && !externalReference) {
    return Response.json({ error: "Token o reference mancanti" }, { status: 400 });
  }

  if (!status) {
    return Response.json({ error: "Stato pagamento non valido" }, { status: 400 });
  }

  const paymentRequest = token
    ? await db.paymentRequest.findUnique({
        where: {
          token
        },
        include: {
          location: {
            include: {
              technicalSettings: true
            }
          }
        }
      })
    : await db.paymentRequest.findFirst({
        where: {
          externalReference
        },
        include: {
          location: {
            include: {
              technicalSettings: true
            }
          }
        }
      });

  if (!paymentRequest) {
    return Response.json({ error: "Pagamento non trovato" }, { status: 404 });
  }

  const configuredSecret = paymentRequest.location?.technicalSettings?.paymentWebhookSecret || "";
  const providedSecret =
    request.headers.get("x-coperto-payment-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    String(payload?.secret || "");

  if (configuredSecret && configuredSecret !== providedSecret) {
    return Response.json({ error: "Webhook secret non valido" }, { status: 401 });
  }

  const updated = await markPaymentRequestStatus({
    token: paymentRequest.token,
    status,
    payload
  });

  return Response.json({
    ok: true,
    paymentRequestId: updated?.id || null,
    status: updated?.status || null
  });
}
