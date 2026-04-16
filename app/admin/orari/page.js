import Link from "next/link";
import { requireUser } from "../../../lib/auth";
import {
  deleteOpeningExceptionAction,
  saveOpeningExceptionAction,
  saveOpeningHoursAction,
  saveReservationSettingsAction
} from "../../../lib/actions/admin-actions";
import { getDateKey } from "../../../lib/reservations";
import { weekdayLabel } from "../../../lib/format";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getAccessibleLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

function exceptionStatusLabel(exception) {
  if (exception.isClosed) {
    return "Chiuso";
  }

  if (exception.opensAt && exception.closesAt) {
    return `${exception.opensAt} - ${exception.closesAt}`;
  }

  return "Orario speciale";
}

export default async function OrariPage({ searchParams }) {
  const user = await requireUser();
  requirePageAccess(user, "hours");
  const canManageHours = canAccessPage(user, "hours", "manage");
  const locations = await getAccessibleLocations(user);
  const resolvedSearchParams = await searchParams;
  const requestedLocationId = String(resolvedSearchParams?.locationId || "");
  const hasMultipleLocations = locations.length > 1;
  const selectedLocation = hasMultipleLocations
    ? locations.find((location) => location.id === requestedLocationId) || null
    : locations[0] || null;

  return (
    <div className="page-stack">
      {!canManageHours ? (
        <section className="panel-card">
          <div className="panel-header">
            <h2>Accesso in sola lettura</h2>
            <p>Puoi consultare orari e regole prenotazioni ma non modificarli.</p>
          </div>
        </section>
      ) : null}

      {hasMultipleLocations ? (
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Seleziona la sede</h2>
              <p>Scegli prima il locale, poi entri in orari settimanali, eccezioni e slot.</p>
            </div>
            <span className="location-chip highlighted">
              {selectedLocation ? selectedLocation.name : "Nessuna sede selezionata"}
            </span>
          </div>

          <div className="location-picker-grid">
            {locations.map((location) => (
              <Link
                className={
                  selectedLocation?.id === location.id
                    ? "location-pill active"
                    : "location-pill"
                }
                href={`/admin/orari?locationId=${location.id}`}
                key={location.id}
              >
                <strong>{location.name}</strong>
                <span>{location.city}</span>
                <small>{location.address}</small>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {selectedLocation ? (
        <>
          <section className="panel-card" key={selectedLocation.id}>
            <div className="panel-header">
              <div>
                <h2>{selectedLocation.name}</h2>
                <p>Orari di apertura, durata tavolo, slot cliente e regole prenotazione.</p>
              </div>
              <div className="row-meta">
                <span>{selectedLocation.city}</span>
                <span>{selectedLocation.address}</span>
              </div>
            </div>

            <form action={saveReservationSettingsAction} className="entity-form">
              <input name="locationId" type="hidden" value={selectedLocation.id} />
              <fieldset className="form-fieldset" disabled={!canManageHours}>
                <div className="form-grid">
                  <label>
                    <span>Titolo pagina</span>
                    <input
                      defaultValue={selectedLocation.settings?.pageTitle || ""}
                      name="pageTitle"
                      type="text"
                    />
                  </label>
                  <label className="full-width">
                    <span>Messaggio introduttivo</span>
                    <input
                      defaultValue={selectedLocation.settings?.welcomeMessage || ""}
                      name="welcomeMessage"
                      type="text"
                    />
                  </label>
                  <label>
                    <span>Durata tavolo (minuti)</span>
                    <input
                      defaultValue={selectedLocation.settings?.durationMinutes || 120}
                      name="durationMinutes"
                      type="number"
                    />
                  </label>
                  <label>
                    <span>Intervallo slot (minuti)</span>
                    <input
                      defaultValue={selectedLocation.settings?.slotIntervalMinutes || 30}
                      name="slotIntervalMinutes"
                      type="number"
                    />
                  </label>
                  <label>
                    <span>Anticipo minimo</span>
                    <input
                      defaultValue={selectedLocation.settings?.leadTimeMinutes || 60}
                      name="leadTimeMinutes"
                      type="number"
                    />
                  </label>
                  <label>
                    <span>Coperti minimi</span>
                    <input
                      defaultValue={selectedLocation.settings?.minGuests || 1}
                      name="minGuests"
                      type="number"
                    />
                  </label>
                  <label>
                    <span>Coperti massimi</span>
                    <input
                      defaultValue={selectedLocation.settings?.maxGuests || 8}
                      name="maxGuests"
                      type="number"
                    />
                  </label>
                </div>
                <div className="checkbox-grid">
                  <label className="checkbox-item">
                    <input
                      defaultChecked={selectedLocation.settings?.useTimeSlots ?? true}
                      name="useTimeSlots"
                      type="checkbox"
                    />
                    <span>Usa slot prenotazione invece di orario libero</span>
                  </label>
                  <label className="checkbox-item">
                    <input
                      defaultChecked={selectedLocation.settings?.requirePhone ?? true}
                      name="requirePhone"
                      type="checkbox"
                    />
                    <span>Telefono obbligatorio</span>
                  </label>
                  <label className="checkbox-item">
                    <input
                      defaultChecked={selectedLocation.settings?.requireEmail ?? true}
                      name="requireEmail"
                      type="checkbox"
                    />
                    <span>Email obbligatoria</span>
                  </label>
                </div>
                <button className="button button-primary" type="submit">
                  Salva impostazioni prenotazione
                </button>
              </fieldset>
            </form>
          </section>

          <section className="panel-card">
            <div className="panel-header">
              <div>
                <h2>Orari settimanali</h2>
                <p>Regola l’orario base del locale. Le eccezioni calendario lo sovrascrivono.</p>
              </div>
            </div>

            <form action={saveOpeningHoursAction} className="entity-form">
              <input name="locationId" type="hidden" value={selectedLocation.id} />
              <fieldset className="form-fieldset" disabled={!canManageHours}>
                <div className="hours-editor">
                  {selectedLocation.openingHours.map((hour) => (
                    <div className="hours-editor-row" key={`${selectedLocation.id}-${hour.weekday}`}>
                      <strong>{weekdayLabel(hour.weekday)}</strong>
                      <label className="inline-field">
                        <span>Apre</span>
                        <input
                          defaultValue={hour.opensAt}
                          name={`opensAt_${hour.weekday}`}
                          type="time"
                        />
                      </label>
                      <label className="inline-field">
                        <span>Chiude</span>
                        <input
                          defaultValue={hour.closesAt}
                          name={`closesAt_${hour.weekday}`}
                          type="time"
                        />
                      </label>
                      <label className="checkbox-item">
                        <input
                          defaultChecked={hour.isClosed}
                          name={`isClosed_${hour.weekday}`}
                          type="checkbox"
                        />
                        <span>Chiuso</span>
                      </label>
                    </div>
                  ))}
                </div>
                <button className="button button-primary" type="submit">
                  Salva orari
                </button>
              </fieldset>
            </form>
          </section>

          <section className="panel-card">
            <div className="panel-header">
              <div>
                <h2>Eccezioni calendario</h2>
                <p>Festività, eventi privati, aperture straordinarie o chiusure fuori standard.</p>
              </div>
              <div className="row-meta">
                <span>{selectedLocation.openingExceptions.length} eccezioni salvate</span>
              </div>
            </div>

            <div className="table-card-grid">
              <article className="table-admin-card">
                <div className="table-admin-card-head">
                  <div>
                    <strong>Nuova eccezione</strong>
                    <p>Crea un override per una data precisa.</p>
                  </div>
                </div>

                <form action={saveOpeningExceptionAction} className="entity-form">
                  <input name="locationId" type="hidden" value={selectedLocation.id} />
                  <fieldset className="form-fieldset" disabled={!canManageHours}>
                    <div className="form-grid">
                      <label>
                        <span>Data</span>
                        <input min={getDateKey(new Date())} name="date" required type="date" />
                      </label>
                      <label>
                        <span>Nota</span>
                        <input name="note" placeholder="Pasqua / Evento privato" type="text" />
                      </label>
                      <label>
                        <span>Apre</span>
                        <input defaultValue="12:00" name="opensAt" type="time" />
                      </label>
                      <label>
                        <span>Chiude</span>
                        <input defaultValue="23:00" name="closesAt" type="time" />
                      </label>
                    </div>

                    <label className="checkbox-item">
                      <input name="isClosed" type="checkbox" />
                      <span>Giornata chiusa</span>
                    </label>

                    <button className="button button-primary" type="submit">
                      Salva eccezione
                    </button>
                  </fieldset>
                </form>
              </article>

              {selectedLocation.openingExceptions.map((exception) => (
                <article className="table-admin-card" key={exception.id}>
                  <div className="table-admin-card-head">
                    <div>
                      <strong>{getDateKey(exception.date)}</strong>
                      <p>{exception.note || "Eccezione calendario"}</p>
                    </div>
                    <div className="row-meta">
                      <span>{exceptionStatusLabel(exception)}</span>
                    </div>
                  </div>

                  <details className="inline-editor">
                    <summary>Modifica eccezione</summary>
                    <form action={saveOpeningExceptionAction} className="entity-form">
                      <input name="locationId" type="hidden" value={selectedLocation.id} />
                      <input name="exceptionId" type="hidden" value={exception.id} />

                      <fieldset className="form-fieldset" disabled={!canManageHours}>
                        <div className="form-grid">
                          <label>
                            <span>Data</span>
                            <input
                              defaultValue={getDateKey(exception.date)}
                              name="date"
                              required
                              type="date"
                            />
                          </label>
                          <label>
                            <span>Nota</span>
                            <input defaultValue={exception.note || ""} name="note" type="text" />
                          </label>
                          <label>
                            <span>Apre</span>
                            <input
                              defaultValue={exception.opensAt || "12:00"}
                              name="opensAt"
                              type="time"
                            />
                          </label>
                          <label>
                            <span>Chiude</span>
                            <input
                              defaultValue={exception.closesAt || "23:00"}
                              name="closesAt"
                              type="time"
                            />
                          </label>
                        </div>

                        <div className="entity-footer">
                          <label className="checkbox-item">
                            <input
                              defaultChecked={exception.isClosed}
                              name="isClosed"
                              type="checkbox"
                            />
                            <span>Giornata chiusa</span>
                          </label>
                          <button className="button button-primary" type="submit">
                            Aggiorna eccezione
                          </button>
                        </div>
                      </fieldset>
                    </form>
                  </details>

                  {canManageHours ? (
                    <form action={deleteOpeningExceptionAction} className="table-card-actions">
                      <input name="exceptionId" type="hidden" value={exception.id} />
                      <button className="button button-danger" type="submit">
                        Elimina eccezione
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="panel-card">
          <p className="empty-copy">
            {locations.length
              ? "Seleziona una sede per configurare orari, eccezioni e slot."
              : "Nessuna sede accessibile disponibile."}
          </p>
        </section>
      )}
    </div>
  );
}
