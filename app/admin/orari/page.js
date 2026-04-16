import Link from "next/link";
import { requireUser } from "../../../lib/auth";
import {
  saveOpeningHoursAction,
  saveReservationSettingsAction
} from "../../../lib/actions/admin-actions";
import { weekdayLabel } from "../../../lib/format";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getAccessibleLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function OrariPage({ searchParams }) {
  const user = await requireUser();
  requirePageAccess(user, "hours");
  const canManageHours = canAccessPage(user, "hours", "manage");
  const locations = await getAccessibleLocations(user);
  const resolvedSearchParams = await searchParams;
  const requestedLocationId = String(resolvedSearchParams?.locationId || "");
  const selectedLocation =
    locations.find((location) => location.id === requestedLocationId) || locations[0] || null;
  const hasMultipleLocations = locations.length > 1;

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
              <p>Scegli prima la sede da configurare, poi visualizzi orari e impostazioni.</p>
            </div>
            {selectedLocation ? (
              <span className="location-chip highlighted">{selectedLocation.name}</span>
            ) : null}
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
        <section className="panel-card" key={selectedLocation.id}>
          <div className="panel-header">
            <h2>{selectedLocation.name}</h2>
            <p>Orari di apertura e impostazioni prenotazione.</p>
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
      ) : (
        <section className="panel-card">
          <p className="empty-copy">Nessuna sede accessibile disponibile.</p>
        </section>
      )}
    </div>
  );
}
