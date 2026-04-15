"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { canManageBusiness, canManageUsers, hashPassword, requireUser } from "../auth";
import { DEFAULT_OPENING_HOURS } from "../constants";
import { toSlug } from "../format";
import { assertLocationAccess } from "../permissions";

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

export async function saveUserAction(formData) {
  const actor = await requireUser();

  if (!canManageUsers(actor)) {
    throw new Error("Non autorizzato");
  }

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

  if (!["ADMIN", "PROPRIETARIO"].includes(actor.role)) {
    throw new Error("Non autorizzato");
  }

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

  if (!canManageBusiness(actor)) {
    throw new Error("Non autorizzato");
  }

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

  if (!canManageBusiness(actor)) {
    throw new Error("Non autorizzato");
  }

  assertLocationAccess(actor, locationId);

  await db.reservationSetting.upsert({
    where: { locationId },
    update: {
      pageTitle: String(formData.get("pageTitle") || "").trim() || null,
      welcomeMessage:
        String(formData.get("welcomeMessage") || "").trim() || null,
      durationMinutes: Number(formData.get("durationMinutes") || 120),
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

  if (!canManageBusiness(actor)) {
    throw new Error("Non autorizzato");
  }

  assertLocationAccess(actor, locationId);

  const code = String(formData.get("code") || "").trim();
  const seats = Number(formData.get("seats") || 2);
  const zone = String(formData.get("zone") || "").trim();
  const active = parseBoolean(formData.get("active"));

  if (!code || !locationId || seats < 1) {
    return;
  }

  if (tableId) {
    await db.diningTable.update({
      where: { id: tableId },
      data: {
        code,
        seats,
        zone: zone || null,
        active
      }
    });
  } else {
    await db.diningTable.create({
      data: {
        locationId,
        code,
        seats,
        zone: zone || null,
        active
      }
    });
  }

  revalidateAdminSection("/admin/tavoli");
  revalidatePath("/prenota");
}

export async function generateTablesAction(formData) {
  const actor = await requireUser();
  const locationId = String(formData.get("locationId") || "");

  if (!canManageBusiness(actor)) {
    throw new Error("Non autorizzato");
  }

  assertLocationAccess(actor, locationId);

  const prefix = String(formData.get("prefix") || "T").trim();
  const from = Number(formData.get("from") || 1);
  const to = Number(formData.get("to") || 1);
  const seats = Number(formData.get("seats") || 2);
  const zone = String(formData.get("zone") || "").trim();

  if (to < from || from < 1) {
    return;
  }

  const payload = [];

  for (let current = from; current <= to; current += 1) {
    payload.push({
      locationId,
      code: `${prefix}${current}`,
      seats,
      zone: zone || null,
      active: true
    });
  }

  await db.diningTable.createMany({
    data: payload,
    skipDuplicates: true
  });

  revalidateAdminSection("/admin/tavoli");
  revalidatePath("/prenota");
}

export async function saveMenuAction(formData) {
  const actor = await requireUser();
  const menuId = String(formData.get("menuId") || "");
  const locationId = String(formData.get("locationId") || "");

  if (!canManageBusiness(actor)) {
    throw new Error("Non autorizzato");
  }

  assertLocationAccess(actor, locationId);

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const isActive = parseBoolean(formData.get("isActive"));

  if (!name) {
    return;
  }

  if (menuId) {
    await db.menu.update({
      where: { id: menuId },
      data: {
        name,
        description: description || null,
        isActive
      }
    });
  } else {
    await db.menu.create({
      data: {
        locationId,
        name,
        description: description || null,
        isActive
      }
    });
  }

  revalidateAdminSection("/admin/menu");
}

export async function saveMenuSectionAction(formData) {
  const actor = await requireUser();
  const menuId = String(formData.get("menuId") || "");
  const name = String(formData.get("name") || "").trim();
  const sortOrder = Number(formData.get("sortOrder") || 0);

  if (!canManageBusiness(actor) || !menuId || !name) {
    return;
  }

  const menu = await db.menu.findUnique({
    where: { id: menuId }
  });

  if (!menu) {
    return;
  }

  assertLocationAccess(actor, menu.locationId);

  await db.menuSection.create({
    data: {
      menuId,
      name,
      sortOrder
    }
  });

  revalidateAdminSection("/admin/menu");
}

export async function saveMenuItemAction(formData) {
  const actor = await requireUser();
  const itemId = String(formData.get("itemId") || "");
  const sectionId = String(formData.get("sectionId") || "");
  const name = String(formData.get("name") || "").trim();

  if (!canManageBusiness(actor) || !sectionId || !name) {
    return;
  }

  const section = await db.menuSection.findUnique({
    where: { id: sectionId },
    include: {
      menu: true
    }
  });

  if (!section) {
    return;
  }

  assertLocationAccess(actor, section.menu.locationId);

  const payload = {
    name,
    description: String(formData.get("description") || "").trim() || null,
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

export async function updateReservationAction(formData) {
  const actor = await requireUser();
  const reservationId = String(formData.get("reservationId") || "");

  if (!reservationId) {
    return;
  }

  const reservation = await db.reservation.findUnique({
    where: { id: reservationId }
  });

  if (!reservation) {
    return;
  }

  assertLocationAccess(actor, reservation.locationId);

  await db.reservation.update({
    where: { id: reservationId },
    data: {
      status: String(formData.get("status") || reservation.status),
      tableId: String(formData.get("tableId") || "") || null
    }
  });

  revalidateAdminSection("/admin/prenotazioni");
  revalidatePath("/prenota");
}
