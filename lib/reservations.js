import { randomBytes } from "node:crypto";
import { db } from "./db";

const BLOCKING_RESERVATION_STATUSES = ["IN_ATTESA", "CONFERMATA", "IN_CORSO"];

export function toMinutes(value) {
  const [hours, minutes] = String(value || "00:00")
    .split(":")
    .map(Number);
  return hours * 60 + minutes;
}

export function parseDateInput(dateText) {
  return new Date(`${dateText}T00:00:00`);
}

export function getReservationWindow(dateTime, durationMinutes) {
  const start = new Date(dateTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return { start, end };
}

export function getOpeningHourForDate(openingHours, dateTime) {
  return openingHours.find((item) => item.weekday === new Date(dateTime).getDay()) || null;
}

export function isWithinOpeningHours(dateTime, openingHour, durationMinutes) {
  if (!openingHour || openingHour.isClosed) {
    return false;
  }

  const startMinutes = new Date(dateTime).getHours() * 60 + new Date(dateTime).getMinutes();
  const endMinutes = startMinutes + durationMinutes;
  const opensAt = toMinutes(openingHour.opensAt);
  const closesAt = toMinutes(openingHour.closesAt);

  return startMinutes >= opensAt && endMinutes <= closesAt;
}

export function formatSlotLabel(dateTime) {
  const date = new Date(dateTime);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function toLocalDateTimeInputValue(dateTime) {
  const date = new Date(dateTime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function generateReservationSlots({
  dateText,
  openingHour,
  durationMinutes,
  slotIntervalMinutes,
  leadTimeMinutes
}) {
  if (!openingHour || openingHour.isClosed) {
    return [];
  }

  const day = parseDateInput(dateText);
  const openMinutes = toMinutes(openingHour.opensAt);
  const closeMinutes = toMinutes(openingHour.closesAt);
  const latestStart = closeMinutes - durationMinutes;

  if (latestStart < openMinutes) {
    return [];
  }

  const threshold = Date.now() + leadTimeMinutes * 60 * 1000;
  const slots = [];

  for (
    let minutes = openMinutes;
    minutes <= latestStart;
    minutes += Math.max(slotIntervalMinutes, 5)
  ) {
    const dateTime = new Date(day);
    dateTime.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

    if (dateTime.getTime() < threshold) {
      continue;
    }

    slots.push({
      dateTime,
      value: toLocalDateTimeInputValue(dateTime),
      label: formatSlotLabel(dateTime)
    });
  }

  return slots;
}

function windowsOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

async function getCandidateTables(locationId, guests) {
  return db.diningTable.findMany({
    where: {
      locationId,
      active: true,
      seats: {
        gte: guests
      }
    },
    orderBy: [{ seats: "asc" }, { code: "asc" }]
  });
}

async function getBlockingReservations({
  locationId,
  start,
  end,
  durationMinutes,
  excludeReservationId
}) {
  const where = {
    locationId,
    tableId: {
      not: null
    },
    status: {
      in: BLOCKING_RESERVATION_STATUSES
    },
    dateTime: {
      gte: new Date(start.getTime() - durationMinutes * 60 * 1000),
      lte: end
    }
  };

  if (excludeReservationId) {
    where.id = {
      not: excludeReservationId
    };
  }

  return db.reservation.findMany({
    where,
    select: {
      id: true,
      tableId: true,
      dateTime: true
    }
  });
}

function getAvailableTableIds({ tables, reservations, start, end, durationMinutes }) {
  return tables
    .filter((table) => {
      const hasOverlap = reservations.some((reservation) => {
        if (reservation.tableId !== table.id) {
          return false;
        }

        const reservationWindow = getReservationWindow(reservation.dateTime, durationMinutes);

        return windowsOverlap(
          start,
          end,
          reservationWindow.start,
          reservationWindow.end
        );
      });

      return !hasOverlap;
    })
    .map((table) => table.id);
}

export async function findAssignableTable(
  locationId,
  guests,
  dateTime,
  durationMinutes,
  excludeReservationId
) {
  const tables = await getCandidateTables(locationId, guests);

  if (tables.length === 0) {
    return null;
  }

  const { start, end } = getReservationWindow(dateTime, durationMinutes);
  const reservations = await getBlockingReservations({
    locationId,
    start,
    end,
    durationMinutes,
    excludeReservationId
  });
  const availableTableIds = new Set(
    getAvailableTableIds({
      tables,
      reservations,
      start,
      end,
      durationMinutes
    })
  );

  return tables.find((table) => availableTableIds.has(table.id)) || null;
}

export async function getSlotAvailability({
  location,
  dateText,
  guests,
  excludeReservationId
}) {
  const settings = location.settings || {
    durationMinutes: 120,
    slotIntervalMinutes: 30,
    leadTimeMinutes: 60
  };
  const openingHour = getOpeningHourForDate(location.openingHours, parseDateInput(dateText));
  const slots = generateReservationSlots({
    dateText,
    openingHour,
    durationMinutes: settings.durationMinutes || 120,
    slotIntervalMinutes: settings.slotIntervalMinutes || 30,
    leadTimeMinutes: settings.leadTimeMinutes || 60
  });
  const tables = await getCandidateTables(location.id, guests);

  if (slots.length === 0 || tables.length === 0) {
    return slots.map((slot) => ({
      ...slot,
      available: false,
      availableTableCount: 0
    }));
  }

  const dayStart = parseDateInput(dateText);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);
  const reservations = await getBlockingReservations({
    locationId: location.id,
    start: dayStart,
    end: dayEnd,
    durationMinutes: settings.durationMinutes || 120,
    excludeReservationId
  });

  return slots.map((slot) => {
    const window = getReservationWindow(slot.dateTime, settings.durationMinutes || 120);
    const availableTableCount = getAvailableTableIds({
      tables,
      reservations,
      start: window.start,
      end: window.end,
      durationMinutes: settings.durationMinutes || 120
    }).length;

    return {
      ...slot,
      available: availableTableCount > 0,
      availableTableCount
    };
  });
}

export async function ensureReservationManageToken(reservationId) {
  const reservation = await db.reservation.findUnique({
    where: {
      id: reservationId
    },
    select: {
      id: true,
      manageToken: true
    }
  });

  if (!reservation) {
    return null;
  }

  if (reservation.manageToken) {
    return reservation.manageToken;
  }

  const updated = await db.reservation.update({
    where: {
      id: reservationId
    },
    data: {
      manageToken: randomBytes(24).toString("hex")
    },
    select: {
      manageToken: true
    }
  });

  return updated.manageToken;
}

export async function convertOpenWaitlistEntries({
  locationId,
  exactDateTime = null
}) {
  const location = await db.location.findUnique({
    where: {
      id: locationId
    },
    include: {
      settings: true,
      openingHours: true,
      technicalSettings: true
    }
  });

  if (!location) {
    return [];
  }

  const durationMinutes = location.settings?.durationMinutes || 120;
  const waitlistEntries = await db.waitlistEntry.findMany({
    where: {
      locationId,
      status: "OPEN",
      ...(exactDateTime
        ? {
            preferredDateTime: exactDateTime
          }
        : {
            preferredDateTime: {
              gte: new Date()
            }
          })
    },
    orderBy: [{ preferredDateTime: "asc" }, { createdAt: "asc" }]
  });

  const converted = [];

  for (const entry of waitlistEntries) {
    const table = await findAssignableTable(
      entry.locationId,
      entry.guests,
      entry.preferredDateTime,
      durationMinutes
    );

    if (!table) {
      continue;
    }

    const reservation = await db.reservation.create({
      data: {
        locationId: entry.locationId,
        tableId: table.id,
        manageToken: randomBytes(24).toString("hex"),
        guestName: entry.guestName,
        guestEmail: entry.guestEmail,
        guestPhone: entry.guestPhone,
        guests: entry.guests,
        dateTime: entry.preferredDateTime,
        notes: entry.notes,
        status: "CONFERMATA",
        source: "WAITLIST"
      }
    });

    await db.waitlistEntry.update({
      where: {
        id: entry.id
      },
      data: {
        status: "CONVERTED",
        reservationId: reservation.id,
        notifiedAt: new Date()
      }
    });

    converted.push({
      entry,
      reservation,
      table,
      location
    });
  }

  return converted;
}
