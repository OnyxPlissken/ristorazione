import { db } from "../../../../lib/db";
import { ingestPosTransaction } from "../../../../lib/pos";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const locationId = String(payload?.locationId || "");
  const externalId = String(payload?.externalId || "");
  const totalAmount = Number(payload?.totalAmount || 0);
  const occurredAt = payload?.occurredAt ? new Date(payload.occurredAt) : new Date();

  if (!locationId || !externalId || Number.isNaN(totalAmount) || totalAmount <= 0) {
    return Response.json({ error: "Payload POS non valido" }, { status: 400 });
  }

  const location = await db.location.findUnique({
    where: {
      id: locationId
    },
    include: {
      technicalSettings: true
    }
  });

  if (!location || !location.technicalSettings?.posEnabled) {
    return Response.json({ error: "Integrazione POS non attiva" }, { status: 403 });
  }

  const providedSecret =
    request.headers.get("x-coperto-pos-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    String(payload?.secret || "");

  if (
    location.technicalSettings.posWebhookSecret &&
    location.technicalSettings.posWebhookSecret !== providedSecret
  ) {
    return Response.json({ error: "Secret POS non valido" }, { status: 401 });
  }

  const transaction = await ingestPosTransaction({
    locationId,
    externalId,
    provider: payload?.provider || location.technicalSettings.posProvider || "CUSTOM",
    totalAmount,
    guests: payload?.guests ? Number(payload.guests) : null,
    occurredAt,
    reservationId: payload?.reservationId || null,
    guestName: payload?.guestName || "",
    guestEmail: payload?.guestEmail || "",
    guestPhone: payload?.guestPhone || "",
    payload,
    source: "WEBHOOK"
  });

  return Response.json({
    ok: true,
    transactionId: transaction.id
  });
}
