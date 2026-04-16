"use client";

import { useActionState, useEffect, useState } from "react";
import { createPublicReservationAction } from "../lib/actions/public-actions";

const initialState = {
  error: "",
  success: "",
  canJoinWaitlist: false
};

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function PublicReservationForm({ locations }) {
  const [state, action, pending] = useActionState(
    createPublicReservationAction,
    initialState
  );
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [selectedDate, setSelectedDate] = useState(todayValue());
  const [guests, setGuests] = useState("2");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [slotState, setSlotState] = useState({
    loading: false,
    error: "",
    slots: []
  });

  const selectedLocation = locations.find((location) => location.id === locationId) || null;
  const usesTimeSlots = selectedLocation?.settings?.useTimeSlots ?? true;

  useEffect(() => {
    let cancelled = false;

    async function loadSlots() {
      if (!usesTimeSlots || !locationId || !selectedDate) {
        setSlotState({
          loading: false,
          error: "",
          slots: []
        });
        return;
      }

      setSlotState((current) => ({
        ...current,
        loading: true,
        error: ""
      }));

      try {
        const response = await fetch(
          `/api/public/reservation-slots?locationId=${encodeURIComponent(locationId)}&date=${encodeURIComponent(selectedDate)}&guests=${encodeURIComponent(guests || "2")}`,
          {
            cache: "no-store"
          }
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Impossibile caricare gli slot.");
        }

        if (cancelled) {
          return;
        }

        setSlotState({
          loading: false,
          error: "",
          slots: payload.slots || []
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSlotState({
          loading: false,
          error: error.message || "Impossibile caricare gli slot.",
          slots: []
        });
      }
    }

    loadSlots();

    return () => {
      cancelled = true;
    };
  }, [guests, locationId, selectedDate, usesTimeSlots]);

  useEffect(() => {
    if (!usesTimeSlots) {
      return;
    }

    const existing = slotState.slots.find((slot) => slot.value === selectedSlot);

    if (existing) {
      return;
    }

    const nextSlot =
      slotState.slots.find((slot) => slot.available)?.value ||
      slotState.slots[0]?.value ||
      "";

    setSelectedSlot(nextSlot);
  }, [selectedSlot, slotState.slots, usesTimeSlots]);

  return (
    <form action={action} className="panel-card form-panel">
      <div className="panel-header">
        <div>
          <h2>Richiedi una prenotazione</h2>
          <p>
            Scegli sede, data e coperti. Se uno slot non e&apos; disponibile puoi iscriverti alla coda.
          </p>
        </div>
        {usesTimeSlots ? (
          <span className="location-chip highlighted">Prenotazione a slot</span>
        ) : (
          <span className="location-chip">Orario libero</span>
        )}
      </div>

      <div className="form-grid">
        <label>
          <span>Sede</span>
          <select
            name="locationId"
            onChange={(event) => setLocationId(event.target.value)}
            required
            value={locationId}
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {(location.publicName || location.name)} - {location.city}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Numero ospiti</span>
          <input
            max={selectedLocation?.settings?.maxGuests || 12}
            min={selectedLocation?.settings?.minGuests || 1}
            name="guests"
            onChange={(event) => setGuests(event.target.value)}
            type="number"
            value={guests}
          />
        </label>

        {usesTimeSlots ? (
          <>
            <label>
              <span>Data</span>
              <input
                onChange={(event) => setSelectedDate(event.target.value)}
                required
                type="date"
                value={selectedDate}
              />
            </label>
            <label>
              <span>Slot orario</span>
              <select
                onChange={(event) => setSelectedSlot(event.target.value)}
                required
                value={selectedSlot}
              >
                {slotState.slots.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label} {slot.available ? "• disponibile" : "• non disponibile"}
                  </option>
                ))}
              </select>
            </label>
            <input name="dateTime" type="hidden" value={selectedSlot} />
          </>
        ) : (
          <label>
            <span>Data e ora</span>
            <input name="dateTime" required type="datetime-local" />
          </label>
        )}

        <label>
          <span>Nome e cognome</span>
          <input name="guestName" required type="text" />
        </label>
        <label>
          <span>Email</span>
          <input name="guestEmail" type="email" />
        </label>
        <label>
          <span>Telefono</span>
          <input name="guestPhone" type="text" />
        </label>
      </div>

      {usesTimeSlots ? (
        <div className="helper-copy">
          {slotState.loading
            ? "Sto caricando gli slot disponibili..."
            : slotState.error
              ? slotState.error
              : slotState.slots.length === 0
                ? "Nessuno slot disponibile per la data selezionata."
                : "Gli slot sono generati in base agli orari della sede e alla durata tavolo configurata."}
        </div>
      ) : null}

      <label>
        <span>Note</span>
        <textarea
          name="notes"
          placeholder="Allergie, seggiolone, richieste speciali..."
          rows="4"
        />
      </label>

      {state?.error ? <p className="form-error">{state.error}</p> : null}
      {state?.success ? <p className="form-success">{state.success}</p> : null}

      <div className="cta-row">
        <button
          className="button button-primary"
          disabled={pending || (usesTimeSlots && !selectedSlot)}
          name="intent"
          type="submit"
          value="reservation"
        >
          {pending ? "Invio in corso..." : "Prenota"}
        </button>

        <button
          className="button button-muted"
          disabled={
            pending ||
            (usesTimeSlots
              ? !selectedSlot ||
                (!state.canJoinWaitlist &&
                  slotState.slots.length > 0 &&
                  slotState.slots.find((slot) => slot.value === selectedSlot)?.available)
              : false)
          }
          name="intent"
          type="submit"
          value="waitlist"
        >
          Iscrivimi alla coda
        </button>
      </div>
    </form>
  );
}
