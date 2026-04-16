"use client";

import { startTransition, useActionState, useDeferredValue, useState } from "react";
import { updateReservationAction } from "../lib/actions/admin-actions";
import {
  RESERVATION_SOURCE_LABELS,
  RESERVATION_STATUS_LABELS
} from "../lib/constants";
import { formatDateTime } from "../lib/format";

const statusOrder = ["ALL", ...Object.keys(RESERVATION_STATUS_LABELS)];
const actionInitialState = {
  error: "",
  success: ""
};

function matchesSearch(reservation, normalizedQuery) {
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    reservation.guestName,
    reservation.guestEmail,
    reservation.guestPhone,
    reservation.locationName,
    reservation.table?.code,
    ...(reservation.assignedTableCodes || []),
    reservation.notes
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function isVisibleInAllView(reservation, now) {
  if (reservation.status === "CANCELLATA") {
    return false;
  }

  if (reservation.status === "COMPLETATA") {
    const cutoff = new Date(reservation.dateTime);
    cutoff.setHours(24, 0, 0, 0);
    return now < cutoff;
  }

  return true;
}

function ReservationRow({ reservation, canManageReservations }) {
  const [state, action, pending] = useActionState(
    updateReservationAction,
    actionInitialState
  );

  return (
    <form action={action} className="entity-card">
      <input name="reservationId" type="hidden" value={reservation.id} />
      <fieldset className="form-fieldset" disabled={!canManageReservations || pending}>
        <div className="reservation-head">
          <div>
            <strong>{reservation.guestName}</strong>
            <p>
              {reservation.locationName} / {formatDateTime(reservation.dateTime)}
            </p>
          </div>
          <div className="row-meta">
            <span>{reservation.guests} ospiti</span>
            <span>{RESERVATION_SOURCE_LABELS[reservation.source] || reservation.source}</span>
          </div>
        </div>

        <div className="form-grid">
          <label>
            <span>Stato</span>
            <select defaultValue={reservation.status} name="status">
              {Object.entries(RESERVATION_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tavolo</span>
            <select defaultValue={reservation.tableId || ""} name="tableId">
              <option value="">Assegna automaticamente</option>
              {reservation.availableTables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.code} - {table.seats} coperti
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Email</span>
            <input defaultValue={reservation.guestEmail || ""} disabled type="text" />
          </label>
          <label>
            <span>Telefono</span>
            <input defaultValue={reservation.guestPhone || ""} disabled type="text" />
          </label>
        </div>

        {reservation.notes ? (
          <div className="note-box">
            <strong>Note</strong>
            <p>{reservation.notes}</p>
          </div>
        ) : null}

        {state.error ? <p className="form-error">{state.error}</p> : null}
        {state.success ? <p className="form-success">{state.success}</p> : null}

        <div className="entity-footer">
          <span>
            {reservation.assignedTableCodes?.length
              ? `Assegnato a ${reservation.assignedTableCodes.join(" + ")}`
              : reservation.table
                ? `Assegnato a ${reservation.table.code}`
                : "Nessun tavolo assegnato"}
          </span>
          <button className="button button-primary" type="submit">
            {pending ? "Aggiornamento..." : "Aggiorna prenotazione"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export default function AdminReservationsPanel({
  reservations,
  canManageReservations
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const now = new Date();
  const allViewReservations = reservations.filter((reservation) =>
    isVisibleInAllView(reservation, now)
  );
  const counts = reservations.reduce(
    (accumulator, reservation) => ({
      ...accumulator,
      [reservation.status]: (accumulator[reservation.status] || 0) + 1
    }),
    { ALL: allViewReservations.length }
  );

  const filteredReservations = reservations.filter((reservation) => {
    const matchesStatus =
      statusFilter === "ALL"
        ? isVisibleInAllView(reservation, now)
        : reservation.status === statusFilter;

    return matchesStatus && matchesSearch(reservation, normalizedQuery);
  });

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <h2>Gestione prenotazioni</h2>
          <p>
            Cerca per nome, cognome, email o telefono. I risultati si aggiornano mentre scrivi.
          </p>
        </div>
        <div className="row-meta">
          <span>{filteredReservations.length} risultati</span>
          <span>{allViewReservations.length} visibili in Tutte</span>
        </div>
      </div>

      <div className="reservation-toolbar">
        <label className="search-input-shell">
          <span className="sr-only">Cerca prenotazione</span>
          <input
            onChange={(event) => {
              const value = event.target.value;
              startTransition(() => {
                setQuery(value);
              });
            }}
            placeholder="Cerca per nome, email o telefono"
            type="search"
            value={query}
          />
        </label>

        <div className="status-filter-grid">
          {statusOrder.map((status) => (
            <button
              className={
                statusFilter === status
                  ? "status-filter-button active"
                  : "status-filter-button"
              }
              key={status}
              onClick={() => {
                startTransition(() => {
                  setStatusFilter(status);
                });
              }}
              type="button"
            >
              <strong>
                {status === "ALL" ? "Tutte" : RESERVATION_STATUS_LABELS[status]}
              </strong>
              <span>{counts[status] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="entity-list">
        {filteredReservations.map((reservation) => (
          <ReservationRow
            canManageReservations={canManageReservations}
            key={reservation.id}
            reservation={reservation}
          />
        ))}

        {filteredReservations.length === 0 ? (
          <p className="empty-copy">
            Nessuna prenotazione corrisponde ai filtri correnti.
          </p>
        ) : null}
      </div>
    </section>
  );
}
