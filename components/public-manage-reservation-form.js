"use client";

import { useActionState, useEffect, useState } from "react";
import {
  cancelPublicReservationAction,
  updatePublicReservationAction
} from "../lib/actions/public-actions";
import { dateInputValue, formatDateTime } from "../lib/format";

const initialState = {
  error: "",
  success: "",
  canJoinWaitlist: false
};

export default function PublicManageReservationForm({ reservation }) {
  const [updateState, updateAction, updatePending] = useActionState(
    updatePublicReservationAction,
    initialState
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelPublicReservationAction,
    initialState
  );
  const [selectedDate, setSelectedDate] = useState(dateInputValue(reservation.dateTime).slice(0, 10));
  const [guests, setGuests] = useState(String(reservation.guests));
  const [selectedSlot, setSelectedSlot] = useState(dateInputValue(reservation.dateTime));
  const [slotState, setSlotState] = useState({
    loading: false,
    error: "",
    slots: []
  });

  const usesTimeSlots = reservation.location.settings?.useTimeSlots ?? true;
  const isLocked = ["CANCELLATA", "COMPLETATA", "NO_SHOW"].includes(reservation.status);

  useEffect(() => {
    let cancelled = false;

    async function loadSlots() {
      if (!usesTimeSlots || !selectedDate) {
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
          `/api/public/reservation-slots?locationId=${encodeURIComponent(reservation.locationId)}&date=${encodeURIComponent(selectedDate)}&guests=${encodeURIComponent(guests)}&reservationToken=${encodeURIComponent(reservation.manageToken)}`,
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
  }, [guests, reservation.locationId, reservation.manageToken, selectedDate, usesTimeSlots]);

  useEffect(() => {
    if (!usesTimeSlots) {
      return;
    }

    const current = slotState.slots.find((slot) => slot.value === selectedSlot);

    if (current) {
      return;
    }

    setSelectedSlot(
      slotState.slots.find((slot) => slot.available)?.value ||
        slotState.slots[0]?.value ||
        ""
    );
  }, [selectedSlot, slotState.slots, usesTimeSlots]);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <h2>Gestisci la tua prenotazione</h2>
          <p>
            {reservation.locationName} / {formatDateTime(reservation.dateTime)}
          </p>
        </div>
        <div className="row-meta">
          <span>{reservation.guests} coperti</span>
          <span>{reservation.status}</span>
        </div>
      </div>

      <form action={updateAction} className="entity-form">
        <input name="manageToken" type="hidden" value={reservation.manageToken || ""} />
        <input name="locationId" type="hidden" value={reservation.locationId} />

        <fieldset className="form-fieldset" disabled={isLocked || updatePending || cancelPending}>
          <div className="form-grid">
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
                <input
                  defaultValue={dateInputValue(reservation.dateTime)}
                  name="dateTime"
                  required
                  type="datetime-local"
                />
              </label>
            )}

            <label>
              <span>Coperti</span>
              <input
                max={reservation.location.settings?.maxGuests || 12}
                min={reservation.location.settings?.minGuests || 1}
                name="guests"
                onChange={(event) => setGuests(event.target.value)}
                type="number"
                value={guests}
              />
            </label>
            <label>
              <span>Nome e cognome</span>
              <input defaultValue={reservation.guestName} name="guestName" required type="text" />
            </label>
            <label>
              <span>Email</span>
              <input defaultValue={reservation.guestEmail || ""} name="guestEmail" type="email" />
            </label>
            <label>
              <span>Telefono</span>
              <input defaultValue={reservation.guestPhone || ""} name="guestPhone" type="text" />
            </label>
          </div>

          {usesTimeSlots ? (
            <div className="helper-copy">
              {slotState.loading
                ? "Sto caricando gli slot disponibili..."
                : slotState.error || "Scegli uno slot disponibile per aggiornare la prenotazione."}
            </div>
          ) : null}

          <label>
            <span>Note</span>
            <textarea defaultValue={reservation.notes || ""} name="notes" rows="4" />
          </label>

          {updateState.error ? <p className="form-error">{updateState.error}</p> : null}
          {updateState.success ? <p className="form-success">{updateState.success}</p> : null}
          {cancelState.error ? <p className="form-error">{cancelState.error}</p> : null}
          {cancelState.success ? <p className="form-success">{cancelState.success}</p> : null}

          <div className="entity-footer">
            <span>
              {reservation.table
                ? `Tavolo assegnato: ${reservation.table.code}`
                : "Il tavolo verra' riassegnato in base alla disponibilita'."}
            </span>
            <div className="cta-row">
              <button
                className="button button-primary"
                disabled={isLocked || (usesTimeSlots && !selectedSlot)}
                type="submit"
              >
                {updatePending ? "Aggiornamento..." : "Salva modifiche"}
              </button>
            </div>
          </div>
        </fieldset>
      </form>

      {!isLocked ? (
        <form action={cancelAction}>
          <input name="manageToken" type="hidden" value={reservation.manageToken || ""} />
          <button className="button button-danger" disabled={cancelPending} type="submit">
            {cancelPending ? "Cancellazione..." : "Cancella prenotazione"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
