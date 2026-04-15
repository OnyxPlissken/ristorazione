import { requireUser } from "../../../lib/auth";
import {
  saveOpeningHoursAction,
  saveReservationSettingsAction
} from "../../../lib/actions/admin-actions";
import { weekdayLabel } from "../../../lib/format";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getAccessibleLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function OrariPage() {
  const user = await requireUser();
  requirePageAccess(user, "hours");
  const canManageHours = canAccessPage(user, "hours", "manage");

  const locations = await getAccessibleLocations(user);

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

      {locations.map((location) => (
        <section className="panel-card" key={location.id}>
          <div className="panel-header">
            <h2>{location.name}</h2>
            <p>Orari di apertura e impostazioni prenotazione.</p>
          </div>

          <form action={saveReservationSettingsAction} className="entity-form">
            <input name="locationId" type="hidden" value={location.id} />
            <fieldset className="form-fieldset" disabled={!canManageHours}>
              <div className="form-grid">
                <label>
                  <span>Titolo pagina</span>
                  <input
                    defaultValue={location.settings?.pageTitle || ""}
                    name="pageTitle"
                    type="text"
                  />
                </label>
                <label className="full-width">
                  <span>Messaggio introduttivo</span>
                  <input
                    defaultValue={location.settings?.welcomeMessage || ""}
                    name="welcomeMessage"
                    type="text"
                  />
                </label>
                <label>
                  <span>Durata prenotazione</span>
                  <input
                    defaultValue={location.settings?.durationMinutes || 120}
                    name="durationMinutes"
                    type="number"
                  />
                </label>
                <label>
                  <span>Anticipo minimo</span>
                  <input
                    defaultValue={location.settings?.leadTimeMinutes || 60}
                    name="leadTimeMinutes"
                    type="number"
                  />
                </label>
                <label>
                  <span>Coperti minimi</span>
                  <input
                    defaultValue={location.settings?.minGuests || 1}
                    name="minGuests"
                    type="number"
                  />
                </label>
                <label>
                  <span>Coperti massimi</span>
                  <input
                    defaultValue={location.settings?.maxGuests || 8}
                    name="maxGuests"
                    type="number"
                  />
                </label>
              </div>
              <div className="checkbox-grid">
                <label className="checkbox-item">
                  <input
                    defaultChecked={location.settings?.requirePhone ?? true}
                    name="requirePhone"
                    type="checkbox"
                  />
                  <span>Telefono obbligatorio</span>
                </label>
                <label className="checkbox-item">
                  <input
                    defaultChecked={location.settings?.requireEmail ?? true}
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
            <input name="locationId" type="hidden" value={location.id} />
            <fieldset className="form-fieldset" disabled={!canManageHours}>
              <div className="hours-editor">
                {location.openingHours.map((hour) => (
                  <div className="hours-editor-row" key={`${location.id}-${hour.weekday}`}>
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
      ))}
    </div>
  );
}
