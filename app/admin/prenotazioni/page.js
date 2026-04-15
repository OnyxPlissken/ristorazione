import { requireUser } from "../../../lib/auth";
import { RESERVATION_STATUS_LABELS } from "../../../lib/constants";
import { updateReservationAction } from "../../../lib/actions/admin-actions";
import { formatDateTime } from "../../../lib/format";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getAccessibleLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function PrenotazioniPage() {
  const user = await requireUser();
  requirePageAccess(user, "reservations");
  const canManageReservations = canAccessPage(user, "reservations", "manage");

  const locations = await getAccessibleLocations(user);
  const reservations = locations.flatMap((location) =>
    location.reservations.map((reservation) => ({
      ...reservation,
      locationName: location.name,
      availableTables: location.tables
    }))
  );

  return (
    <div className="page-stack">
      {!canManageReservations ? (
        <section className="panel-card">
          <div className="panel-header">
            <h2>Accesso in sola lettura</h2>
            <p>Puoi consultare le prenotazioni ma non cambiarne stato o assegnazione tavolo.</p>
          </div>
        </section>
      ) : null}

      <section className="panel-card">
        <div className="panel-header">
          <h2>Gestione prenotazioni</h2>
          <p>Controlla stato, sede e tavolo assegnato.</p>
        </div>
        <div className="entity-list">
          {reservations.map((reservation) => (
            <form action={updateReservationAction} className="entity-card" key={reservation.id}>
              <input name="reservationId" type="hidden" value={reservation.id} />
              <fieldset className="form-fieldset" disabled={!canManageReservations}>
                <div className="reservation-head">
                  <div>
                    <strong>{reservation.guestName}</strong>
                    <p>
                      {reservation.locationName} / {formatDateTime(reservation.dateTime)}
                    </p>
                  </div>
                  <div className="row-meta">
                    <span>{reservation.guests} ospiti</span>
                    <span>{reservation.source}</span>
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
                      <option value="">Da assegnare</option>
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

                <div className="entity-footer">
                  <span>
                    {reservation.table ? `Assegnato a ${reservation.table.code}` : "Nessun tavolo assegnato"}
                  </span>
                  <button className="button button-primary" type="submit">
                    Aggiorna prenotazione
                  </button>
                </div>
              </fieldset>
            </form>
          ))}
          {reservations.length === 0 ? (
            <p className="empty-copy">Nessuna prenotazione disponibile.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
