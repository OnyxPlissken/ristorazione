"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignFloorReservationAction,
  optimizeFloorAssignmentsAction
} from "../lib/actions/admin-actions";
import {
  FLOOR_PLAN_STAGE_HEIGHT,
  FLOOR_PLAN_STAGE_WIDTH,
  resolveTableLayout
} from "../lib/floor-plan";
import { formatDateTime } from "../lib/format";

function floorTone(status) {
  if (!status) {
    return "free";
  }

  return status.tone || "free";
}

function canDropReservationOnTable(reservation, table) {
  return table.active && table.seats >= reservation.guests;
}

export default function AdminFloorServiceBoard({
  canManageReservations,
  canManageTables,
  kitchenLoad = [],
  location,
  reservations,
  selectedDate,
  zones
}) {
  const router = useRouter();
  const [activeZoneId, setActiveZoneId] = useState(zones[0]?.id || "");
  const [dragReservationId, setDragReservationId] = useState("");
  const [hoveredTableId, setHoveredTableId] = useState("");
  const [feedback, setFeedback] = useState({ error: "", success: "" });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setActiveZoneId(zones[0]?.id || "");
  }, [zones]);

  const activeZone = zones.find((zone) => zone.id === activeZoneId) || zones[0] || null;
  const zoneTableIds = new Set((activeZone?.tables || []).map((table) => table.id));
  const visibleReservations = reservations.filter((reservation) => {
    if (reservation.assignedTableIds.length === 0) {
      return true;
    }

    return reservation.assignedTableIds.some((tableId) => zoneTableIds.has(tableId));
  });
  const unassignedReservations = visibleReservations.filter(
    (reservation) => reservation.assignedTableIds.length === 0
  );
  const yieldEngineEnabled = Boolean(location?.technicalSettings?.yieldEngineEnabled);
  const peakKitchenLoad = [...kitchenLoad].sort((left, right) => right.covers - left.covers)[0] || null;

  async function assignReservation(tableId) {
    if (!dragReservationId || !canManageReservations) {
      return;
    }

    const formData = new FormData();
    formData.set("reservationId", dragReservationId);
    formData.set("tableId", tableId);

    startTransition(async () => {
      const result = await assignFloorReservationAction(formData);
      setFeedback({
        error: result?.error || "",
        success: result?.success || ""
      });
      setDragReservationId("");
      setHoveredTableId("");
      router.refresh();
    });
  }

  async function optimizeAssignments() {
    if (!canManageReservations || !location?.id) {
      return;
    }

    const formData = new FormData();
    formData.set("locationId", location.id);
    formData.set("date", selectedDate);

    startTransition(async () => {
      const result = await optimizeFloorAssignmentsAction(formData);
      setFeedback({
        error: result?.error || "",
        success: result?.success || ""
      });
      setDragReservationId("");
      setHoveredTableId("");
      router.refresh();
    });
  }

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <h2>Mappa sala drag and drop</h2>
          <p>Trascina una prenotazione sul tavolo compatibile per assegnarla o spostarla al volo.</p>
        </div>
        <div className="row-meta">
          <span>{location.name}</span>
          <span>{selectedDate}</span>
          {canManageTables ? (
            <Link className="button button-muted" href={`/admin/tavoli?locationId=${location.id}&view=layout`}>
              Apri editor layout
            </Link>
          ) : null}
          {canManageReservations && yieldEngineEnabled ? (
            <button
              className="button button-secondary"
              disabled={pending}
              onClick={() => void optimizeAssignments()}
              type="button"
            >
              Ottimizza assegnazioni
            </button>
          ) : null}
        </div>
      </div>

      <div className="admin-floor-service">
        <aside className="admin-floor-service-sidebar">
          <div className="admin-floor-zone-tabs">
            {zones.map((zone) => (
              <button
                className={zone.id === activeZone?.id ? "location-pill active" : "location-pill"}
                key={zone.id}
                onClick={() => setActiveZoneId(zone.id)}
                type="button"
              >
                <strong>{zone.name}</strong>
                <span>{zone.tables.length} tavoli</span>
              </button>
            ))}
          </div>

          <div className="note-box">
            <strong>Da assegnare</strong>
            <p>
              {unassignedReservations.length
                ? `${unassignedReservations.length} prenotazioni senza tavolo nella zona corrente.`
                : "Nessuna prenotazione da assegnare in questa zona."}
            </p>
          </div>

          {peakKitchenLoad ? (
            <div className="note-box">
              <strong>Picco cucina</strong>
              <p>
                {peakKitchenLoad.label}: {peakKitchenLoad.covers}
                {peakKitchenLoad.maxCovers ? `/${peakKitchenLoad.maxCovers}` : ""} coperti
                {peakKitchenLoad.overloaded ? " - oltre soglia" : ""}
              </p>
            </div>
          ) : null}

          <div className="floor-drag-list">
            {unassignedReservations.map((reservation) => (
              <button
                className="floor-drag-card"
                draggable={canManageReservations}
                key={reservation.id}
                onDragEnd={() => {
                  setDragReservationId("");
                  setHoveredTableId("");
                }}
                onDragStart={() => setDragReservationId(reservation.id)}
                type="button"
              >
                <strong>{reservation.guestName}</strong>
                <span>{reservation.guests} coperti</span>
                <small>{formatDateTime(reservation.dateTime)}</small>
                {reservation.engineScore ? (
                  <small>
                    Motore {reservation.engineRank} / {reservation.engineScore}:{" "}
                    {reservation.recommendedTableCodes?.join(" + ")}
                  </small>
                ) : null}
                {reservation.engineReason ? <small>{reservation.engineReason}</small> : null}
              </button>
            ))}
          </div>

          {feedback.error ? <p className="form-error">{feedback.error}</p> : null}
          {feedback.success ? <p className="form-success">{feedback.success}</p> : null}
        </aside>

        <div className="admin-floor-stage-wrap">
          <div
            className="admin-floor-stage admin-floor-stage-live"
            style={{
              width: `${FLOOR_PLAN_STAGE_WIDTH}px`,
              height: `${FLOOR_PLAN_STAGE_HEIGHT}px`
            }}
          >
            {activeZone?.tables.map((table, index) => {
              const layout = resolveTableLayout(table, index);
              const canDrop = dragReservationId
                ? canDropReservationOnTable(
                    reservations.find((reservation) => reservation.id === dragReservationId) || {
                      guests: Number.MAX_SAFE_INTEGER
                    },
                    table
                  )
                : false;

              return (
                <div
                  className={[
                    "admin-floor-live-node",
                    `tone-${floorTone(table.floorStatus)}`,
                    hoveredTableId === table.id && canDrop ? "drop-target" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={table.id}
                  onDragLeave={() => setHoveredTableId((current) => (current === table.id ? "" : current))}
                  onDragOver={(event) => {
                    if (!canManageReservations || !dragReservationId || !canDrop) {
                      return;
                    }

                    event.preventDefault();
                    setHoveredTableId(table.id);
                  }}
                  onDrop={(event) => {
                    if (!canManageReservations || !dragReservationId || !canDrop) {
                      return;
                    }

                    event.preventDefault();
                    void assignReservation(table.id);
                  }}
                  style={{
                    left: `${layout.x}px`,
                    top: `${layout.y}px`,
                    width: `${layout.width}px`,
                    height: `${layout.height}px`,
                    transform: `rotate(${layout.rotation || 0}deg)`,
                    borderRadius: layout.shape === "ROUND" ? "999px" : "14px"
                  }}
                >
                  <div className="admin-floor-live-head">
                    <strong>{table.code}</strong>
                    <span>{table.seats}</span>
                  </div>

                  <div className="admin-floor-live-status">
                    <span className={`table-status-chip ${floorTone(table.floorStatus)}`}>
                      {table.floorStatus?.label || "Libero"}
                    </span>
                  </div>

                  <div className="admin-floor-live-reservations">
                    {(table.reservations || []).slice(0, 2).map((reservation) => (
                      <button
                        className="admin-floor-live-chip"
                        draggable={canManageReservations}
                        key={`${table.id}-${reservation.id}`}
                        onDragEnd={() => {
                          setDragReservationId("");
                          setHoveredTableId("");
                        }}
                        onDragStart={() => setDragReservationId(reservation.id)}
                        type="button"
                      >
                        {reservation.guestName}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="admin-floor-service-sidebar">
          <div className="note-box">
            <strong>Zona attiva</strong>
            <p>
              {activeZone?.name || "Nessuna zona"} / {(activeZone?.tables || []).length} tavoli
            </p>
          </div>

          <div className="floor-drag-list">
            {visibleReservations.map((reservation) => (
              <Link
                className="floor-reservation-summary"
                href={`/admin/prenotazioni?reservationId=${reservation.id}`}
                key={`summary-${reservation.id}`}
              >
                <strong>{reservation.guestName}</strong>
                <span>{reservation.guests} coperti</span>
                <small>
                  {reservation.assignedTableCodes.length
                    ? reservation.assignedTableCodes.join(" + ")
                    : "Da assegnare"}
                </small>
              </Link>
            ))}
          </div>

          <p className="helper-copy">
            I tavoli evidenziati durante il drag sono compatibili per capienza e slot.
          </p>
          {pending ? <p className="helper-copy">Aggiornamento sala in corso...</p> : null}
        </aside>
      </div>
    </section>
  );
}
