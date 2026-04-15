import { requireUser } from "../../../lib/auth";
import { saveLocationAction } from "../../../lib/actions/admin-actions";
import { AdminDialog } from "../../../components/admin-dialog";
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
          <div>
            <h2>Gestione sedi</h2>
            <p>Crea nuove sedi solo quando servono e mantieni ordinata l&apos;anagrafica del brand.</p>
          </div>
          {canManageLocations ? (
            <AdminDialog
              buttonClassName="button button-primary"
              buttonLabel="Nuova sede"
              description="Inserisci i dati base della sede e abilita subito le prenotazioni online."
              title="Crea una nuova sede"
            >
              <form action={saveLocationAction} className="entity-form">
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
                    <span>Citta&apos;</span>
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
              </form>
            </AdminDialog>
          ) : null}
        </div>
        <div className="zone-summary-grid">
          <article className="summary-chip">
            <strong>Sedi attive</strong>
            <span>{locations.length} sedi accessibili al tuo profilo</span>
          </article>
          <article className="summary-chip">
            <strong>Prenotazioni online</strong>
            <span>
              {locations.filter((location) => location.reservationEnabled).length} sedi abilitate
            </span>
          </article>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <h2>Sedi configurate</h2>
          <p>Aggiorna dati commerciali e disponibilita' prenotazioni.</p>
        </div>
        <div className="entity-list">
          {locations.map((location) => (
            <article className="entity-card compact" key={location.id}>
              <div className="panel-header">
                <div>
                  <h2>{location.name}</h2>
                  <p>
                    {location.address}, {location.city}
                  </p>
                </div>
                <div className="row-meta">
                  <span>{location.slug}</span>
                  <span>
                    {location.reservationEnabled ? "Prenotazioni online attive" : "Prenotazioni online spente"}
                  </span>
                </div>
              </div>

              <div className="data-list">
                <div className="data-row">
                  <strong>Contatti</strong>
                  <span>{location.phone || location.email || "Non configurati"}</span>
                </div>
              </div>

              {canManageLocations ? (
                <details className="inline-editor">
                  <summary>Modifica sede</summary>
                  <form action={saveLocationAction} className="entity-form">
                    <input name="locationId" type="hidden" value={location.id} />
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
                        <span>Citta&apos;</span>
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
                  </form>
                </details>
              ) : (
                <p className="helper-copy">Il tuo ruolo puo&apos; consultare la sede ma non modificarla.</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
