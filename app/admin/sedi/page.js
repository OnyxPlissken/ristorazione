import { requireUser } from "../../../lib/auth";
import { saveLocationAction } from "../../../lib/actions/admin-actions";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getAccessibleLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function SediPage() {
  const user = await requireUser();
  requirePageAccess(user, "locations");
  const canManageLocations = canAccessPage(user, "locations", "manage");
  const locations = await getAccessibleLocations(user);

  return (
    <div className="page-stack">
      {!canManageLocations ? (
        <section className="panel-card">
          <div className="panel-header">
            <h2>Accesso in sola lettura</h2>
            <p>Puoi consultare le sedi ma non crearle o modificarle.</p>
          </div>
        </section>
      ) : null}

      <section className="panel-card">
        <div className="panel-header">
          <h2>Nuova sede</h2>
          <p>Crea una sede con impostazioni base e orari predefiniti.</p>
        </div>
        <form action={saveLocationAction} className="entity-form">
          <fieldset className="form-fieldset" disabled={!canManageLocations}>
            <div className="form-grid">
              <label>
                <span>Nome sede</span>
                <input name="name" required type="text" />
              </label>
              <label>
                <span>Slug</span>
                <input name="slug" placeholder="milano-centro" type="text" />
              </label>
              <label>
                <span>Citta'</span>
                <input name="city" required type="text" />
              </label>
              <label>
                <span>Indirizzo</span>
                <input name="address" required type="text" />
              </label>
              <label>
                <span>Telefono</span>
                <input name="phone" type="text" />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" />
              </label>
            </div>
            <label className="checkbox-item">
              <input defaultChecked name="reservationEnabled" type="checkbox" />
              <span>Prenotazioni online abilitate</span>
            </label>
            <button className="button button-primary" type="submit">
              Salva sede
            </button>
          </fieldset>
        </form>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <h2>Sedi configurate</h2>
          <p>Aggiorna dati commerciali e disponibilita' prenotazioni.</p>
        </div>
        <div className="entity-list">
          {locations.map((location) => (
            <form action={saveLocationAction} className="entity-card" key={location.id}>
              <input name="locationId" type="hidden" value={location.id} />
              <fieldset className="form-fieldset" disabled={!canManageLocations}>
                <div className="form-grid">
                  <label>
                    <span>Nome sede</span>
                    <input defaultValue={location.name} name="name" type="text" />
                  </label>
                  <label>
                    <span>Slug</span>
                    <input defaultValue={location.slug} name="slug" type="text" />
                  </label>
                  <label>
                    <span>Citta'</span>
                    <input defaultValue={location.city} name="city" type="text" />
                  </label>
                  <label>
                    <span>Indirizzo</span>
                    <input defaultValue={location.address} name="address" type="text" />
                  </label>
                  <label>
                    <span>Telefono</span>
                    <input defaultValue={location.phone || ""} name="phone" type="text" />
                  </label>
                  <label>
                    <span>Email</span>
                    <input defaultValue={location.email || ""} name="email" type="email" />
                  </label>
                </div>
                <div className="entity-footer">
                  <label className="checkbox-item">
                    <input
                      defaultChecked={location.reservationEnabled}
                      name="reservationEnabled"
                      type="checkbox"
                    />
                    <span>Prenotazioni online</span>
                  </label>
                  <button className="button button-primary" type="submit">
                    Aggiorna sede
                  </button>
                </div>
              </fieldset>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
