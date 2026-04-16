import Link from "next/link";
import { requireUser } from "../../../lib/auth";
import { getDateKey } from "../../../lib/reservations";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { formatDateTime } from "../../../lib/format";
import { getFloorPageData } from "../../../lib/queries";

export const dynamic = "force-dynamic";

function floorStatusLabel(status) {
  if (!status) {
    return "table-status-chip";
  }

  return `table-status-chip ${status.tone || "free"}`;
}

export default async function SalaPage({ searchParams }) {
  const user = await requireUser();
  requirePageAccess(user, "tables");
  const canManageTables = canAccessPage(user, "tables", "manage");
  const params = await searchParams;
  const locationId = String(params?.locationId || "");
  const dateText = String(params?.date || getDateKey(new Date()));
  const data = await getFloorPageData(user, {
    locationId,
    dateText
  });

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Mappa sala operativa</h2>
            <p>Vista visuale per zona con stato tavolo, coperti, combinazioni e prossime prenotazioni.</p>
          </div>
          <div className="row-meta">
            <span>{data.selectedLocation ? data.selectedLocation.name : "Nessuna sede"}</span>
            <span>{dateText}</span>
          </div>
        </div>

        <form className="reservation-toolbar">
          <div className="form-grid">
            <label>
              <span>Sede</span>
              <select defaultValue={data.selectedLocation?.id || ""} name="locationId">
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
            Aggiorna vista sala
          </button>
        </form>
      </section>

      {data.selectedLocation ? (
        data.zones.map((zone) => (
          <section className="panel-card" key={zone.id}>
            <div className="panel-header">
              <div>
                <h2>{zone.name}</h2>
                <p>{zone.tables.length} tavoli in questa zona.</p>
              </div>
              <div className="row-meta">
                <span>{zone.active ? "Zona attiva" : "Zona inattiva"}</span>
              </div>
            </div>

            {zone.tables.length > 0 ? (
              <div className="floor-grid">
                {zone.tables.map((table) => (
                  <article className="floor-card" key={table.id}>
                    <div className="floor-card-head">
                      <div>
                        <strong>{table.code}</strong>
                        <p>{table.seats} coperti</p>
                      </div>
                      <span className={floorStatusLabel(table.floorStatus)}>
                        {table.floorStatus.label}
                      </span>
                    </div>

                    {table.combinableCodes?.length ? (
                      <div className="note-box">
                        <strong>Combinabile con</strong>
                        <p>{table.combinableCodes.join(", ")}</p>
                      </div>
                    ) : null}

                    {table.floorStatus?.reservation ? (
                      <div className="info-list">
                        <div>
                          <strong>Cliente</strong>
                          <span>{table.floorStatus.reservation.guestName}</span>
                        </div>
                        <div>
                          <strong>Slot</strong>
                          <span>{formatDateTime(table.floorStatus.reservation.dateTime)}</span>
                        </div>
                        <div>
                          <strong>Coperti</strong>
                          <span>{table.floorStatus.reservation.guests}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="note-box">
                        <strong>Disponibilità</strong>
                        <p>Il tavolo è pronto per nuove prenotazioni su questa data.</p>
                      </div>
                    )}

                    {canManageTables ? (
                      <div className="floor-card-actions">
                        <Link className="button button-muted" href={`/admin/tavoli?locationId=${data.selectedLocation.id}`}>
                          Gestisci tavolo
                        </Link>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-copy">Nessun tavolo assegnato a questa zona.</p>
            )}
          </section>
        ))
      ) : (
        <section className="panel-card">
          <p className="empty-copy">Nessuna sede accessibile disponibile.</p>
        </section>
      )}
    </div>
  );
}
