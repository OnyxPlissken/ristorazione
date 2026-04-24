import { getCurrentUser } from "../../../../../lib/auth";
import { createAuditLog } from "../../../../../lib/audit";
import { db } from "../../../../../lib/db";
import { canAccessPage, canAccessLocation } from "../../../../../lib/permissions";
import {
  cancelQueuedReservationNotifications,
  scheduleReservationReminderNotifications,
  sendReservationStatusSmsNotification,
  sendWaitlistConversionNotification
} from "../../../../../lib/notifications";
import { ensureReservationPaymentRequest } from "../../../../../lib/payments";
import { buildCustomerSnapshot, syncCustomerProfileMetrics } from "../../../../../lib/customer-profiles";
import { convertOpenWaitlistEntries, findAssignableTables } from "../../../../../lib/reservations";

export const dynamic = "force-dynamic";

async function convertWaitlist(locationId, exactDateTime) {
  const converted = await convertOpenWaitlistEntries({
    locationId,
    exactDateTime
  });

  for (const item of converted) {
    await sendWaitlistConversionNotification(item.reservation, item.location, item.entry.id);
  }
}

export async function POST(request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  if (!canAccessPage(user, "reservations", "manage")) {
    return Response.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json().catch(() => ({}));
  const reservationIds = Array.isArray(payload?.reservationIds)
    ? payload.reservationIds.map((value) => String(value))
    : [];
  const action = String(payload?.action || "");

  if (!reservationIds.length || !action) {
    return Response.json({ error: "Dati bulk non validi" }, { status: 400 });
  }

  const reservations = await db.reservation.findMany({
    where: {
      id: {
        in: reservationIds
      },
      archivedAt: null
    },
    include: {
      location: {
        include: {
          settings: true,
          technicalSettings: true
        }
      }
    }
  });

  let updated = 0;

  for (const reservation of reservations) {
    if (!canAccessLocation(user, reservation.locationId)) {
      continue;
    }

    let nextStatus = reservation.status;
    let tableId = reservation.tableId;
    let tableIds = reservation.tableIds || [];
    let archivedAt = null;
    let archiveReason = null;

    if (action === "ARCHIVE") {
      archivedAt = new Date();
      archiveReason = "Archiviata da bulk actions";
    } else if (action === "CONFIRM") {
      const assignment = await findAssignableTables(
        reservation.locationId,
        reservation.guests,
        reservation.dateTime,
        reservation.location.settings?.durationMinutes || 120,
        reservation.id
      );

      nextStatus = assignment ? "CONFERMATA" : "IN_ATTESA";
      tableId = assignment?.primaryTable?.id || null;
      tableIds = assignment?.tableIds || [];
    } else if (action === "COMPLETE") {
      nextStatus = "COMPLETATA";
      tableId = null;
      tableIds = [];
    } else if (action === "CANCEL") {
      nextStatus = "CANCELLATA";
      tableId = null;
      tableIds = [];
    } else if (action === "NO_SHOW") {
      nextStatus = "NO_SHOW";
      tableId = null;
      tableIds = [];
    }

    let customerSnapshot = {
      band: reservation.customerBand,
      priorityScore: reservation.customerPriorityScore,
      depositRequired: reservation.depositRequired,
      depositAmount: reservation.depositAmount
    };

    if (reservation.customerProfileId) {
      const profile = await syncCustomerProfileMetrics(reservation.customerProfileId);
      customerSnapshot = buildCustomerSnapshot(
        profile,
        reservation.location.technicalSettings || {}
      );
    }

    const nextReservation = await db.reservation.update({
      where: {
        id: reservation.id
      },
      data: {
        status: nextStatus,
        tableId,
        tableIds,
        archivedAt,
        archiveReason,
        customerBand: customerSnapshot.band,
        customerPriorityScore: customerSnapshot.priorityScore,
        depositRequired: customerSnapshot.depositRequired,
        depositAmount: customerSnapshot.depositAmount
      },
      include: {
        location: {
          include: {
            technicalSettings: true,
            settings: true
          }
        }
      }
    });

    await createAuditLog({
      userId: user.id,
      locationId: reservation.locationId,
      reservationId: reservation.id,
      entityType: "reservation",
      entityId: reservation.id,
      action: `BULK_${action}`,
      summary: `Bulk action ${action} su ${reservation.guestName}`,
      metadata: {
        previousStatus: reservation.status,
        nextStatus
      }
    });

    if (action === "ARCHIVE" || ["CANCEL", "COMPLETE", "NO_SHOW"].includes(action)) {
      await cancelQueuedReservationNotifications(reservation.id, null);
      await convertWaitlist(reservation.locationId, reservation.dateTime);
    }

    if (action === "CONFIRM") {
      const paymentRequest = await ensureReservationPaymentRequest(
        {
          ...nextReservation,
          depositRequired: customerSnapshot.depositRequired,
          depositAmount: customerSnapshot.depositAmount
        },
        nextReservation.location
      );

      await scheduleReservationReminderNotifications(
        {
          ...nextReservation,
          paymentRequests: paymentRequest ? [paymentRequest] : []
        },
        nextReservation.location,
        reservation.customerProfileId
          ? await db.customerProfile.findUnique({
              where: {
                id: reservation.customerProfileId
              }
            })
          : null
      );
    }

    if (reservation.status !== nextStatus && action !== "ARCHIVE") {
      await sendReservationStatusSmsNotification(nextReservation, nextReservation.location);
    }

    updated += 1;
  }

  return Response.json({
    ok: true,
    updated
  });
}
