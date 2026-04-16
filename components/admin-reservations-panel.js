"use client";

import {
  startTransition,
  useActionState,
  useDeferredValue,
  useEffect,
  useState
} from "react";
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

function statusTone(status) {
  if (status === "CONFERMATA" || status === "COMPLETATA") {
    return "free";
  }

  if (status === "IN_ATTESA" || status === "IN_CORSO") {
    return "scheduled";
  }

  return "failed";
}

function ReservationListItem({ active, onSelect, reservation }) {
  return (
    <button
      className={active ? "reservation-list-item active" : "reservation-list-item"}
      onClick={onSelect}
      type="button"
    >
      <div className="reservation-list-item-head">
        <strong>{reservation.guestName}</strong>
        <span className={`table-status-chip ${statusTone(reservation.status)}`}>
          {RESERVATION_STATUS_LABELS[reservation.status] || reservation.status}
        </span>
      </div>
      <p>
        {reservation.locationName} - {formatDateTime(reservation.dateTime)}
      </p>
      <div className="reservation-list-item-meta">
        <span>{reservation.guests} ospiti</span>
        <span>{reservation.assignedTableCodes?.join(" + ") || "Auto"}</span>
      </div>
    </button>
  );
}

function ReservationDetailPanel({ canManageReservations, reservation }) {
  const [state, action, pending] = useActionState(
    updateReservationAction,
    actionInitialState
  );

  if (!reservation) {
    return (
      <section className="section-card reservation-detail-empty">
        <strong>Nessuna prenotazione selezionata</strong>
        <p>Scegli una prenotazione dalla lista per vedere il dettaglio.</p>
      </section>
    );
  }

  return (
    <section className="section-card reservation-detail-panel">
      <form action={action} className="entity-form">
        <input name="reservationId" type="hidden" value={reservation.id} />
        <fieldset className="form-fieldset" disabled={!canManageReservations || pending}>
          <div className="panel-header">
            <div>
              <h2>{reservation.guestName}</h2>
              <p>
                {reservation.locationName} / {formatDateTime(reservation.dateTime)}
              </p>
            </div>
            <span className={`table-status-chip ${statusTone(reservation.status)}`}>
              {RESERVATION_STATUS_LABELS[reservation.status] || reservation.status}
            </span>
          </div>

          <div className="reservation-detail-summary">
            <div className="summary-chip">
              <strong>{reservation.guests}</strong>
              <span>ospiti</span>
            </div>
            <div className="summary-chip">
              <strong>
                {reservation.assignedTableCodes?.length
                  ? reservation.assignedTableCodes.join(" + ")
                  : "Auto"}
              </strong>
              <span>tavolo</span>
            </div>
            <div className="summary-chip">
              <strong>{RESERVATION_SOURCE_LABELS[reservation.source] || reservation.source}</strong>
              <span>origine</span>
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
              <strong>Note cliente</strong>
              <p>{reservation.notes}</p>
            </div>
          ) : null}

          <div className="info-list">
            <div>
              <strong>Creata il</strong>
              <span>{formatDateTime(reservation.createdAt)}</span>
            </div>
            <div>
              <strong>Link gestione</strong>
              <span>{reservation.manageToken ? "Disponibile" : "Non generato"}</span>
            </div>
          </div>

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
    </section>
  );
}

export default function AdminReservationsPanel({
  reservations,
  canManageReservations
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedReservationId, setSelectedReservationId] = useState(reservations[0]?.id || "");
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

  useEffect(() => {
    if (!filteredReservations.length) {
      setSelectedReservationId("");
      return;
    }

    if (!filteredReservations.some((reservation) => reservation.id === selectedReservationId)) {
      setSelectedReservationId(filteredReservations[0].id);
    }
  }, [filteredReservations, selectedReservationId]);

  const selectedReservation =
    filteredReservations.find((reservation) => reservation.id === selectedReservationId) || null;

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <h2>Gestione prenotazioni</h2>
          <p>Lista compatta a sinistra, dettaglio operativo a destra, con filtri sempre visibili.</p>
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

      <div className="reservation-workspace">
        <div className="reservation-list-shell">
          <div className="reservation-list-head">
            <strong>Prenotazioni</strong>
            <span>{filteredReservations.length} elementi</span>
          </div>

          <div className="reservation-list">
            {filteredReservations.map((reservation) => (
              <ReservationListItem
                active={reservation.id === selectedReservationId}
                key={reservation.id}
                onSelect={() => setSelectedReservationId(reservation.id)}
                reservation={reservation}
              />
            ))}

            {filteredReservations.length === 0 ? (
              <p className="empty-copy">
                Nessuna prenotazione corrisponde ai filtri correnti.
              </p>
            ) : null}
          </div>
        </div>

        <ReservationDetailPanel
          canManageReservations={canManageReservations}
          reservation={selectedReservation}
        />
      </div>
    </section>
  );
}
