"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";

function toMinutes(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
}

function getReservationWindow(dateTime, durationMinutes) {
  const start = new Date(dateTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return { start, end };
}

async function findAssignableTable(locationId, guests, dateTime, durationMinutes) {
  const tables = await db.diningTable.findMany({
    where: {
      locationId,
      active: true,
      seats: {
        gte: guests
      }
    },
    orderBy: {
      seats: "asc"
    }
  });

  const { start, end } = getReservationWindow(dateTime, durationMinutes);

  for (const table of tables) {
    const overlaps = await db.reservation.count({
      where: {
        tableId: table.id,
        status: {
          notIn: ["CANCELLATA", "NO_SHOW", "COMPLETATA"]
        },
        dateTime: {
          gte: new Date(start.getTime() - durationMinutes * 60 * 1000),
          lte: end
        }
      }
    });

    if (overlaps === 0) {
      return table;
    }
  }

  return null;
}

export async function createPublicReservationAction(_, formData) {
  const state = {
    error: "",
    success: ""
  };
  const locationId = String(formData.get("locationId") || "");
  const guestName = String(formData.get("guestName") || "").trim();
  const guestEmail = String(formData.get("guestEmail") || "").trim();
  const guestPhone = String(formData.get("guestPhone") || "").trim();
  const guests = Number(formData.get("guests") || 1);
  const dateTime = new Date(String(formData.get("dateTime") || ""));
  const notes = String(formData.get("notes") || "").trim();

  if (!locationId || !guestName || Number.isNaN(dateTime.getTime())) {
    return {
      ...state,
      error: "Compila tutti i campi obbligatori."
    };
  }

  const location = await db.location.findUnique({
    where: { id: locationId },
    include: {
      settings: true,
      technicalSettings: true,
      openingHours: true
    }
  });

  if (
    !location ||
    !location.reservationEnabled ||
    location.technicalSettings?.reservationsEnabled === false
  ) {
    return {
      ...state,
      error: "La sede selezionata non accetta prenotazioni online."
    };
  }

  const weekday = dateTime.getDay();
  const hours = location.openingHours.find((item) => item.weekday === weekday);

  if (!hours || hours.isClosed) {
    return {
      ...state,
      error: "La sede e' chiusa nel giorno selezionato."
    };
  }

  const incomingMinutes = dateTime.getHours() * 60 + dateTime.getMinutes();

  if (
    incomingMinutes < toMinutes(hours.opensAt) ||
    incomingMinutes > toMinutes(hours.closesAt)
  ) {
    return {
      ...state,
      error: "L'orario selezionato non rientra nell'apertura della sede."
    };
  }

  const settings = location.settings || {
    durationMinutes: 120,
    leadTimeMinutes: 60,
    minGuests: 1,
    maxGuests: 8
  };

  if (settings.requireEmail && !guestEmail) {
    return {
      ...state,
      error: "Per questa sede l'email e' obbligatoria."
    };
  }

  if (settings.requirePhone && !guestPhone) {
    return {
      ...state,
      error: "Per questa sede il telefono e' obbligatorio."
    };
  }

  if (guests < settings.minGuests || guests > settings.maxGuests) {
    return {
      ...state,
      error: "Il numero di ospiti non rientra nei limiti configurati."
    };
  }

  const minutesUntilReservation = Math.floor(
    (dateTime.getTime() - Date.now()) / (60 * 1000)
  );

  if (minutesUntilReservation < settings.leadTimeMinutes) {
    return {
      ...state,
      error: "La prenotazione richiede piu' anticipo."
    };
  }

  const table = await findAssignableTable(
    locationId,
    guests,
    dateTime,
    settings.durationMinutes
  );

  await db.reservation.create({
    data: {
      locationId,
      tableId: table?.id || null,
      guestName,
      guestEmail: guestEmail || null,
      guestPhone: guestPhone || null,
      guests,
      dateTime,
      notes: notes || null,
      status: table ? "CONFERMATA" : "IN_ATTESA",
      source: "PUBBLICA"
    }
  });

  revalidatePath("/prenota");
  revalidatePath("/admin");
  revalidatePath("/admin/prenotazioni");

  return {
    ...state,
    success: table
      ? "Prenotazione registrata e tavolo assegnato."
      : "Richiesta registrata. Il tavolo verra' assegnato dal ristorante."
  };
}
