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
  CUSTOMER_SCORE_BAND_LABELS,
  RESERVATION_SOURCE_LABELS,
  RESERVATION_STATUS_LABELS,
  customerBandTone
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
  const assignedTableLabel = reservation.assignedTableCodes?.length
    ? reservation.assignedTableCodes.join(" + ")
    : "Auto";
  const contactLabel = reservation.guestEmail || reservation.guestPhone || "Nessun contatto";
  const customerBand = reservation.customerProfileSummary?.band || reservation.customerBand;

  return (
    <button
      className={active ? "reservation-list-item active" : "reservation-list-item"}
      onClick={onSelect}
      type="button"
    >
      <span className="reservation-row-cell reservation-row-primary">
        <strong>{reservation.guestName}</strong>
        <small>
          {contactLabel}
          {customerBand
            ? ` / ${CUSTOMER_SCORE_BAND_LABELS[customerBand] || customerBand}`
            : ""}
        </small>
      </span>
      <span className="reservation-row-cell">
        <strong>{formatDateTime(reservation.dateTime)}</strong>
        <small>{RESERVATION_SOURCE_LABELS[reservation.source] || reservation.source}</small>
      </span>
      <span className="reservation-row-cell">
        <strong>{reservation.locationName}</strong>
        <small>{reservation.guests} coperti</small>
      </span>
      <span className="reservation-row-cell">
        <strong>{assignedTableLabel}</strong>
        <small>{reservation.notes ? "Con note" : "Nessuna nota"}</small>
      </span>
      <span className="reservation-row-cell reservation-row-status">
        <span className={`table-status-chip ${statusTone(reservation.status)}`}>
          {RESERVATION_STATUS_LABELS[reservation.status] || reservation.status}
        </span>
      </span>
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

  const assignedTableLabel = reservation.assignedTableCodes?.length
    ? reservation.assignedTableCodes.join(" + ")
    : reservation.table?.code || "Assegnazione automatica";
  const customerProfile = reservation.customerProfileSummary;

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
            <div className="reservation-header-badges">
              {customerProfile?.band ? (
                <span className={`customer-band-chip ${customerBandTone(customerProfile.band)}`}>
                  {CUSTOMER_SCORE_BAND_LABELS[customerProfile.band] || customerProfile.band}
                </span>
              ) : null}
              <span className={`table-status-chip ${statusTone(reservation.status)}`}>
                {RESERVATION_STATUS_LABELS[reservation.status] || reservation.status}
              </span>
            </div>
          </div>

          <div className="reservation-detail-grid">
            <div className="reservation-detail-cell">
              <span>Coperti</span>
              <strong>{reservation.guests}</strong>
            </div>
            <div className="reservation-detail-cell">
              <span>Tavolo</span>
              <strong>{assignedTableLabel}</strong>
            </div>
            <div className="reservation-detail-cell">
              <span>Origine</span>
              <strong>{RESERVATION_SOURCE_LABELS[reservation.source] || reservation.source}</strong>
            </div>
            <div className="reservation-detail-cell">
              <span>Email</span>
              <strong>{reservation.guestEmail || "Non disponibile"}</strong>
            </div>
            <div className="reservation-detail-cell">
              <span>Telefono</span>
              <strong>{reservation.guestPhone || "Non disponibile"}</strong>
            </div>
            <div className="reservation-detail-cell">
              <span>Link gestione</span>
              <strong>{reservation.manageToken ? "Disponibile" : "Non generato"}</strong>
            </div>
            <div className="reservation-detail-cell">
              <span>Priorita cliente</span>
              <strong>{customerProfile?.priorityScore ?? reservation.customerPriorityScore ?? 0}</strong>
            </div>
            <div className="reservation-detail-cell">
              <span>Deposito consigliato</span>
              <strong>
                {reservation.depositRequired
                  ? reservation.depositAmount
                    ? `EUR ${Number(reservation.depositAmount).toFixed(2)}`
                    : "Richiesto"
                  : "Non richiesto"}
              </strong>
            </div>
          </div>

          {customerProfile ? (
            <div className="customer-profile-summary">
              <div>
                <span>Storico</span>
                <strong>{customerProfile.completedReservations} completate</strong>
              </div>
              <div>
                <span>No-show</span>
                <strong>{customerProfile.noShowCount}</strong>
              </div>
              <div>
                <span>Affidabilita</span>
                <strong>{customerProfile.reliabilityScore}/100</strong>
              </div>
              <div>
                <span>Spesa media</span>
                <strong>
                  {customerProfile.averageSpend
                    ? `EUR ${Number(customerProfile.averageSpend).toFixed(0)}`
                    : "n.d."}
                </strong>
              </div>
            </div>
          ) : null}

          <div className="reservation-editor-grid">
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
              <span>Spesa registrata</span>
              <input
                defaultValue={reservation.spendAmount || ""}
                min="0"
                name="spendAmount"
                step="0.01"
                type="number"
              />
            </label>
          </div>

          {reservation.notes ? (
            <div className="note-box">
              <strong>Note cliente</strong>
              <p>{reservation.notes}</p>
            </div>
          ) : null}

          <div className="reservation-info-grid">
            <div>
              <strong>Creata il</strong>
              <span>{formatDateTime(reservation.createdAt)}</span>
            </div>
            <div>
              <strong>Riepilogo assegnazione</strong>
              <span>{assignedTableLabel}</span>
            </div>
          </div>

          {state.error ? <p className="form-error">{state.error}</p> : null}
          {state.success ? <p className="form-success">{state.success}</p> : null}

          <div className="entity-footer">
            <span>
              {canManageReservations
                ? "Le modifiche vengono applicate subito al record selezionato."
                : "Il tuo profilo puo consultare ma non modificare la prenotazione."}
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
  initialSelectedReservationId = "",
  reservations,
  canManageReservations
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedReservationId, setSelectedReservationId] = useState(
    initialSelectedReservationId || reservations[0]?.id || ""
  );
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
    if (initialSelectedReservationId && reservations.some((reservation) => reservation.id === initialSelectedReservationId)) {
      setSelectedReservationId(initialSelectedReservationId);
    }
  }, [initialSelectedReservationId, reservations]);

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
          <p>Lista operativa in formato tabellare a sinistra, inspector tecnico a destra.</p>
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
            placeholder="Cerca per nome, email, telefono o tavolo"
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
              <strong>{status === "ALL" ? "Tutte" : RESERVATION_STATUS_LABELS[status]}</strong>
              <span>{counts[status] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="reservation-workspace">
        <div className="reservation-list-shell">
          <div className="reservation-list-head reservation-list-grid-head">
            <span>Cliente</span>
            <span>Arrivo</span>
            <span>Sede</span>
            <span>Tavolo</span>
            <span>Stato</span>
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
