"use client";

import {
  startTransition,
  useActionState,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition
} from "react";
import { useRouter } from "next/navigation";
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
  if (reservation.status === "CANCELLATA" || reservation.archivedAt) {
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

function applySavedFilterConfig(savedFilter, setters) {
  const filters = savedFilter?.filters || {};
  setters.setQuery(String(filters.query || ""));
  setters.setStatusFilter(String(filters.statusFilter || "ALL"));
  setters.setLocationFilter(String(filters.locationFilter || "ALL"));
}

function ReservationListItem({
  active,
  checked,
  onSelect,
  onToggle,
  reservation
}) {
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
      <span className="reservation-row-cell reservation-checkbox-cell">
        <input
          checked={checked}
          onChange={(event) => onToggle(event.target.checked)}
          onClick={(event) => event.stopPropagation()}
          type="checkbox"
        />
      </span>
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
        <p>Scegli una prenotazione dalla lista per vedere dettaglio, pagamento e azioni.</p>
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
              <span>Deposito</span>
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

          {state.error ? <p className="form-error">{state.error}</p> : null}
          {state.success ? <p className="form-success">{state.success}</p> : null}

          <div className="entity-footer">
            <span>
              {canManageReservations
                ? "Le modifiche aggiornano stato, assegnazione, reminder e deposito."
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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [selectedReservationId, setSelectedReservationId] = useState(
    initialSelectedReservationId || reservations[0]?.id || ""
  );
  const [selectedReservationIds, setSelectedReservationIds] = useState([]);
  const [savedFilters, setSavedFilters] = useState([]);
  const [savedFilterId, setSavedFilterId] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [isPending, startBulkTransition] = useTransition();
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

  const locationOptions = useMemo(
    () =>
      [...new Map(reservations.map((reservation) => [reservation.locationId, reservation.locationName])).entries()].map(
        ([value, label]) => ({ value, label })
      ),
    [reservations]
  );

  const filteredReservations = reservations.filter((reservation) => {
    const matchesStatus =
      statusFilter === "ALL"
        ? isVisibleInAllView(reservation, now)
        : reservation.status === statusFilter;
    const matchesLocation =
      locationFilter === "ALL" ? true : reservation.locationId === locationFilter;

    return matchesStatus && matchesLocation && matchesSearch(reservation, normalizedQuery);
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSavedFilters() {
      try {
        const response = await fetch("/api/admin/filters?pageKey=reservations", {
          cache: "no-store"
        });
        const payload = await response.json();

        if (!cancelled && response.ok) {
          setSavedFilters(payload.filters || []);
          const defaultFilter = (payload.filters || []).find((item) => item.isDefault);

          if (defaultFilter) {
            setSavedFilterId(defaultFilter.id);
            applySavedFilterConfig(defaultFilter, {
              setQuery,
              setStatusFilter,
              setLocationFilter
            });
          }
        }
      } catch {
        // Ignore filter bootstrap failures.
      }
    }

    void loadSavedFilters();

    return () => {
      cancelled = true;
    };
  }, []);

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
  const visibleIds = filteredReservations.map((reservation) => reservation.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedReservationIds.includes(id));

  async function reloadSavedFilters() {
    const response = await fetch("/api/admin/filters?pageKey=reservations", {
      cache: "no-store"
    });
    const payload = await response.json();

    if (response.ok) {
      setSavedFilters(payload.filters || []);
    }
  }

  function toggleReservationSelection(reservationId, checked) {
    setSelectedReservationIds((current) =>
      checked ? [...new Set([...current, reservationId])] : current.filter((id) => id !== reservationId)
    );
  }

  function toggleAllVisible(checked) {
    setSelectedReservationIds((current) => {
      if (checked) {
        return [...new Set([...current, ...visibleIds])];
      }

      return current.filter((id) => !visibleIds.includes(id));
    });
  }

  function runBulkAction(action) {
    if (!selectedReservationIds.length) {
      return;
    }

    startBulkTransition(async () => {
      setBulkMessage("");

      try {
        const response = await fetch("/api/admin/reservations/bulk", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            action,
            reservationIds: selectedReservationIds
          })
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Bulk action fallita.");
        }

        setBulkMessage(`Azione ${action} applicata a ${payload.updated} prenotazioni.`);
        setSelectedReservationIds([]);
        router.refresh();
      } catch (error) {
        setBulkMessage(error.message || "Bulk action fallita.");
      }
    });
  }

  async function saveCurrentFilter() {
    const name = window.prompt("Nome del filtro da salvare");

    if (!name) {
      return;
    }

    const response = await fetch("/api/admin/filters", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        pageKey: "reservations",
        name,
        locationId: locationFilter === "ALL" ? null : locationFilter,
        filters: {
          query,
          statusFilter,
          locationFilter
        }
      })
    });
    const payload = await response.json();

    if (response.ok) {
      setSavedFilterId(payload.filter.id);
      await reloadSavedFilters();
    }
  }

  async function deleteCurrentSavedFilter() {
    if (!savedFilterId) {
      return;
    }

    await fetch(`/api/admin/filters?filterId=${encodeURIComponent(savedFilterId)}`, {
      method: "DELETE"
    });
    setSavedFilterId("");
    await reloadSavedFilters();
  }

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <h2>Gestione prenotazioni</h2>
          <p>Lista operativa, filtri salvati per ruolo/sede e azioni bulk su selezione multipla.</p>
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

        <div className="menu-filter-grid">
          <label>
            <span className="sr-only">Sede</span>
            <select
              onChange={(event) => setLocationFilter(event.target.value)}
              value={locationFilter}
            >
              <option value="ALL">Tutte le sedi</option>
              {locationOptions.map((location) => (
                <option key={location.value} value={location.value}>
                  {location.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtro salvato</span>
            <select
              onChange={(event) => {
                const nextId = event.target.value;
                setSavedFilterId(nextId);
                const savedFilter = savedFilters.find((item) => item.id === nextId);

                if (savedFilter) {
                  applySavedFilterConfig(savedFilter, {
                    setQuery,
                    setStatusFilter,
                    setLocationFilter
                  });
                }
              }}
              value={savedFilterId}
            >
              <option value="">Filtri salvati</option>
              {savedFilters.map((filter) => (
                <option key={filter.id} value={filter.id}>
                  {filter.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="micro-actions">
          <button className="button button-muted" onClick={saveCurrentFilter} type="button">
            Salva filtro
          </button>
          {savedFilterId ? (
            <button className="button button-muted" onClick={deleteCurrentSavedFilter} type="button">
              Elimina filtro
            </button>
          ) : null}
        </div>
      </div>

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

      {selectedReservationIds.length > 0 ? (
        <div className="reservation-bulk-bar">
          <strong>{selectedReservationIds.length} selezionate</strong>
          <div className="micro-actions">
            <button className="button button-muted" onClick={() => runBulkAction("CONFIRM")} type="button">
              Conferma
            </button>
            <button className="button button-muted" onClick={() => runBulkAction("COMPLETE")} type="button">
              Completa
            </button>
            <button className="button button-muted" onClick={() => runBulkAction("CANCEL")} type="button">
              Cancella
            </button>
            <button className="button button-muted" onClick={() => runBulkAction("NO_SHOW")} type="button">
              No show
            </button>
            <button className="button button-muted" onClick={() => runBulkAction("ARCHIVE")} type="button">
              Archivia
            </button>
          </div>
          {isPending ? <span className="helper-copy">Applico azione bulk...</span> : null}
        </div>
      ) : null}

      {bulkMessage ? (
        <p className={bulkMessage.includes("fallita") ? "form-error" : "form-success"}>
          {bulkMessage}
        </p>
      ) : null}

      <div className="reservation-workspace">
        <div className="reservation-list-shell">
          <div className="reservation-list-head reservation-list-grid-head">
            <span>
              <input
                checked={allVisibleSelected}
                onChange={(event) => toggleAllVisible(event.target.checked)}
                type="checkbox"
              />
            </span>
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
                checked={selectedReservationIds.includes(reservation.id)}
                key={reservation.id}
                onSelect={() => setSelectedReservationId(reservation.id)}
                onToggle={(checked) => toggleReservationSelection(reservation.id, checked)}
                reservation={reservation}
              />
            ))}

            {filteredReservations.length === 0 ? (
              <div className="empty-state-card">
                <strong>Nessuna prenotazione nei filtri correnti</strong>
                <p>Prova a cambiare stato, sede o ricerca libera. Puoi anche salvare una vista piu' utile per il tuo ruolo.</p>
              </div>
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
