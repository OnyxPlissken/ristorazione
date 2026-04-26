"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { hashPassword, requireUser } from "../auth";
import { createAuditLog } from "../audit";
import { DEFAULT_OPENING_HOURS, DEFAULT_ROLE_PERMISSIONS } from "../constants";
import {
  buildCustomerSnapshot,
  syncCustomerProfileMetrics
} from "../customer-profiles";
import { toSlug } from "../format";
import { normalizeMediaUrlInput, resolveInlineImageDataUrl } from "../media";
import { assertLocationAccess, assertPageAccess } from "../permissions";
import {
  buildReservationAssignmentCandidates,
  convertOpenWaitlistEntries,
  findAssignableTables,
  findRequestedTableAssignment,
  parseDateInput
} from "../reservations";
import { getTableAssignmentPolicy } from "../table-assignment-policy";
import {
  cancelQueuedReservationNotifications,
  enqueuePaymentLinkNotification,
  scheduleReservationReminderNotifications,
  sendReservationStatusSmsNotification,
  sendWaitlistConversionNotification
} from "../notifications";
import { ensureReservationPaymentRequest } from "../payments";

function parseIds(values) {
  return values.filter(Boolean).map((value) => String(value));
}

function parseBoolean(value) {
  return value === "on" || value === "true";
}

function parsePrice(value) {
  const normalized = String(value || "0").replace(",", ".");
  return Number.parseFloat(normalized || "0");
}

function parseOptionalNumber(value) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function dateToIso(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function revalidateAdminSection(path) {
  revalidatePath(path);
  revalidatePath("/admin");
}

function buildReservationActionState(overrides = {}) {
  return {
    error: "",
    success: "",
    ...overrides
  };
}

async function notifyConvertedWaitlistEntries(locationId, exactDateTime = null) {
  const converted = await convertOpenWaitlistEntries({
    locationId,
    exactDateTime
  });

  for (const item of converted) {
    try {
      await sendWaitlistConversionNotification(
        item.reservation,
        item.location,
        item.entry.id
      );
    } catch (error) {
      console.error("Errore invio notifica waitlist", error);
    }
  }
}

function getMenuAssignedLocationIds(menu) {
  return [...new Set([menu.locationId, ...(menu.locationIds || [])].filter(Boolean))];
}

function ensureMultiLocationMenuAccess(actor, menu) {
  if (["ADMIN", "PROPRIETARIO"].includes(actor.role)) {
    return;
  }

  if (menu.appliesToAllLocations) {
    throw new Error("Solo amministratore o proprietario possono gestire menu validi per tutte le sedi");
  }

  for (const locationId of getMenuAssignedLocationIds(menu)) {
    assertLocationAccess(actor, locationId);
  }
}

async function resolveZoneInput(locationId, zoneId, newZoneName) {
  const cleanNewZoneName = String(newZoneName || "").trim();

  if (cleanNewZoneName) {
    const zone = await db.locationZone.upsert({
      where: {
        locationId_name: {
          locationId,
          name: cleanNewZoneName
        }
      },
      update: {},
      create: {
        locationId,
        name: cleanNewZoneName
      }
    });

    return {
      zoneId: zone.id,
      zoneName: zone.name
    };
  }

  if (zoneId) {
    const zone = await db.locationZone.findUnique({
      where: {
        id: zoneId
      }
    });

    if (zone && zone.locationId === locationId) {
      return {
        zoneId: zone.id,
        zoneName: zone.name
      };
    }
  }

  return {
    zoneId: null,
    zoneName: null
  };
}

async function syncTableCombinableRelationships(tableId, locationId, nextIds) {
  const currentTables = await db.diningTable.findMany({
    where: {
      locationId,
      OR: [
        { id: tableId },
        {
          combinableWithIds: {
            has: tableId
          }
        },
        {
          id: {
            in: nextIds
          }
        }
      ]
    }
  });

  const currentById = new Map(currentTables.map((table) => [table.id, table]));
  const selectedIds = [...new Set(nextIds.filter((id) => id && id !== tableId))].filter((id) =>
    currentById.has(id)
  );
  const currentSelectedIds = currentById.get(tableId)?.combinableWithIds || [];
  const deselectedIds = currentSelectedIds.filter((id) => !selectedIds.includes(id));

  await db.$transaction([
    db.diningTable.update({
      where: {
        id: tableId
      },
      data: {
        combinableWithIds: selectedIds
      }
    }),
    ...selectedIds
      .filter((id) => currentById.has(id))
      .map((id) => {
        const other = currentById.get(id);
        return db.diningTable.update({
          where: {
            id
          },
          data: {
            combinableWithIds: [...new Set([...(other.combinableWithIds || []), tableId])]
          }
        });
      }),
    ...deselectedIds
      .filter((id) => currentById.has(id))
      .map((id) => {
        const other = currentById.get(id);
        return db.diningTable.update({
          where: {
            id
          },
          data: {
            combinableWithIds: (other.combinableWithIds || []).filter(
              (candidateId) => candidateId !== tableId
            )
          }
        });
      })
  ]);
}

export async function saveUserAction(formData) {
  const actor = await requireUser();
  assertPageAccess(actor, "users", "manage");

  const userId = String(formData.get("userId") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "STAFF");
  const active = parseBoolean(formData.get("active"));
  const locationIds = parseIds(formData.getAll("locationIds"));

  if (!name || !email || !role || (!userId && !password)) {
    return;
  }

  for (const locationId of locationIds) {
    assertLocationAccess(actor, locationId);
  }

  if (userId) {
    await db.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        role,
        active,
        ...(password ? { passwordHash: hashPassword(password) } : {})
      }
    });

    await db.userLocation.deleteMany({
      where: { userId }
    });

    if (locationIds.length > 0) {
      await db.userLocation.createMany({
        data: locationIds.map((locationId) => ({ userId, locationId })),
        skipDuplicates: true
      });
    }

    await createAuditLog({
      userId: actor.id,
      entityType: "user",
      entityId: userId,
      action: "USER_UPDATED",
      summary: `Utente aggiornato: ${name}`,
      metadata: {
        role,
        active,
        locationIds
      }
    });
  } else {
    const created = await db.user.create({
      data: {
        name,
        email,
        role,
        active,
        passwordHash: hashPassword(password)
      }
    });

    if (locationIds.length > 0) {
      await db.userLocation.createMany({
        data: locationIds.map((locationId) => ({
          userId: created.id,
          locationId
        })),
        skipDuplicates: true
      });
    }

    await createAuditLog({
      userId: actor.id,
      entityType: "user",
      entityId: created.id,
      action: "USER_CREATED",
      summary: `Utente creato: ${name}`,
      metadata: {
        role,
        active,
        locationIds
      }
    });
  }

  revalidateAdminSection("/admin/utenti");
}

export async function saveLocationAction(formData) {
  const actor = await requireUser();
  assertPageAccess(actor, "locations", "manage");

  const locationId = String(formData.get("locationId") || "");
  const name = String(formData.get("name") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const reservationEnabled = parseBoolean(formData.get("reservationEnabled"));
  const slugInput = String(formData.get("slug") || "").trim();

  if (!name || !city || !address) {
    return;
  }

  const slug = toSlug(slugInput || name);

  if (locationId) {
    await db.location.update({
      where: { id: locationId },
      data: {
        name,
        slug,
        city,
        address,
        phone: phone || null,
        email: email || null,
        reservationEnabled
      }
    });

    await createAuditLog({
      userId: actor.id,
      locationId,
      entityType: "location",
      entityId: locationId,
      action: "LOCATION_UPDATED",
      summary: `Sede aggiornata: ${name}`,
      metadata: {
        city,
        reservationEnabled
      }
    });
  } else {
    const created = await db.location.create({
      data: {
        name,
        slug,
        city,
        address,
        phone: phone || null,
        email: email || null,
        reservationEnabled,
        settings: {
          create: {}
        },
        technicalSettings: {
          create: {
            displayName: name,
            reservationsEnabled: reservationEnabled
          }
        },
        openingHours: {
          create: DEFAULT_OPENING_HOURS
        }
      }
    });

    await db.userLocation.createMany({
      data: [
        {
          userId: actor.id,
          locationId: created.id
        }
      ],
        skipDuplicates: true
      });

    await createAuditLog({
      userId: actor.id,
      locationId: created.id,
      entityType: "location",
      entityId: created.id,
      action: "LOCATION_CREATED",
      summary: `Sede creata: ${name}`,
      metadata: {
        city,
        reservationEnabled
      }
    });
  }

  revalidateAdminSection("/admin/sedi");
  revalidatePath("/prenota");
}

export async function saveOpeningHoursAction(formData) {
  const actor = await requireUser();
  const locationId = String(formData.get("locationId") || "");
  assertPageAccess(actor, "hours", "manage");

  assertLocationAccess(actor, locationId);

  for (const weekday of [1, 2, 3, 4, 5, 6, 0]) {
    const opensAt = String(formData.get(`opensAt_${weekday}`) || "12:00");
    const closesAt = String(formData.get(`closesAt_${weekday}`) || "23:00");
    const isClosed = parseBoolean(formData.get(`isClosed_${weekday}`));

    await db.openingHour.upsert({
      where: {
        locationId_weekday: {
          locationId,
          weekday
        }
      },
      update: {
        opensAt,
        closesAt,
        isClosed
      },
      create: {
        locationId,
        weekday,
        opensAt,
        closesAt,
        isClosed
      }
    });
  }

  await createAuditLog({
    userId: actor.id,
    locationId,
    entityType: "opening_hours",
    entityId: locationId,
    action: "OPENING_HOURS_UPDATED",
    summary: "Orari settimanali aggiornati",
    metadata: {
      weekdays: [1, 2, 3, 4, 5, 6, 0]
    }
  });

  revalidateAdminSection("/admin/orari");
  revalidatePath("/prenota");
}

export async function saveOpeningExceptionAction(formData) {
  const actor = await requireUser();
  const locationId = String(formData.get("locationId") || "");
  const exceptionId = String(formData.get("exceptionId") || "");
  const date = String(formData.get("date") || "");
  assertPageAccess(actor, "hours", "manage");

  assertLocationAccess(actor, locationId);

  if (!locationId || !date) {
    return;
  }

  const parsedDate = parseDateInput(date);
  const opensAt = String(formData.get("opensAt") || "").trim() || null;
  const closesAt = String(formData.get("closesAt") || "").trim() || null;
  const isClosed = parseBoolean(formData.get("isClosed"));
  const note = String(formData.get("note") || "").trim() || null;

  if (exceptionId) {
    const existingException = await db.openingHourException.findUnique({
      where: {
        id: exceptionId
      }
    });

    if (!existingException || existingException.locationId !== locationId) {
      throw new Error("Eccezione orario non valida per questa sede");
    }

    await db.openingHourException.update({
      where: {
        id: exceptionId
      },
      data: {
        date: parsedDate,
        opensAt,
        closesAt,
        isClosed,
        note
      }
    });
  } else {
    await db.openingHourException.upsert({
      where: {
        locationId_date: {
          locationId,
          date: parsedDate
        }
      },
      update: {
        opensAt,
        closesAt,
        isClosed,
        note
      },
      create: {
        locationId,
        date: parsedDate,
        opensAt,
        closesAt,
        isClosed,
        note
      }
    });
  }

  await createAuditLog({
    userId: actor.id,
    locationId,
    entityType: "opening_exception",
    entityId: exceptionId || `${locationId}:${date}`,
    action: "OPENING_EXCEPTION_SAVED",
    summary: `Eccezione orario salvata per ${date}`,
    metadata: {
      isClosed,
      opensAt,
      closesAt,
      note
    }
  });

  revalidateAdminSection("/admin/orari");
  revalidatePath("/prenota");
}

export async function deleteOpeningExceptionAction(formData) {
  const actor = await requireUser();
  const exceptionId = String(formData.get("exceptionId") || "");
  assertPageAccess(actor, "hours", "manage");

  if (!exceptionId) {
    return;
  }

  const exception = await db.openingHourException.findUnique({
    where: {
      id: exceptionId
    }
  });

  if (!exception) {
    return;
  }

  assertLocationAccess(actor, exception.locationId);

  await db.openingHourException.delete({
    where: {
      id: exceptionId
    }
  });

  await createAuditLog({
    userId: actor.id,
    locationId: exception.locationId,
    entityType: "opening_exception",
    entityId: exceptionId,
    action: "OPENING_EXCEPTION_DELETED",
    summary: `Eccezione orario eliminata per ${dateToIso(exception.date)}`,
    metadata: null
  });

  revalidateAdminSection("/admin/orari");
  revalidatePath("/prenota");
}

export async function saveReservationSettingsAction(formData) {
  const actor = await requireUser();
  const locationId = String(formData.get("locationId") || "");
  assertPageAccess(actor, "hours", "manage");

  assertLocationAccess(actor, locationId);

  await db.reservationSetting.upsert({
    where: { locationId },
    update: {
      pageTitle: String(formData.get("pageTitle") || "").trim() || null,
      welcomeMessage:
        String(formData.get("welcomeMessage") || "").trim() || null,
      durationMinutes: Number(formData.get("durationMinutes") || 120),
      useTimeSlots: parseBoolean(formData.get("useTimeSlots")),
      slotIntervalMinutes: Number(formData.get("slotIntervalMinutes") || 30),
      leadTimeMinutes: Number(formData.get("leadTimeMinutes") || 60),
      minGuests: Number(formData.get("minGuests") || 1),
      maxGuests: Number(formData.get("maxGuests") || 8),
      requirePhone: parseBoolean(formData.get("requirePhone")),
      requireEmail: parseBoolean(formData.get("requireEmail"))
    },
    create: {
      locationId,
      pageTitle: String(formData.get("pageTitle") || "").trim() || null,
      welcomeMessage:
        String(formData.get("welcomeMessage") || "").trim() || null,
      durationMinutes: Number(formData.get("durationMinutes") || 120),
      useTimeSlots: parseBoolean(formData.get("useTimeSlots")),
      slotIntervalMinutes: Number(formData.get("slotIntervalMinutes") || 30),
      leadTimeMinutes: Number(formData.get("leadTimeMinutes") || 60),
      minGuests: Number(formData.get("minGuests") || 1),
      maxGuests: Number(formData.get("maxGuests") || 8),
      requirePhone: parseBoolean(formData.get("requirePhone")),
      requireEmail: parseBoolean(formData.get("requireEmail"))
    }
  });

  await createAuditLog({
    userId: actor.id,
    locationId,
    entityType: "reservation_settings",
    entityId: locationId,
    action: "RESERVATION_SETTINGS_UPDATED",
    summary: "Impostazioni prenotazione aggiornate",
    metadata: {
      durationMinutes: Number(formData.get("durationMinutes") || 120),
      useTimeSlots: parseBoolean(formData.get("useTimeSlots")),
      slotIntervalMinutes: Number(formData.get("slotIntervalMinutes") || 30)
    }
  });

  revalidateAdminSection("/admin/orari");
  revalidatePath("/prenota");
}

export async function saveTableAction(formData) {
  const actor = await requireUser();
  const tableId = String(formData.get("tableId") || "");
  const locationId = String(formData.get("locationId") || "");
  assertPageAccess(actor, "tables", "manage");

  assertLocationAccess(actor, locationId);

  const code = String(formData.get("code") || "").trim();
  const seats = Number(formData.get("seats") || 2);
  const active = parseBoolean(formData.get("active"));
  const selectedZoneId = String(formData.get("zoneId") || "").trim();
  const newZoneName = String(formData.get("newZoneName") || "").trim();
  const combinableWithIds = parseIds(formData.getAll("combinableWithIds"));

  if (!code || !locationId || seats < 1) {
    return;
  }

  const { zoneId, zoneName } = await resolveZoneInput(
    locationId,
    selectedZoneId,
    newZoneName
  );

  if (tableId) {
    await db.diningTable.update({
      where: { id: tableId },
      data: {
        code,
        seats,
        zoneId,
        zone: zoneName,
        active
      }
    });

    await syncTableCombinableRelationships(tableId, locationId, combinableWithIds);

    await createAuditLog({
      userId: actor.id,
      locationId,
      entityType: "table",
      entityId: tableId,
      action: "TABLE_UPDATED",
      summary: `Tavolo aggiornato: ${code}`,
      metadata: {
        seats,
        zoneId,
        combinableWithIds
      }
    });
  } else {
    const createdTable = await db.diningTable.create({
      data: {
        locationId,
        zoneId,
        code,
        seats,
        zone: zoneName,
        active
      }
    });

    await syncTableCombinableRelationships(createdTable.id, locationId, combinableWithIds);

    await createAuditLog({
      userId: actor.id,
      locationId,
      entityType: "table",
      entityId: createdTable.id,
      action: "TABLE_CREATED",
      summary: `Tavolo creato: ${code}`,
      metadata: {
        seats,
        zoneId,
        combinableWithIds
      }
    });
  }

  await notifyConvertedWaitlistEntries(locationId);
  revalidateAdminSection("/admin/tavoli");
  revalidatePath("/prenota");
}

export async function saveTableLayoutAction(formData) {
  const actor = await requireUser();
  const tableId = String(formData.get("tableId") || "");
  const locationId = String(formData.get("locationId") || "");
  assertPageAccess(actor, "tables", "manage");

  if (!tableId || !locationId) {
    return;
  }

  assertLocationAccess(actor, locationId);

  const existingTable = await db.diningTable.findUnique({
    where: {
      id: tableId
    }
  });

  if (!existingTable || existingTable.locationId !== locationId) {
    return;
  }

  const zoneId = String(formData.get("zoneId") || "").trim() || null;
  const zoneRecord = zoneId
    ? await db.locationZone.findUnique({
        where: {
          id: zoneId
        }
      })
    : null;

  if (zoneRecord && zoneRecord.locationId !== locationId) {
    throw new Error("Zona non valida per questa sede");
  }

  const zoneName = zoneRecord?.name || null;
  const layoutShape = String(formData.get("layoutShape") || "RECT");

  await db.diningTable.update({
    where: {
      id: tableId
    },
    data: {
      zoneId,
      zone: zoneName,
      layoutX: parseOptionalNumber(formData.get("layoutX")),
      layoutY: parseOptionalNumber(formData.get("layoutY")),
      layoutWidth: parseOptionalNumber(formData.get("layoutWidth")),
      layoutHeight: parseOptionalNumber(formData.get("layoutHeight")),
      layoutRotation: parseOptionalNumber(formData.get("layoutRotation")),
      layoutShape: layoutShape === "ROUND" ? "ROUND" : "RECT"
    }
  });

  await createAuditLog({
    userId: actor.id,
    locationId,
    entityType: "table_layout",
    entityId: tableId,
    action: "TABLE_LAYOUT_UPDATED",
    summary: `Planimetria aggiornata per tavolo ${existingTable.code}`,
    metadata: {
      zoneId,
      layoutShape
    }
  });

  revalidateAdminSection("/admin/tavoli");
  revalidatePath(`/admin/sala?locationId=${locationId}`);
  revalidatePath("/prenota");
}

export async function generateTablesAction(formData) {
  const actor = await requireUser();
  const locationId = String(formData.get("locationId") || "");
  assertPageAccess(actor, "tables", "manage");

  assertLocationAccess(actor, locationId);

  const prefix = String(formData.get("prefix") || "T").trim();
  const from = Number(formData.get("from") || 1);
  const to = Number(formData.get("to") || 1);
  const seats = Number(formData.get("seats") || 2);
  const selectedZoneId = String(formData.get("zoneId") || "").trim();
  const newZoneName = String(formData.get("newZoneName") || "").trim();

  if (to < from || from < 1) {
    return;
  }

  const { zoneId, zoneName } = await resolveZoneInput(
    locationId,
    selectedZoneId,
    newZoneName
  );

  const payload = [];

  for (let current = from; current <= to; current += 1) {
    payload.push({
      locationId,
      zoneId,
      code: `${prefix}${current}`,
      seats,
      zone: zoneName,
      active: true
    });
  }

  await db.diningTable.createMany({
    data: payload,
    skipDuplicates: true
  });

  await createAuditLog({
    userId: actor.id,
    locationId,
    entityType: "table_batch",
    entityId: `${locationId}:${prefix}${from}-${to}`,
    action: "TABLES_GENERATED",
    summary: `Generazione rapida tavoli ${prefix}${from}-${to}`,
    metadata: {
      seats,
      count: payload.length,
      zoneId
    }
  });

  await notifyConvertedWaitlistEntries(locationId);
  revalidateAdminSection("/admin/tavoli");
  revalidatePath("/prenota");
}

export async function saveLocationZoneAction(formData) {
  const actor = await requireUser();
  assertPageAccess(actor, "tables", "manage");

  const locationId = String(formData.get("locationId") || "");
  const zoneId = String(formData.get("zoneId") || "");
  const name = String(formData.get("name") || "").trim();
  const sortOrder = Number(formData.get("sortOrder") || 0);
  const active = parseBoolean(formData.get("active"));

  assertLocationAccess(actor, locationId);

  if (!locationId || !name) {
    return;
  }

  if (zoneId) {
    const existingZone = await db.locationZone.findUnique({
      where: {
        id: zoneId
      }
    });

    if (!existingZone || existingZone.locationId !== locationId) {
      throw new Error("Zona non valida per questa sede");
    }

    await db.locationZone.update({
      where: {
        id: zoneId
      },
      data: {
        name,
        sortOrder,
        active
      }
    });

    await db.diningTable.updateMany({
      where: {
        zoneId
      },
      data: {
        zone: name
      }
    });

    await createAuditLog({
      userId: actor.id,
      locationId,
      entityType: "zone",
      entityId: zoneId,
      action: "ZONE_UPDATED",
      summary: `Zona aggiornata: ${name}`,
      metadata: {
        sortOrder,
        active
      }
    });
  } else {
    const zone = await db.locationZone.upsert({
      where: {
        locationId_name: {
          locationId,
          name
        }
      },
      update: {
        sortOrder,
        active
      },
      create: {
        locationId,
        name,
        sortOrder,
        active
      }
    });

    await createAuditLog({
      userId: actor.id,
      locationId,
      entityType: "zone",
      entityId: zone.id,
      action: "ZONE_SAVED",
      summary: `Zona salvata: ${name}`,
      metadata: {
        sortOrder,
        active
      }
    });
  }

  revalidateAdminSection("/admin/tavoli");
}

export async function deleteTableAction(formData) {
  const actor = await requireUser();
  assertPageAccess(actor, "tables", "delete");

  const tableId = String(formData.get("tableId") || "");

  if (!tableId) {
    return;
  }

  const table = await db.diningTable.findUnique({
    where: {
      id: tableId
    }
  });

  if (!table) {
    return;
  }

  assertLocationAccess(actor, table.locationId);

  const relatedTables = await db.diningTable.findMany({
    where: {
      locationId: table.locationId,
      combinableWithIds: {
        has: tableId
      }
    }
  });
  const affectedReservations = await db.reservation.findMany({
    where: {
      locationId: table.locationId,
      OR: [
        {
          tableId
        },
        {
          tableIds: {
            has: tableId
          }
        }
      ]
    },
    select: {
      id: true,
      tableId: true,
      tableIds: true
    }
  });

  await db.$transaction([
    ...relatedTables.map((item) =>
      db.diningTable.update({
        where: {
          id: item.id
        },
        data: {
          combinableWithIds: (item.combinableWithIds || []).filter((id) => id !== tableId)
        }
      })
    ),
    ...affectedReservations.map((reservation) => {
      const nextTableIds = (reservation.tableIds || []).filter((id) => id !== tableId);
      return db.reservation.update({
        where: {
          id: reservation.id
        },
        data: {
          tableIds: nextTableIds,
          tableId:
            reservation.tableId === tableId
              ? nextTableIds[0] || null
              : reservation.tableId
        }
      });
    }),
    db.diningTable.update({
      where: {
        id: tableId
      },
      data: {
        archivedAt: new Date(),
        archiveReason: "Archiviato da gestione tavoli",
        active: false,
        combinableWithIds: []
      }
    })
  ]);

  await createAuditLog({
    userId: actor.id,
    locationId: table.locationId,
    entityType: "table",
    entityId: tableId,
    action: "TABLE_ARCHIVED",
    summary: `Tavolo archiviato: ${table.code}`,
    metadata: {
      seats: table.seats
    }
  });

  revalidateAdminSection("/admin/tavoli");
  revalidatePath("/prenota");
}

export async function saveMenuAction(formData) {
  const actor = await requireUser();
  const menuId = String(formData.get("menuId") || "");
  assertPageAccess(actor, "menus", "manage");

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const isActive = parseBoolean(formData.get("isActive"));
  const deliveryEnabled = parseBoolean(formData.get("deliveryEnabled"));
  const appliesToAllLocations = parseBoolean(formData.get("appliesToAllLocations"));
  const selectedLocationIds = [...new Set(parseIds(formData.getAll("locationIds")))];

  if (!name) {
    return;
  }

  if (appliesToAllLocations && !["ADMIN", "PROPRIETARIO"].includes(actor.role)) {
    throw new Error("Solo amministratore o proprietario possono applicare un menu a tutte le sedi");
  }

  if (!appliesToAllLocations && selectedLocationIds.length === 0) {
    return;
  }

  for (const locationId of selectedLocationIds) {
    assertLocationAccess(actor, locationId);
  }

  if (menuId) {
    const existingMenu = await db.menu.findUnique({
      where: { id: menuId }
    });

    if (!existingMenu) {
      return;
    }

    ensureMultiLocationMenuAccess(actor, existingMenu);

    await db.menu.update({
      where: { id: menuId },
      data: {
        locationId: appliesToAllLocations
          ? existingMenu.locationId
          : selectedLocationIds[0] || existingMenu.locationId,
        name,
        description: description || null,
        isActive,
        deliveryEnabled,
        appliesToAllLocations,
        locationIds: appliesToAllLocations ? [] : selectedLocationIds
      }
    });

    await createAuditLog({
      userId: actor.id,
      locationId: existingMenu.locationId,
      entityType: "menu",
      entityId: menuId,
      action: "MENU_UPDATED",
      summary: `Menu aggiornato: ${name}`,
      metadata: {
        appliesToAllLocations,
        selectedLocationIds,
        deliveryEnabled
      }
    });
  } else {
    const fallbackLocation =
      selectedLocationIds[0]
        ? { id: selectedLocationIds[0] }
        : actor.locationAccess[0]
          ? { id: actor.locationAccess[0].locationId }
          : await db.location.findFirst({
              select: {
                id: true
              },
              orderBy: {
                name: "asc"
              }
            });

    const fallbackLocationId = fallbackLocation?.id;

    if (!fallbackLocationId) {
      return;
    }

    const createdMenu = await db.menu.create({
      data: {
        locationId: fallbackLocationId,
        name,
        description: description || null,
        isActive,
        deliveryEnabled,
        appliesToAllLocations,
        locationIds: appliesToAllLocations ? [] : selectedLocationIds
      }
    });

    await createAuditLog({
      userId: actor.id,
      locationId: fallbackLocationId,
      entityType: "menu",
      entityId: createdMenu.id,
      action: "MENU_CREATED",
      summary: `Menu creato: ${name}`,
      metadata: {
        appliesToAllLocations,
        selectedLocationIds,
        deliveryEnabled
      }
    });
  }

  revalidateAdminSection("/admin/menu");
}

export async function deleteMenuAction(formData) {
  const actor = await requireUser();
  const menuId = String(formData.get("menuId") || "");
  assertPageAccess(actor, "menus", "manage");

  if (!menuId) {
    return;
  }

  const menu = await db.menu.findUnique({
    where: { id: menuId }
  });

  if (!menu) {
    return;
  }

  ensureMultiLocationMenuAccess(actor, menu);

  await db.menu.update({
    where: { id: menuId },
    data: {
      archivedAt: new Date(),
      archiveReason: "Archiviato da gestione menu",
      isActive: false
    }
  });

  await createAuditLog({
    userId: actor.id,
    locationId: menu.locationId,
    entityType: "menu",
    entityId: menuId,
    action: "MENU_ARCHIVED",
    summary: `Menu archiviato: ${menu.name}`,
    metadata: null
  });

  revalidateAdminSection("/admin/menu");
}

export async function saveMenuSectionAction(formData) {
  const actor = await requireUser();
  const sectionId = String(formData.get("sectionId") || "");
  const menuId = String(formData.get("menuId") || "");
  const name = String(formData.get("name") || "").trim();
  const sortOrder = Number(formData.get("sortOrder") || 0);

  if (!menuId || !name) {
    return;
  }

  assertPageAccess(actor, "menus", "manage");

  const menu = await db.menu.findUnique({
    where: { id: menuId }
  });

  if (!menu) {
    return;
  }

  ensureMultiLocationMenuAccess(actor, menu);

  if (sectionId) {
    await db.menuSection.update({
      where: { id: sectionId },
      data: {
        name,
        sortOrder
      }
    });

    await createAuditLog({
      userId: actor.id,
      locationId: menu.locationId,
      entityType: "menu_section",
      entityId: sectionId,
      action: "MENU_SECTION_UPDATED",
      summary: `Sezione menu aggiornata: ${name}`,
      metadata: {
        sortOrder
      }
    });
  } else {
    const createdSection = await db.menuSection.create({
      data: {
        menuId,
        name,
        sortOrder
      }
    });

    await createAuditLog({
      userId: actor.id,
      locationId: menu.locationId,
      entityType: "menu_section",
      entityId: createdSection.id,
      action: "MENU_SECTION_CREATED",
      summary: `Sezione menu creata: ${name}`,
      metadata: {
        sortOrder
      }
    });
  }

  revalidateAdminSection("/admin/menu");
}

export async function saveMenuItemAction(formData) {
  const actor = await requireUser();
  const itemId = String(formData.get("itemId") || "");
  const sectionId = String(formData.get("sectionId") || "");
  const name = String(formData.get("name") || "").trim();

  if (!sectionId || !name) {
    return;
  }

  assertPageAccess(actor, "menus", "manage");

  const section = await db.menuSection.findUnique({
    where: { id: sectionId },
    include: {
      menu: true
    }
  });

    if (!section) {
      return;
    }

    ensureMultiLocationMenuAccess(actor, section.menu);

  const uploadedImageUrl = await resolveInlineImageDataUrl(formData.get("imageFile"));
  const manualImageUrl = normalizeMediaUrlInput(formData.get("imageUrl"));
  const removeImage = parseBoolean(formData.get("removeImage"));

  const payload = {
    name,
    description: String(formData.get("description") || "").trim() || null,
    imageUrl: removeImage ? null : uploadedImageUrl || manualImageUrl,
    price: parsePrice(formData.get("price") || 0),
    allergens: String(formData.get("allergens") || "").trim() || null,
    available: parseBoolean(formData.get("available")),
    sortOrder: Number(formData.get("sortOrder") || 0)
  };

  if (itemId) {
    await db.menuItem.update({
      where: { id: itemId },
      data: payload
    });

    await createAuditLog({
      userId: actor.id,
      locationId: section.menu.locationId,
      entityType: "menu_item",
      entityId: itemId,
      action: "MENU_ITEM_UPDATED",
      summary: `Piatto aggiornato: ${name}`,
      metadata: {
        available: payload.available,
        sortOrder: payload.sortOrder
      }
    });
  } else {
    const createdItem = await db.menuItem.create({
      data: {
        sectionId,
        ...payload
      }
    });

    await createAuditLog({
      userId: actor.id,
      locationId: section.menu.locationId,
      entityType: "menu_item",
      entityId: createdItem.id,
      action: "MENU_ITEM_CREATED",
      summary: `Piatto creato: ${name}`,
      metadata: {
        available: payload.available,
        sortOrder: payload.sortOrder
      }
    });
  }

  revalidateAdminSection("/admin/menu");
}

export async function assignFloorReservationAction(formData) {
  const actor = await requireUser();
  const reservationId = String(formData.get("reservationId") || "");
  const tableId = String(formData.get("tableId") || "");
  assertPageAccess(actor, "reservations", "manage");

  if (!reservationId || !tableId) {
    return { error: "Prenotazione o tavolo non validi." };
  }

  const reservation = await db.reservation.findUnique({
    where: {
      id: reservationId
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

  if (!reservation) {
    return { error: "Prenotazione non trovata." };
  }

  if (["CANCELLATA", "COMPLETATA", "NO_SHOW"].includes(reservation.status)) {
    return { error: "Questa prenotazione non e' piu assegnabile dalla sala." };
  }

  assertLocationAccess(actor, reservation.locationId);

  const durationMinutes = reservation.location.settings?.durationMinutes || 120;
  const assignment = await findRequestedTableAssignment(
    reservation.locationId,
    tableId,
    reservation.guests,
    reservation.dateTime,
    durationMinutes,
    reservation.id,
    reservation.location.technicalSettings || {}
  );

  if (!assignment) {
    return { error: "Il tavolo selezionato non e' compatibile o non e' disponibile per questo slot." };
  }

  const nextStatus =
    reservation.status === "IN_ATTESA" ? "CONFERMATA" : reservation.status;

  await db.reservation.update({
    where: {
      id: reservationId
    },
    data: {
      status: nextStatus,
      tableId: assignment.primaryTable.id,
      tableIds: assignment.tableIds
    }
  });

  await createAuditLog({
    userId: actor.id,
    locationId: reservation.locationId,
    reservationId: reservation.id,
    entityType: "reservation",
    entityId: reservation.id,
    action: "FLOOR_TABLE_ASSIGNED",
    summary: `Prenotazione assegnata dalla mappa sala su ${assignment.code}`,
    metadata: {
      tableIds: assignment.tableIds,
      nextStatus
    }
  });

  revalidateAdminSection("/admin/sala");
  revalidateAdminSection("/admin/prenotazioni");
  revalidateAdminSection("/admin/calendario");

  return {
    success: `Prenotazione assegnata a ${assignment.code}.`
  };
}

function getAssignmentSlotBucket(reservation, policy) {
  const date = new Date(reservation.dateTime);

  if (policy.slotMode === "PRECISE" || policy.flexMinutes <= 0) {
    return date.toISOString();
  }

  const bucketSize = policy.flexMinutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / bucketSize) * bucketSize).toISOString();
}

function groupReservationsByAssignmentSlot(reservations, policy) {
  const groups = new Map();

  for (const reservation of reservations) {
    const bucket = getAssignmentSlotBucket(reservation, policy);
    const group = groups.get(bucket) || [];
    group.push(reservation);
    groups.set(bucket, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => new Date(left) - new Date(right))
    .map(([, group]) => group);
}

export async function optimizeFloorAssignmentsAction(formData) {
  const actor = await requireUser();
  assertPageAccess(actor, "reservations", "manage");

  const locationId = String(formData.get("locationId") || "");
  const dateText = String(formData.get("date") || "");

  if (!locationId || !dateText) {
    return { error: "Sede o data non valide." };
  }

  assertLocationAccess(actor, locationId);

  const selectedDate = parseDateInput(dateText);
  const dayEnd = new Date(selectedDate);
  dayEnd.setHours(23, 59, 59, 999);
  const location = await db.location.findUnique({
    where: {
      id: locationId
    },
    include: {
      settings: true,
      technicalSettings: true,
      tables: {
        where: {
          active: true,
          archivedAt: null
        },
        orderBy: [{ seats: "asc" }, { code: "asc" }]
      },
      reservations: {
        where: {
          archivedAt: null,
          dateTime: {
            gte: selectedDate,
            lte: dayEnd
          },
          status: {
            in: ["IN_ATTESA", "CONFERMATA"]
          }
        },
        include: {
          customerProfile: true
        },
        orderBy: [{ dateTime: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!location) {
    return { error: "Sede non trovata." };
  }

  const policy = getTableAssignmentPolicy(location.technicalSettings || {});

  if (!policy.enabled) {
    return { error: "Il modulo Motore resa sala non e' attivo per questa sede." };
  }

  const unassignedReservations = location.reservations.filter(
    (reservation) =>
      !reservation.tableId && (!reservation.tableIds || reservation.tableIds.length === 0)
  );
  const candidateGroups = groupReservationsByAssignmentSlot(unassignedReservations, policy).map(
    (reservations) =>
      buildReservationAssignmentCandidates({
        reservations,
        availableTables: location.tables,
        policy
      })
  );
  const durationMinutes = location.settings?.durationMinutes || 120;
  const assignments = [];

  for (const candidates of candidateGroups) {
    for (const candidate of candidates) {
      const reservation = await db.reservation.findUnique({
        where: {
          id: candidate.reservation.id
        },
        select: {
          id: true,
          status: true,
          tableId: true,
          tableIds: true,
          guests: true,
          dateTime: true,
          locationId: true
        }
      });

      if (
        !reservation ||
        reservation.locationId !== locationId ||
        !["IN_ATTESA", "CONFERMATA"].includes(reservation.status) ||
        reservation.tableId ||
        (reservation.tableIds || []).length > 0
      ) {
        continue;
      }

      const assignment = await findAssignableTables(
        locationId,
        reservation.guests,
        reservation.dateTime,
        durationMinutes,
        reservation.id,
        location.technicalSettings || {}
      );

      if (!assignment) {
        continue;
      }

      await db.reservation.update({
        where: {
          id: reservation.id
        },
        data: {
          status: "CONFERMATA",
          tableId: assignment.primaryTable.id,
          tableIds: assignment.tableIds
        }
      });

      assignments.push({
        reservationId: reservation.id,
        tableIds: assignment.tableIds,
        score: candidate.score.total,
        reason: candidate.reason
      });
    }
  }

  await createAuditLog({
    userId: actor.id,
    locationId,
    entityType: "reservation",
    entityId: locationId,
    action: "FLOOR_ASSIGNMENT_OPTIMIZED",
    summary: `Motore tavoli eseguito: ${assignments.length} assegnazioni`,
    metadata: {
      dateText,
      strategy: policy.strategy,
      slotMode: policy.slotMode,
      assignments
    }
  });

  revalidateAdminSection("/admin/sala");
  revalidateAdminSection("/admin/prenotazioni");
  revalidateAdminSection("/admin/calendario");

  return assignments.length > 0
    ? {
        success: `Motore tavoli completato: ${assignments.length} prenotazioni assegnate.`
      }
    : {
        success: "Motore tavoli eseguito: nessuna nuova assegnazione disponibile."
      };
}

export async function updateReservationAction(previousStateOrFormData, maybeFormData) {
  const formData =
    maybeFormData instanceof FormData ? maybeFormData : previousStateOrFormData;
  const actor = await requireUser();
  const reservationId = String(formData.get("reservationId") || "");
  assertPageAccess(actor, "reservations", "manage");

  if (!reservationId) {
    return buildReservationActionState({
      error: "Prenotazione non valida."
    });
  }

  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    include: {
      location: {
        include: {
          settings: true,
          technicalSettings: true
        }
      }
    }
  });

  if (!reservation) {
    return buildReservationActionState({
      error: "Prenotazione non trovata."
    });
  }

  assertLocationAccess(actor, reservation.locationId);

  const requestedStatus = String(formData.get("status") || reservation.status);
  const spendAmount = parseOptionalNumber(formData.get("spendAmount"));

  if (spendAmount !== null && spendAmount < 0) {
    return buildReservationActionState({
      error: "La spesa non puo' essere negativa."
    });
  }

  let tableId = String(formData.get("tableId") || "") || null;
  let tableIds = tableId ? [tableId] : [];
  const durationMinutes = reservation.location.settings?.durationMinutes || 120;

  if (["CANCELLATA", "NO_SHOW", "COMPLETATA"].includes(requestedStatus)) {
    tableId = null;
    tableIds = [];
  }

  if (["IN_ATTESA", "CONFERMATA", "IN_CORSO"].includes(requestedStatus)) {
    if (tableId) {
      const requestedAssignment = await findRequestedTableAssignment(
        reservation.locationId,
        tableId,
        reservation.guests,
        reservation.dateTime,
        durationMinutes,
        reservation.id,
        reservation.location.technicalSettings || {}
      );

      if (!requestedAssignment) {
        return buildReservationActionState({
          error: "Il tavolo selezionato non e' compatibile o non e' disponibile."
        });
      }

      tableId = requestedAssignment.primaryTable.id;
      tableIds = requestedAssignment.tableIds;
    } else {
      const assignment = await findAssignableTables(
        reservation.locationId,
        reservation.guests,
        reservation.dateTime,
        durationMinutes,
        reservation.id,
        reservation.location.technicalSettings || {}
      );

      tableId = assignment?.primaryTable?.id || null;
      tableIds = assignment?.tableIds || [];
    }
  }

  const nextStatus =
    requestedStatus === "CONFERMATA" && !tableId ? "IN_ATTESA" : requestedStatus;

  let updatedReservation = await db.reservation.update({
    where: { id: reservationId },
    data: {
      status: nextStatus,
      tableId,
      tableIds,
      spendAmount
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

  let customerSnapshot = {
    band: updatedReservation.customerBand,
    priorityScore: updatedReservation.customerPriorityScore,
    depositRequired: updatedReservation.depositRequired,
    depositAmount: updatedReservation.depositAmount
  };

  if (reservation.customerProfileId) {
    const syncedProfile = await syncCustomerProfileMetrics(reservation.customerProfileId);
    customerSnapshot = buildCustomerSnapshot(
      syncedProfile,
      updatedReservation.location.technicalSettings || {}
    );

    updatedReservation = await db.reservation.update({
      where: {
        id: reservationId
      },
      data: {
        customerBand: customerSnapshot.band,
        customerPriorityScore: customerSnapshot.priorityScore,
        depositRequired: customerSnapshot.depositRequired,
        depositAmount: customerSnapshot.depositAmount
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
  }

  await createAuditLog({
    userId: actor.id,
    locationId: reservation.locationId,
    reservationId,
    entityType: "reservation",
    entityId: reservationId,
    action: "RESERVATION_UPDATED",
    summary: `Prenotazione aggiornata a ${nextStatus}`,
    metadata: {
      previousStatus: reservation.status,
      nextStatus,
      tableId,
      tableIds,
      spendAmount
    }
  });

  if (
    ["CANCELLATA", "NO_SHOW", "COMPLETATA"].includes(updatedReservation.status) &&
    reservation.status !== updatedReservation.status
  ) {
    await cancelQueuedReservationNotifications(reservation.id, null);
    await notifyConvertedWaitlistEntries(reservation.locationId, reservation.dateTime);
  }

  if (reservation.status !== updatedReservation.status) {
    try {
      await sendReservationStatusSmsNotification(
        updatedReservation,
        updatedReservation.location
      );
    } catch (error) {
      console.error("Errore invio SMS stato prenotazione", error);
    }
  }

  let paymentRequest = null;

  try {
    paymentRequest = await ensureReservationPaymentRequest(
      {
        ...updatedReservation,
        depositRequired: customerSnapshot.depositRequired,
        depositAmount: customerSnapshot.depositAmount
      },
      updatedReservation.location
    );

    if (paymentRequest) {
      await enqueuePaymentLinkNotification(
        paymentRequest,
        {
          ...updatedReservation,
          paymentRequests: [paymentRequest]
        },
        updatedReservation.location
      );
    }

    const customerProfile = reservation.customerProfileId
      ? await db.customerProfile.findUnique({
          where: {
            id: reservation.customerProfileId
          }
        })
      : null;

    if (["IN_ATTESA", "CONFERMATA", "IN_CORSO"].includes(updatedReservation.status)) {
      await scheduleReservationReminderNotifications(
        {
          ...updatedReservation,
          paymentRequests: paymentRequest ? [paymentRequest] : []
        },
        updatedReservation.location,
        customerProfile
      );
    }
  } catch (error) {
    console.error("Errore schedulazione notifiche operative", error);
  }

  revalidateAdminSection("/admin/prenotazioni");
  revalidateAdminSection("/admin/analytics");
  revalidatePath("/prenota");

  const depositMessage = customerSnapshot.depositRequired
    ? customerSnapshot.depositAmount
      ? ` Deposito consigliato: EUR ${Number(customerSnapshot.depositAmount).toFixed(2)}.`
      : " Deposito consigliato attivo per questo cliente."
    : "";

  return buildReservationActionState({
    success:
      updatedReservation.status === "IN_ATTESA" && requestedStatus === "CONFERMATA" && !tableId
        ? "Prenotazione aggiornata. Nessun tavolo libero: lasciata in attesa."
        : tableIds.length > 1
          ? `Prenotazione aggiornata con successo. Tavoli assegnati: ${tableIds.length}.${depositMessage}`
          : `Prenotazione aggiornata con successo.${depositMessage}`
  });
}

export async function saveAdminConsoleLocationAction(formData) {
  const actor = await requireUser();
  assertPageAccess(actor, "console", "manage");

  const locationId = String(formData.get("locationId") || "");
  const name = String(formData.get("name") || "").trim();

  if (!locationId || !name) {
    return;
  }

  const reservationEnabled = parseBoolean(formData.get("reservationEnabled"));
  const reservationStatusSmsStatuses = parseIds(
    formData.getAll("reservationStatusSmsStatuses")
  );
  const technicalPayload = {
    displayName: String(formData.get("displayName") || "").trim() || null,
    qrEnabled: parseBoolean(formData.get("qrEnabled")),
    reservationsEnabled: reservationEnabled,
    yieldEngineEnabled: parseBoolean(formData.get("yieldEngineEnabled")),
    customerTableSelectionEnabled: parseBoolean(
      formData.get("customerTableSelectionEnabled")
    ),
    slotOptimizationEnabled: parseBoolean(formData.get("slotOptimizationEnabled")),
    smartWaitlistEnabled: parseBoolean(formData.get("smartWaitlistEnabled")),
    customerScoringEnabled: parseBoolean(formData.get("customerScoringEnabled")),
    tableAssignmentStrategy:
      String(formData.get("tableAssignmentStrategy") || "BALANCED") || "BALANCED",
    tableAssignmentSlotMode:
      String(formData.get("tableAssignmentSlotMode") || "FLEXIBLE") || "FLEXIBLE",
    tableAssignmentFlexMinutes:
      Number(formData.get("tableAssignmentFlexMinutes") || 30) || 30,
    tableAssignmentTurnoverBufferMinutes:
      Number(formData.get("tableAssignmentTurnoverBufferMinutes") || 15) || 15,
    tableAssignmentCombineTablesEnabled: parseBoolean(
      formData.get("tableAssignmentCombineTablesEnabled")
    ),
    tableAssignmentMaxTables:
      Number(formData.get("tableAssignmentMaxTables") || 4) || 4,
    tableAssignmentMinOccupancyPercent:
      Number(formData.get("tableAssignmentMinOccupancyPercent") || 50) || 50,
    tableAssignmentWeightTableFit:
      Number(formData.get("tableAssignmentWeightTableFit") || 30) || 30,
    tableAssignmentWeightPartySize:
      Number(formData.get("tableAssignmentWeightPartySize") || 25) || 25,
    tableAssignmentWeightCustomerPriority:
      Number(formData.get("tableAssignmentWeightCustomerPriority") || 20) || 20,
    tableAssignmentWeightAverageSpend:
      Number(formData.get("tableAssignmentWeightAverageSpend") || 15) || 15,
    tableAssignmentWeightCreatedAt:
      Number(formData.get("tableAssignmentWeightCreatedAt") || 10) || 10,
    predictiveDurationEnabled: parseBoolean(formData.get("predictiveDurationEnabled")),
    kitchenLoadGuardEnabled: parseBoolean(formData.get("kitchenLoadGuardEnabled")),
    kitchenLoadWindowMinutes:
      Number(formData.get("kitchenLoadWindowMinutes") || 30) || 30,
    kitchenLoadMaxCovers:
      Number(formData.get("kitchenLoadMaxCovers") || 40) || 40,
    controlledOverbookingEnabled: parseBoolean(
      formData.get("controlledOverbookingEnabled")
    ),
    controlledOverbookingMaxCovers:
      Number(formData.get("controlledOverbookingMaxCovers") || 0) || 0,
    controlledOverbookingMinReliabilityScore:
      Number(formData.get("controlledOverbookingMinReliabilityScore") || 70) || 70,
    waitlistOfferTtlMinutes:
      Number(formData.get("waitlistOfferTtlMinutes") || 8) || 8,
    ownerBriefEnabled: parseBoolean(formData.get("ownerBriefEnabled")),
    ownerBriefMorningHour:
      Number(formData.get("ownerBriefMorningHour") || 10) || 10,
    adaptiveDepositEnabled: parseBoolean(formData.get("adaptiveDepositEnabled")),
    adaptiveDepositAmount: parseOptionalNumber(formData.get("adaptiveDepositAmount")),
    deliveryEnabled: parseBoolean(formData.get("deliveryEnabled")),
    paymentsEnabled: parseBoolean(formData.get("paymentsEnabled")),
    notificationWebhookEnabled: parseBoolean(formData.get("notificationWebhookEnabled")),
    notificationWebhookUrl:
      String(formData.get("notificationWebhookUrl") || "").trim() || null,
    notificationWebhookSecret:
      String(formData.get("notificationWebhookSecret") || "").trim() || null,
    posEnabled: parseBoolean(formData.get("posEnabled")),
    posProvider: String(formData.get("posProvider") || "").trim() || null,
    posApiBaseUrl: String(formData.get("posApiBaseUrl") || "").trim() || null,
    posApiKey: String(formData.get("posApiKey") || "").trim() || null,
    posWebhookSecret:
      String(formData.get("posWebhookSecret") || "").trim() || null,
    googleBusinessEnabled: parseBoolean(formData.get("googleBusinessEnabled")),
    reservationEmails:
      String(formData.get("reservationEmails") || "").trim() || null,
    deliveryProvider:
      String(formData.get("deliveryProvider") || "").trim() || null,
    deliveryApiBaseUrl:
      String(formData.get("deliveryApiBaseUrl") || "").trim() || null,
    deliveryApiKey:
      String(formData.get("deliveryApiKey") || "").trim() || null,
    deliveryWebhookSecret:
      String(formData.get("deliveryWebhookSecret") || "").trim() || null,
    googleBusinessPlaceId:
      String(formData.get("googleBusinessPlaceId") || "").trim() || null,
    googleBusinessAccountId:
      String(formData.get("googleBusinessAccountId") || "").trim() || null,
    googleBusinessLocationId:
      String(formData.get("googleBusinessLocationId") || "").trim() || null,
    googleBusinessApiKey:
      String(formData.get("googleBusinessApiKey") || "").trim() || null,
    paymentProvider:
      String(formData.get("paymentProvider") || "").trim() || null,
    paymentPublicKey:
      String(formData.get("paymentPublicKey") || "").trim() || null,
    paymentApiKey:
      String(formData.get("paymentApiKey") || "").trim() || null,
    paymentWebhookSecret:
      String(formData.get("paymentWebhookSecret") || "").trim() || null,
    paymentCheckoutBaseUrl:
      String(formData.get("paymentCheckoutBaseUrl") || "").trim() || null,
    smsEnabled: parseBoolean(formData.get("smsEnabled")),
    smsAlias: String(formData.get("smsAlias") || "").trim() || null,
    smsUsername: String(formData.get("smsUsername") || "").trim() || null,
    smsPassword: String(formData.get("smsPassword") || "").trim() || null,
    reservationStatusSmsStatuses,
    reservationStatusSmsTemplate:
      String(formData.get("reservationStatusSmsTemplate") || "").trim() || null,
    waitlistSmsTemplate:
      String(formData.get("waitlistSmsTemplate") || "").trim() || null,
    manageLinkDeliveryMode:
      String(formData.get("manageLinkDeliveryMode") || "SMS") || "SMS",
    manageLinkSmsTemplate:
      String(formData.get("manageLinkSmsTemplate") || "").trim() || null,
    manageLinkEmailSubject:
      String(formData.get("manageLinkEmailSubject") || "").trim() || null,
    manageLinkEmailTemplate:
      String(formData.get("manageLinkEmailTemplate") || "").trim() || null,
    smtpHost: String(formData.get("smtpHost") || "").trim() || null,
    smtpPort: Number(formData.get("smtpPort") || 0) || null,
    smtpSecure: parseBoolean(formData.get("smtpSecure")),
    smtpUsername: String(formData.get("smtpUsername") || "").trim() || null,
    smtpPassword: String(formData.get("smtpPassword") || "").trim() || null,
    smtpFromName: String(formData.get("smtpFromName") || "").trim() || null,
    smtpFromEmail: String(formData.get("smtpFromEmail") || "").trim() || null,
    crmReminderLeadHours: Number(formData.get("crmReminderLeadHours") || 24),
    crmBirthdayEnabled: parseBoolean(formData.get("crmBirthdayEnabled")),
    crmBirthdayTemplate:
      String(formData.get("crmBirthdayTemplate") || "").trim() || null,
    crmVipReminderEnabled: parseBoolean(formData.get("crmVipReminderEnabled")),
    crmVipReminderTemplate:
      String(formData.get("crmVipReminderTemplate") || "").trim() || null,
    crmRiskReminderEnabled: parseBoolean(formData.get("crmRiskReminderEnabled")),
    crmRiskReminderTemplate:
      String(formData.get("crmRiskReminderTemplate") || "").trim() || null,
    crmNoShowReminderEnabled: parseBoolean(formData.get("crmNoShowReminderEnabled")),
    crmNoShowReminderTemplate:
      String(formData.get("crmNoShowReminderTemplate") || "").trim() || null,
    technicalNotes:
      String(formData.get("technicalNotes") || "").trim() || null
  };

  await db.location.update({
    where: {
      id: locationId
    },
    data: {
      name,
      reservationEnabled,
      technicalSettings: {
        upsert: {
          create: {
            ...technicalPayload
          },
          update: {
            ...technicalPayload
          }
        }
      }
    }
  });

  await createAuditLog({
    userId: actor.id,
    locationId,
    entityType: "technical_settings",
    entityId: locationId,
    action: "CONSOLE_UPDATED",
    summary: "Console Admin aggiornata",
    metadata: {
      qrEnabled: technicalPayload.qrEnabled,
      reservationsEnabled: technicalPayload.reservationsEnabled,
      yieldEngineEnabled: technicalPayload.yieldEngineEnabled,
      customerTableSelectionEnabled: technicalPayload.customerTableSelectionEnabled,
      slotOptimizationEnabled: technicalPayload.slotOptimizationEnabled,
      smartWaitlistEnabled: technicalPayload.smartWaitlistEnabled,
      customerScoringEnabled: technicalPayload.customerScoringEnabled,
      tableAssignmentStrategy: technicalPayload.tableAssignmentStrategy,
      tableAssignmentSlotMode: technicalPayload.tableAssignmentSlotMode,
      predictiveDurationEnabled: technicalPayload.predictiveDurationEnabled,
      kitchenLoadGuardEnabled: technicalPayload.kitchenLoadGuardEnabled,
      controlledOverbookingEnabled: technicalPayload.controlledOverbookingEnabled,
      ownerBriefEnabled: technicalPayload.ownerBriefEnabled,
      adaptiveDepositEnabled: technicalPayload.adaptiveDepositEnabled,
      smsEnabled: technicalPayload.smsEnabled,
      posEnabled: technicalPayload.posEnabled,
      paymentsEnabled: technicalPayload.paymentsEnabled,
      notificationWebhookEnabled: technicalPayload.notificationWebhookEnabled
    }
  });

  revalidateAdminSection("/admin/console");
  revalidateAdminSection("/admin/sedi");
  revalidateAdminSection("/admin/tavoli");
  revalidatePath("/prenota");
  revalidatePath("/table/[tableId]", "page");
}

export async function saveRolePermissionAction(formData) {
  const actor = await requireUser();

  if (actor.role !== "ADMIN") {
    throw new Error("Non autorizzato");
  }

  const role = String(formData.get("role") || "");

  if (!role || !DEFAULT_ROLE_PERMISSIONS[role]) {
    return;
  }

  const payload = Object.keys(DEFAULT_ROLE_PERMISSIONS[role]).reduce(
    (accumulator, key) => ({
      ...accumulator,
      [key]: parseBoolean(formData.get(key))
    }),
    {}
  );

  await db.rolePermission.upsert({
    where: {
      role
    },
    update: payload,
    create: {
      role,
      ...payload
    }
  });

  await createAuditLog({
    userId: actor.id,
    entityType: "role_permission",
    entityId: role,
    action: "ROLE_PERMISSION_UPDATED",
    summary: `Permessi aggiornati per ruolo ${role}`,
    metadata: payload
  });

  revalidateAdminSection("/admin/permessi");
}

export async function saveRolePermissionMatrixAction(formData) {
  const actor = await requireUser();

  if (actor.role !== "ADMIN") {
    throw new Error("Non autorizzato");
  }

  for (const [role, defaults] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const payload = Object.keys(defaults).reduce(
      (accumulator, key) => ({
        ...accumulator,
        [key]: parseBoolean(formData.get(`${role}__${key}`))
      }),
      {}
    );

    await db.rolePermission.upsert({
      where: {
        role
      },
      update: payload,
      create: {
        role,
        ...payload
      }
    });
  }

  await createAuditLog({
    userId: actor.id,
    entityType: "role_permission_matrix",
    entityId: "global",
    action: "ROLE_PERMISSION_MATRIX_UPDATED",
    summary: "Matrice permessi aggiornata",
    metadata: {
      roles: Object.keys(DEFAULT_ROLE_PERMISSIONS)
    }
  });

  revalidateAdminSection("/admin/permessi");
}
