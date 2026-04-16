"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { hashPassword, requireUser } from "../auth";
import { DEFAULT_OPENING_HOURS, DEFAULT_ROLE_PERMISSIONS } from "../constants";
import { toSlug } from "../format";
import { assertLocationAccess, assertPageAccess } from "../permissions";
import {
  convertOpenWaitlistEntries,
  findAssignableTable
} from "../reservations";
import {
  sendReservationStatusSmsNotification,
  sendWaitlistConversionNotification
} from "../notifications";

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
      await sendWaitlistConversionNotification(item.reservation, item.location);
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
  } else {
    await db.diningTable.create({
      data: {
        locationId,
        zoneId,
        code,
        seats,
        zone: zoneName,
        active
      }
    });
  }

  await notifyConvertedWaitlistEntries(locationId);
  revalidateAdminSection("/admin/tavoli");
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
  } else {
    await db.locationZone.upsert({
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

  await db.diningTable.delete({
    where: {
      id: tableId
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

    await db.menu.create({
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

  await db.menu.delete({
    where: { id: menuId }
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
  } else {
    await db.menuSection.create({
      data: {
        menuId,
        name,
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

  const payload = {
    name,
    description: String(formData.get("description") || "").trim() || null,
    imageUrl: String(formData.get("imageUrl") || "").trim() || null,
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
  } else {
    await db.menuItem.create({
      data: {
        sectionId,
        ...payload
      }
    });
  }

  revalidateAdminSection("/admin/menu");
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
  let tableId = String(formData.get("tableId") || "") || null;
  const durationMinutes = reservation.location.settings?.durationMinutes || 120;

  if (["CANCELLATA", "NO_SHOW"].includes(requestedStatus)) {
    tableId = null;
  }

  if (
    !tableId &&
    ["IN_ATTESA", "CONFERMATA", "IN_CORSO"].includes(requestedStatus)
  ) {
    const bestTable = await findAssignableTable(
      reservation.locationId,
      reservation.guests,
      reservation.dateTime,
      durationMinutes,
      reservation.id
    );

    tableId = bestTable?.id || null;
  }

  const nextStatus =
    requestedStatus === "CONFERMATA" && !tableId ? "IN_ATTESA" : requestedStatus;

  const updatedReservation = await db.reservation.update({
    where: { id: reservationId },
    data: {
      status: nextStatus,
      tableId
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

  if (
    ["CANCELLATA", "NO_SHOW", "COMPLETATA"].includes(updatedReservation.status) &&
    reservation.status !== updatedReservation.status
  ) {
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

  revalidateAdminSection("/admin/prenotazioni");
  revalidatePath("/prenota");

  return buildReservationActionState({
    success:
      updatedReservation.status === "IN_ATTESA" && requestedStatus === "CONFERMATA" && !tableId
        ? "Prenotazione aggiornata. Nessun tavolo libero: lasciata in attesa."
        : "Prenotazione aggiornata con successo."
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
    deliveryEnabled: parseBoolean(formData.get("deliveryEnabled")),
    paymentsEnabled: parseBoolean(formData.get("paymentsEnabled")),
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

  revalidateAdminSection("/admin/permessi");
}
