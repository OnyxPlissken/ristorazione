import { getCurrentUser } from "../../../../../lib/auth";
import { createAuditLog } from "../../../../../lib/audit";
import { db } from "../../../../../lib/db";
import { canAccessPage } from "../../../../../lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  if (!canAccessPage(user, "reservations", "manage")) {
    return Response.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json().catch(() => ({}));
  const customerIds = Array.isArray(payload?.customerIds)
    ? payload.customerIds.map((value) => String(value))
    : [];
  const action = String(payload?.action || "");

  if (!customerIds.length || !action) {
    return Response.json({ error: "Dati bulk non validi" }, { status: 400 });
  }

  const updates = [];

  if (action === "MARK_VIP") {
    updates.push(
      db.customerProfile.updateMany({
        where: {
          id: {
            in: customerIds
          }
        },
        data: {
          vip: true,
          archivedAt: null,
          archiveReason: null
        }
      })
    );
  } else if (action === "UNMARK_VIP") {
    updates.push(
      db.customerProfile.updateMany({
        where: {
          id: {
            in: customerIds
          }
        },
        data: {
          vip: false
        }
      })
    );
  } else if (action === "ARCHIVE") {
    updates.push(
      db.customerProfile.updateMany({
        where: {
          id: {
            in: customerIds
          }
        },
        data: {
          archivedAt: new Date(),
          archiveReason: "Archiviato da bulk actions CRM"
        }
      })
    );
  } else if (action === "RESTORE") {
    updates.push(
      db.customerProfile.updateMany({
        where: {
          id: {
            in: customerIds
          }
        },
        data: {
          archivedAt: null,
          archiveReason: null
        }
      })
    );
  } else {
    return Response.json({ error: "Azione bulk non supportata" }, { status: 400 });
  }

  const [result] = await db.$transaction(updates);

  await createAuditLog({
    userId: user.id,
    entityType: "customer_profile",
    entityId: customerIds.join(","),
    action: `CRM_${action}`,
    summary: `Bulk action CRM ${action} su ${customerIds.length} profili`,
    metadata: {
      customerIds
    }
  });

  return Response.json({
    ok: true,
    updated: result.count
  });
}
