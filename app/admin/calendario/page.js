import { requireUser } from "../../../lib/auth";
import { getDateKey } from "../../../lib/reservations";
import { requirePageAccess } from "../../../lib/permissions";
import { formatDateTime } from "../../../lib/format";
import { RESERVATION_STATUS_LABELS } from "../../../lib/constants";
import { getReservationCalendarPageData } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function CalendarioPage({ searchParams }) {
  const user = await requireUser();
  requirePageAccess(user, "reservations");
  const params = await searchParams;
  const locationId = String(params?.locationId || "");
  const dateText = String(params?.date || getDateKey(new Date()));
  const data = await getReservationCalendarPageData(user, {
    locationId,
    dateText
  });

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Calendario prenotazioni</h2>
            <p>Vista per data con timeline ordinata, sedi e tavoli assegnati.</p>
          </div>
          <div className="row-meta">
            <span>{dateText}</span>
            <span>{data.groups.reduce((sum, group) => sum + group.reservations.length, 0)} prenotazioni</span>
          </div>
        </div>

        <form className="reservation-toolbar">
          <div className="form-grid">
            <label>
              <span>Sede</span>
              <select defaultValue={locationId} name="locationId">
                <option value="">Tutte le sedi</option>
                {data.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} - {location.city}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Data</span>
              <input defaultValue={dateText} name="date" type="date" />
            </label>
          </div>
          <button className="button button-primary" type="submit">
            Aggiorna calendario
          </button>
        </form>
      </section>

      {data.groups.map((group) => (
        <section className="panel-card" key={group.id}>
          <div className="panel-header">
            <div>
              <h2>{group.name}</h2>
              <p>{group.city} - {group.address}</p>
            </div>
            <div className="row-meta">
              <span>{group.reservations.length} prenotazioni</span>
            </div>
          </div>

          {group.reservations.length > 0 ? (
            <div className="calendar-list">
              {group.reservations.map((reservation) => (
                <article className="calendar-card" key={reservation.id}>
                  <div className="calendar-card-time">
                    <strong>{reservation.slotLabel}</strong>
                    <span>{RESERVATION_STATUS_LABELS[reservation.status] || reservation.status}</span>
                  </div>
                  <div className="calendar-card-main">
                    <strong>{reservation.guestName}</strong>
                    <p>
                      {reservation.guests} ospiti - {reservation.assignedTableCodes.join(" + ") || "Tavolo automatico"}
                    </p>
                  </div>
                  <div className="calendar-card-meta">
                    <span>{formatDateTime(reservation.dateTime)}</span>
                    <span>{reservation.guestPhone || reservation.guestEmail || "Nessun recapito"}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-copy">Nessuna prenotazione per questa sede nella data selezionata.</p>
          )}
        </section>
      ))}
    </div>
  );
}
