import { db } from "./db";
import { createAuditLog } from "./audit";
import { createAdminNotification } from "./admin-notifications";
import {
  ensureCustomerProfile,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  syncCustomerProfileMetrics
} from "./customer-profiles";

function buildReservationWindow(dateTime, minutes = 180) {
  const center = new Date(dateTime);
  return {
    start: new Date(center.getTime() - minutes * 60 * 1000),
    end: new Date(center.getTime() + minutes * 60 * 1000)
  };
}

async function resolveReservationMatch({
  locationId,
  reservationId,
  occurredAt,
  guestEmail,
  guestPhone
}) {
  if (reservationId) {
    return db.reservation.findFirst({
      where: {
        id: reservationId,
        locationId
      }
    });
  }

  const normalizedEmail = normalizeCustomerEmail(guestEmail);
  const normalizedPhone = normalizeCustomerPhone(guestPhone);
  const window = buildReservationWindow(occurredAt);

  return db.reservation.findFirst({
    where: {
      locationId,
      archivedAt: null,
      dateTime: {
        gte: window.start,
        lte: window.end
      },
      OR: [
        ...(normalizedEmail ? [{ guestEmail: normalizedEmail }] : []),
        ...(normalizedPhone ? [{ guestPhone: normalizedPhone }] : [])
      ]
    },
    orderBy: {
      dateTime: "desc"
    }
  });
}

export async function ingestPosTransaction({
  locationId,
  externalId,
  provider = "CUSTOM",
  totalAmount,
  guests = null,
  occurredAt,
  reservationId = null,
  guestName = "",
  guestEmail = "",
  guestPhone = "",
  payload = null,
  source = "WEBHOOK"
}) {
  const location = await db.location.findUnique({
    where: {
      id: locationId
    },
    include: {
      technicalSettings: true
    }
  });

  if (!location) {
    throw new Error("Sede non trovata.");
  }

  const reservation = await resolveReservationMatch({
    locationId,
    reservationId,
    occurredAt,
    guestEmail,
    guestPhone
  });
  const customerProfile =
    reservation?.customerProfileId
      ? await db.customerProfile.findUnique({
          where: {
            id: reservation.customerProfileId
          }
        })
      : await ensureCustomerProfile({
          guestName,
          guestEmail,
          guestPhone
        });

  const transaction = await db.posTransaction.upsert({
    where: {
      locationId_externalId: {
        locationId,
        externalId
      }
    },
    update: {
      provider,
      totalAmount,
      guests,
      occurredAt,
      reservationId: reservation?.id || null,
      customerProfileId: customerProfile?.id || null,
      payload,
      source
    },
    create: {
      locationId,
      externalId,
      provider,
      totalAmount,
      guests,
      occurredAt,
      reservationId: reservation?.id || null,
      customerProfileId: customerProfile?.id || null,
      payload,
      source
    }
  });

  if (reservation?.id) {
    await db.reservation.update({
      where: {
        id: reservation.id
      },
      data: {
        spendAmount: totalAmount
      }
    });

    await createAuditLog({
      locationId,
      reservationId: reservation.id,
      entityType: "pos_transaction",
      entityId: transaction.id,
      action: "POS_SYNCED",
      summary: `Transazione POS agganciata alla prenotazione ${reservation.guestName}`,
      metadata: {
        externalId,
        amount: Number(totalAmount)
      }
    });

    await createAdminNotification({
      locationId,
      reservationId: reservation.id,
      type: "POS_SYNCED",
      title: "Scontrino POS sincronizzato",
      body: `${reservation.guestName} aggiornato con spesa reale da POS.`,
      href: `/admin/prenotazioni?reservationId=${reservation.id}`
    });
  }

  if (customerProfile?.id) {
    await syncCustomerProfileMetrics(customerProfile.id);
  }

  return transaction;
}
