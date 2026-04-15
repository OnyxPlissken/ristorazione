import Link from "next/link";
import { canManageBusiness, requireUser } from "../../../lib/auth";
import { generateTablesAction, saveTableAction } from "../../../lib/actions/admin-actions";
import { getAccessibleLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function TavoliPage() {
  const user = await requireUser();

  if (!canManageBusiness(user)) {
    return null;
  }

  const locations = await getAccessibleLocations(user);

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <h2>Generazione rapida tavoli</h2>
          <p>Crea una serie di tavoli in un colpo solo.</p>
        </div>
        <form action={generateTablesAction} className="entity-form">
          <div className="form-grid">
            <label>
              <span>Sede</span>
              <select name="locationId">
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Prefisso</span>
              <input defaultValue="T" name="prefix" type="text" />
            </label>
            <label>
              <span>Da</span>
              <input defaultValue="1" name="from" type="number" />
            </label>
            <label>
              <span>A</span>
              <input defaultValue="10" name="to" type="number" />
            </label>
            <label>
              <span>Coperti</span>
              <input defaultValue="4" name="seats" type="number" />
            </label>
            <label>
              <span>Zona</span>
              <input name="zone" placeholder="Sala interna" type="text" />
            </label>
          </div>
          <button className="button button-primary" type="submit">
            Genera tavoli
          </button>
        </form>
      </section>

      {locations.map((location) => (
        <section className="panel-card" key={location.id}>
          <div className="panel-header">
            <h2>{location.name}</h2>
            <p>Nuovo tavolo e tavoli configurati</p>
          </div>
          <form action={saveTableAction} className="entity-form">
            <input name="locationId" type="hidden" value={location.id} />
            <div className="form-grid">
              <label>
                <span>Codice tavolo</span>
                <input name="code" placeholder="T1" type="text" />
              </label>
              <label>
                <span>Coperti</span>
                <input defaultValue="4" name="seats" type="number" />
              </label>
              <label>
                <span>Zona</span>
                <input name="zone" placeholder="Dehors" type="text" />
              </label>
            </div>
            <label className="checkbox-item">
              <input defaultChecked name="active" type="checkbox" />
              <span>Tavolo attivo</span>
            </label>
            <button className="button button-primary" type="submit">
              Salva tavolo
            </button>
          </form>

          <div className="entity-list">
            {location.tables.map((table) => (
              <form action={saveTableAction} className="entity-card compact" key={table.id}>
                <input name="tableId" type="hidden" value={table.id} />
                <input name="locationId" type="hidden" value={location.id} />
                <div className="form-grid">
                  <label>
                    <span>Codice</span>
                    <input defaultValue={table.code} name="code" type="text" />
                  </label>
                  <label>
                    <span>Coperti</span>
                    <input defaultValue={table.seats} name="seats" type="number" />
                  </label>
                  <label>
                    <span>Zona</span>
                    <input defaultValue={table.zone || ""} name="zone" type="text" />
                  </label>
                </div>
                <div className="entity-footer">
                  <div className="auth-links">
                    <label className="checkbox-item">
                      <input defaultChecked={table.active} name="active" type="checkbox" />
                      <span>{table.active ? "Attivo" : "Disattivo"}</span>
                    </label>
                    <Link href={`/table/${table.id}`}>Apri QR tavolo</Link>
                  </div>
                  <button className="button button-primary" type="submit">
                    Aggiorna tavolo
                  </button>
                </div>
              </form>
            ))}
            {location.tables.length === 0 ? (
              <p className="empty-copy">Nessun tavolo configurato.</p>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
