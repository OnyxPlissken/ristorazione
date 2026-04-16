import { db } from "./db";

export async function createAuditLog({
  locationId = null,
  reservationId = null,
  userId = null,
  entityType,
  entityId,
  action,
  summary,
  metadata = null
}) {
  if (!entityType || !entityId || !action || !summary) {
    return null;
  }

  return db.auditLog.create({
    data: {
      locationId,
      reservationId,
      userId,
      entityType,
      entityId,
      action,
      summary,
      metadata
    }
  });
}
