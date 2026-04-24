import { randomBytes } from "node:crypto";
import { db } from "./db";
import { createAuditLog } from "./audit";
import {
  buildCustomerSnapshot,
  ensureCustomerProfile,
  sortWaitlistEntriesByPriority,
  syncCustomerProfileMetrics
} from "./customer-profiles";

const BLOCKING_RESERVATION_STATUSES = ["IN_ATTESA", "CONFERMATA", "IN_CORSO"];
const MAX_COMBINATION_SIZE = 4;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function toMinutes(value) {
  const [hours, minutes] = String(value || "00:00")
    .split(":")
    .map(Number);
  return hours * 60 + minutes;
}

export function parseDateInput(dateText) {
  const [year, month, day] = String(dateText || "")
    .split("-")
    .map(Number);
  const date = new Date();
  date.setFullYear(year || 1970, (month || 1) - 1, day || 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getReservationWindow(dateTime, durationMinutes) {
  const start = new Date(dateTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return { start, end };
}

export function getOpeningExceptionForDate(openingExceptions = [], dateTime) {
  const key = getDateKey(dateTime);
  return openingExceptions.find((item) => getDateKey(item.date) === key) || null;
}

export function getOpeningHourForDate(openingHours, dateTime, openingExceptions = []) {
  const exception = getOpeningExceptionForDate(openingExceptions, dateTime);

  if (exception) {
    return {
      weekday: new Date(dateTime).getDay(),
      opensAt: exception.opensAt || "00:00",
      closesAt: exception.closesAt || "00:00",
      isClosed: Boolean(exception.isClosed || !exception.opensAt || !exception.closesAt),
      note: exception.note || null,
      isException: true,
      date: exception.date
    };
  }

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

async function getCandidateTables(locationId) {
  return db.diningTable.findMany({
    where: {
      locationId,
      active: true,
      archivedAt: null
    },
    include: {
      zoneRecord: true
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
    archivedAt: null,
    status: {
      in: BLOCKING_RESERVATION_STATUSES
    },
    OR: [
      {
        tableId: {
          not: null
        }
      },
      {
        tableIds: {
          isEmpty: false
        }
      }
    ],
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
      tableIds: true,
      dateTime: true
    }
  });
}

function extractReservationTableIds(reservation) {
  return [...new Set([reservation.tableId, ...(reservation.tableIds || [])].filter(Boolean))];
}

function getOccupiedTableIds({ reservations, start, end, durationMinutes }) {
  const occupied = new Set();

  for (const reservation of reservations) {
    const reservationWindow = getReservationWindow(reservation.dateTime, durationMinutes);

    if (
      !windowsOverlap(start, end, reservationWindow.start, reservationWindow.end)
    ) {
      continue;
    }

    for (const tableId of extractReservationTableIds(reservation)) {
      occupied.add(tableId);
    }
  }

  return occupied;
}

function compareAssignments(left, right) {
  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  const leftOverflow = left.totalSeats - left.guests;
  const rightOverflow = right.totalSeats - right.guests;

  if (leftOverflow !== rightOverflow) {
    return leftOverflow - rightOverflow;
  }

  if (left.tables.length !== right.tables.length) {
    return left.tables.length - right.tables.length;
  }

  if (left.totalSeats !== right.totalSeats) {
    return left.totalSeats - right.totalSeats;
  }

  return left.code.localeCompare(right.code, "it", {
    numeric: true,
    sensitivity: "base"
  });
}

function buildTableLookup(tables) {
  return new Map(tables.map((table) => [table.id, table]));
}

function areTablesConnectable(left, right) {
  return (
    left.combinableWithIds?.includes(right.id) ||
    right.combinableWithIds?.includes(left.id)
  );
}

function buildAssignment(tables, guests) {
  return {
    guests,
    tables,
    tableIds: tables.map((table) => table.id),
    primaryTable: tables[0] || null,
    totalSeats: tables.reduce((sum, table) => sum + table.seats, 0),
    code: tables.map((table) => table.code).join(" + "),
    isCombined: tables.length > 1
  };
}

function findSingleTableAssignment(availableTables, guests) {
  const candidates = availableTables.filter((table) => table.seats >= guests);
  return candidates.length > 0 ? buildAssignment([candidates[0]], guests) : null;
}

function findCombinedTableAssignment(availableTables, guests) {
  const lookup = buildTableLookup(availableTables);
  const candidates = [];

  function expand(currentTables, remainingTables) {
    const assignment = buildAssignment(currentTables, guests);

    if (assignment.totalSeats >= guests) {
      candidates.push(assignment);
      return;
    }

    if (currentTables.length >= MAX_COMBINATION_SIZE) {
      return;
    }

    const currentIds = new Set(currentTables.map((table) => table.id));
    const connectedNextTables = remainingTables.filter((table) =>
      currentTables.some((currentTable) => areTablesConnectable(currentTable, table))
    );

    for (const table of connectedNextTables) {
      if (currentIds.has(table.id)) {
        continue;
      }

      const nextTables = [...currentTables, table].sort((left, right) =>
        left.code.localeCompare(right.code, "it", {
          numeric: true,
          sensitivity: "base"
        })
      );
      const nextRemaining = remainingTables.filter((item) => item.id !== table.id);
      expand(nextTables, nextRemaining);
    }
  }

  for (const table of availableTables) {
    const combinableIds = new Set(table.combinableWithIds || []);
    const connectedTables = availableTables.filter((candidate) => {
      if (candidate.id === table.id) {
        return false;
      }

      const canConnect =
        combinableIds.has(candidate.id) || candidate.combinableWithIds?.includes(table.id);
      const sameZone =
        (candidate.zoneId && table.zoneId && candidate.zoneId === table.zoneId) ||
        (!candidate.zoneId && !table.zoneId);

      return canConnect && sameZone;
    });

    if (connectedTables.length === 0) {
      continue;
    }

    expand([lookup.get(table.id)], connectedTables);
  }

  return candidates.sort(compareAssignments)[0] || null;
}

function findAssignmentFromAvailableTables(availableTables, guests) {
  const singleAssignment = findSingleTableAssignment(availableTables, guests);

  if (singleAssignment) {
    return singleAssignment;
  }

  return findCombinedTableAssignment(availableTables, guests);
}

function buildSlotAvailabilityResult({
  slot,
  tables,
  availableTables,
  assignment,
  guests,
  slotOptimizationEnabled
}) {
  if (!assignment) {
    return {
      ...slot,
      available: false,
      availableTableCount: 0,
      assignedSeats: 0,
      slotScore: 0,
      recommended: false,
      recommendationReason: "Slot saturo per questo numero di coperti.",
      fitLabel: "Saturato",
      overflowSeats: null,
      tableLabel: "",
      isCombinedAssignment: false
    };
  }

  const overflowSeats = Math.max(assignment.totalSeats - guests, 0);
  const combinationPenalty = Math.max(assignment.tables.length - 1, 0) * 14;
  const occupancyRatio = tables.length > 0 ? (tables.length - availableTables.length) / tables.length : 0;
  const fitBonus = clamp(28 - overflowSeats * 7, 0, 28);
  const densityBonus = Math.round(occupancyRatio * 18);
  const slotScore = slotOptimizationEnabled
    ? clamp(52 + fitBonus + densityBonus - combinationPenalty, 0, 100)
    : 0;

  let fitLabel = "Compatibile";
  let recommendationReason = "Tavolo compatibile disponibile.";

  if (overflowSeats === 0 && assignment.tables.length === 1) {
    fitLabel = "Fit perfetto";
    recommendationReason = "Combacia con il tavolo ideale senza sprecare coperti.";
  } else if (assignment.tables.length > 1) {
    fitLabel = "Combinazione";
    recommendationReason = "Richiede una combinazione tavoli per soddisfare il gruppo.";
  } else if (overflowSeats <= 2) {
    fitLabel = "Buon fit";
    recommendationReason = "Buon compromesso tra capienza e saturazione della sala.";
  } else {
    fitLabel = "Capienza ampia";
    recommendationReason = "Disponibile ma con tavolo piu' grande del necessario.";
  }

  return {
    ...slot,
    available: true,
    availableTableCount: assignment.tables.length,
    assignedSeats: assignment.totalSeats,
    slotScore,
    recommended: false,
    recommendationReason,
    fitLabel,
    overflowSeats,
    tableLabel: assignment.code,
    isCombinedAssignment: assignment.isCombined
  };
}

function findRequestedSingleTableAssignment(availableTables, guests, requestedTableId) {
  const requestedTable = availableTables.find((table) => table.id === requestedTableId);

  if (!requestedTable || requestedTable.seats < guests) {
    return null;
  }

  return buildAssignment([requestedTable], guests);
}

async function getAvailableTablesForReservationWindow({
  locationId,
  dateTime,
  durationMinutes,
  excludeReservationId
}) {
  const tables = await getCandidateTables(locationId);

  if (tables.length === 0) {
    return {
      tables: [],
      availableTables: [],
      occupiedTableIds: new Set()
    };
  }

  const { start, end } = getReservationWindow(dateTime, durationMinutes);
  const reservations = await getBlockingReservations({
    locationId,
    start,
    end,
    durationMinutes,
    excludeReservationId
  });
  const occupiedTableIds = getOccupiedTableIds({
    reservations,
    start,
    end,
    durationMinutes
  });

  return {
    tables,
    availableTables: tables.filter((table) => !occupiedTableIds.has(table.id)),
    occupiedTableIds
  };
}

export async function findAssignableTables(
  locationId,
  guests,
  dateTime,
  durationMinutes,
  excludeReservationId
) {
  const tables = await getCandidateTables(locationId);

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
  const occupiedTableIds = getOccupiedTableIds({
    reservations,
    start,
    end,
    durationMinutes
  });
  const availableTables = tables.filter((table) => !occupiedTableIds.has(table.id));

  if (availableTables.length === 0) {
    return null;
  }

  return findAssignmentFromAvailableTables(availableTables, guests);
}

export async function findRequestedTableAssignment(
  locationId,
  requestedTableId,
  guests,
  dateTime,
  durationMinutes,
  excludeReservationId
) {
  const { availableTables } = await getAvailableTablesForReservationWindow({
    locationId,
    dateTime,
    durationMinutes,
    excludeReservationId
  });

  return findRequestedSingleTableAssignment(availableTables, guests, requestedTableId);
}

export async function findAssignableTable(
  locationId,
  guests,
  dateTime,
  durationMinutes,
  excludeReservationId
) {
  const assignment = await findAssignableTables(
    locationId,
    guests,
    dateTime,
    durationMinutes,
    excludeReservationId
  );

  return assignment?.primaryTable || null;
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
  const openingHour = getOpeningHourForDate(
    location.openingHours,
    parseDateInput(dateText),
    location.openingExceptions || []
  );
  const slots = generateReservationSlots({
    dateText,
    openingHour,
    durationMinutes: settings.durationMinutes || 120,
    slotIntervalMinutes: settings.slotIntervalMinutes || 30,
    leadTimeMinutes: settings.leadTimeMinutes || 60
  });
  const tables = await getCandidateTables(location.id);
  const slotOptimizationEnabled = location.technicalSettings?.slotOptimizationEnabled !== false;

  if (slots.length === 0 || tables.length === 0) {
    return slots.map((slot) => ({
      ...slot,
      available: false,
      availableTableCount: 0,
      assignedSeats: 0,
      slotScore: 0,
      recommended: false,
      recommendationReason: "Nessun tavolo disponibile per la sede selezionata.",
      fitLabel: "Non disponibile",
      overflowSeats: null,
      tableLabel: "",
      isCombinedAssignment: false
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

  const slotResults = await Promise.all(
    slots.map(async (slot) => {
      const window = getReservationWindow(slot.dateTime, settings.durationMinutes || 120);
      const occupiedTableIds = getOccupiedTableIds({
        reservations,
        start: window.start,
        end: window.end,
        durationMinutes: settings.durationMinutes || 120
      });
      const availableTables = tables.filter((table) => !occupiedTableIds.has(table.id));
      const assignment = findAssignmentFromAvailableTables(availableTables, guests);

      return buildSlotAvailabilityResult({
        slot,
        tables,
        availableTables,
        assignment,
        guests,
        slotOptimizationEnabled
      });
    })
  );

  if (!slotOptimizationEnabled) {
    return slotResults;
  }

  const recommendedValues = new Set(
    [...slotResults]
      .filter((slot) => slot.available)
      .sort((left, right) => {
        if ((right.slotScore || 0) !== (left.slotScore || 0)) {
          return (right.slotScore || 0) - (left.slotScore || 0);
        }

        if ((left.overflowSeats ?? 99) !== (right.overflowSeats ?? 99)) {
          return (left.overflowSeats ?? 99) - (right.overflowSeats ?? 99);
        }

        return new Date(left.dateTime) - new Date(right.dateTime);
      })
      .slice(0, 3)
      .map((slot) => slot.value)
  );

  return slotResults.map((slot) => ({
    ...slot,
    recommended: recommendedValues.has(slot.value)
  }));
}

export async function getFloorPlanAvailability({
  location,
  guests,
  dateTime,
  excludeReservationId
}) {
  const durationMinutes = location.settings?.durationMinutes || 120;
  const { tables, availableTables, occupiedTableIds } =
    await getAvailableTablesForReservationWindow({
      locationId: location.id,
      dateTime,
      durationMinutes,
      excludeReservationId
    });
  const availableLookup = new Set(availableTables.map((table) => table.id));

  return {
    tables: tables.map((table) => ({
      ...table,
      available: availableLookup.has(table.id),
      selectable: availableLookup.has(table.id) && table.seats >= guests,
      occupied: occupiedTableIds.has(table.id)
    }))
  };
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
      technicalSettings: true,
      openingExceptions: true
    }
  });

  if (!location) {
    return [];
  }

  const durationMinutes = location.settings?.durationMinutes || 120;
  const waitlistEntries = await db.waitlistEntry.findMany({
    where: {
      locationId,
      archivedAt: null,
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
    include: {
      customerProfile: true
    },
    orderBy: [{ preferredDateTime: "asc" }, { createdAt: "asc" }]
  });
  const sortedWaitlistEntries = sortWaitlistEntriesByPriority(
    waitlistEntries.map((entry) => ({
      ...entry,
      customerBand: entry.customerProfile?.band || entry.customerBand,
      priorityScore: entry.customerProfile?.priorityScore || entry.priorityScore
    })),
    location.technicalSettings || {}
  );

  const converted = [];

  for (const entry of sortedWaitlistEntries) {
    const assignment = await findAssignableTables(
      entry.locationId,
      entry.guests,
      entry.preferredDateTime,
      durationMinutes
    );

    if (!assignment) {
      continue;
    }

    const customerProfile =
      entry.customerProfile ||
      (await ensureCustomerProfile({
        guestName: entry.guestName,
        guestEmail: entry.guestEmail,
        guestPhone: entry.guestPhone
      }));
    const customerSnapshot = buildCustomerSnapshot(
      customerProfile,
      location.technicalSettings || {}
    );

    const reservation = await db.reservation.create({
      data: {
        locationId: entry.locationId,
        tableId: assignment.primaryTable.id,
        tableIds: assignment.tableIds,
        manageToken: randomBytes(24).toString("hex"),
        customerProfileId: customerProfile?.id || null,
        guestName: entry.guestName,
        guestEmail: entry.guestEmail,
        guestPhone: entry.guestPhone,
        guests: entry.guests,
        dateTime: entry.preferredDateTime,
        notes: entry.notes,
        status: "CONFERMATA",
        source: "WAITLIST",
        customerBand: customerSnapshot.band,
        customerPriorityScore: customerSnapshot.priorityScore,
        depositRequired: customerSnapshot.depositRequired,
        depositAmount: customerSnapshot.depositAmount
      }
    });

    await db.waitlistEntry.update({
      where: {
        id: entry.id
      },
      data: {
        status: "CONVERTED",
        reservationId: reservation.id,
        notifiedAt: new Date(),
        customerProfileId: customerProfile?.id || null,
        customerBand: customerSnapshot.band,
        priorityScore: customerSnapshot.priorityScore
      }
    });

    if (customerProfile?.id) {
      const syncedProfile = await syncCustomerProfileMetrics(customerProfile.id);
      const syncedSnapshot = buildCustomerSnapshot(
        syncedProfile,
        location.technicalSettings || {}
      );

      await db.reservation.update({
        where: {
          id: reservation.id
        },
        data: {
          customerBand: syncedSnapshot.band,
          customerPriorityScore: syncedSnapshot.priorityScore,
          depositRequired: syncedSnapshot.depositRequired,
          depositAmount: syncedSnapshot.depositAmount
        }
      });
    }

    await createAuditLog({
      locationId: entry.locationId,
      reservationId: reservation.id,
      entityType: "reservation",
      entityId: reservation.id,
      action: "WAITLIST_CONVERTED",
      summary: `Coda convertita in prenotazione confermata su ${assignment.code}`,
      metadata: {
        waitlistEntryId: entry.id,
        preferredDateTime: entry.preferredDateTime.toISOString(),
        tableIds: assignment.tableIds
      }
    });

    converted.push({
      entry,
      reservation,
      assignment,
      table: assignment.primaryTable,
      location
    });
  }

  return converted;
}
