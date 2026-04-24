import { canViewAdmin, getCurrentUser } from "../../../../../lib/auth";
import { toCsv, csvResponse } from "../../../../../lib/csv";
import { db } from "../../../../../lib/db";
import { getAccessibleLocationIds } from "../../../../../lib/permissions";

export const dynamic = "force-dynamic";

function scopedWhere(user, field = "locationId") {
  const ids = getAccessibleLocationIds(user);

  if (ids === null) {
    return {};
  }

  return {
    [field]: {
      in: ids
    }
  };
}

export async function GET(request, { params }) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  if (!canViewAdmin(user)) {
    return Response.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const resolvedParams = await params;
  const kind = String(resolvedParams?.kind || "");

  if (kind === "reservations") {
    const rows = await db.reservation.findMany({
      where: {
        ...scopedWhere(user),
        archivedAt: null
      },
      include: {
        location: true
      },
      orderBy: {
        dateTime: "desc"
      },
      take: 5000
    });

    return csvResponse(
      "prenotazioni.csv",
      toCsv(rows, [
        { label: "ID", value: "id" },
        { label: "Cliente", value: "guestName" },
        { label: "Email", value: "guestEmail" },
        { label: "Telefono", value: "guestPhone" },
        { label: "Sede", value: (row) => row.location?.name || "" },
        { label: "DataOra", value: (row) => row.dateTime.toISOString() },
        { label: "Coperti", value: "guests" },
        { label: "Stato", value: "status" },
        { label: "Spesa", value: (row) => Number(row.spendAmount || 0) }
      ])
    );
  }

  if (kind === "customers") {
    const rows = await db.customerProfile.findMany({
      where: {
        archivedAt: null,
        OR: [
          {
            reservations: {
              some: scopedWhere(user)
            }
          },
          {
            waitlistEntries: {
              some: scopedWhere(user)
            }
          }
        ]
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 5000
    });

    return csvResponse(
      "clienti.csv",
      toCsv(rows, [
        { label: "ID", value: "id" },
        { label: "Nome", value: "displayName" },
        { label: "Email", value: "normalizedEmail" },
        { label: "Telefono", value: "normalizedPhone" },
        { label: "VIP", value: (row) => (row.vip ? "SI" : "NO") },
        { label: "Fascia", value: "band" },
        { label: "Priority", value: "priorityScore" },
        { label: "Completate", value: "completedReservations" },
        { label: "NoShow", value: "noShowCount" },
        { label: "TotaleSpesa", value: (row) => Number(row.totalSpend || 0) }
      ])
    );
  }

  if (kind === "audit") {
    const rows = await db.auditLog.findMany({
      where: scopedWhere(user),
      include: {
        user: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5000
    });

    return csvResponse(
      "audit-log.csv",
      toCsv(rows, [
        { label: "Quando", value: (row) => row.createdAt.toISOString() },
        { label: "Azione", value: "action" },
        { label: "Entita", value: "entityType" },
        { label: "EntityId", value: "entityId" },
        { label: "Utente", value: (row) => row.user?.name || "Sistema" },
        { label: "Summary", value: "summary" }
      ])
    );
  }

  if (kind === "notifications") {
    const rows = await db.notificationLog.findMany({
      where: scopedWhere(user),
      orderBy: {
        createdAt: "desc"
      },
      take: 5000
    });

    return csvResponse(
      "notifiche.csv",
      toCsv(rows, [
        { label: "Quando", value: (row) => row.createdAt.toISOString() },
        { label: "Canale", value: "channel" },
        { label: "Evento", value: "event" },
        { label: "Stato", value: "status" },
        { label: "Destinazione", value: "destination" },
        { label: "Errore", value: "errorMessage" }
      ])
    );
  }

  if (kind === "payments") {
    const rows = await db.paymentRequest.findMany({
      where: scopedWhere(user),
      include: {
        reservation: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5000
    });

    return csvResponse(
      "pagamenti.csv",
      toCsv(rows, [
        { label: "ID", value: "id" },
        { label: "Reference", value: "externalReference" },
        { label: "Prenotazione", value: (row) => row.reservation?.guestName || "" },
        { label: "Importo", value: (row) => Number(row.amount || 0) },
        { label: "Valuta", value: "currency" },
        { label: "Stato", value: "status" },
        { label: "PagatoIl", value: (row) => (row.paidAt ? row.paidAt.toISOString() : "") }
      ])
    );
  }

  return Response.json({ error: "Export non supportato" }, { status: 404 });
}
