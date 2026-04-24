"use client";

import { useActionState, useEffect, useState } from "react";
import { createPublicReservationAction } from "../lib/actions/public-actions";
import PublicFloorPlanPicker from "./public-floor-plan-picker";

const initialState = {
  error: "",
  success: "",
  canJoinWaitlist: false,
  priorityHint: "",
  depositNotice: "",
  paymentUrl: "",
  paymentStatus: ""
};

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function SlotRecommendationStrip({ onSelect, selectedSlot, slots, title }) {
  if (!slots.length) {
    return null;
  }

  return (
    <div className="slot-recommendation-strip">
      <strong>{title}</strong>
      <div className="slot-recommendation-list">
        {slots.map((slot) => (
          <button
            className={
              selectedSlot === slot.value
                ? "slot-recommendation-chip active"
                : "slot-recommendation-chip"
            }
            key={slot.value}
            onClick={() => onSelect(slot.value)}
            type="button"
          >
            <span>{slot.label}</span>
            <small>{slot.recommendationReason || slot.fitLabel}</small>
          </button>
        ))}
      </div>
    </div>
  );
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
  const [selectedDateTime, setSelectedDateTime] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [slotState, setSlotState] = useState({
    loading: false,
    error: "",
    slots: [],
    recommendations: [],
    optimizationEnabled: false
  });
  const [floorPlanState, setFloorPlanState] = useState({
    loading: false,
    error: "",
    enabled: false,
    zones: []
  });

  const selectedLocation = locations.find((location) => location.id === locationId) || null;
  const usesTimeSlots = selectedLocation?.settings?.useTimeSlots ?? true;
  const tableSelectionEnabled = Boolean(
    selectedLocation?.technicalSettings?.customerTableSelectionEnabled
  );
  const selectedSlotData = slotState.slots.find((slot) => slot.value === selectedSlot) || null;
  const alternativeSlots = slotState.recommendations.filter(
    (slot) => slot.value !== selectedSlot
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSlots() {
      if (!usesTimeSlots || !locationId || !selectedDate) {
        setSlotState({
          loading: false,
          error: "",
          slots: [],
          recommendations: [],
          optimizationEnabled: false
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
          slots: payload.slots || [],
          recommendations: payload.recommendations || [],
          optimizationEnabled: Boolean(payload.slotOptimizationEnabled)
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSlotState({
          loading: false,
          error: error.message || "Impossibile caricare gli slot.",
          slots: [],
          recommendations: [],
          optimizationEnabled: false
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
      setSelectedDateTime(existing.value);
      return;
    }

    const nextSlot =
      slotState.slots.find((slot) => slot.available)?.value ||
      slotState.slots[0]?.value ||
      "";

    setSelectedSlot(nextSlot);
    setSelectedDateTime(nextSlot);
  }, [selectedSlot, slotState.slots, usesTimeSlots]);

  useEffect(() => {
    if (!usesTimeSlots) {
      return;
    }

    setSelectedDateTime(selectedSlot);
  }, [selectedSlot, usesTimeSlots]);

  useEffect(() => {
    let cancelled = false;

    async function loadFloorPlan() {
      if (!tableSelectionEnabled || !locationId || !selectedDateTime) {
        setFloorPlanState({
          loading: false,
          error: "",
          enabled: false,
          zones: []
        });
        setSelectedTableId("");
        return;
      }

      setFloorPlanState((current) => ({
        ...current,
        loading: true,
        error: ""
      }));

      try {
        const response = await fetch(
          `/api/public/floor-plan?locationId=${encodeURIComponent(locationId)}&dateTime=${encodeURIComponent(selectedDateTime)}&guests=${encodeURIComponent(guests || "2")}`,
          {
            cache: "no-store"
          }
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Impossibile caricare la planimetria.");
        }

        if (cancelled) {
          return;
        }

        const nextZones = payload.zones || [];
        const stillSelected = nextZones.some((zone) =>
          zone.tables.some((table) => table.id === selectedTableId && table.selectable)
        );

        if (!stillSelected) {
          setSelectedTableId("");
        }

        setFloorPlanState({
          loading: false,
          error: "",
          enabled: Boolean(payload.enabled),
          zones: nextZones
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setFloorPlanState({
          loading: false,
          error: error.message || "Impossibile caricare la planimetria.",
          enabled: true,
          zones: []
        });
        setSelectedTableId("");
      }
    }

    loadFloorPlan();

    return () => {
      cancelled = true;
    };
  }, [guests, locationId, selectedDateTime, tableSelectionEnabled]);

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
                    {slot.label} - {slot.available ? "disponibile" : "non disponibile"}
                    {slot.recommended ? " - consigliato" : ""}
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
              name="dateTime"
              onChange={(event) => setSelectedDateTime(event.target.value)}
              required
              type="datetime-local"
            />
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

      {usesTimeSlots && selectedSlotData ? (
        <div className="slot-insight-card">
          <div>
            <strong>
              {selectedSlotData.recommended
                ? `Slot consigliato: ${selectedSlotData.label}`
                : `Slot selezionato: ${selectedSlotData.label}`}
            </strong>
            <p>{selectedSlotData.recommendationReason}</p>
          </div>
          <div className="slot-insight-meta">
            <span>{selectedSlotData.fitLabel}</span>
            {selectedSlotData.available ? (
              <span>
                {selectedSlotData.tableLabel || `${selectedSlotData.assignedSeats} coperti`}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {usesTimeSlots && slotState.optimizationEnabled ? (
        <SlotRecommendationStrip
          onSelect={(value) => {
            setSelectedSlot(value);
            setSelectedDateTime(value);
          }}
          selectedSlot={selectedSlot}
          slots={slotState.recommendations}
          title="Slot consigliati dal motore"
        />
      ) : null}

      {usesTimeSlots && selectedSlotData && !selectedSlotData.available ? (
        <SlotRecommendationStrip
          onSelect={(value) => {
            setSelectedSlot(value);
            setSelectedDateTime(value);
          }}
          selectedSlot={selectedSlot}
          slots={alternativeSlots}
          title="Alternative rapide per evitare la coda"
        />
      ) : null}

      <input name="selectedTableId" type="hidden" value={selectedTableId} />

      <PublicFloorPlanPicker
        enabled={floorPlanState.enabled}
        error={floorPlanState.error}
        loading={floorPlanState.loading}
        onSelect={setSelectedTableId}
        selectedTableId={selectedTableId}
        zones={floorPlanState.zones}
      />

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
      {state?.priorityHint ? <p className="helper-copy">{state.priorityHint}</p> : null}
      {state?.depositNotice ? <p className="form-warning">{state.depositNotice}</p> : null}
      {state?.paymentUrl ? (
        <div className="payment-callout">
          <div>
            <strong>Completa il deposito</strong>
            <p>
              Il link pagamento e' gia' pronto. Puoi aprirlo subito oppure usare quello inviato al
              cliente.
            </p>
          </div>
          <a
            className="button button-primary"
            href={state.paymentUrl}
            rel="noreferrer"
            target="_blank"
          >
            Vai al pagamento
          </a>
        </div>
      ) : null}

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
              ? !selectedSlot || Boolean(selectedSlotData?.available)
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
