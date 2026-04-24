import { randomBytes } from "node:crypto";
import { db } from "./db";
import { getAppBaseUrl } from "./app-url";
import { createAuditLog } from "./audit";
import { createAdminNotification } from "./admin-notifications";

function buildHostedPaymentUrl(token) {
  return `${getAppBaseUrl()}/pagamento/${token}`;
}

function buildWebhookUrl() {
  return `${getAppBaseUrl()}/api/public/payments/webhook`;
}

function appendQuery(baseUrl, params) {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

export function buildPaymentCheckoutUrl(technicalSettings, paymentRequest, reservation) {
  const hostedUrl = buildHostedPaymentUrl(paymentRequest.token);

  if (!technicalSettings?.paymentCheckoutBaseUrl) {
    return hostedUrl;
  }

  return appendQuery(technicalSettings.paymentCheckoutBaseUrl, {
    reference: paymentRequest.externalReference,
    token: paymentRequest.token,
    amount: Number(paymentRequest.amount || 0).toFixed(2),
    currency: paymentRequest.currency,
    reservationId: reservation?.id,
    returnUrl: hostedUrl,
    webhookUrl: buildWebhookUrl()
  });
}

export async function ensureReservationPaymentRequest(reservation, location) {
  const technicalSettings = location?.technicalSettings || {};
  const amount = Number(reservation?.depositAmount || 0);

  if (
    !reservation?.id ||
    !location?.id ||
    !technicalSettings.paymentsEnabled ||
    !reservation.depositRequired ||
    amount <= 0
  ) {
    return null;
  }

  const existing = await db.paymentRequest.findFirst({
    where: {
      reservationId: reservation.id,
      status: "PENDING"
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (existing) {
    const checkoutUrl = buildPaymentCheckoutUrl(technicalSettings, existing, reservation);

    if (existing.checkoutUrl !== checkoutUrl) {
      return db.paymentRequest.update({
        where: {
          id: existing.id
        },
        data: {
          checkoutUrl
        }
      });
    }

    return existing;
  }

  const paymentRequest = await db.paymentRequest.create({
    data: {
      locationId: location.id,
      reservationId: reservation.id,
      customerProfileId: reservation.customerProfileId || null,
      provider: technicalSettings.paymentProvider || "CUSTOM",
      externalReference: `dep_${reservation.id}_${randomBytes(4).toString("hex")}`,
      amount,
      currency: "EUR",
      expiresAt: new Date(new Date(reservation.dateTime).getTime() - 60 * 60 * 1000)
    }
  });

  return db.paymentRequest.update({
    where: {
      id: paymentRequest.id
    },
    data: {
      checkoutUrl: buildPaymentCheckoutUrl(technicalSettings, paymentRequest, reservation)
    }
  });
}

export async function getPaymentRequestByToken(token) {
  if (!token) {
    return null;
  }

  return db.paymentRequest.findUnique({
    where: {
      token
    },
    include: {
      location: {
        include: {
          technicalSettings: true
        }
      },
      reservation: true,
      customerProfile: true
    }
  });
}

export async function markPaymentRequestStatus({
  token = null,
  externalReference = null,
  status,
  payload = null
}) {
  const paymentRequest = token
    ? await db.paymentRequest.findUnique({
        where: {
          token
        },
        include: {
          reservation: true,
          location: {
            include: {
              technicalSettings: true
            }
          }
        }
      })
    : externalReference
      ? await db.paymentRequest.findFirst({
          where: {
            externalReference
          },
          include: {
            reservation: true,
            location: {
              include: {
                technicalSettings: true
              }
            }
          }
        })
      : null;

  if (!paymentRequest) {
    return null;
  }

  const nextStatus = status || "PAID";
  const paidAt = nextStatus === "PAID" ? new Date() : null;

  const updated = await db.paymentRequest.update({
    where: {
      id: paymentRequest.id
    },
    data: {
      status: nextStatus,
      paidAt,
      rawPayload: payload || undefined
    },
    include: {
      reservation: true,
      location: {
        include: {
          technicalSettings: true
        }
      }
    }
  });

  await createAuditLog({
    locationId: updated.locationId,
    reservationId: updated.reservationId,
    entityType: "payment_request",
    entityId: updated.id,
    action: `PAYMENT_${nextStatus}`,
    summary: `Pagamento deposito ${nextStatus.toLowerCase()}`,
    metadata: {
      externalReference: updated.externalReference,
      amount: Number(updated.amount || 0)
    }
  });

  await createAdminNotification({
    locationId: updated.locationId,
    reservationId: updated.reservationId,
    type: `PAYMENT_${nextStatus}`,
    title: nextStatus === "PAID" ? "Deposito pagato" : "Pagamento aggiornato",
    body:
      nextStatus === "PAID"
        ? `${updated.reservation?.guestName || "Cliente"} ha completato il deposito.`
        : `Stato pagamento aggiornato a ${nextStatus}.`,
    href: updated.reservationId
      ? `/admin/prenotazioni?reservationId=${updated.reservationId}`
      : "/admin/registro"
  });

  return updated;
}

export async function expireStalePaymentRequests(limit = 100) {
  const now = new Date();
  const expired = await db.paymentRequest.findMany({
    where: {
      status: "PENDING",
      expiresAt: {
        lte: now
      }
    },
    take: limit
  });

  if (expired.length === 0) {
    return 0;
  }

  await db.paymentRequest.updateMany({
    where: {
      id: {
        in: expired.map((item) => item.id)
      }
    },
    data: {
      status: "EXPIRED"
    }
  });

  return expired.length;
}
