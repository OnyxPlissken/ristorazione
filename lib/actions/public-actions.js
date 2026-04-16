"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import {
  convertOpenWaitlistEntries,
  findAssignableTable,
  getOpeningHourForDate,
  isWithinOpeningHours
} from "../reservations";
import {
  sendReservationManageLinkNotification,
  sendWaitlistConversionNotification
} from "../notifications";

const initialState = {
  error: "",
  success: "",
  canJoinWaitlist: false
};

function buildState(overrides = {}) {
  return {
    ...initialState,
    ...overrides
  };
}

function parseFormData(formData) {
  return {
    locationId: String(formData.get("locationId") || ""),
    guestName: String(formData.get("guestName") || "").trim(),
    guestEmail: String(formData.get("guestEmail") || "").trim(),
    guestPhone: String(formData.get("guestPhone") || "").trim(),
    guests: Number(formData.get("guests") || 1),
    dateTime: new Date(String(formData.get("dateTime") || "")),
    notes: String(formData.get("notes") || "").trim(),
    intent: String(formData.get("intent") || "reservation")
  };
}

async function getPublicLocation(locationId) {
  return db.location.findUnique({
    where: {
      id: locationId
    },
    include: {
      settings: true,
      technicalSettings: true,
      openingHours: true
    }
  });
}

function validateBasicReservationInput(payload) {
  if (!payload.locationId || !payload.guestName || Number.isNaN(payload.dateTime.getTime())) {
    return "Compila tutti i campi obbligatori.";
  }

  return "";
}

function validateReservationRules(location, payload) {
  if (
    !location ||
    !location.reservationEnabled ||
    location.technicalSettings?.reservationsEnabled === false
  ) {
    return "La sede selezionata non accetta prenotazioni online.";
  }

  const settings = location.settings || {
    durationMinutes: 120,
    leadTimeMinutes: 60,
    minGuests: 1,
    maxGuests: 8,
    requirePhone: true,
    requireEmail: true
  };
  const openingHour = getOpeningHourForDate(location.openingHours, payload.dateTime);

  if (!openingHour || openingHour.isClosed) {
    return "La sede e' chiusa nel giorno selezionato.";
  }

  if (!isWithinOpeningHours(payload.dateTime, openingHour, settings.durationMinutes || 120)) {
    return "L'orario selezionato non rientra nell'apertura della sede.";
  }

  if (settings.requireEmail && !payload.guestEmail) {
    return "Per questa sede l'email e' obbligatoria.";
  }

  if (settings.requirePhone && !payload.guestPhone) {
    return "Per questa sede il telefono e' obbligatorio.";
  }

  if (payload.guests < settings.minGuests || payload.guests > settings.maxGuests) {
    return "Il numero di ospiti non rientra nei limiti configurati.";
  }

  const minutesUntilReservation = Math.floor(
    (payload.dateTime.getTime() - Date.now()) / (60 * 1000)
  );

  if (minutesUntilReservation < settings.leadTimeMinutes) {
    return "La prenotazione richiede piu' anticipo.";
  }

  return "";
}

async function notifyConvertedWaitlistEntries(locationId, exactDateTime) {
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

export async function createPublicReservationAction(_, formData) {
  const payload = parseFormData(formData);
  const basicError = validateBasicReservationInput(payload);

  if (basicError) {
    return buildState({
      error: basicError
    });
  }

  const location = await getPublicLocation(payload.locationId);
  const rulesError = validateReservationRules(location, payload);

  if (rulesError) {
    return buildState({
      error: rulesError
    });
  }

  const durationMinutes = location.settings?.durationMinutes || 120;

  if (payload.intent === "waitlist") {
    await db.waitlistEntry.create({
      data: {
        locationId: payload.locationId,
        guestName: payload.guestName,
        guestEmail: payload.guestEmail || null,
        guestPhone: payload.guestPhone || null,
        guests: payload.guests,
        preferredDateTime: payload.dateTime,
        notes: payload.notes || null
      }
    });

    revalidatePath("/prenota");

    return buildState({
      success:
        "Ti abbiamo inserito in coda. Riceverai un messaggio se si liberera' un tavolo per lo slot scelto."
    });
  }

  const table = await findAssignableTable(
    payload.locationId,
    payload.guests,
    payload.dateTime,
    durationMinutes
  );

  if (!table) {
    return buildState({
      error:
        "Per questo slot non ci sono tavoli disponibili. Puoi iscriverti alla coda per essere avvisato se si libera un posto.",
      canJoinWaitlist: true
    });
  }

  const reservation = await db.reservation.create({
    data: {
      locationId: payload.locationId,
      tableId: table.id,
      manageToken: randomBytes(24).toString("hex"),
      guestName: payload.guestName,
      guestEmail: payload.guestEmail || null,
      guestPhone: payload.guestPhone || null,
      guests: payload.guests,
      dateTime: payload.dateTime,
      notes: payload.notes || null,
      status: "CONFERMATA",
      source: "PUBBLICA"
    }
  });

  try {
    await sendReservationManageLinkNotification(reservation, location);
  } catch (error) {
    console.error("Errore invio link prenotazione", error);
  }

  revalidatePath("/prenota");
  revalidatePath("/admin");
  revalidatePath("/admin/prenotazioni");

  return buildState({
    success:
      "Prenotazione registrata e tavolo assegnato. Abbiamo inviato il link per gestirla al cliente."
  });
}

export async function updatePublicReservationAction(_, formData) {
  const manageToken = String(formData.get("manageToken") || "");
  const payload = parseFormData(formData);

  if (!manageToken) {
    return buildState({
      error: "Link prenotazione non valido."
    });
  }

  const reservation = await db.reservation.findFirst({
    where: {
      manageToken
    },
    include: {
      location: {
        include: {
          settings: true,
          technicalSettings: true,
          openingHours: true
        }
      }
    }
  });

  if (!reservation) {
    return buildState({
      error: "Prenotazione non trovata."
    });
  }

  if (["CANCELLATA", "COMPLETATA", "NO_SHOW"].includes(reservation.status)) {
    return buildState({
      error: "Questa prenotazione non puo' piu' essere modificata."
    });
  }

  const basicError = validateBasicReservationInput({
    ...payload,
    locationId: reservation.locationId
  });

  if (basicError) {
    return buildState({
      error: basicError
    });
  }

  const rulesError = validateReservationRules(reservation.location, {
    ...payload,
    locationId: reservation.locationId
  });

  if (rulesError) {
    return buildState({
      error: rulesError
    });
  }

  const durationMinutes = reservation.location.settings?.durationMinutes || 120;
  const table = await findAssignableTable(
    reservation.locationId,
    payload.guests,
    payload.dateTime,
    durationMinutes,
    reservation.id
  );

  if (!table) {
    return buildState({
      error:
        "Per il nuovo slot non ci sono tavoli disponibili. Scegli un altro orario."
    });
  }

  await db.reservation.update({
    where: {
      id: reservation.id
    },
    data: {
      tableId: table.id,
      guestName: payload.guestName,
      guestEmail: payload.guestEmail || null,
      guestPhone: payload.guestPhone || null,
      guests: payload.guests,
      dateTime: payload.dateTime,
      notes: payload.notes || null,
      status: "CONFERMATA"
    }
  });

  if (reservation.dateTime.getTime() !== payload.dateTime.getTime()) {
    await notifyConvertedWaitlistEntries(reservation.locationId, reservation.dateTime);
  }

  revalidatePath(`/prenotazione/${manageToken}`);
  revalidatePath("/prenota");
  revalidatePath("/admin/prenotazioni");

  return buildState({
    success: "Prenotazione aggiornata con successo."
  });
}

export async function cancelPublicReservationAction(_, formData) {
  const manageToken = String(formData.get("manageToken") || "");

  if (!manageToken) {
    return buildState({
      error: "Link prenotazione non valido."
    });
  }

  const reservation = await db.reservation.findFirst({
    where: {
      manageToken
    },
    include: {
      location: {
        include: {
          settings: true,
          technicalSettings: true,
          openingHours: true
        }
      }
    }
  });

  if (!reservation) {
    return buildState({
      error: "Prenotazione non trovata."
    });
  }

  await db.reservation.update({
    where: {
      id: reservation.id
    },
    data: {
      status: "CANCELLATA",
      tableId: null
    }
  });

  await notifyConvertedWaitlistEntries(reservation.locationId, reservation.dateTime);

  revalidatePath(`/prenotazione/${manageToken}`);
  revalidatePath("/prenota");
  revalidatePath("/admin/prenotazioni");

  return buildState({
    success: "Prenotazione cancellata con successo."
  });
}
